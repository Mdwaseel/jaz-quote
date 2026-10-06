from collections import OrderedDict
from datetime import datetime

from django.db.models import Count, Sum

from common.api import api, ok
from quotes.workflow import visible_quotes


@api(methods=("GET",))
def modelwise_quotation_count(request):
    qs = (
        visible_quotes(request.auth_user).exclude(status="Inactive")
        .values("package")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    return ok([{"product": r["package"] or "Custom", "count": r["count"]} for r in qs], 200)


def _initials(name):
    parts = [p for p in (name or "").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _month_key(dt):
    return dt.year * 12 + (dt.month - 1)


def _last_n_months(n):
    """Return list of (key, 'Mon') for the last n calendar months, oldest first."""
    now = datetime.now()
    base = now.year * 12 + (now.month - 1)
    out = []
    for i in range(n - 1, -1, -1):
        k = base - i
        month = k % 12
        label = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month]
        out.append((k, label))
    return out


def _pct_change(curr, prev):
    if not prev:
        return 0
    return round((curr - prev) / prev * 100)


@api(methods=("GET",))
def sales_overview(request):
    """Aggregated BDM dashboard metrics derived from quotation data."""
    # Scoped to the user's own hierarchy (Admin: everything).
    active = visible_quotes(request.auth_user).exclude(status="Inactive")
    confirmed = active.filter(status="Confirmed")

    def val(q):
        return float(q.include_tax or q.exclude_tax or 0)

    # --- Team total (confirmed revenue) ---
    team_total = float(confirmed.aggregate(v=Sum("include_tax"))["v"] or 0)

    # --- Attainment by rep (confirmed revenue, top 8) ---
    rep_rev = {}
    for q in confirmed.select_related("created_by"):
        name = (q.created_by.name if q.created_by else "Unassigned")
        rep_rev[name] = rep_rev.get(name, 0) + val(q)
    attainment = sorted(
        [{"name": n, "initials": _initials(n), "value": v} for n, v in rep_rev.items()],
        key=lambda r: r["value"], reverse=True,
    )[:8]

    # --- Revenue mix (confirmed revenue by investment level, else package) ---
    model_rev = {}
    for q in confirmed:
        key = q.tier or q.package or "Other"
        model_rev[key] = model_rev.get(key, 0) + val(q)
    mix_sorted = sorted(model_rev.items(), key=lambda kv: kv[1], reverse=True)
    top = mix_sorted[:4]
    others = sum(v for _, v in mix_sorted[4:])
    mix_items = list(top) + ([("Others", others)] if others else [])
    mix_total = sum(v for _, v in mix_items) or 1
    source_mix = [
        {"label": k, "value": v, "pct": round(v / mix_total * 100)}
        for k, v in mix_items
    ]

    # --- Pipeline health (stage funnel by status) ---
    counts = {r["status"]: r["c"] for r in active.values("status").annotate(c=Count("id"))}
    pipeline = [
        {"stage": "Total quotations", "count": active.count()},
        {"stage": "Pending", "count": counts.get("Pending", 0)},
        {"stage": "Rebate", "count": counts.get("Rebate", 0)},
        {"stage": "Confirmed", "count": counts.get("Confirmed", 0)},
    ]

    # --- Monthly series (last 6 months) ---
    months = _last_n_months(6)
    month_keys = [k for k, _ in months]
    month_labels = [lab for _, lab in months]
    counts_by_month = OrderedDict((k, 0) for k in month_keys)
    acv_sum_by_month = OrderedDict((k, 0.0) for k in month_keys)
    acv_n_by_month = OrderedDict((k, 0) for k in month_keys)
    quoted_by_month = OrderedDict((k, 0.0) for k in month_keys)
    won_by_month = OrderedDict((k, 0.0) for k in month_keys)

    for q in active.only("created_at", "status", "include_tax", "exclude_tax"):
        k = _month_key(q.created_at)
        if k in counts_by_month:
            counts_by_month[k] += 1
            quoted_by_month[k] += val(q)
        if q.status == "Confirmed" and k in acv_sum_by_month:
            acv_sum_by_month[k] += val(q)
            acv_n_by_month[k] += 1
            won_by_month[k] += val(q)

    trend_counts = [counts_by_month[k] for k in month_keys]
    quoted_series = [round(quoted_by_month[k]) for k in month_keys]
    won_series = [round(won_by_month[k]) for k in month_keys]
    acv_series = [
        round(acv_sum_by_month[k] / acv_n_by_month[k]) if acv_n_by_month[k] else 0
        for k in month_keys
    ]

    # Average contract value + change vs previous non-zero month
    confirmed_count = confirmed.count()
    acv_value = round(team_total / confirmed_count) if confirmed_count else 0
    acv_change = _pct_change(acv_series[-1], acv_series[-2]) if len(acv_series) >= 2 else 0

    # Quotation-volume trend
    trend_change = _pct_change(trend_counts[-1], trend_counts[-2]) if len(trend_counts) >= 2 else 0

    quoted_total = sum(quoted_series)

    return ok({
        "teamTotal": team_total,
        "attainment": attainment,
        "sourceMix": source_mix,
        "sourceTotal": team_total,
        "pipeline": pipeline,
        "months": month_labels,
        "revenue": {
            "quoted": quoted_series,
            "won": won_series,
            "quotedTotal": quoted_total,
            "wonTotal": team_total,
        },
        "trend": {
            "series": trend_counts,
            "total": sum(trend_counts),
            "thisMonth": trend_counts[-1] if trend_counts else 0,
            "confirmed": confirmed_count,
            "pending": counts.get("Pending", 0),
            "change": trend_change,
        },
        "acv": {
            "value": acv_value,
            "series": acv_series,
            "change": acv_change,
        },
    }, 200)
