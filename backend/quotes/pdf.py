"""Render a quotation to the JAZ Home Theatres PDF.

Page 1 is the JAZ cover (pdf_assets/jaz_cover.jpg) with the customer details written
onto its form lines. Every following page uses the gold-cornered content background
(pdf_assets/jaz_content.jpg); content flows across as many pages as the BOQ and terms
need. The HTML is converted with a headless Chromium (Chrome or Edge).
"""
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from django.conf import settings
from django.template.loader import render_to_string

ASSETS = Path(settings.BASE_DIR) / "pdf_assets"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/snap/bin/chromium",
]

# Cover form lines (left %, usable width %, line height %) measured on jaz_cover.jpg
# (1414 × 2000 px). Right-column values may run a little past the printed line.
COVER_FIELDS = {
    "name": (46.32, 22.1, 80.25), "mobile": (46.32, 22.1, 82.85), "email": (46.32, 22.1, 85.45),
    "city": (46.32, 22.1, 88.05), "address": (46.32, 49.2, 90.65),
    "date": (76.66, 21.9, 80.25), "model": (76.66, 21.9, 82.85), "number": (82.74, 15.9, 85.45),
    "state": (76.66, 21.9, 88.05),
}
COVER_MAX_PT, COVER_MIN_PT, COVER_TRACKING = 10.5, 6.5, 0.02  # tracking in em, matches the template
_FONT = None


def _find_browser():
    for c in CHROME_CANDIDATES:
        if os.path.sep in c or (len(c) > 2 and c[1] == ":"):
            if os.path.exists(c):
                return c
        else:
            found = shutil.which(c)
            if found:
                return found
    return None


def _dec(v):
    try:
        return Decimal(str(v or 0))
    except Exception:
        return Decimal(0)


def inr(value, symbol="₹ "):
    """Indian digit grouping, e.g. ₹ 18,90,000."""
    n = _dec(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    neg, s = n < 0, str(abs(int(n)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return f"{'-' if neg else ''}{symbol}{s}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_100(n):
    return _ONES[n] if n < 20 else (_TENS[n // 10] + (f"-{_ONES[n % 10]}" if n % 10 else ""))


def _below_1000(n):
    h, r = divmod(n, 100)
    return " ".join(x for x in ((_ONES[h] + " Hundred") if h else "", _below_100(r) if r else "") if x)


def _words(n):
    crore, n = divmod(n, 10 ** 7)
    lakh, n = divmod(n, 10 ** 5)
    thousand, n = divmod(n, 1000)
    parts = [f"{_words(crore)} Crore" if crore else "", f"{_below_100(lakh)} Lakh" if lakh else "",
             f"{_below_100(thousand)} Thousand" if thousand else "", _below_1000(n) if n else ""]
    return " ".join(p for p in parts if p)


def amount_in_words(value):
    """Indian numbering: 2112200 -> 'Rupees Twenty-One Lakh Twelve Thousand Two Hundred Only'."""
    n = abs(int(_dec(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
    return f"Rupees {_words(n) or 'Zero'} Only"


def _num(v):
    d = _dec(v)
    return int(d) if d == d.to_integral_value() else float(d)


def _yrs(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return v
    return int(f) if f == int(f) else f


def _fmt_date(dt):
    return (dt or datetime.now()).strftime("%d %b %Y")


def _signature(value):
    """Only embed validated inline images (never an external URL)."""
    from .workflow import SIGNATURE_RE

    value = (value or "").strip()
    return value if SIGNATURE_RE.match(value) else ""


def _sign_note(quote):
    """e.g. "E-signed on 05 Oct 2026" under the customer's signature."""
    if not quote.pk:
        return ""
    from .esign import current_signature

    sig = current_signature(quote)
    if sig is None or not sig.signed_at:
        return ""
    how = "E-signed" if sig.method == "ESIGN" else "Signed onsite"
    return f"{how} on {sig.signed_at.strftime('%d %b %Y')}"


def _em_width(text):
    """Width of ``text`` in em at Montserrat Medium (the cover font), tracking included."""
    global _FONT
    try:
        if _FONT is None:
            from PIL import ImageFont

            _FONT = ImageFont.truetype(str(ASSETS / "fonts" / "Montserrat.ttf"), 100)
            _FONT.set_variation_by_axes([500])
        em = _FONT.getlength(text) / 100
    except Exception:  # noqa: BLE001 — fall back to an average character width
        em = len(text) * 0.6
    return em + COVER_TRACKING * len(text)


def _cover_style(key, text):
    """Absolute position on the cover form line, with the font shrunk to fit the line
    (only the address may wrap to a second line, growing upwards)."""
    left, width, line = COVER_FIELDS[key]
    width_mm = 210 * width / 100 - 0.5
    lines = 2 if key == "address" else 1
    em = _em_width(text or "") or 1
    size = width_mm * lines / (em * 0.3528) * (0.92 if lines > 1 else 1)  # 1 pt = 0.3528 mm
    size = max(COVER_MIN_PT, min(COVER_MAX_PT, round(size - 0.05, 1)))
    return f"left:{left}%;width:{width}%;bottom:calc({100 - line}% + 1.3mm);font-size:{size}pt"


def _rows_or(rows, default):
    rows = [r for r in (rows or []) if (r.get("Label") or r.get("Value"))]
    return rows or default


def build_context(quote, watermark=""):
    from accounts.models import CompanyProfile
    from catalog import jaz
    from catalog.models import PaymentTerm

    from .views import selected_bank
    from .workflow import quote_fin

    c = quote.customer
    p = quote.product_info or {}
    s = quote.sales_info or {}
    company = CompanyProfile.get()
    fin = quote_fin(quote)
    created = quote.created_at or datetime.now()

    # ---- BOQ grouped by category (order of first appearance) ----
    groups, optional = {}, []
    for i in fin["items"]:
        line = {
            "name": i["Name"], "spec": i.get("Specification") or "", "brand": i.get("Brand") or "",
            "remarks": i.get("Remarks") or "", "qty": _num(i["Qty"]), "unit": i.get("Unit") or "Nos",
            "price": inr(i["UnitPrice"], ""), "amount": inr(_dec(i["Qty"]) * _dec(i["UnitPrice"]), ""),
            "gst": _num(i["GstPercent"]),
        }
        if i.get("Optional"):
            optional.append({**line, "category": i["Category"]})
        else:
            groups.setdefault(i["Category"], []).append(line)
    boq, n = [], 0
    for cat, lines in groups.items():
        for line in lines:
            n += 1
            line["no"] = n
        boq.append({"category": cat, "lines": lines})

    rates = fin["gst_rates"]
    gst_label = f"GST {rates[0]}%" if len(rates) == 1 else "GST (as applicable)"
    categories = [{
        "name": r["Category"], "list": inr(r["List"], ""), "offer": inr(r["Offer"], ""), "tax": inr(r["Tax"], ""),
        "total": inr(r["Total"], ""), "gst": " / ".join(f"{g}%" for g in r["Gst"]),
    } for r in fin["categories"]]

    final = _dec(quote.include_tax)
    terms = quote.payment_terms or [{"TermName": t.term_name, "TermValue": t.term_value}
                                    for t in PaymentTerm.objects.all().order_by("order", "id")] or \
        [{"TermName": n_, "TermValue": v} for n_, v in jaz.STANDARD_PAYMENT_TERMS]
    terms = [{"name": t["TermName"], "pct": _num(t["TermValue"]),
              "amount": inr(final * _dec(t["TermValue"]) / 100)} for t in terms]

    warr = {str(w.get("TypeOfParts", "")).lower(): w.get("Duration") for w in (quote.warranty_details or [])}
    amc = {str(a.get("AmcType", "")).lower(): a.get("Duration") for a in (quote.amc_details or [])}
    try:
        validity = int(s.get("ValidityDays") or 15)
    except (TypeError, ValueError):
        validity = 15

    room_size = " × ".join(x for x in (p.get("RoomLength"), p.get("RoomWidth"), p.get("RoomHeight")) if x)
    project = [(k, v) for k, v in (
        ("Room / Area", p.get("Room")), ("Project Type", p.get("ProjectType")),
        ("Room Size", f"{room_size} ft (L × W × H)" if room_size else ""),
        ("Seating", " · ".join(x for x in (f"{p['Seats']} seats" if p.get("Seats") else "",
                                           f"{p['Rows']} row(s)" if p.get("Rows") else "") if x)),
        ("Screen", p.get("Screen")), ("Site Stage", p.get("ConstructionStage")),
        ("Investment", p.get("Tier")),
    ) if v]

    bank = selected_bank(quote)
    if bank is not None and not (bank.account_number or "").strip():
        bank = None
    location = ", ".join(x for x in (company.city, company.state) if x)
    first_name = (c.name or "").split(" ")[0]
    model = quote.package or p.get("Package") or ""
    address = c.address2 or c.address or ""
    cover = {k: {"text": v, "style": _cover_style(k, v)} for k, v in (
        ("name", c.name), ("mobile", c.mobile), ("email", c.email), ("city", c.city), ("address", address),
        ("date", _fmt_date(created)), ("model", model), ("number", quote.quotation_number), ("state", c.state),
    )}

    details = [("Customer Name", c.name), ("Quotation No.", quote.quotation_number), ("Mobile No.", c.mobile),
               ("Date", _fmt_date(created)), ("E-mail", c.email), ("City", c.city), ("Project Address", address),
               ("State", c.state), ("Configuration", quote.configuration or p.get("Configuration")),
               ("Valid until", f"{_fmt_date(created + timedelta(days=validity))} ({validity} days)")] + project

    return {
        "fonts_dir": (ASSETS / "fonts").as_uri(),
        "details": [details[i:i + 2] for i in range(0, len(details), 2)],
        "room": p.get("Room") or "",
        "cover_url": (ASSETS / "jaz_cover.jpg").as_uri(),
        "content_url": (ASSETS / "jaz_content.jpg").as_uri(),
        "watermark": watermark,
        "cover": cover,
        "company": company, "company_location": location,
        "quotation_number": quote.quotation_number,
        "date": _fmt_date(created),
        "valid_until": _fmt_date(created + timedelta(days=validity)), "validity_days": validity,
        "customer": c, "first_name": first_name, "address": address,
        "model": model, "configuration": quote.configuration or p.get("Configuration") or "",
        "project": project, "notes": p.get("Notes") or "",
        "spec": _rows_or(p.get("Spec"), jaz.DEFAULT_SPEC),
        "scope": p.get("Scope") or jaz.SCOPE,
        "finishes": _rows_or(p.get("Finishes"), jaz.DEFAULT_FINISHES),
        "standard_features": jaz.STANDARD_FEATURES,
        "about": jaz.ABOUT, "principles": jaz.PRINCIPLES,
        "boq": boq, "optional": optional, "optional_total": inr(fin["optional_total"]),
        "categories": categories, "gst_label": gst_label,
        "list_total": inr(quote.base_amount), "offer_total": inr(quote.exclude_tax), "tax_total": inr(quote.tax),
        "grand_total": inr(final), "grand_words": amount_in_words(final),
        "discount": _dec(quote.special_cost) > 0, "discount_amount": inr(quote.special_cost),
        "discount_pct": _num(quote.discount_percent),
        "terms": terms, "procurement_note": jaz.PROCUREMENT_NOTE,
        "timeline": s.get("DeliveryAt") or "",
        "delivery_stages": jaz.DELIVERY_STAGES, "project_delivery": jaz.PROJECT_DELIVERY,
        "workmanship_yr": _yrs(warr.get("workmanship") or 1),
        "amc_comp": _yrs(amc.get("comprehensive") if amc.get("comprehensive") not in (None, "") else 7.5),
        "amc_prev": _yrs(amc.get("preventive") if amc.get("preventive") not in (None, "") else 5),
        "customer_scope": jaz.CUSTOMER_SCOPE, "jaz_scope": jaz.JAZ_SCOPE, "exclusions": jaz.EXCLUSIONS,
        "jaz_notes": jaz.NOTES, "order_policy": jaz.ORDER_POLICY, "acknowledgement": jaz.ACKNOWLEDGEMENT,
        "bank": bank,
        "sales_by": s.get("SalesBy") or "",
        "sales_note": s.get("Remarks") or "",
        "customer_sign": _signature(s.get("CustomerSign")),
        "sign_note": _sign_note(quote),
        "signatory_sign": _signature(s.get("SignatorySign")),
    }


def generate_quote_pdf(quote, watermark="") -> str:
    """Render the quote to a PDF under MEDIA_ROOT/quotes and return the relative path."""
    browser = _find_browser()
    if not browser:
        raise RuntimeError("No Chrome/Edge browser found to render the PDF.")

    html = render_to_string("quotation.html", build_context(quote, watermark))

    out_dir = Path(settings.MEDIA_ROOT) / "quotes"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    rel_path = f"quotes/{quote.quotation_number}_{stamp}.pdf"
    out_pdf = Path(settings.MEDIA_ROOT) / rel_path

    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / "quote.html"
        html_path.write_text(html, encoding="utf-8")
        user_data = Path(tmp) / "cud"
        cmd = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-background-networking",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            "--allow-file-access-from-files",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=4000",
            f"--user-data-dir={user_data}",
            f"--print-to-pdf={out_pdf}",
            html_path.as_uri(),
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=120)
        if not out_pdf.exists():
            raise RuntimeError(
                "PDF generation failed: " + (proc.stderr.decode(errors="ignore")[:500] or "unknown error")
            )
    return rel_path
