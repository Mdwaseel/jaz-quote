"""Admin panel API — products, prices & packages, company profile, quotation
monitoring, users.

Guarded by the Admin role (or staff/superuser). Powers the React admin UI.
"""
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Count, ProtectedError

from common.api import api as base_api, fail, ok
from accounts import hierarchy as H
from accounts.models import Bank, Branch, CompanyProfile, Franchise, Role, User
from catalog.models import Package, PackageItem, PaymentTerm, Product, ProductCategory
from catalog.views import package_row, packages_qs, product_row
from quotes import workflow as W
from quotes.models import ApprovalRequest, Customer, Quotation, QuotationEvent


def _is_admin(user):
    if not user:
        return False
    return H.is_admin(user)


def admin_api(methods=("POST",)):
    """Like the base api decorator but also requires an Admin user.

    base_api enforces auth (401) and sets request.auth_user; we then check role.
    """
    def decorator(view):
        import functools

        @functools.wraps(view)
        def checked(request, *args, **kwargs):
            if not _is_admin(request.auth_user):
                return fail("Admin access required.", 403)
            return view(request, *args, **kwargs)

        return base_api(methods=methods, auth=True)(checked)

    return decorator


# ---------------------------------------------------------------- catalog: products, categories, packages
KINDS = ("product", "category", "package", "paymentterm")


class Invalid(ValueError):
    pass


def _money(v, label="price", allow_none=False):
    if v in (None, "") and allow_none:
        return None
    try:
        d = Decimal(str(v if v not in (None, "") else 0))
    except (InvalidOperation, ValueError):
        raise Invalid(f"Invalid {label}.")
    if not d.is_finite() or d < 0:
        raise Invalid(f"Invalid {label}.")
    return d


def _gst(v, allow_none=True):
    d = _money(v, "GST %", allow_none=allow_none)
    if d is not None and d > 28:
        raise Invalid("GST must be between 0% and 28%.")
    return d


def _catalog_rows(kind):
    if kind == "product":
        return [{**product_row(p), "Order": p.order}
                for p in Product.objects.select_related("category").order_by("category__order", "order", "name")]
    if kind == "category":
        return [{"Id": c.id, "Name": c.name, "Order": c.order, "GstPercent": float(c.gst_percent), "Products": c.n}
                for c in ProductCategory.objects.annotate(n=Count("products")).order_by("order", "name")]
    if kind == "package":
        return [{**package_row(p), "Order": p.order} for p in packages_qs().order_by("order", "name")]
    if kind == "paymentterm":
        return [{"Id": t.id, "Name": t.term_name, "Value": float(t.term_value), "Order": t.order}
                for t in PaymentTerm.objects.all().order_by("order", "id")]
    return []


def _set_package_items(pkg, items):
    if not isinstance(items, list):
        raise Invalid("Invalid package items.")
    rows = []
    for i, it in enumerate(items):
        product = Product.objects.filter(id=it.get("productId") or it.get("ProductId")).first()
        if product is None:
            raise Invalid("A package item refers to a product that no longer exists.")
        qty = _money(it.get("qty") if it.get("qty") is not None else it.get("Qty"), "quantity")
        if qty <= 0:
            raise Invalid(f"Quantity for “{product.name}” must be more than 0.")
        rows.append(PackageItem(package=pkg, product=product, qty=qty, order=i))
    pkg.items.all().delete()
    PackageItem.objects.bulk_create(rows)


def _spec(rows):
    if not isinstance(rows, list):
        raise Invalid("Invalid specification.")
    return [{"Label": str(r.get("Label") or "").strip()[:80], "Value": str(r.get("Value") or "").strip()[:400]}
            for r in rows if isinstance(r, dict) and (r.get("Label") or r.get("Value"))]


def _apply_fields(kind, obj, d):
    """Copy the posted fields that are present onto ``obj`` (validating each)."""
    def has(k):
        return k in d and d[k] is not None

    if has("name"):
        name = str(d["name"]).strip()
        if not name:
            raise Invalid("Name cannot be empty.")
        setattr(obj, "term_name" if kind == "paymentterm" else "name", name[:160])
    if has("order"):
        try:
            obj.order = int(d["order"])
        except (TypeError, ValueError):
            raise Invalid("Invalid order.")
    if kind == "product":
        if has("categoryId"):
            cat = ProductCategory.objects.filter(id=d["categoryId"]).first()
            if cat is None:
                raise Invalid("Choose a category.")
            obj.category = cat
        if has("value"):
            obj.price = _money(d["value"])
        for k, attr, n in (("specification", "specification", 500), ("brands", "brands", 200), ("unit", "unit", 20)):
            if has(k):
                setattr(obj, attr, str(d[k]).strip()[:n])
        if "gstPercent" in d:
            obj.gst_percent = _gst(d["gstPercent"])
        if has("active"):
            obj.is_active = bool(d["active"])
    elif kind == "category":
        if has("gstPercent"):
            obj.gst_percent = _gst(d["gstPercent"], allow_none=False)
    elif kind == "package":
        for k, n in (("configuration", 20), ("tier", 60), ("description", 1000)):
            if has(k):
                setattr(obj, k, str(d[k]).strip()[:n])
        if has("spec"):
            obj.spec = _spec(d["spec"])
        if has("active"):
            obj.is_active = bool(d["active"])
    elif kind == "paymentterm":
        if has("value"):
            v = _money(d["value"], "percentage")
            if v > 100:
                raise Invalid("A payment stage cannot be more than 100%.")
            obj.term_value = int(v)


@admin_api()
def catalog_list(request):
    kind = request.data.get("kind")
    if kind not in KINDS:
        return fail("Unknown catalog kind.")
    return ok(_catalog_rows(kind))


_MODELS = {"product": Product, "category": ProductCategory, "package": Package, "paymentterm": PaymentTerm}


@admin_api()
@transaction.atomic
def catalog_update(request):
    d = request.data or {}
    kind = d.get("kind")
    if kind not in KINDS:
        return fail("Unknown catalog kind.")
    obj = _MODELS[kind].objects.filter(id=d.get("id")).first()
    if not obj:
        return fail("Item not found.", 404)
    try:
        _apply_fields(kind, obj, d)
        obj.save()
        if kind == "package" and d.get("items") is not None:
            _set_package_items(obj, d["items"])
    except Invalid as e:
        transaction.set_rollback(True)
        return fail(str(e))
    return ok({"Id": obj.id, "Message": "Updated."})


@admin_api()
@transaction.atomic
def catalog_create(request):
    d = request.data or {}
    kind = d.get("kind")
    if kind not in KINDS:
        return fail("Unknown catalog kind.")
    if not str(d.get("name") or "").strip():
        return fail("Name is required.")
    try:
        if kind == "product":
            cat = ProductCategory.objects.filter(id=d.get("categoryId")).first()
            if cat is None:
                return fail("Choose a category.")
            obj = Product(category=cat, name="")
        elif kind == "category":
            if ProductCategory.objects.filter(name__iexact=str(d["name"]).strip()).exists():
                return fail("A category with this name already exists.")
            obj = ProductCategory(name="")
        elif kind == "package":
            obj = Package(name="")
        else:
            obj = PaymentTerm(term_name="")
        _apply_fields(kind, obj, d)
        obj.save()
        if kind == "package" and d.get("items") is not None:
            _set_package_items(obj, d["items"])
    except Invalid as e:
        transaction.set_rollback(True)
        return fail(str(e))
    return ok({"Id": obj.id, "Message": "Created."}, 201)


@admin_api()
def catalog_delete(request):
    kind = request.data.get("kind")
    if kind not in KINDS:
        return fail("Unknown catalog kind.")
    try:
        _MODELS[kind].objects.filter(id=request.data.get("id")).delete()
    except ProtectedError:
        return fail("This category still has products. Move or delete them first.")
    return ok({"Message": "Deleted."})


@admin_api()
def catalog_refs(request):
    from catalog import jaz

    return ok({
        "categories": [{"Id": c.id, "Name": c.name, "GstPercent": float(c.gst_percent)} for c in ProductCategory.objects.all()],
        "products": [product_row(p) for p in Product.objects.select_related("category")],
        "tiers": jaz.TIERS,
        "configurations": jaz.CONFIGURATIONS,
        "specLabels": jaz.SPEC_LABELS,
        "brands": jaz.BRANDS,
    })


# ---------------------------------------------------------------- products CSV (import / export)
@admin_api()
def catalog_import(request):
    """Body: {file: <base64 of the CSV>, apply: false|true}. Always validates every row first;
    with apply=true and no errors, writes everything in one transaction."""
    import base64
    import binascii

    from catalog import csv_io

    d = request.data or {}
    try:
        raw = base64.b64decode(str(d.get("file") or "").split(",")[-1], validate=True)
    except (binascii.Error, ValueError):
        return fail("Could not read the uploaded file.")
    try:
        result, new_categories = csv_io.plan(csv_io.parse(csv_io.decode(raw)))
    except csv_io.CsvError as e:
        return fail(str(e))
    errors = sum(1 for r in result if r["Action"] == "error")
    if d.get("apply"):
        if errors:
            return fail(f"Fix the {errors} row(s) with errors before importing.")
        csv_io.apply(result)
    return ok(csv_io.summary(result, new_categories, applied=bool(d.get("apply"))))


@admin_api()
def catalog_export(request):
    from django.http import HttpResponse

    from catalog import csv_io

    resp = HttpResponse(csv_io.export_csv(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = 'attachment; filename="jaz-products.csv"'
    return resp


# ---------------------------------------------------------------- company profile + bank
COMPANY_FIELDS = ("name", "tagline", "address", "city", "state", "email", "phone", "website", "gstin", "pan")
BANK_FIELDS = {"accountHolderName": "account_holder_name", "bankName": "bank_name", "accountNumber": "account_number",
               "ifscCode": "ifsc_code", "branchName": "branch_name"}


def _company_payload():
    c = CompanyProfile.get()
    b = Bank.objects.order_by("id").first()
    return {
        "company": {f: getattr(c, f) for f in COMPANY_FIELDS},
        "bank": {k: getattr(b, a) if b else "" for k, a in BANK_FIELDS.items()},
    }


@admin_api(methods=("GET", "POST"))
def company(request):
    return ok(_company_payload())


@admin_api()
def company_update(request):
    d = request.data or {}
    c = CompanyProfile.get()
    for f in COMPANY_FIELDS:
        if f in (d.get("company") or {}):
            setattr(c, f, str(d["company"][f] or "").strip()[:500 if f == "address" else 200])
    if not c.name:
        return fail("Company name is required.")
    if c.email:
        try:
            validate_email(c.email)
        except ValidationError:
            return fail("Enter a valid company email.")
    c.save()
    bank = d.get("bank") or {}
    if any(str(bank.get(k) or "").strip() for k in BANK_FIELDS):
        b = Bank.objects.order_by("id").first() or Bank(entity_id=1)
        for k, attr in BANK_FIELDS.items():
            if k in bank:
                setattr(b, attr, str(bank[k] or "").strip()[:120])
        b.save()
    return ok({**_company_payload(), "Message": "Saved."})


# ---------------------------------------------------------------- dashboard stats
@admin_api()
def stats(request):
    qs = Quotation.objects.exclude(status="Inactive")
    package_counts = list(qs.values("package").annotate(count=Count("id")).order_by("-count"))
    total_value = sum(float(q.include_tax) for q in qs)
    return ok({
        "totalQuotations": qs.count(),
        "pending": qs.filter(status="Pending").count(),
        "confirmed": qs.filter(status="Confirmed").count(),
        "totalCustomers": Customer.objects.count(),
        "totalUsers": User.objects.filter(is_active=True).count(),
        "totalProducts": Product.objects.filter(is_active=True).count(),
        "totalPackages": Package.objects.filter(is_active=True).count(),
        "totalValue": total_value,
        "pendingApprovals": ApprovalRequest.objects.filter(status=ApprovalRequest.PENDING).count(),
        "awaitingApproval": qs.filter(workflow_status__in=[
            Quotation.PENDING_APPROVAL, Quotation.PARTIALLY_APPROVED, Quotation.EDIT_REQUESTED]).count(),
        "packageCounts": [{"product": m["package"] or "Custom", "count": m["count"]} for m in package_counts],
    })


# ---------------------------------------------------------------- quotations monitor
@admin_api()
def quotations(request):
    rows = []
    for q in Quotation.objects.select_related("customer", "created_by").all():
        rows.append({
            "QuotationNumber": q.quotation_number,
            "CustomerName": q.customer.name,
            "Mobile": q.customer.mobile,
            "Package": q.package, "Configuration": q.configuration, "Room": q.room, "Tier": q.tier,
            "City": q.customer.city, "State": q.customer.state,
            "ExcludeTax": float(q.exclude_tax), "IncludeTax": float(q.include_tax),
            "Status": q.status,
            "WorkflowStatus": q.workflow_status, "WorkflowLabel": W.STATUS_LABEL[q.workflow_status],
            "DiscountPercent": float(q.discount_percent), "Version": q.current_version,
            "PendingLabel": W.pending_label(q) if q.workflow_status in (
                Quotation.PENDING_APPROVAL, Quotation.PARTIALLY_APPROVED, Quotation.EDIT_REQUESTED) else "",
            "CreatedByRole": q.created_by_role,
            "CreatedBy": q.created_by.name if q.created_by else "",
            "CreatedDate": q.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
            "CancelReason": q.cancel_reason,
            "QuoteFile": q.quote_file,
            "CustomerId": q.customer.id,
        })
    return ok(rows)


@admin_api()
def quotation_status(request):
    number = request.data.get("QuotationNumber")
    status = request.data.get("Status")
    if status not in dict(Quotation.STATUS_CHOICES):
        return fail("Invalid status.")
    Quotation.objects.filter(quotation_number=number).update(status=status)
    return ok({"Message": "Status updated."})


# ---------------------------------------------------------------- users
@admin_api()
def users(request):
    me = request.auth_user.id if request.auth_user else None
    rows = []
    for u in User.objects.filter(is_deleted=False).prefetch_related("roles").select_related("franchise", "reporting_manager").order_by("-id"):
        rows.append({
            "UserId": u.id, "Name": u.name, "Email": u.email, "Mobile": u.mobile,
            "EmployeeCode": u.employee_code, "Role": H.effective_role(u), "Roles": u.role_names,
            "Region": u.region,
            "ManagerId": u.reporting_manager_id,
            "Manager": u.reporting_manager.name if u.reporting_manager else "",
            "Franchize": u.franchise.name if u.franchise else "",
            "FranchiseId": u.franchise_id,
            "Status": "Active" if u.is_active else "Inactive",
            "IsSelf": u.id == me,
            "OpenApprovals": u.approval_steps.filter(status__in=["PENDING", "WAITING"], request__status="PENDING").count(),
        })
    return ok(rows)


@admin_api()
def toggle_user(request):
    uid = request.data.get("userId")
    active = bool(request.data.get("active"))
    # An admin must not be able to disable their own access.
    if not active and request.auth_user and str(uid) == str(request.auth_user.id):
        return fail("You cannot deactivate your own account.", 400)
    u = User.objects.filter(id=uid).first()
    if u is None:
        return fail("User not found.", 404)
    u.is_active = active
    u.save(update_fields=["is_active"])
    moved = 0
    if not active:
        # Pending approvals assigned to them move up the requester's chain.
        moved = W.escalate_for_inactive(u, request.auth_user)
    return ok({"Message": "User updated.", "EscalatedApprovals": moved})


@admin_api()
def user_refs(request):
    """Roles + franchises for the 'add user' form."""
    return ok({
        "Roles": [{"Id": r.id, "Name": r.name} for r in sorted(
            Role.objects.filter(name__in=H.ALL_ROLES), key=lambda r: H.role_level(r.name))],
        "Franchises": [{"Id": f.id, "Name": f.name} for f in Franchise.objects.all()],
        "Managers": [{"Id": u.id, "Name": u.name, "Role": H.effective_role(u), "Region": u.region}
                     for u in User.objects.filter(is_active=True).prefetch_related("roles").order_by("name")
                     if H.effective_role(u) in (H.ADMIN, H.DIRECTOR, H.RSD, H.RM, H.SR_BDM)],
    })


@admin_api()
def create_user(request):
    d = request.data or {}
    name = (d.get("name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    if not name or not email:
        return fail("Name and email are required.", 400)
    if len(password) < 8:
        return fail("Password must be at least 8 characters.", 400)
    if User.objects.filter(email=email).exists():
        return fail("A user with this email already exists.", 400)

    role_name = d.get("role") or "BDM"
    if role_name not in H.ROLE_LEVELS:
        return fail("Unknown role.", 400)
    manager = User.objects.filter(id=d.get("managerId")).first() if d.get("managerId") else None
    if manager is not None and H.role_level(H.effective_role(manager)) > H.role_level(role_name):
        return fail(f"A {role_name} cannot report to a {H.effective_role(manager)}.", 400)
    franchise = None
    fid = d.get("franchiseId")
    if fid:
        franchise = Franchise.objects.filter(id=fid).first()
    if franchise is None:
        franchise = Franchise.objects.filter(name="JAZ").first() or Franchise.objects.first()
    branch = Branch.objects.filter(franchise=franchise).first() if franchise else None

    is_admin_role = role_name == "Admin"
    user = User.objects.create(
        name=name, email=email, mobile=(d.get("mobile") or "").strip(),
        employee_code=(d.get("employeeCode") or "").strip(),
        franchise=franchise, branch=branch, reporting_manager=manager,
        region=(d.get("region") or "").strip(),
        is_staff=is_admin_role, is_superuser=is_admin_role,
    )
    user.set_password(password)
    user.save()
    role = Role.objects.filter(name=role_name).first()
    if role:
        user.roles.add(role)
    from accounts.emails import send_login_details

    emailed = send_login_details(user, password, request.auth_user)
    return ok({"UserId": user.id, "EmailSent": emailed,
               "Message": f"User created. Login details {'emailed to ' + user.email if emailed else 'could not be emailed'}."}, 201)


@admin_api()
def update_user(request):
    """Edit a user's profile, role and position in the hierarchy."""
    d = request.data or {}
    u = User.objects.filter(id=d.get("userId")).first()
    if u is None:
        return fail("User not found.", 404)
    role_name = d.get("role") or H.effective_role(u)
    if role_name not in H.ROLE_LEVELS:
        return fail("Unknown role.", 400)
    if u.id == request.auth_user.id and role_name != H.ADMIN:
        return fail("You cannot remove your own Admin role.", 400)
    manager = u.reporting_manager
    if "managerId" in d:
        manager = User.objects.filter(id=d.get("managerId")).first() if d.get("managerId") else None
    err = H.validate_assignment(u, role_name, manager)
    if err:
        return fail(err, 400)
    # Direct reports must not outrank the user's new role.
    for sub in u.reports.all():
        if H.role_level(H.effective_role(sub)) < H.role_level(role_name):
            return fail(f"{sub.name} ({H.effective_role(sub)}) reports to this user; reassign them first.", 400)
    # Personal details — validate everything before changing anything.
    if d.get("name") is not None and not str(d.get("name")).strip():
        return fail("Name cannot be empty.", 400)
    email = u.email
    if d.get("email") is not None:
        email = str(d.get("email")).strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return fail("Enter a valid email address.", 400)
        if User.objects.filter(email=email).exclude(id=u.id).exists():
            return fail("Another user already uses this email.", 400)
    franchise = u.franchise
    if d.get("franchiseId") not in (None, ""):
        franchise = Franchise.objects.filter(id=d.get("franchiseId")).first()
        if franchise is None:
            return fail("Unknown franchise.", 400)
    password = d.get("password") or ""
    if password and len(password) < 8:
        return fail("Password must be at least 8 characters.", 400)

    for src, attr in (("name", "name"), ("mobile", "mobile"), ("employeeCode", "employee_code"), ("region", "region")):
        if d.get(src) is not None:
            setattr(u, attr, str(d.get(src)).strip())
    u.email = email
    if franchise != u.franchise:
        u.franchise = franchise
        u.branch = Branch.objects.filter(franchise=franchise).first() if franchise else None
    if password:
        u.set_password(password)
    u.reporting_manager = manager
    is_admin_role = role_name == H.ADMIN
    u.is_staff = is_admin_role
    u.is_superuser = is_admin_role
    u.save()
    role = Role.objects.get_or_create(name=role_name)[0]
    u.roles.set([role])
    return ok({"Message": "User updated."})


@admin_api()
def org_tree(request):
    """Whole organisation as a forest (roots = users with no manager)."""
    users = list(User.objects.filter(is_deleted=False).prefetch_related("roles").order_by("name"))
    by_mgr = {}
    for u in users:
        by_mgr.setdefault(u.reporting_manager_id, []).append(u)
    counts = dict(
        Quotation.objects.exclude(status="Inactive").values("created_by_id")
        .annotate(c=Count("id")).values_list("created_by_id", "c")
    )
    seen = set()

    def order(x):
        return (H.role_level(H.effective_role(x)), x.name)

    def node(u):
        seen.add(u.id)
        kids = sorted(by_mgr.get(u.id, []), key=order)
        return {
            "Id": u.id, "Name": u.name, "Email": u.email, "Role": H.effective_role(u), "Region": u.region,
            "Active": u.is_active, "ManagerId": u.reporting_manager_id, "Quotations": counts.get(u.id, 0),
            "Children": [node(k) for k in kids if k.id not in seen],
        }

    return ok([node(r) for r in sorted(by_mgr.get(None, []), key=order)])


@admin_api()
def audit_log(request):
    d = request.data or {}
    qs = QuotationEvent.objects.select_related("quotation", "actor").order_by("-created_at", "-id")
    if d.get("quotationNumber"):
        qs = qs.filter(quotation__quotation_number__icontains=d["quotationNumber"])
    rows = [{
        "Id": e.id, "QuotationNumber": e.quotation.quotation_number, "Version": e.version_number,
        "Action": e.action, "Field": e.field, "PreviousValue": e.previous_value, "NewValue": e.new_value,
        "Note": e.note, "Status": e.status, "Actor": e.actor.name if e.actor else "System",
        "ActorRole": e.actor_role, "CreatedAt": e.created_at.isoformat(),
    } for e in qs[:1000]]
    return ok(rows)
