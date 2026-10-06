"""Quotation authorisation rules — the single source of truth for every limit.

All functions are pure: given the *creator's role* and the requested value they
return the list of roles that must approve (in order). Mapping roles onto real
people happens later in ``workflow`` via the creator's own reporting chain.

To change a limit, edit the tables below — nothing else hard-codes them.
"""
import re
from decimal import Decimal, InvalidOperation

from accounts.hierarchy import ADMIN, BDM, DIRECTOR, RM, RSD, SR_BDM, role_level

INF = Decimal("Infinity")

# ---------------------------------------------------------------- discount (%)
# Slabs: BDM up to 15% · RM approves up to 25% · RSD approves up to 30% ·
# above that RSD then Admin · above the company limit (35%) straight to Admin.
# What each role may grant on its own quotations without any approval.
DISCOUNT_SELF_LIMIT = {BDM: 15, SR_BDM: 15, RM: 25, RSD: 30, DIRECTOR: 50, ADMIN: INF}
# (upper bound inclusive, approval path) — evaluated for anyone above their self-limit.
DISCOUNT_BANDS = [
    (Decimal(15), []),
    (Decimal(25), [RM]),
    (Decimal(30), [RSD]),
    (Decimal(35), [RSD, ADMIN]),
    (INF, [ADMIN]),
]
COMPANY_DISCOUNT_LIMIT = Decimal(35)  # above this = "outside company limit"
MAX_DISCOUNT = Decimal(100)

# ---------------------------------------------------------------- warranty (years)
# JAZ installation workmanship warranty (AV equipment carries the manufacturer's own warranty).
WARRANTY_STANDARD = Decimal(1)
WARRANTY_SELF_LIMIT = {BDM: 1, SR_BDM: 1, RM: 1, RSD: 3, DIRECTOR: 3, ADMIN: INF}
WARRANTY_BANDS = [
    (Decimal(1), []),
    (Decimal(3), [RSD]),
    (INF, [RSD, ADMIN]),
]
WARRANTY_PARTS = ["Workmanship"]

# ---------------------------------------------------------------- AMC (% of system value per year)
# Offered after the warranty period. Minimum rate each role may quote; going *below*
# needs someone whose floor allows it.
AMC_TYPES = ["Comprehensive", "Preventive"]
AMC_FLOOR = {
    BDM: {"Comprehensive": Decimal("7.5"), "Preventive": Decimal(5)},
    SR_BDM: {"Comprehensive": Decimal("7.5"), "Preventive": Decimal(5)},
    RM: {"Comprehensive": Decimal(6), "Preventive": Decimal(4)},
    RSD: {"Comprehensive": Decimal(5), "Preventive": Decimal(3)},
    DIRECTOR: {"Comprehensive": Decimal(5), "Preventive": Decimal(3)},
    ADMIN: {"Comprehensive": Decimal(0), "Preventive": Decimal(0)},
}
# The company's standard rates — the default on every new quotation, whoever creates it.
AMC_STANDARD = AMC_FLOOR[BDM]

# ---------------------------------------------------------------- payment terms (%)
# The JAZ standard schedule (quotation template) — the same for every role; anything
# else is a custom schedule that needs the next level up.
from catalog.jaz import STANDARD_PAYMENT_TERMS  # noqa: E402

PAYMENT_TEMPLATES = {role: list(STANDARD_PAYMENT_TERMS) for role in (BDM, SR_BDM, RM, RSD, DIRECTOR, ADMIN)}
# Approval ladder used for "whoever is next up" decisions.
LADDER = [RM, RSD, DIRECTOR, ADMIN]

# Edits to a locked (submitted) BDM / Sr. BDM quotation need their RM.
EDIT_PATH = [RM]


class RuleError(ValueError):
    """Invalid input (not an approval matter) — surfaced to the user as a 400."""


# ---------------------------------------------------------------- helpers
def dec(v, field="value"):
    try:
        d = Decimal(str(v if v not in (None, "") else 0))
    except (InvalidOperation, ValueError):
        raise RuleError(f"Invalid {field}.")
    if not d.is_finite():
        raise RuleError(f"Invalid {field}.")
    return d


def _above(creator_role, roles):
    """Keep only roles with more authority than the creator (never self-approve)."""
    lvl = role_level(creator_role)
    return [r for r in roles if role_level(r) < lvl]


def _banded_path(creator_role, value, self_limit, bands):
    if value <= Decimal(str(self_limit[creator_role])):
        return []
    for upper, path in bands:
        if value <= upper:
            roles = _above(creator_role, path)
            return roles or ([] if creator_role == ADMIN else [ADMIN])
    return [ADMIN]


def _next_level(creator_role):
    for r in LADDER:
        if role_level(r) < role_level(creator_role) and r != DIRECTOR:
            return r
    return ADMIN


# ---------------------------------------------------------------- discount
def get_discount_approval_path(creator_role, discount_percent):
    pct = dec(discount_percent, "discount")
    if pct < 0 or pct > MAX_DISCOUNT:
        raise RuleError("Discount must be between 0% and 100%.")
    return _banded_path(creator_role, pct, DISCOUNT_SELF_LIMIT, DISCOUNT_BANDS)


def discount_outside_limit(creator_role, discount_percent):
    pct = dec(discount_percent, "discount")
    return pct > COMPANY_DISCOUNT_LIMIT and bool(get_discount_approval_path(creator_role, pct))


# ---------------------------------------------------------------- warranty
def normalize_warranty(items):
    """[{Duration, TypeOfParts}] → {part: Decimal years}; missing parts = standard."""
    out = {p: WARRANTY_STANDARD for p in WARRANTY_PARTS}
    for w in items or []:
        part = str(w.get("TypeOfParts") or "").strip()
        match = next((p for p in WARRANTY_PARTS if p.lower() == part.lower()), None)
        if match is None or w.get("Duration") in (None, ""):
            continue
        yrs = dec(w.get("Duration"), "warranty")
        if yrs < 0 or yrs > 25:
            raise RuleError("Warranty must be between 0 and 25 years.")
        out[match] = yrs
    return out


def get_warranty_approval_path(creator_role, warranty):
    years = max(normalize_warranty(warranty).values())
    return _banded_path(creator_role, years, WARRANTY_SELF_LIMIT, WARRANTY_BANDS)


# ---------------------------------------------------------------- AMC
def normalize_amc(items, creator_role):
    """[{Duration, AmcType}] → {type: Decimal rate}; missing types = the standard rate."""
    out = dict(AMC_STANDARD)
    for a in items or []:
        kind = str(a.get("AmcType") or "").strip()
        match = next((t for t in AMC_TYPES if t.lower() == kind.lower()), None)
        if match is None or a.get("Duration") in (None, ""):
            continue
        rate = dec(a.get("Duration"), "AMC")
        if rate < 0 or rate > 100:
            raise RuleError("AMC must be between 0 and 100.")
        out[match] = rate
    return out


def get_amc_approval_path(creator_role, amc):
    rates = normalize_amc(amc, creator_role)
    floor = AMC_FLOOR[creator_role]
    if all(rates[t] >= floor[t] for t in AMC_TYPES):
        return []
    # The lowest-ranking approver whose own floor covers every requested rate.
    for role in _above(creator_role, LADDER):
        if all(rates[t] >= AMC_FLOOR[role][t] for t in AMC_TYPES):
            return [role]
    return [ADMIN]


# ---------------------------------------------------------------- payment terms
def _norm_name(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def normalize_terms(items):
    rows = []
    for t in items or []:
        name = str(t.get("TermName") or "").strip()
        if not name:
            continue
        val = dec(t.get("TermValue"), "payment term")
        if val <= 0 or val > 100:
            raise RuleError("Each payment term must be between 1% and 100%.")
        rows.append({"TermName": name, "TermValue": int(val) if val == int(val) else float(val)})
    if rows and sum(Decimal(str(r["TermValue"])) for r in rows) != 100:
        raise RuleError("Payment terms must add up to exactly 100%.")
    return rows


def _terms_key(rows):
    return sorted((_norm_name(r[0] if isinstance(r, tuple) else r["TermName"]),
                   Decimal(str(r[1] if isinstance(r, tuple) else r["TermValue"]))) for r in rows)


def default_terms(role):
    return [{"TermName": n, "TermValue": v} for n, v in PAYMENT_TEMPLATES[role]]


def terms_template_owner(terms):
    """Lowest-authority role whose standard template equals ``terms`` (or None)."""
    key = _terms_key(terms)
    for role in (BDM, SR_BDM, RM, RSD, DIRECTOR, ADMIN):
        if _terms_key(PAYMENT_TEMPLATES[role]) == key:
            return role
    return None


def get_payment_terms_approval_path(creator_role, payment_terms):
    rows = normalize_terms(payment_terms) or default_terms(creator_role)
    if creator_role == ADMIN:
        return []
    owner = terms_template_owner(rows)
    if owner is not None and role_level(owner) >= role_level(creator_role):
        return []  # own template, or a stricter (lower-role) one
    if owner is not None:
        return [owner]
    return [_next_level(creator_role)]  # custom terms → next level up


# ---------------------------------------------------------------- whole quotation
def evaluate(creator_role, data):
    """Return one requirement per category that needs approval.

    ``data`` keys: discount_percent, warranty, amc, payment_terms.
    """
    reqs = []
    pct = dec(data.get("discount_percent"), "discount")
    path = get_discount_approval_path(creator_role, pct)
    if path:
        reqs.append({
            "category": "DISCOUNT", "path": path, "requested": float(pct),
            "standard": float(DISCOUNT_SELF_LIMIT[creator_role]) if DISCOUNT_SELF_LIMIT[creator_role] != INF else None,
            "outside_limit": discount_outside_limit(creator_role, pct),
        })
    w = normalize_warranty(data.get("warranty"))
    path = get_warranty_approval_path(creator_role, data.get("warranty"))
    if path:
        reqs.append({
            "category": "WARRANTY", "path": path, "requested": {k: float(v) for k, v in w.items()},
            "standard": float(WARRANTY_SELF_LIMIT[creator_role]), "outside_limit": False,
        })
    a = normalize_amc(data.get("amc"), creator_role)
    path = get_amc_approval_path(creator_role, data.get("amc"))
    if path:
        reqs.append({
            "category": "AMC", "path": path, "requested": {k: float(v) for k, v in a.items()},
            "standard": {k: float(v) for k, v in AMC_FLOOR[creator_role].items()}, "outside_limit": False,
        })
    terms = normalize_terms(data.get("payment_terms")) or default_terms(creator_role)
    path = get_payment_terms_approval_path(creator_role, terms)
    if path:
        reqs.append({
            "category": "PAYMENT_TERMS", "path": path, "requested": terms,
            "standard": default_terms(creator_role), "outside_limit": False,
        })
    return reqs


def role_policy(role):
    """Limits for one role, for the quotation builder UI (display only)."""
    lim = DISCOUNT_SELF_LIMIT[role]
    return {
        "role": role,
        "discount": {
            "selfLimit": None if lim == INF else float(lim),
            "companyLimit": float(COMPANY_DISCOUNT_LIMIT),
            "bands": [{"upTo": None if u == INF else float(u), "path": p} for u, p in DISCOUNT_BANDS],
        },
        "warranty": {
            "standard": float(WARRANTY_STANDARD),
            "selfLimit": None if WARRANTY_SELF_LIMIT[role] == INF else float(WARRANTY_SELF_LIMIT[role]),
            "parts": WARRANTY_PARTS,
        },
        "amc": {"defaults": {k: float(v) for k, v in AMC_STANDARD.items()},
                "floors": {k: float(v) for k, v in AMC_FLOOR[role].items()}, "types": AMC_TYPES},
        "paymentTerms": default_terms(role),
        "paymentTermNames": sorted({n for tpl in PAYMENT_TEMPLATES.values() for n, _ in tpl}),
        "editRequiresApproval": role in (BDM, SR_BDM),
    }
