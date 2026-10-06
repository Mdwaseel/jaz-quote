"""Quotation approval engine.

Ties together: quotation data + approval state + user hierarchy + permission
rules (``rules``) + versions + audit history. Views stay thin and call these
functions; every authorisation decision is made here, server-side.
"""
import base64
import re
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from accounts import hierarchy as H
from accounts.models import User

from . import rules
from .models import (
    ApprovalRequest as AR,
    ApprovalStep as AS,
    Customer,
    Quotation as Q,
    QuotationEvent,
    QuotationVersion,
)
from .notify import notify
from .pricing import additional_for_effective, compute_financials, normalize_items

FIELD_CATEGORIES = [AR.DISCOUNT, AR.WARRANTY, AR.AMC, AR.PAYMENT_TERMS]
CATEGORY_LABEL = dict(AR.CATEGORY_CHOICES)
STATUS_LABEL = dict(Q.WORKFLOW_CHOICES)
DOWNLOADABLE = {Q.APPROVED, Q.DOWNLOADED, Q.EDIT_REQUESTED}


class WorkflowError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _role(user):
    return H.effective_role(user)


def _f(v):
    return float(v or 0)


# ====================================================================== visibility
def visible_user_ids(user):
    """None = everything (Admin); otherwise self + everyone below in the tree."""
    if H.is_admin(user):
        return None
    return [user.id] + H.descendant_ids(user)


def visible_quotes(user):
    qs = Q.objects.all()
    ids = visible_user_ids(user)
    if ids is not None:
        qs = qs.filter(created_by_id__in=ids)
    return qs


def can_view(user, quote):
    ids = visible_user_ids(user)
    if ids is None or quote.created_by_id in ids:
        return True
    # A reassigned / fallback approver outside the subtree still needs to see it.
    return AS.objects.filter(request__quotation=quote, assigned_to=user).exists()


def get_quote_for(user, number):
    quote = Q.objects.select_related("customer", "created_by").filter(quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    return quote


# ====================================================================== audit
def log(quote, actor, action, *, field="", prev=None, new=None, note="", status=None):
    QuotationEvent.objects.create(
        quotation=quote, version_number=quote.current_version, actor=actor,
        actor_role=_role(actor) if actor else "", action=action, field=field,
        previous_value=prev, new_value=new, note=note or "",
        status=status or quote.workflow_status,
    )


# ====================================================================== signatures
SIGNATURE_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$")
MAX_SIGNATURE_BYTES = 600_000
SIGNATURE_FIELDS = {"customer": ("CustomerSign", "Customer signature"),
                    "signatory": ("SignatorySign", "Authorised signatory signature")}


def clean_signature(value, label):
    """'' or a validated data:image/(png|jpeg|webp);base64 URL (drawn or uploaded)."""
    value = (value or "").strip()
    if not value:
        return ""
    m = SIGNATURE_RE.match(value)
    if not m:
        raise WorkflowError(f"{label} must be a PNG, JPG or WebP image.")
    try:
        raw = base64.b64decode(m.group(2), validate=True)
    except ValueError:
        raise WorkflowError(f"{label} image is damaged — please upload it again.")
    if len(raw) > MAX_SIGNATURE_BYTES:
        raise WorkflowError(f"{label} image is too large (max 600 KB).")
    return value


def _clean_sales(sales):
    sales = dict(sales or {})
    for key, label in SIGNATURE_FIELDS.values():
        sales[key] = clean_signature(sales.get(key), label)
    # The customer's signature only ever comes from e-signature / onsite signing
    # (quotes.esign) and belongs to one version — a new/edited version starts unsigned.
    sales["CustomerSign"] = ""
    return sales


# ====================================================================== payload → data
PROJECT_TEXT = {"Package": 160, "Configuration": 20, "Tier": 60, "Room": 160, "ProjectType": 80,
                "ConstructionStage": 60, "RoomLength": 10, "RoomWidth": 10, "RoomHeight": 10, "Seats": 10,
                "Rows": 10, "Screen": 120, "Notes": 1000}


def clean_product(product):
    """Project + BOQ payload → stored ProductInfo (text trimmed, lists bounded).
    BOQ lines are validated separately by pricing.normalize_items."""
    product = product if isinstance(product, dict) else {}
    out = {k: str(product.get(k) or "").strip()[:n] for k, n in PROJECT_TEXT.items()}
    pid = product.get("PackageId")
    out["PackageId"] = int(pid) if str(pid or "").isdigit() else None

    def rows(key, limit=40):
        val = product.get(key) if isinstance(product.get(key), list) else []
        return [{"Label": str(r.get("Label") or "").strip()[:80], "Value": str(r.get("Value") or "").strip()[:400]}
                for r in val[:limit] if isinstance(r, dict) and (r.get("Label") or r.get("Value"))]

    out["Spec"] = rows("Spec")
    out["Finishes"] = rows("Finishes")
    scope = product.get("Scope") if isinstance(product.get("Scope"), list) else []
    out["Scope"] = [str(x).strip()[:300] for x in scope[:60] if str(x or "").strip()]
    return out


def normalize(role, d):
    """Validate a builder payload and compute authoritative pricing."""
    product = clean_product(d.get("ProductInfo"))
    try:
        items = normalize_items((d.get("ProductInfo") or {}).get("Items"))
    except rules.RuleError as e:
        raise WorkflowError(str(e))
    base_fin = compute_financials(product, 0, items=items)
    if not base_fin["priced"]:
        raise WorkflowError("Add at least one priced item to the BOQ.")

    if d.get("DiscountPercent") not in (None, ""):
        pct = rules.dec(d.get("DiscountPercent"), "discount")
    elif rules.dec(d.get("SpecialCost"), "special cost") > 0:  # rupee rebate → %
        pct = rules.dec(d.get("SpecialCost")) / base_fin["quoted"] * 100
    else:
        pct = Decimal(0)
    pct = pct.quantize(Decimal("0.000001"))  # exact to the rupee when a ₹ discount was typed
    if pct < 0 or pct > 100:
        raise WorkflowError("Discount must be between 0% and 100%.")
    fin = compute_financials(product, pct, items=items)
    try:
        rules.get_discount_approval_path(role, fin["effective_percent"])  # range validation
        warranty = rules.normalize_warranty(d.get("WarrentyDetails"))
        amc = rules.normalize_amc(d.get("Amc"), role)
        terms = rules.normalize_terms(d.get("PaymentTerms")) or rules.default_terms(role)
    except rules.RuleError as e:
        raise WorkflowError(str(e))

    return {
        "customer": {
            "name": (d.get("CustomerName") or "").strip(), "mobile": d.get("CustomerMobile") or "",
            "email": d.get("CustomerEmail") or "", "address": d.get("CustomerAddress") or "",
            "address2": d.get("CustomerAddress2") or "", "landmark": d.get("LandMark") or "",
            "city": d.get("CityName") or "", "state": d.get("StateName") or "",
            "country": d.get("CountryName") or "India", "zipcode": str(d.get("ZipCode") or ""),
        },
        "product": product,
        "sales": _clean_sales(d.get("SalesInfo")),
        "discount_percent": fin["effective_percent"],
        "additional_percent": pct,
        "warranty": [{"Duration": _f(v), "TypeOfParts": k} for k, v in warranty.items()],
        "amc": [{"Duration": _f(v), "AmcType": k} for k, v in amc.items()],
        "payment_terms": terms,
        "fin": fin,
    }


def _rules_input(data):
    return {"discount_percent": data["discount_percent"], "warranty": data["warranty"],
            "amc": data["amc"], "payment_terms": data["payment_terms"]}


def _apply(quote, data):
    c = quote.customer
    for k, v in data["customer"].items():
        setattr(c, k, v)
    c.save()
    apply_financials(quote, dict(data["product"]), data["fin"])
    quote.sales_info = data["sales"]
    quote.payment_terms, quote.warranty_details, quote.amc_details = data["payment_terms"], data["warranty"], data["amc"]


def package_title(p):
    if p.get("Package"):
        return p["Package"]
    return f"{p['Configuration']} Home Theatre" if p.get("Configuration") else "Custom Home Theatre"


def apply_financials(quote, p, fin):
    """Store the server-computed BOQ + totals on the quotation (never client totals)."""
    p["Items"] = fin["items"]
    p["AdditionalDiscountPercent"] = float(fin["additional_percent"])
    p["Package"] = package_title(p)
    quote.product_info = p
    quote.package, quote.configuration = p["Package"][:160], (p.get("Configuration") or "")[:20]
    quote.tier, quote.room = (p.get("Tier") or "")[:60], (p.get("Room") or "")[:160]
    quote.base_amount, quote.discount_percent = fin["list"], fin["effective_percent"]
    quote.special_cost, quote.exclude_tax = fin["discount"], fin["exclude"]
    quote.tax, quote.include_tax = fin["tax"], fin["include"]


def financials_block(fin, amc_items=None):
    """API shape of a pricing result (shared by the builder's live evaluation and saved quotes)."""
    net = _f(fin["exclude"])
    return {
        "BaseAmount": _f(fin["list"]), "QuotedAmount": _f(fin["quoted"]), "PriceAdjustment": _f(fin["adjustment"]),
        "AdditionalDiscountPercent": _f(fin["additional_percent"]),
        "AdditionalDiscountAmount": _f(fin["additional_discount"]),
        "DiscountPercent": _f(fin["effective_percent"]), "DiscountAmount": _f(fin["discount"]),
        "NetAmount": net, "Tax": _f(fin["tax"]), "FinalAmount": _f(fin["include"]), "GstRates": fin["gst_rates"],
        "OptionalAmount": _f(fin["optional_total"]), "OptionalCount": fin["optional_count"],
        "ItemCount": fin["item_count"], "Categories": fin["categories"],
        "AmcAnnual": {a.get("AmcType"): round(net * _f(a.get("Duration")) / 100)
                      for a in (amc_items or []) if a.get("AmcType")},
    }


def quote_fin(quote):
    """Recompute the breakdown from the BOQ stored on the quotation (prices as saved)."""
    p = quote.product_info or {}
    return compute_financials(p, p.get("AdditionalDiscountPercent") or 0, items=p.get("Items") or [])


def financials(quote):
    block = financials_block(quote_fin(quote), quote.amc_details)
    # The stored totals are authoritative.
    block.update({"BaseAmount": _f(quote.base_amount), "DiscountPercent": _f(quote.discount_percent),
                  "DiscountAmount": _f(quote.special_cost), "NetAmount": _f(quote.exclude_tax),
                  "Tax": _f(quote.tax), "FinalAmount": _f(quote.include_tax)})
    return block


def snapshot(quote):
    c = quote.customer
    return {
        "customer": {"name": c.name, "mobile": c.mobile, "email": c.email, "address": c.address,
                     "address2": c.address2, "city": c.city, "state": c.state, "zipcode": c.zipcode},
        "product_info": quote.product_info, "sales_info": quote.sales_info,
        "payment_terms": quote.payment_terms, "warranty_details": quote.warranty_details,
        "amc_details": quote.amc_details, "financials": financials(quote),
    }


def _cat_value(quote, cat):
    """Comparable value of one approval-sensitive parameter (for carry-over checks)."""
    if cat == AR.DISCOUNT:
        return {"percent": _f(quote.discount_percent), "base": _f(quote.base_amount)}
    if cat == AR.WARRANTY:
        return {w["TypeOfParts"]: _f(w["Duration"]) for w in quote.warranty_details or []}
    if cat == AR.AMC:
        return {a["AmcType"]: _f(a["Duration"]) for a in quote.amc_details or []}
    if cat == AR.PAYMENT_TERMS:
        return [[n, _f(v)] for n, v in rules._terms_key(quote.payment_terms or [])]
    return None


def _display_value(quote, cat):
    if cat == AR.DISCOUNT:
        return {"percent": _f(quote.discount_percent), "amount": _f(quote.special_cost),
                "base": _f(quote.base_amount), "final": _f(quote.include_tax)}
    if cat == AR.PAYMENT_TERMS:
        return quote.payment_terms
    return _cat_value(quote, cat)


def _standard_display(role, cat, req):
    if cat == AR.DISCOUNT:
        return {"percent": req.get("standard") or 0}
    if cat == AR.WARRANTY:
        return {p: req["standard"] for p in rules.WARRANTY_PARTS}
    return req.get("standard")


# ====================================================================== chain resolution
def resolve_steps(creator, path):
    """Map a role path onto real people from the creator's own reporting chain."""
    out = []
    for role in path:
        u = H.resolve_approver(creator, role)
        if u is None:
            raise WorkflowError(
                f"No {role} is assigned in your reporting hierarchy. Ask an Admin to set up your reporting manager."
            )
        eff = _role(u)
        step_role = role if eff == role else eff
        if out and out[-1][1].id == u.id:
            continue  # the same person decides once
        out.append((step_role, u))
    return out


def _pending_step(req):
    return next((s for s in req.steps.all() if s.status == AS.PENDING), None)


def _create_request(quote, requester, cat, path, reason, existing, requested, outside_limit=False):
    role = _role(requester)
    steps = resolve_steps(quote.created_by or requester, path)
    req = AR.objects.create(
        quotation=quote, version_number=quote.current_version, category=cat,
        requested_by=requester, requested_by_role=role, reason=reason,
        existing_value=existing, requested_value=requested, outside_limit=outside_limit,
    )
    for i, (step_role, u) in enumerate(steps):
        AS.objects.create(request=req, order=i, role=step_role, assigned_to=u,
                          status=AS.PENDING if i == 0 else AS.WAITING)
    label = CATEGORY_LABEL[cat]
    log(quote, requester, f"{label} Requested", field=cat, prev=existing, new=requested, note=reason)
    first_role, first = steps[0]
    log(quote, requester, f"Submitted to {first_role}", field=cat, note=f"Assigned to {first.name}")
    chain = " → ".join(r for r, _ in steps)
    kind = "escalated" if first_role == H.ADMIN and role != H.ADMIN and outside_limit else (
        "edit_request" if cat == AR.EDIT else "request")
    notify([first], quote, kind,
           f"{requester.name} ({role}) requested approval for {label.lower()} on quotation "
           f"{quote.quotation_number} ({quote.customer.name}).\n"
           f"Requested: {_human(cat, requested)}\nReason: {reason}\nApproval chain: {chain}\n"
           f"Final amount: Rs. {_f(quote.include_tax):,.0f}")
    return req


def _human(cat, value):
    if value is None:
        return "—"
    if cat == AR.DISCOUNT:
        return f"{value.get('percent')}% (Rs. {value.get('amount', 0):,.0f} off)"
    if cat == AR.PAYMENT_TERMS:
        return ", ".join(f"{t['TermName']} {t['TermValue']}%" for t in value)
    if cat == AR.EDIT:
        return value.get("changes") or "—"
    if isinstance(value, dict):
        return ", ".join(f"{k}: {v}" for k, v in value.items())
    return str(value)


# ====================================================================== status
def recompute_status(quote):
    if quote.workflow_status in (Q.DRAFT, Q.EDITING, Q.CANCELLED, Q.EXPIRED):
        return quote.workflow_status
    reqs = list(quote.approval_requests.filter(version_number=quote.current_version)
                .exclude(category=AR.EDIT).exclude(status=AR.CANCELLED).prefetch_related("steps"))
    if any(r.status == AR.REJECTED for r in reqs):
        status = Q.REJECTED
    elif all(r.status == AR.APPROVED for r in reqs):
        status = Q.DOWNLOADED if (quote.workflow_status == Q.DOWNLOADED and
                                  quote.approved_version == quote.current_version) else Q.APPROVED
        quote.approved_version = quote.current_version
    elif any(r.status == AR.APPROVED or any(s.status == AS.APPROVED for s in r.steps.all()) for r in reqs):
        status = Q.PARTIALLY_APPROVED
    else:
        status = Q.PENDING_APPROVAL
    if quote.approval_requests.filter(category=AR.EDIT, status=AR.PENDING).exists():
        status = Q.EDIT_REQUESTED
    quote.workflow_status = status
    quote.save(update_fields=["workflow_status", "approved_version", "updated_at"])
    return status


def _cancel_open(quote, actor, note, categories=None):
    qs = quote.approval_requests.filter(status=AR.PENDING)
    if categories:
        qs = qs.filter(category__in=categories)
    for req in qs:
        req.status, req.resolved_at = AR.CANCELLED, timezone.now()
        req.save(update_fields=["status", "resolved_at"])
        req.steps.filter(status__in=[AS.PENDING, AS.WAITING]).update(status=AS.CANCELLED)
        log(quote, actor, f"{CATEGORY_LABEL[req.category]} Request Cancelled", field=req.category, note=note)


# ====================================================================== create / edit / submit
def _next_number():
    """JAZHT-<year>-<0001…>: the template's JAZHT/2026/____ numbering (hyphens keep it URL-safe)."""
    prefix = f"JAZHT-{datetime.now().year}-"
    seq = Q.objects.filter(quotation_number__startswith=prefix).count() + 1
    while True:
        number = f"{prefix}{seq:04d}"
        if not Q.objects.filter(quotation_number=number).exists():
            return number
        seq += 1


@transaction.atomic
def create_quotation(user, d):
    role = _role(user)
    data = normalize(role, d)
    if not data["customer"]["name"]:
        raise WorkflowError("Customer name is required.")
    customer = Customer.objects.create(**data["customer"])
    quote = Q(quotation_number=_next_number(), customer=customer, created_by=user,
              created_by_role=role, workflow_status=Q.DRAFT)
    _apply(quote, data)
    quote.save()
    log(quote, user, "Quotation Created", new={"final": _f(quote.include_tax)})
    if not d.get("SaveAsDraft"):
        _submit(user, quote, data, d.get("Reasons") or {}, prev_values={})
    return quote


def edit_permission(user, quote):
    """(allowed, reason) for directly changing quotation data."""
    if quote.created_by_id != user.id:
        return False, "Only the person who created this quotation can edit it."
    st = quote.workflow_status
    if st in (Q.CANCELLED, Q.EXPIRED):
        return False, f"This quotation is {STATUS_LABEL[st].lower()}."
    if st in (Q.DRAFT, Q.EDITING, Q.REJECTED):
        return True, ""
    if _role(user) in H.LOCKED_CREATOR_ROLES:
        if st == Q.EDIT_REQUESTED:
            return False, "Locked — your edit request is awaiting RM approval."
        return False, "Locked — submitted quotations can only be changed after your RM approves an edit request."
    return True, ""


@transaction.atomic
def update_quotation(user, number, d):
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer").filter(quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    allowed, reason = edit_permission(user, quote)
    if not allowed:
        raise WorkflowError(reason, 403)
    role = _role(user)
    prev_values = {c: _cat_value(quote, c) for c in FIELD_CATEGORIES} if quote.current_version else {}
    before = {"final": _f(quote.include_tax), "discount": _f(quote.discount_percent), "product": _project_summary(quote)}
    data = normalize(role, d)
    _apply(quote, data)
    quote.save()
    after = {"final": _f(quote.include_tax), "discount": _f(quote.discount_percent), "product": _project_summary(quote)}
    for key, label in (("final", "Final Amount"), ("discount", "Discount %"), ("product", "Project / BOQ")):
        if before[key] != after[key]:
            log(quote, user, f"{label} Changed", field=key, prev=before[key], new=after[key])
    if quote.workflow_status == Q.DRAFT and d.get("SaveAsDraft"):
        log(quote, user, "Draft Saved")
        return quote
    _submit(user, quote, data, d.get("Reasons") or {}, prev_values=prev_values)
    return quote


def _project_summary(quote):
    p = quote.product_info or {}
    items = [i for i in (p.get("Items") or []) if not i.get("Optional")]
    return {"package": quote.package, "room": quote.room, "lines": len(items),
            "quoted": round(sum(_f(i.get("Qty")) * _f(i.get("UnitPrice")) for i in items))}


def _submit(user, quote, data, reasons, prev_values):
    role = _role(user)
    reqs = rules.evaluate(role, _rules_input(data))
    for r in reqs:
        if not str(reasons.get(r["category"]) or "").strip():
            raise WorkflowError(f"Please give a reason for the {CATEGORY_LABEL[r['category']].lower()} approval request.")

    prev_version = quote.current_version
    prev_approved = {
        r.category: r for r in quote.approval_requests.filter(version_number=prev_version, status=AR.APPROVED)
        .exclude(category=AR.EDIT).prefetch_related("steps")
    } if prev_version else {}
    _cancel_open(quote, user, "Superseded by a newer version of the quotation.")

    quote.current_version = prev_version + 1
    quote.created_by_role = role
    quote.submitted_at = timezone.now()
    quote.workflow_status = Q.PENDING_APPROVAL
    quote.save()
    QuotationVersion.objects.create(
        quotation=quote, number=quote.current_version, snapshot=snapshot(quote), created_by=user,
        note="Initial submission" if prev_version == 0 else f"Edited after v{prev_version}",
    )
    log(quote, user, "Quotation Submitted" if prev_version == 0 else "Quotation Re-submitted",
        new={"version": quote.current_version, "final": _f(quote.include_tax)}, status=Q.PENDING_APPROVAL)

    for r in reqs:
        cat = r["category"]
        old = prev_approved.get(cat)
        if old is not None and prev_values.get(cat) == _cat_value(quote, cat):
            _carry_over(quote, user, old)
            continue
        existing = _display_value_from_prev(prev_values, cat) if prev_values else _standard_display(role, cat, r)
        _create_request(quote, user, cat, r["path"], str(reasons.get(cat)).strip(), existing,
                        _display_value(quote, cat), outside_limit=r["outside_limit"])

    status = recompute_status(quote)
    if not reqs:
        log(quote, user, "No Approval Required — Ready for Download", status=status)
    if prev_version:
        rm = H.resolve_approver(user, H.RM) if role in H.LOCKED_CREATOR_ROLES else None
        if rm:
            notify([rm], quote, "changed",
                   f"{user.name} edited quotation {quote.quotation_number} (now v{quote.current_version}). "
                   f"Final amount: Rs. {_f(quote.include_tax):,.0f}. Status: {STATUS_LABEL[status]}.")


def _display_value_from_prev(prev_values, cat):
    v = prev_values.get(cat)
    if cat == AR.DISCOUNT and v:
        return {"percent": v["percent"]}
    if cat == AR.PAYMENT_TERMS and v:
        return [{"TermName": n, "TermValue": val} for n, val in v]
    return v


def _carry_over(quote, user, old):
    req = AR.objects.create(
        quotation=quote, version_number=quote.current_version, category=old.category,
        requested_by=old.requested_by, requested_by_role=old.requested_by_role,
        reason=old.reason, existing_value=old.existing_value, requested_value=old.requested_value,
        approved_value=old.approved_value, outside_limit=old.outside_limit,
        status=AR.APPROVED, resolved_at=timezone.now(),
    )
    for s in old.steps.all():
        AS.objects.create(request=req, order=s.order, role=s.role, assigned_to=s.assigned_to,
                          status=s.status, acted_by=s.acted_by, note=s.note, acted_at=s.acted_at)
    log(quote, user, f"{CATEGORY_LABEL[old.category]} Approval Carried Over", field=old.category,
        note=f"Unchanged since v{old.version_number}; previous approval still applies.")


# ====================================================================== approve / reject
@transaction.atomic
def act(user, request_id, action, note="", approved_percent=None):
    req = AR.objects.select_for_update(of=("self",)).select_related("quotation", "requested_by").filter(id=request_id).first()
    if req is None or not can_view(user, req.quotation):
        raise WorkflowError("Approval request not found.", 404)
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer", "created_by").get(pk=req.quotation_id)
    if req.status != AR.PENDING:
        raise WorkflowError("This request has already been resolved.", 409)
    step = req.steps.filter(status=AS.PENDING).order_by("order").first()
    if step is None:
        raise WorkflowError("This request has no pending approval step.", 409)
    if user.id in (req.requested_by_id, quote.created_by_id):
        raise WorkflowError("You cannot approve or reject your own request.", 403)
    override = step.assigned_to_id != user.id
    if override and not H.is_admin(user):
        who = step.assigned_to.name if step.assigned_to else "the assigned approver"
        raise WorkflowError(f"This request is awaiting {step.role} approval from {who}.", 403)

    note = (note or "").strip()
    label = CATEGORY_LABEL[req.category]
    role = _role(user)
    now = timezone.now()
    requester = req.requested_by

    if action == "reject":
        if not note:
            raise WorkflowError("A rejection reason is required.")
        step.status, step.acted_by, step.acted_at = AS.REJECTED, user, now
        step.note = f"[Admin override] {note}" if override else note
        step.save()
        req.steps.filter(status=AS.WAITING).update(status=AS.CANCELLED)
        req.status, req.resolved_at = AR.REJECTED, now
        req.save(update_fields=["status", "resolved_at"])
        log(quote, user, f"{label} Rejected by {role}", field=req.category, note=note, new={"stage": step.role})
        status = recompute_status(quote)
        notify([requester], quote, "edit_rejected" if req.category == AR.EDIT else "rejected",
               f"{user.name} ({role}) rejected the {label.lower()} request on {quote.quotation_number}.\n"
               f"Reason: {note}\nQuotation status: {STATUS_LABEL[status]}.")
        return req

    if action != "approve":
        raise WorkflowError("Unknown action.")

    step.status, step.acted_by, step.acted_at = AS.APPROVED, user, now
    step.note = f"[Admin override] {note}".strip() if override else note
    step.save()
    log(quote, user, f"{label} Approved by {role}", field=req.category, note=note, new={"stage": step.role})

    if approved_percent not in (None, "") and req.category == AR.DISCOUNT:
        _modify_discount(user, req, quote, approved_percent)

    # Later levels whose authority the actor already has are covered by this decision.
    lvl = H.role_level(role)
    for s in req.steps.filter(status=AS.WAITING).order_by("order"):
        if H.role_level(s.role) >= lvl:
            s.status, s.acted_by, s.acted_at = AS.APPROVED, user, now
            s.note = f"Covered by {role} approval"
            s.save()
    nxt = req.steps.filter(status=AS.WAITING).order_by("order").first()
    if nxt is not None:
        nxt.status = AS.PENDING
        nxt.save(update_fields=["status"])
        log(quote, user, f"Submitted to {nxt.role}", field=req.category,
            note=f"Assigned to {nxt.assigned_to.name if nxt.assigned_to else '—'}")
        recompute_status(quote)
        kind = "escalated" if nxt.role == H.ADMIN else "next_level"
        body = (f"The {label.lower()} request on {quote.quotation_number} was approved by {user.name} ({role}) "
                f"and now needs {nxt.role} approval.\nNote: {note or '—'}\n"
                f"Final amount: Rs. {_f(quote.include_tax):,.0f}")
        notify([nxt.assigned_to], quote, kind, body)
        notify([requester], quote, "next_level", body)
        return req

    req.status, req.resolved_at = AR.APPROVED, now
    req.save(update_fields=["status", "resolved_at"])
    if req.category == AR.EDIT:
        _cancel_open(quote, user, "Quotation unlocked for editing.", categories=FIELD_CATEGORIES)
        quote.workflow_status = Q.EDITING
        quote.save(update_fields=["workflow_status", "updated_at"])
        log(quote, user, "Quotation Unlocked for Editing", note=note, status=Q.EDITING)
        notify([requester], quote, "edit_approved",
               f"{user.name} ({role}) approved your edit request for {quote.quotation_number}. "
               f"Editing is enabled.\nNote: {note or '—'}")
        return req
    status = recompute_status(quote)
    notify([requester], quote, "approved",
           f"{user.name} ({role}) approved the {label.lower()} request on {quote.quotation_number}.\n"
           f"Note: {note or '—'}\nQuotation status: {STATUS_LABEL[status]}.")
    if status == Q.APPROVED:
        log(quote, user, "All Approvals Complete — Ready for Download", status=status)
        notify([quote.created_by], quote, "downloadable",
               f"All approvals for {quote.quotation_number} are complete. The quotation can now be downloaded.\n"
               f"Final amount: Rs. {_f(quote.include_tax):,.0f}")
    return req


def _modify_discount(user, req, quote, approved_percent):
    try:
        new_pct = rules.dec(approved_percent, "approved discount").quantize(Decimal("0.01"))
    except rules.RuleError as e:
        raise WorkflowError(str(e))
    old_pct = Decimal(str(quote.discount_percent))
    if new_pct < 0 or new_pct >= old_pct:
        raise WorkflowError("An approved discount must be lower than the requested discount.")
    old_final = _f(quote.include_tax)
    p = dict(quote.product_info or {})
    items = p.get("Items") or []
    additional = additional_for_effective(p, new_pct, items=items)
    if additional is None:
        raise WorkflowError(
            f"The BOQ line prices alone are already more than {new_pct}% below list. "
            "Reject the request so the line prices can be revised.")
    fin = compute_financials(p, additional, items=items)
    apply_financials(quote, p, fin)
    old_version = quote.current_version
    quote.current_version = old_version + 1
    quote.save()
    QuotationVersion.objects.create(quotation=quote, number=quote.current_version, snapshot=snapshot(quote),
                                    created_by=user, note=f"Discount changed {old_pct}% → {new_pct}% by approver")
    # The other parameters are unchanged, so their requests move to the new version.
    quote.approval_requests.filter(version_number=old_version).exclude(status=AR.CANCELLED).update(
        version_number=quote.current_version)
    req.version_number = quote.current_version
    req.approved_value = _display_value(quote, AR.DISCOUNT)
    creator_role = quote.created_by_role or req.requested_by_role
    new_path = rules.get_discount_approval_path(creator_role, new_pct)
    req.outside_limit = rules.discount_outside_limit(creator_role, new_pct)
    req.save(update_fields=["approved_value", "outside_limit", "version_number"])
    for s in req.steps.filter(status=AS.WAITING):
        if s.role not in new_path:
            s.status, s.note = AS.SKIPPED, f"Not required at {new_pct}%"
            s.save(update_fields=["status", "note"])
    log(quote, user, "Discount Modified by Approver", field=AR.DISCOUNT,
        prev={"percent": _f(old_pct), "final": old_final},
        new={"percent": _f(new_pct), "final": _f(quote.include_tax)})


# ====================================================================== edit requests
@transaction.atomic
def request_edit(user, number, reason, changes=""):
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer").filter(quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    if quote.created_by_id != user.id:
        raise WorkflowError("Only the creator can request an edit.", 403)
    if _role(user) not in H.LOCKED_CREATOR_ROLES:
        raise WorkflowError("You can edit this quotation directly.")
    st = quote.workflow_status
    if st in (Q.DRAFT, Q.EDITING, Q.REJECTED):
        raise WorkflowError("This quotation is already editable.")
    if st == Q.EDIT_REQUESTED:
        raise WorkflowError("An edit request is already pending.", 409)
    if st in (Q.CANCELLED, Q.EXPIRED):
        raise WorkflowError(f"This quotation is {STATUS_LABEL[st].lower()}.")
    reason = (reason or "").strip()
    if not reason:
        raise WorkflowError("Please give a reason for the edit request.")
    req = _create_request(quote, user, AR.EDIT, rules.EDIT_PATH, reason,
                          {"status": STATUS_LABEL[st], "final": _f(quote.include_tax)},
                          {"changes": (changes or "").strip()})
    recompute_status(quote)
    return req


# ====================================================================== signatures after submission
@transaction.atomic
def set_signature(user, number, kind, image):
    """Add / replace / remove a signature on a submitted quotation (e.g. the customer
    signs after receiving it). Pricing and approvals are unaffected; it is audited."""
    if kind not in SIGNATURE_FIELDS:
        raise WorkflowError("Unknown signature type.")
    quote = Q.objects.select_for_update(of=("self",)).filter(quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    if quote.workflow_status in (Q.CANCELLED, Q.EXPIRED):
        raise WorkflowError(f"This quotation is {STATUS_LABEL[quote.workflow_status].lower()}.")
    key, label = SIGNATURE_FIELDS[kind]
    image = clean_signature(image, label)
    if kind == "customer" and image:
        raise WorkflowError("Customer signatures are collected by e-signature or onsite signing.")
    had = bool((quote.sales_info or {}).get(key))
    quote.sales_info = {**(quote.sales_info or {}), key: image}
    quote.save(update_fields=["sales_info", "updated_at"])
    action = f"{label} {'Removed' if not image else 'Replaced' if had else 'Added'}"
    log(quote, user, action, field="SIGNATURE")
    return quote


# ====================================================================== other lifecycle actions
def download_state(user, quote):
    """(allowed, reason) for downloading the customer PDF."""
    if not can_view(user, quote):
        return False, "Not permitted."
    st = quote.workflow_status
    if st == Q.DRAFT:
        return False, "Draft — submit the quotation first."
    if st == Q.EDITING:
        return False, "Editing in progress — re-submit the quotation first."
    if st in (Q.CANCELLED, Q.EXPIRED):
        return False, f"{STATUS_LABEL[st]}."
    if st == Q.REJECTED:
        return False, "Approval rejected — revise and re-submit."
    if st in DOWNLOADABLE and quote.approved_version == quote.current_version:
        return True, ""
    return False, pending_label(quote) or "Approval required."


def pending_label(quote):
    parts = []
    for req in quote.approval_requests.filter(status=AR.PENDING).prefetch_related("steps__assigned_to"):
        s = _pending_step(req)
        if s:
            who = f" ({s.assigned_to.name})" if s.assigned_to else ""
            parts.append(f"Pending {s.role} Approval{who} — {CATEGORY_LABEL[req.category]}")
    return "; ".join(parts)


@transaction.atomic
def record_download(user, quote):
    log(quote, user, "Quotation Downloaded", new={"version": quote.current_version, "final": _f(quote.include_tax)})
    if quote.workflow_status == Q.APPROVED:
        quote.workflow_status = Q.DOWNLOADED
        quote.save(update_fields=["workflow_status", "updated_at"])
    creator = quote.created_by
    targets = [creator] if creator and creator.id != user.id else []
    if creator and creator.id == user.id and _role(creator) in H.LOCKED_CREATOR_ROLES:
        targets.append(H.resolve_approver(creator, H.RM))
    notify(targets, quote, "downloaded",
           f"{user.name} downloaded quotation {quote.quotation_number} (v{quote.current_version}, "
           f"Rs. {_f(quote.include_tax):,.0f}).")


@transaction.atomic
def cancel_quotation(user, quote):
    if quote.created_by_id != user.id and not H.is_admin(user):
        raise WorkflowError("Only the creator or an Admin can cancel this quotation.", 403)
    _cancel_open(quote, user, "Quotation cancelled.")
    quote.workflow_status, quote.status = Q.CANCELLED, "Inactive"
    quote.save(update_fields=["workflow_status", "status", "updated_at"])
    log(quote, user, "Quotation Cancelled", status=Q.CANCELLED)


@transaction.atomic
def reassign_step(admin, step_id, user_id, note=""):
    if not H.is_admin(admin):
        raise WorkflowError("Admin access required.", 403)
    step = AS.objects.select_related("request__quotation").filter(id=step_id).first()
    if step is None or step.status not in (AS.PENDING, AS.WAITING) or step.request.status != AR.PENDING:
        raise WorkflowError("Only open approval steps can be reassigned.")
    new = User.objects.filter(id=user_id, is_active=True).first()
    if new is None:
        raise WorkflowError("Choose an active user.")
    quote = step.request.quotation
    if new.id in (step.request.requested_by_id, quote.created_by_id):
        raise WorkflowError("An approval cannot be assigned to the person who requested it.")
    if H.role_level(_role(new)) > H.role_level(step.role):
        raise WorkflowError(f"{new.name} does not have {step.role} authority.")
    old = step.assigned_to
    step.assigned_to = new
    step.save(update_fields=["assigned_to"])
    log(quote, admin, "Approval Reassigned", field=step.request.category,
        prev={"stage": step.role, "user": old.name if old else None}, new={"user": new.name}, note=note)
    if step.status == AS.PENDING:
        notify([new], quote, "reassigned",
               f"{admin.name} (Admin) reassigned a {CATEGORY_LABEL[step.request.category].lower()} approval on "
               f"{quote.quotation_number} to you (stage: {step.role}).")
    return step


def escalate_for_inactive(user, actor):
    """Re-route open steps assigned to a deactivated user up the requester's chain."""
    moved = 0
    steps = AS.objects.filter(assigned_to=user, status__in=[AS.PENDING, AS.WAITING],
                              request__status=AR.PENDING).select_related("request__quotation__created_by")
    for step in steps:
        quote = step.request.quotation
        creator = quote.created_by
        new = H.resolve_approver(creator, step.role) if creator else None
        if new is None or new.id == user.id:
            admins = [u for u in User.objects.filter(is_active=True) if H.is_admin(u)]
            notify(admins, quote, "needs_reassign",
                   f"{user.name} was deactivated and has an open {step.role} approval on {quote.quotation_number}. "
                   f"Please reassign it from All Approvals.")
            continue
        step.assigned_to = new
        step.save(update_fields=["assigned_to"])
        moved += 1
        log(quote, actor, "Approval Escalated", field=step.request.category,
            prev={"user": user.name}, new={"user": new.name, "stage": step.role},
            note=f"{user.name} was deactivated.")
        if step.status == AS.PENDING:
            notify([new], quote, "reassigned",
                   f"An open {step.role} approval on {quote.quotation_number} was escalated to you "
                   f"because {user.name} was deactivated.")
    return moved


# ====================================================================== serialisation
def _user_ref(u):
    if u is None:
        return None
    return {"Id": u.id, "Name": u.name, "Role": _role(u), "Active": u.is_active}


def serialize_request(req, include_quote=False, viewer=None):
    steps = list(req.steps.all())
    requester_role = req.requested_by_role or ""
    ladder = [{"Role": requester_role, "Name": req.requested_by.name if req.requested_by else "",
               "Status": "SUBMITTED"}]
    by_role = {s.role: s for s in steps}
    for role in (H.RM, H.RSD, H.DIRECTOR, H.ADMIN):
        if H.role_level(role) >= H.role_level(requester_role):
            continue
        s = by_role.get(role)
        if s is None:
            if role != H.DIRECTOR:
                ladder.append({"Role": role, "Name": None, "Status": "NOT_REQUIRED"})
            continue
        ladder.append({"Role": role, "Name": s.assigned_to.name if s.assigned_to else None, "Status": s.status,
                       "Note": s.note, "ActedBy": s.acted_by.name if s.acted_by else None,
                       "ActedAt": s.acted_at.isoformat() if s.acted_at else None})
    pending = next((s for s in steps if s.status == AS.PENDING), None)
    out = {
        "Id": req.id, "Category": req.category, "CategoryLabel": CATEGORY_LABEL[req.category],
        "Status": req.status, "VersionNumber": req.version_number, "Reason": req.reason,
        "ExistingValue": req.existing_value, "RequestedValue": req.requested_value,
        "ApprovedValue": req.approved_value, "OutsideLimit": req.outside_limit,
        "RequestedBy": _user_ref(req.requested_by), "RequestedByRole": requester_role,
        "CreatedAt": req.created_at.isoformat(), "ResolvedAt": req.resolved_at.isoformat() if req.resolved_at else None,
        "CurrentStage": pending.role if pending else None,
        "CurrentApprover": _user_ref(pending.assigned_to) if pending else None,
        "Steps": [{
            "Id": s.id, "Order": s.order, "Role": s.role, "AssignedTo": _user_ref(s.assigned_to),
            "Status": s.status, "ActedBy": _user_ref(s.acted_by), "Note": s.note,
            "ActedAt": s.acted_at.isoformat() if s.acted_at else None,
        } for s in steps],
        "Ladder": ladder,
    }
    if viewer is not None:
        out["CanAct"] = bool(
            pending and req.status == AR.PENDING
            and viewer.id not in (req.requested_by_id, req.quotation.created_by_id)
            and (pending.assigned_to_id == viewer.id or H.is_admin(viewer))
        )
    if include_quote:
        q = req.quotation
        creator = q.created_by
        out["Quotation"] = {
            "QuotationNumber": q.quotation_number, "CustomerName": q.customer.name,
            "CreatedBy": _user_ref(creator), "CreatedByRole": q.created_by_role,
            "Hierarchy": H.chain_summary(creator) if creator else [],
            "WorkflowStatus": q.workflow_status, "WorkflowLabel": STATUS_LABEL[q.workflow_status],
            "CurrentVersion": q.current_version, "Package": q.package, "Configuration": q.configuration,
            "Room": q.room, "Tier": q.tier,
            "Financials": financials(q),
        }
    return out


def quote_state(user, quote):
    """Workflow block embedded in the quotation detail response."""
    can_dl, dl_reason = download_state(user, quote)
    can_edit, edit_reason = edit_permission(user, quote)
    is_creator = quote.created_by_id == user.id
    creator_role = quote.created_by_role or (_role(quote.created_by) if quote.created_by else "")
    reqs = quote.approval_requests.select_related("requested_by", "quotation").prefetch_related(
        "steps__assigned_to", "steps__acted_by")
    current = [serialize_request(r, viewer=user) for r in reqs if r.version_number == quote.current_version
               or (r.category == AR.EDIT and r.status == AR.PENDING)]
    locked = quote.workflow_status not in (Q.DRAFT, Q.EDITING) and creator_role in H.LOCKED_CREATOR_ROLES
    return {
        "WorkflowStatus": quote.workflow_status, "WorkflowLabel": STATUS_LABEL[quote.workflow_status],
        "CurrentVersion": quote.current_version, "ApprovedVersion": quote.approved_version,
        "CreatedBy": _user_ref(quote.created_by), "CreatedByRole": creator_role,
        "Hierarchy": H.chain_summary(quote.created_by) if quote.created_by else [],
        "IsLocked": locked, "Financials": financials(quote),
        "PendingLabel": pending_label(quote),
        "Permissions": {
            "canEdit": can_edit, "editBlockedReason": edit_reason,
            "canRequestEdit": is_creator and creator_role in H.LOCKED_CREATOR_ROLES and quote.workflow_status in (
                Q.PENDING_APPROVAL, Q.PARTIALLY_APPROVED, Q.APPROVED, Q.DOWNLOADED),
            "canDownload": can_dl, "downloadBlockedReason": dl_reason,
            "canCancel": (is_creator or H.is_admin(user)) and quote.workflow_status not in (Q.CANCELLED,),
            "canConfirm": can_dl and quote.status == "Pending",
        },
        "Approvals": current,
    }
