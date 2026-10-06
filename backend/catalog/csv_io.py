"""Products & prices as CSV: export the catalog, and import it back (preview, then apply).

Columns (header names are case-insensitive; common variants are accepted):

    id            optional — the product's id from an export; matches that product exactly
    category      required for new products; created if it doesn't exist yet
    name          required
    specification optional
    brands        optional — suggested brand / model class
    unit          Nos, Lot, Set, Pair, Sq.ft, Rft or Mtr (default Nos)
    list_price    ex-GST list price in ₹ (₹ signs and commas are fine); required for new products
    gst_percent   0–28; blank = the category's default GST
    active        yes / no (default yes)

Rows without an id are matched to an existing product by name (case-insensitive).
"""
import csv
import io
import re
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Max

from .models import Product, ProductCategory

COLUMNS = ["id", "category", "name", "specification", "brands", "unit", "list_price", "gst_percent", "active"]
UNITS = ["Nos", "Lot", "Set", "Pair", "Sq.ft", "Rft", "Mtr"]
MAX_ROWS = 2000
MAX_BYTES = 1_500_000  # base64 in a JSON body must stay under Django's 2.5 MB request limit

# normalised header -> column
_ALIASES = {
    "id": "id", "productid": "id",
    "category": "category", "categoryname": "category",
    "name": "name", "product": "name", "productname": "name", "item": "name",
    "specification": "specification", "spec": "specification", "description": "specification",
    "brands": "brands", "brand": "brands", "suggestedbrand": "brands", "brandmodelclass": "brands",
    "suggestedbrandmodelclass": "brands", "model": "brands",
    "unit": "unit", "uom": "unit",
    "listprice": "list_price", "price": "list_price", "listpriceexgst": "list_price", "unitprice": "list_price",
    "gstpercent": "gst_percent", "gst": "gst_percent", "gstrate": "gst_percent",
    "active": "active", "status": "active", "enabled": "active",
}
_UNIT_ALIASES = {re.sub(r"[^a-z]", "", u.lower()): u for u in UNITS}
_UNIT_ALIASES.update({"no": "Nos", "nos": "Nos", "number": "Nos", "numbers": "Nos", "pcs": "Nos", "pc": "Nos",
                      "sqft": "Sq.ft", "squarefeet": "Sq.ft", "sft": "Sq.ft", "rft": "Rft", "runningfeet": "Rft",
                      "m": "Mtr", "meter": "Mtr", "metre": "Mtr", "mtrs": "Mtr", "lots": "Lot", "sets": "Set", "pairs": "Pair"})
_YES = {"yes", "y", "true", "1", "active", "on"}
_NO = {"no", "n", "false", "0", "inactive", "off"}


class CsvError(ValueError):
    pass


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def _money(raw, label):
    s = re.sub(r"[₹,\s]|rs\.?|inr", "", str(raw or ""), flags=re.I)
    if s == "":
        return None
    try:
        d = Decimal(s)
    except InvalidOperation:
        raise CsvError(f"{label} “{raw}” is not a number")
    if not d.is_finite() or d < 0:
        raise CsvError(f"{label} must be 0 or more")
    return d.quantize(Decimal("0.01"))


def decode(data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise CsvError("The file is too large (max 1.5 MB).")
    for enc in ("utf-8-sig", "cp1252"):  # Excel saves "CSV" as UTF-8 (with BOM) or Windows-1252
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise CsvError("Could not read the file — save it as CSV (UTF-8).")


def parse(text: str):
    """CSV text -> [(row_number, {column: value})]."""
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows = [r for r in reader]
    if not rows:
        raise CsvError("The file is empty.")
    header = [_ALIASES.get(_norm(h)) for h in rows[0]]
    if "name" not in header:
        raise CsvError("No “name” column found. Use the sample CSV's header row.")
    if "list_price" not in header and "id" not in header:
        raise CsvError("No “list_price” column found. Use the sample CSV's header row.")
    out = []
    for i, r in enumerate(rows[1:], start=2):
        if not any(str(c).strip() for c in r):
            continue  # blank line
        rec = {}
        for col, val in zip(header, r):
            if col and col not in rec:
                rec[col] = str(val).strip()
        out.append((i, rec))
    if len(out) > MAX_ROWS:
        raise CsvError(f"Too many rows ({len(out)}); the limit is {MAX_ROWS}.")
    return out


def _value(p, field):
    if p is None:
        return None
    return {
        "category": p.category.name, "name": p.name, "specification": p.specification, "brands": p.brands,
        "unit": p.unit, "list_price": p.price, "gst_percent": p.gst_percent, "active": p.is_active,
    }[field]


def _show(v):
    if v is None:
        return "category default"
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, Decimal):
        return format(v.normalize(), "f") if v == v.to_integral_value() else str(v)
    return str(v)


def plan(rows):
    """Validate every row against the catalog; nothing is written."""
    products = list(Product.objects.select_related("category"))
    by_id = {p.id: p for p in products}
    by_name = {}
    for p in products:
        by_name.setdefault(p.name.strip().lower(), []).append(p)
    categories = {c.name.strip().lower(): c for c in ProductCategory.objects.all()}

    result, seen, new_categories = [], {}, []
    for row_no, rec in rows:
        line = {"Row": row_no, "Name": rec.get("name", ""), "Category": rec.get("category", ""), "Changes": {}}
        try:
            name = rec.get("name", "")
            if not name:
                raise CsvError("Name is empty")
            if len(name) > 160:
                raise CsvError("Name is longer than 160 characters")
            product = None
            if rec.get("id"):
                if not re.fullmatch(r"\d+", rec["id"]):
                    raise CsvError(f"id “{rec['id']}” is not a number")
                product = by_id.get(int(rec["id"]))
                if product is None:
                    raise CsvError(f"No product with id {rec['id']} — clear the id to add it as new")
            else:
                same = by_name.get(name.lower(), [])
                if len(same) > 1:
                    raise CsvError(f"{len(same)} products are called “{name}” — add the id column to say which")
                product = same[0] if same else None
            key = product.id if product else name.lower()
            if key in seen:
                raise CsvError(f"Same product as row {seen[key]}")
            seen[key] = row_no

            cat_name = rec.get("category", "")
            if not cat_name and product is None:
                raise CsvError("Category is empty")
            if len(cat_name) > 80:
                raise CsvError("Category is longer than 80 characters")
            price = _money(rec.get("list_price"), "list_price") if "list_price" in rec else None
            if product is None and price is None:
                raise CsvError("list_price is empty")
            gst = None
            if rec.get("gst_percent", "") != "":
                gst = _money(rec.get("gst_percent").rstrip("%"), "gst_percent")
                if gst > 28:
                    raise CsvError("gst_percent must be between 0 and 28")
            unit = None
            if rec.get("unit"):
                unit = _UNIT_ALIASES.get(_norm(rec["unit"]))
                if unit is None:
                    raise CsvError(f"Unit “{rec['unit']}” is not one of {', '.join(UNITS)}")
            active = None
            if rec.get("active"):
                a = rec["active"].lower()
                if a not in _YES | _NO:
                    raise CsvError(f"active must be yes or no (got “{rec['active']}”)")
                active = a in _YES

            new = {"name": name}
            if cat_name:
                new["category"] = cat_name
            for f in ("specification", "brands"):
                if f in rec:
                    new[f] = rec[f][:500 if f == "specification" else 200]
            if unit or product is None:
                new["unit"] = unit or "Nos"
            if price is not None:
                new["list_price"] = price
            if "gst_percent" in rec:
                new["gst_percent"] = gst
            if active is not None or product is None:
                new["active"] = True if active is None else active

            changes = {}
            for f, v in new.items():
                old = _value(product, f)
                if f == "category" and old is not None and old.strip().lower() == v.strip().lower():
                    continue
                if old != v:
                    changes[f] = [None if product is None else _show(old), _show(v)]
            if cat_name and cat_name.strip().lower() not in categories and cat_name not in new_categories:
                new_categories.append(cat_name)
            line["Price"] = _show(new.get("list_price", product.price if product else None))
            line.update({"Action": "create" if product is None else ("update" if changes else "unchanged"),
                         "Changes": changes if product is not None else {}, "ProductId": product.id if product else None,
                         "_new": new, "_product": product})
        except CsvError as e:
            line.update({"Action": "error", "Error": str(e)})
        result.append(line)
    return result, new_categories


def summary(result, new_categories, applied):
    count = lambda a: sum(1 for r in result if r["Action"] == a)  # noqa: E731
    return {
        "Applied": applied,
        "Created": count("create"), "Updated": count("update"), "Unchanged": count("unchanged"), "Errors": count("error"),
        "NewCategories": new_categories,
        "Rows": [{k: v for k, v in r.items() if not k.startswith("_")} for r in result],
    }


@transaction.atomic
def apply(result):
    categories = {c.name.strip().lower(): c for c in ProductCategory.objects.all()}
    next_order = (ProductCategory.objects.aggregate(m=Max("order"))["m"] or 0) + 10

    def category(name):
        nonlocal next_order
        key = name.strip().lower()
        if key not in categories:
            categories[key] = ProductCategory.objects.create(name=name.strip(), order=next_order)
            next_order += 10
        return categories[key]

    for r in result:
        if r["Action"] not in ("create", "update"):
            continue
        new, p = r["_new"], r["_product"] or Product(name="")
        if "category" in new:
            p.category = category(new["category"])
        field_map = {"name": "name", "specification": "specification", "brands": "brands", "unit": "unit",
                     "list_price": "price", "gst_percent": "gst_percent", "active": "is_active"}
        for f, attr in field_map.items():
            if f in new:
                setattr(p, attr, new[f])
        p.save()


def export_csv():
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(COLUMNS)
    for p in Product.objects.select_related("category").order_by("category__order", "category__name", "order", "name"):
        w.writerow([p.id, p.category.name, p.name, p.specification, p.brands, p.unit, _show(p.price),
                    "" if p.gst_percent is None else _show(p.gst_percent), "yes" if p.is_active else "no"])
    return "﻿" + out.getvalue()  # BOM so Excel opens ₹ and dashes correctly
