"""BOQ pricing for JAZ quotations.

Every BOQ line carries the unit price the salesperson quotes (set manually) and, for
catalog items, the catalog list price — resolved here from the catalog, never trusted
from the client. Totals (included lines only):

    list value ("Actual price") = Σ qty × max(list price, unit price)
    quoted                      = Σ qty × unit price
    additional discount         = quoted × d%            (the builder's Discount field)
    offer (ex-GST)              = quoted − additional discount
    GST                         = Σ qty × unit price × (1 − d%) × line GST%
    final                       = offer + GST
    total discount %            = (list value − offer) / list value

The total discount is what the approval rules evaluate, so cutting line prices below
list needs the same approval as an equivalent discount. Lines priced above list never
offset cuts elsewhere. Optional lines are priced and listed separately and are not
part of the totals.
"""
from decimal import ROUND_HALF_UP, Decimal

MAX_ITEMS = 250
MAX_GST = Decimal(28)
ONE = Decimal("1")


def _d(v):
    try:
        return Decimal(str(v or 0))
    except Exception:
        return Decimal("0")


def _r(v):
    return Decimal(v).quantize(ONE, rounding=ROUND_HALF_UP)


def _num(v):
    """Decimal -> int when whole, else float (keeps JSON tidy: 2, not 2.0)."""
    return int(v) if v == v.to_integral_value() else float(v)


def _text(v, n):
    return str(v or "").strip()[:n]


def normalize_items(items):
    """Validate client BOQ lines → clean dicts with the server-resolved list price."""
    from catalog.models import Product

    from .rules import RuleError, dec

    if items in (None, ""):
        return []
    if not isinstance(items, list):
        raise RuleError("Invalid BOQ items.")
    if len(items) > MAX_ITEMS:
        raise RuleError(f"A quotation can have at most {MAX_ITEMS} BOQ lines.")
    ids = {int(i["ProductId"]) for i in items if isinstance(i, dict) and str(i.get("ProductId") or "").isdigit()}
    products = {p.id: p for p in Product.objects.select_related("category").filter(id__in=ids)}
    out = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        pid = raw.get("ProductId")
        p = products.get(int(pid)) if str(pid or "").isdigit() else None
        name = _text(raw.get("Name"), 200) or (p.name if p else "")
        if not name:
            continue  # an empty row the user never filled in
        qty = dec(raw.get("Qty"), f"quantity for {name}")
        if qty <= 0 or qty > 100000:
            raise RuleError(f"Quantity for “{name}” must be more than 0.")
        unit = dec(raw.get("UnitPrice"), f"price for {name}")
        if unit < 0 or unit > Decimal("1000000000"):
            raise RuleError(f"Price for “{name}” is not valid.")
        gst_raw = raw.get("GstPercent")
        gst = dec(gst_raw, f"GST for {name}") if gst_raw not in (None, "") else (p.effective_gst if p else Decimal(18))
        if gst < 0 or gst > MAX_GST:
            raise RuleError(f"GST for “{name}” must be between 0% and {MAX_GST}%.")
        out.append({
            "ProductId": p.id if p else None,
            "Category": _text(raw.get("Category"), 80) or (p.category.name if p else "Other"),
            "Name": name,
            "Specification": _text(raw.get("Specification"), 500),
            "Brand": _text(raw.get("Brand"), 200),
            "Unit": _text(raw.get("Unit"), 20) or (p.unit if p else "Nos"),
            "Qty": _num(qty),
            "UnitPrice": _num(unit),
            "ListPrice": _num(_d(p.price)) if p else 0,
            "GstPercent": _num(gst),
            "Optional": bool(raw.get("Optional")),
            "Remarks": _text(raw.get("Remarks"), 200),
            "Amount": _num(_r(qty * unit)),
        })
    return out


def _line(i):
    qty, unit = _d(i["Qty"]), _d(i["UnitPrice"])
    listp = max(_d(i["ListPrice"]), unit)
    return qty * listp, qty * unit, _d(i["GstPercent"])


def compute_financials(product, discount_percent=0, items=None):
    """Authoritative price of a quotation (Decimals, rupees). ``discount_percent`` is
    the additional discount on the quoted BOQ; the result's ``effective_percent`` is the
    total discount vs list that the approval rules use."""
    items = normalize_items((product or {}).get("Items")) if items is None else items
    pct = _d(discount_percent)
    keep = (Decimal(100) - pct) / Decimal(100)
    included = [i for i in items if not i["Optional"]]

    list_raw = quoted_raw = tax_raw = Decimal(0)
    cats = {}
    for i in included:
        lst, quo, gst = _line(i)
        list_raw += lst
        quoted_raw += quo
        tax_raw += quo * keep * gst / 100
        c = cats.setdefault(i["Category"], {"list": Decimal(0), "quoted": Decimal(0), "tax": Decimal(0), "gst": set()})
        c["list"] += lst
        c["quoted"] += quo
        c["tax"] += quo * keep * gst / 100
        c["gst"].add(_num(gst))

    list_value, quoted = _r(list_raw), _r(quoted_raw)
    additional = _r(quoted_raw * pct / 100)
    exclude = quoted - additional
    if exclude < 0:
        exclude = Decimal(0)
    tax = _r(tax_raw)
    include = exclude + tax
    total_discount = max(list_value - exclude, Decimal(0))
    effective = (total_discount / list_value * 100).quantize(Decimal("0.01")) if list_value else Decimal(0)

    categories = []
    for name, c in cats.items():
        offer = _r(c["quoted"] * keep)
        ctax = _r(c["tax"])
        categories.append({"Category": name, "List": float(_r(c["list"])), "Offer": float(offer), "Tax": float(ctax),
                           "Total": float(offer + ctax), "Gst": sorted(c["gst"])})
    _balance(categories, "Offer", exclude)
    _balance(categories, "Tax", tax)
    for c in categories:
        c["Total"] = c["Offer"] + c["Tax"]

    optional = [i for i in items if i["Optional"]]
    rates = sorted({_num(_d(i["GstPercent"])) for i in included})
    return {
        "items": items,
        "categories": categories,
        "list": list_value,
        "quoted": quoted,
        "adjustment": max(list_value - quoted, Decimal(0)),  # cut via line prices
        "additional_percent": pct,
        "additional_discount": additional,
        "discount": total_discount,
        "effective_percent": effective,
        "exclude": exclude,
        "tax": tax,
        "include": include,
        "gst_rates": rates,
        "optional_total": _r(sum((_d(i["Qty"]) * _d(i["UnitPrice"]) for i in optional), Decimal(0))),
        "optional_count": len(optional),
        "item_count": len(included),
        "priced": quoted > 0,
        # aliases used by the workflow engine
        "base": list_value,
        "discount_percent": effective,
    }


def _balance(rows, key, total):
    """Make per-category rounded figures add up exactly to the rounded total."""
    if not rows:
        return
    diff = float(total) - sum(r[key] for r in rows)
    if diff:
        max(rows, key=lambda r: r[key])[key] += diff


def additional_for_effective(product, target_percent, items=None):
    """The additional discount % that brings the total discount to ``target_percent``,
    or None when the line prices alone already exceed it."""
    fin = compute_financials(product, 0, items=items)
    lst, quoted = fin["list"], fin["quoted"]
    if not quoted:
        return None
    target = _d(target_percent)
    d = (Decimal(1) - lst * (Decimal(100) - target) / Decimal(100) / quoted) * 100
    d = d.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    if d < 0:
        return None
    return d
