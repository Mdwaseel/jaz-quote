"""Deal outcome (done / not done + reason) and the win/loss analysis for managers."""
from collections import Counter, OrderedDict, defaultdict
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from accounts import hierarchy as H

from .models import Quotation as Q
from .notify import notify
from .workflow import WorkflowError, can_view, download_state, log, visible_quotes

# Why deals are lost — a fixed list so the reasons can be analysed.
LOST_REASONS = [
    "Price too high",
    "Chose a competitor",
    "Project delayed / on hold",
    "Budget not approved",
    "Customer not responding",
    "Room / site not ready",
    "Specification / brand mismatch",
    "Delivery timeline too long",
    "Payment terms not acceptable",
    "Other",
]


@transaction.atomic
def set_outcome(user, number, outcome, reason="", note=""):
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer", "created_by").filter(
        quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    if quote.workflow_status in (Q.CANCELLED, Q.DRAFT):
        raise WorkflowError("Submit the quotation before recording the deal outcome.")
    reason, note = (reason or "").strip(), (note or "").strip()
    before = quote.deal_status
    if outcome == Q.DEAL_WON:
        allowed, why = download_state(user, quote)
        if not allowed:
            raise WorkflowError(f"A deal can be marked done once the quotation is approved — {why}")
        quote.deal_status, quote.deal_reason, quote.deal_note = Q.DEAL_WON, "", note
        quote.status = "Confirmed"
        action = "Deal Done"
    elif outcome == Q.DEAL_LOST:
        if reason not in LOST_REASONS:
            raise WorkflowError("Choose why the deal was not done.")
        if reason == "Other" and not note:
            raise WorkflowError("Please describe the reason.")
        quote.deal_status, quote.deal_reason, quote.deal_note = Q.DEAL_LOST, reason, note
        quote.status = "Lost"
        action = "Deal Not Done"
    elif outcome == Q.DEAL_OPEN:
        if quote.created_by_id != user.id and not H.is_admin(user) and H.effective_role(user) not in (
                H.DIRECTOR, H.RSD, H.RM):
            raise WorkflowError("Only the creator or a manager can reopen a deal.", 403)
        quote.deal_status, quote.deal_reason, quote.deal_note = Q.DEAL_OPEN, "", ""
        quote.status = "Pending"
        action = "Deal Reopened"
    else:
        raise WorkflowError("Unknown outcome.")
    quote.deal_closed_at = timezone.now() if outcome != Q.DEAL_OPEN else None
    quote.deal_closed_by = user if outcome != Q.DEAL_OPEN else None
    quote.save()
    log(quote, user, action, field="DEAL", prev={"deal": before},
        new={"deal": quote.deal_status, **({"reason": reason} if reason else {})}, note=note)
    if outcome != Q.DEAL_OPEN and quote.created_by:
        rm = H.resolve_approver(quote.created_by, H.RM)
        targets = [t for t in (quote.created_by, rm) if t and t.id != user.id]
        verdict = "was marked as done" if outcome == Q.DEAL_WON else f"was marked as not done — {reason}"
        notify(targets, quote, "deal", f"The deal for {quote.quotation_number} ({quote.customer.name}) {verdict} "
                                       f"by {user.name}.{(' Note: ' + note) if note else ''}")
    return quote


def analysis(user, days=0):
    """Win/loss analysis over the quotations this user can see."""
    since = timezone.now() - timedelta(days=days) if days else None
    qs = visible_quotes(user).exclude(workflow_status__in=[Q.DRAFT, Q.CANCELLED]).select_related(
        "customer", "created_by")
    quotes = [q for q in qs if since is None or (q.deal_closed_at or q.created_at) >= since]
    val = lambda q: float(q.include_tax or 0)  # noqa: E731
    won = [q for q in quotes if q.deal_status == Q.DEAL_WON]
    lost = [q for q in quotes if q.deal_status == Q.DEAL_LOST]
    open_ = [q for q in quotes if q.deal_status == Q.DEAL_OPEN]
    decided = len(won) + len(lost)

    reasons = Counter(q.deal_reason or "Other" for q in lost)
    reason_value = defaultdict(float)
    for q in lost:
        reason_value[q.deal_reason or "Other"] += val(q)
    by_reason = [{"Reason": r, "Count": c, "Value": round(reason_value[r]), "Pct": round(c * 100 / len(lost))}
                 for r, c in reasons.most_common()]

    people = defaultdict(lambda: {"Won": 0, "Lost": 0, "Open": 0, "WonValue": 0.0, "Reasons": Counter()})
    for q in quotes:
        who = q.created_by
        key = (who.name if who else "Unassigned", H.effective_role(who) if who else "")
        p = people[key]
        if q.deal_status == Q.DEAL_WON:
            p["Won"] += 1
            p["WonValue"] += val(q)
        elif q.deal_status == Q.DEAL_LOST:
            p["Lost"] += 1
            p["Reasons"][q.deal_reason or "Other"] += 1
        else:
            p["Open"] += 1
    by_person = sorted([{
        "Name": name, "Role": role, "Won": p["Won"], "Lost": p["Lost"], "Open": p["Open"],
        "Total": p["Won"] + p["Lost"] + p["Open"], "WonValue": round(p["WonValue"]),
        "WinRate": round(p["Won"] * 100 / (p["Won"] + p["Lost"])) if p["Won"] + p["Lost"] else None,
        "TopReason": p["Reasons"].most_common(1)[0][0] if p["Reasons"] else None,
    } for (name, role), p in people.items()], key=lambda r: (-r["Total"], r["Name"]))

    by_model = defaultdict(lambda: {"Won": 0, "Lost": 0})
    for q in won + lost:
        by_model[q.package or "Other"]["Won" if q.deal_status == Q.DEAL_WON else "Lost"] += 1

    now = timezone.now()
    months = OrderedDict()
    for i in range(5, -1, -1):
        y, m = divmod(now.year * 12 + now.month - 1 - i, 12)
        months[(y, m + 1)] = {"Label": datetime(y, m + 1, 1).strftime("%b"), "Won": 0, "Lost": 0}
    for q in won + lost:
        d = q.deal_closed_at
        if d and (d.year, d.month) in months:
            months[(d.year, d.month)]["Won" if q.deal_status == Q.DEAL_WON else "Lost"] += 1

    recent_lost = sorted(lost, key=lambda q: q.deal_closed_at or q.created_at, reverse=True)[:25]
    return {
        "Totals": {
            "Quotations": len(quotes), "Open": len(open_), "Won": len(won), "Lost": len(lost),
            "WinRate": round(len(won) * 100 / decided) if decided else None,
            "WonValue": round(sum(map(val, won))), "LostValue": round(sum(map(val, lost))),
            "OpenValue": round(sum(map(val, open_))),
        },
        "Reasons": by_reason,
        "People": by_person,
        "Packages": [{"Package": k, **v} for k, v in sorted(by_model.items(), key=lambda kv: -(kv[1]["Won"] + kv[1]["Lost"]))],
        "Months": list(months.values()),
        "RecentLost": [{
            "QuotationNumber": q.quotation_number, "CustomerName": q.customer.name,
            "Owner": q.created_by.name if q.created_by else "", "Reason": q.deal_reason, "Note": q.deal_note,
            "Value": val(q), "ClosedAt": (q.deal_closed_at or q.updated_at).isoformat(), "Package": q.package,
        } for q in recent_lost],
        "LostReasons": LOST_REASONS,
    }
