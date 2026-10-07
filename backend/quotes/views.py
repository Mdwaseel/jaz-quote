from pathlib import Path

from django.conf import settings
from django.db.models import Prefetch
from django.http import FileResponse

from accounts import hierarchy as H
from accounts.models import Bank
from common.api import api, fail, ok

from . import rules, workflow as W
from .models import ApprovalRequest as AR, ApprovalStep as AS, Customer, Notification, Quotation
from .pricing import compute_financials, normalize_items


def selected_bank(q):
    """The bank chosen on the quotation (SalesInfo.BankId), else the first configured one."""
    bid = (q.sales_info or {}).get("BankId")
    bank = Bank.objects.filter(id=bid).first() if str(bid or "").isdigit() else None
    return bank or Bank.objects.first()


def _bank_info(bank):
    if not bank:
        return None
    return {
        "Id": bank.id, "EntityId": bank.entity_id, "AccountHolderName": bank.account_holder_name,
        "BankName": bank.bank_name, "AccountNumber": bank.account_number,
        "IFSCCode": bank.ifsc_code, "BranchName": bank.branch_name,
    }


# ---------------------------------------------------------------- rules / live evaluation
@api(methods=("GET", "POST"))
def my_rules(request):
    """The logged-in user's limits, default terms and resolved approvers."""
    user = request.auth_user
    role = H.effective_role(user)
    return ok({**rules.role_policy(role), "approvers": H.chain_summary(user)})


@api()
def evaluate_quote(request):
    """Live builder feedback: authoritative price + which approvals the payload needs."""
    user = request.auth_user
    role = H.effective_role(user)
    d = request.data or {}
    product = d.get("ProductInfo") or {}
    try:
        items = normalize_items(product.get("Items"), product.get("PackageId"))
    except rules.RuleError as e:
        items, item_error = [], str(e)
    else:
        item_error = None
    try:
        pct = rules.dec(d.get("DiscountPercent"), "discount")
        if pct < 0 or pct > 100:
            raise rules.RuleError("Discount must be between 0% and 100%.")
        fin = compute_financials(product, pct, items=items)
        reqs = rules.evaluate(role, {
            "discount_percent": fin["effective_percent"], "warranty": d.get("WarrentyDetails"),
            "amc": d.get("Amc"), "payment_terms": d.get("PaymentTerms"),
        })
        error = item_error
    except rules.RuleError as e:
        fin, reqs, error = compute_financials(product, 0, items=items), [], str(e)
    creator = request.auth_user
    out = []
    for r in reqs:
        steps = []
        for step_role in r["path"]:
            a = H.resolve_approver(creator, step_role)
            steps.append({"Role": step_role, "Name": a.name if a else None})
        out.append({"Category": r["category"], "Label": W.CATEGORY_LABEL[r["category"]],
                    "Path": steps, "OutsideLimit": r["outside_limit"], "Requested": r["requested"],
                    "Standard": r["standard"]})
    return ok({
        "Priced": fin["priced"], "Error": error,
        "Financials": W.financials_block(fin, d.get("Amc") or []),
        "Items": fin["items"],
        "Approvals": out, "ApprovalRequired": bool(out),
    })


# ---------------------------------------------------------------- create / list / detail
@api()
def create_quote(request):
    quote = W.create_quotation(request.auth_user, request.data or {})
    return ok({
        "CustomerId": quote.customer_id, "QuotationNumber": quote.quotation_number,
        "WorkflowStatus": quote.workflow_status, "WorkflowLabel": W.STATUS_LABEL[quote.workflow_status],
    }, 201)


@api()
def update_quote(request):
    d = request.data or {}
    quote = W.update_quotation(request.auth_user, d.get("QuotationNumber"), d)
    return ok({"QuotationNumber": quote.quotation_number, "WorkflowStatus": quote.workflow_status,
               "WorkflowLabel": W.STATUS_LABEL[quote.workflow_status], "Version": quote.current_version})


def _list_row(user, q):
    can_dl, reason = W.download_state(user, q)
    creator_role = q.created_by_role
    return {
        "QuotationNumber": q.quotation_number, "CustomerName": q.customer.name,
        "CreatedDate": q.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
        "Package": q.package, "Configuration": q.configuration, "Room": q.room, "Tier": q.tier,
        "City": q.customer.city, "State": q.customer.state, "CustomerId": q.customer.id,
        "Status": q.status, "QuoteFile": q.quote_file,
        "WorkflowStatus": q.workflow_status, "WorkflowLabel": W.STATUS_LABEL[q.workflow_status],
        "FinalAmount": float(q.include_tax), "DiscountPercent": float(q.discount_percent),
        "Version": q.current_version,
        "DealStatus": q.deal_status, "DealReason": q.deal_reason,
        "CreatedBy": q.created_by.name if q.created_by else "", "CreatedByRole": creator_role,
        "IsMine": q.created_by_id == user.id,
        "IsLocked": q.workflow_status not in (Quotation.DRAFT, Quotation.EDITING) and creator_role in H.LOCKED_CREATOR_ROLES,
        "CanDownload": can_dl, "DownloadBlockedReason": reason,
        "CancelReason": q.cancel_reason, "CancelledAt": q.cancelled_at.isoformat() if q.cancelled_at else None,
    }


@api()
def get_quote_list(request):
    user = request.auth_user
    scope = (request.data or {}).get("scope") or "all"
    state = (request.data or {}).get("state") or "all"  # all | active | cancelled
    # Cancelled quotations are kept and listed (they used to be hidden, which looked like deletion).
    qs = W.visible_quotes(user).select_related("customer", "created_by")
    if state == "active":
        qs = qs.exclude(workflow_status=Quotation.CANCELLED)
    elif state == "cancelled":
        qs = qs.filter(workflow_status=Quotation.CANCELLED)
    if scope == "mine":
        qs = qs.filter(created_by=user)
    elif scope == "team":
        qs = qs.exclude(created_by=user)
    return ok([_list_row(user, q) for q in qs], 201)


def esign_block(user, q):
    from . import esign

    return esign.serialize(q, user)


@api(methods=("GET",))
def get_quote(request):
    number = request.GET.get("QuoteId")
    try:
        q = W.get_quote_for(request.auth_user, number)
    except W.WorkflowError:
        return ok({"response": None}, 201)
    c = q.customer
    bank = selected_bank(q)
    response = {
        "QuotationNumber": q.quotation_number,
        "CustomerId": c.id, "CustomerName": c.name, "CustomerMobile": c.mobile, "CustomerEmail": c.email,
        "CustomerAddress": c.address, "CustomerAddress2": c.address2 or c.address,
        "CityName": c.city, "StateName": c.state, "CountryName": c.country, "ZipCode": c.zipcode,
        "LandMark": c.landmark, "CreatedAt": q.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
        "Package": q.package, "Configuration": q.configuration, "Room": q.room, "Tier": q.tier,
        "ProductInfo": q.product_info, "BankInfo": _bank_info(bank), "PaymentTerms": q.payment_terms,
        "ExcludeTax": float(q.exclude_tax), "IncludeTax": float(q.include_tax), "Tax": float(q.tax),
        "SpecialCost": float(q.special_cost), "DiscountPercent": float(q.discount_percent),
        "BaseAmount": float(q.base_amount),
        "initialExcludeTax": float(q.exclude_tax), "initialIncludeTax": float(q.include_tax),
        "initialTax": float(q.tax), "initialSpecialCost": float(q.special_cost),
        "SalesInfo": q.sales_info, "WarrentyDetails": q.warranty_details, "Amc": q.amc_details,
        "Status": q.status,
        "Deal": {"Status": q.deal_status, "Label": q.get_deal_status_display(), "Reason": q.deal_reason,
                 "Note": q.deal_note, "ClosedAt": q.deal_closed_at.isoformat() if q.deal_closed_at else None,
                 "ClosedBy": q.deal_closed_by.name if q.deal_closed_by else None,
                 "LostReasons": __import__("quotes.deals", fromlist=["LOST_REASONS"]).LOST_REASONS},
        "Signatures": esign_block(request.auth_user, q),
        "Workflow": W.quote_state(request.auth_user, q),
    }
    return ok({"response": response}, 201)


@api()
def quote_history(request):
    q = W.get_quote_for(request.auth_user, (request.data or {}).get("QuotationNumber"))
    events = [{
        "Id": e.id, "Version": e.version_number, "Action": e.action, "Field": e.field,
        "PreviousValue": e.previous_value, "NewValue": e.new_value, "Note": e.note, "Status": e.status,
        "Actor": e.actor.name if e.actor else "System", "ActorRole": e.actor_role,
        "CreatedAt": e.created_at.isoformat(),
    } for e in q.events.select_related("actor")]
    versions = [{
        "Number": v.number, "Note": v.note, "CreatedAt": v.created_at.isoformat(),
        "CreatedBy": v.created_by.name if v.created_by else "",
        "Financials": (v.snapshot or {}).get("financials", {}),
        "Snapshot": v.snapshot,
        "IsApproved": v.number == q.approved_version,
    } for v in q.versions.select_related("created_by")]
    old_requests = [W.serialize_request(r) for r in q.approval_requests.select_related("requested_by", "quotation")
                    .prefetch_related("steps__assigned_to", "steps__acted_by")]
    return ok({"Events": events, "Versions": versions, "Requests": old_requests})


# ---------------------------------------------------------------- status actions
@api()
def confirm_quote(request):
    from . import deals

    deals.set_outcome(request.auth_user, request.data.get("QuoteNumber"), "WON")
    return ok({"Message": "Quote confirmed."})


@api()
def delete_quote(request):
    """Cancel a quotation (it is never deleted). Requires a reason from CANCEL_REASONS."""
    d = request.data or {}
    q = W.cancel_quotation(request.auth_user, W.get_quote_for(request.auth_user, d.get("QuotationNumber")),
                           d.get("Reason"), d.get("Note"))
    return ok({"Message": "Quotation cancelled.", "WorkflowStatus": q.workflow_status})


@api()
def restore_quote(request):
    d = request.data or {}
    q = W.restore_quotation(request.auth_user, W.get_quote_for(request.auth_user, d.get("QuotationNumber")),
                            d.get("Note"))
    return ok({"Message": "Quotation restored.", "WorkflowStatus": q.workflow_status,
               "WorkflowLabel": W.STATUS_LABEL[q.workflow_status]})


@api()
def edit_quote(request):
    """Legacy 'Rebate' endpoint — now routed through the approval engine."""
    d = request.data or {}
    number = d.get("QuoteNumber") or d.get("QuotationNumber")
    q = W.get_quote_for(request.auth_user, number)
    payload = {
        "CustomerName": q.customer.name, "CustomerMobile": q.customer.mobile, "CustomerEmail": q.customer.email,
        "CustomerAddress": q.customer.address, "CustomerAddress2": q.customer.address2,
        "CityName": q.customer.city, "StateName": q.customer.state, "CountryName": q.customer.country,
        "ZipCode": q.customer.zipcode, "LandMark": q.customer.landmark,
        "ProductInfo": q.product_info, "SalesInfo": q.sales_info, "PaymentTerms": q.payment_terms,
        "WarrentyDetails": q.warranty_details, "Amc": q.amc_details,
        "SpecialCost": d.get("SpecialCost"), "Reasons": d.get("Reasons") or {},
    }
    q = W.update_quotation(request.auth_user, number, payload)
    return ok({"Message": "Quote updated.", "ExcludeTax": float(q.exclude_tax), "IncludeTax": float(q.include_tax),
               "WorkflowStatus": q.workflow_status})


@api()
def set_signature(request):
    d = request.data or {}
    q = W.set_signature(request.auth_user, d.get("QuotationNumber"), d.get("Kind") or "customer", d.get("Image"))
    return ok({"Message": "Signature saved." if d.get("Image") else "Signature removed.",
               "SalesInfo": q.sales_info})


@api()
def request_edit(request):
    d = request.data or {}
    req = W.request_edit(request.auth_user, d.get("QuotationNumber"), d.get("Reason"), d.get("RequestedChanges"))
    return ok({"RequestId": req.id, "Message": "Edit request sent to your RM."}, 201)


@api()
def download_quote(request):
    d = request.data or {}
    user = request.auth_user
    if d.get("QuotationNumber"):
        q = W.get_quote_for(user, d.get("QuotationNumber"))
    else:  # legacy: by customer id
        q = Quotation.objects.filter(customer_id=d.get("customerId")).order_by("-created_at").first()
        if not q or not W.can_view(user, q):
            return fail("Quotation not found.", 404)
    allowed, reason = W.download_state(user, q)
    if not allowed:
        return fail(f"Download locked: {reason}", 423)
    from .pdf import generate_quote_pdf

    try:
        rel_path = generate_quote_pdf(q)
    except Exception as exc:  # noqa: BLE001
        return fail(f"Could not generate PDF: {exc}", 500)
    q.quote_file = rel_path
    q.save(update_fields=["quote_file"])
    W.record_download(user, q)

    full = Path(settings.MEDIA_ROOT) / rel_path
    if not full.exists():
        return fail("Generated PDF is missing.", 500)
    # Stream the file directly so it works with DEBUG=false (no reliance on
    # Django serving /media/) and the browser saves it without a popup.
    return FileResponse(
        open(full, "rb"),
        as_attachment=True,
        filename=f"{q.quotation_number}.pdf",
        content_type="application/pdf",
    )


@api()
def preview_quote(request):
    """Render a PDF from the submitted quote data WITHOUT saving it — used for the
    live preview on the Review step. Always watermarked as a non-valid preview so
    it can't stand in for an approved quotation. Prices are recomputed server-side."""
    from .pdf import generate_quote_pdf

    d = request.data or {}
    customer = Customer(
        name=d.get("CustomerName", ""), mobile=d.get("CustomerMobile", ""), email=d.get("CustomerEmail", ""),
        address=d.get("CustomerAddress", ""), address2=d.get("CustomerAddress2", ""), landmark=d.get("LandMark", ""),
        city=d.get("CityName", ""), state=d.get("StateName", ""), country=d.get("CountryName", "India"),
        zipcode=str(d.get("ZipCode", "") or ""),
    )
    try:
        data = W.normalize(H.effective_role(request.auth_user), d)
    except W.WorkflowError as e:
        return fail(str(e), 400)
    quote = Quotation(quotation_number=d.get("QuotationNumber") or "PREVIEW")
    W.apply_financials(quote, dict(data["product"]), data["fin"])
    quote.sales_info = data["sales"]
    quote.payment_terms, quote.warranty_details, quote.amc_details = data["payment_terms"], data["warranty"], data["amc"]
    quote.customer = customer  # in-memory relation for the renderer (never saved)
    try:
        rel_path = generate_quote_pdf(quote, watermark="PREVIEW — NOT A VALID QUOTATION")
    except Exception as exc:  # noqa: BLE001
        return fail(f"Could not generate preview: {exc}", 500)
    full = Path(settings.MEDIA_ROOT) / rel_path
    if not full.exists():
        return fail("Preview PDF is missing.", 500)
    return FileResponse(open(full, "rb"), content_type="application/pdf")


# ---------------------------------------------------------------- approvals
def _requests_qs():
    return AR.objects.select_related("quotation__customer", "quotation__created_by", "requested_by").prefetch_related(
        Prefetch("steps", queryset=AS.objects.select_related("assigned_to", "acted_by").order_by("order")))


def _actionable(user):
    qs = _requests_qs().filter(status=AR.PENDING)
    if H.is_admin(user):
        return qs.filter(steps__status=AS.PENDING, steps__assigned_to=user) | qs.filter(
            steps__status=AS.PENDING, steps__role=H.ADMIN)
    return qs.filter(steps__status=AS.PENDING, steps__assigned_to=user)


@api()
def approvals_list(request):
    """scope: pending (actionable by me) | team (requests on quotations I can see)
    | history (decided by me) | mine (raised by me) | all (Admin)."""
    user = request.auth_user
    d = request.data or {}
    scope = d.get("scope") or "pending"
    if scope == "pending":
        qs = _actionable(user)
    elif scope == "mine":
        qs = _requests_qs().filter(requested_by=user)
    elif scope == "history":
        qs = _requests_qs().filter(steps__acted_by=user)
    elif scope in ("team", "all"):
        if scope == "all" and not H.is_admin(user):
            return fail("Admin access required.", 403)
        ids = W.visible_user_ids(user)
        qs = _requests_qs() if ids is None else _requests_qs().filter(quotation__created_by_id__in=ids)
    else:
        return fail("Unknown scope.")
    if d.get("status"):
        qs = qs.filter(status=d["status"])
    if d.get("category"):
        qs = qs.filter(category=d["category"])
    rows = [W.serialize_request(r, include_quote=True, viewer=user) for r in qs.distinct().order_by("-created_at")[:500]]
    return ok(rows)


@api(methods=("GET", "POST"))
def approvals_counts(request):
    user = request.auth_user
    counts = {c: 0 for c, _ in AR.CATEGORY_CHOICES}
    for r in _actionable(user).distinct():
        counts[r.category] += 1
    mine = AR.objects.filter(requested_by=user, status=AR.PENDING).count()
    unread = Notification.objects.filter(user=user, is_read=False).count()
    return ok({"Pending": counts, "PendingTotal": sum(counts.values()), "MyOpenRequests": mine,
               "UnreadNotifications": unread})


@api()
def approvals_act(request):
    d = request.data or {}
    req = W.act(request.auth_user, d.get("requestId"), d.get("action"), d.get("note"), d.get("approvedPercent"))
    req.refresh_from_db()
    return ok(W.serialize_request(req, include_quote=True, viewer=request.auth_user))


@api()
def approvals_reassign(request):
    d = request.data or {}
    step = W.reassign_step(request.auth_user, d.get("stepId"), d.get("userId"), d.get("note") or "")
    return ok({"Message": "Approval reassigned.", "StepId": step.id})


# ---------------------------------------------------------------- notifications
@api()
def notifications_list(request):
    rows = Notification.objects.filter(user=request.auth_user).select_related("quotation")[:100]
    return ok([{
        "Id": n.id, "Subject": n.subject, "Body": n.body, "IsRead": n.is_read,
        "QuotationNumber": n.quotation.quotation_number if n.quotation else None,
        "CreatedAt": n.created_at.isoformat(),
    } for n in rows])


@api()
def notifications_read(request):
    qs = Notification.objects.filter(user=request.auth_user, is_read=False)
    ids = (request.data or {}).get("ids")
    if ids:
        qs = qs.filter(id__in=ids)
    qs.update(is_read=True)
    return ok({"Message": "Marked as read."})


# ---------------------------------------------------------------- team
@api()
def my_team(request):
    """The logged-in user's subtree as a nested tree (RM / RSD / Director views)."""
    from accounts.models import User

    user = request.auth_user
    ids = set(H.descendant_ids(user)) | {user.id}
    users = {u.id: u for u in User.objects.filter(id__in=ids, is_deleted=False).prefetch_related("roles")}
    children = {}
    for u in users.values():
        children.setdefault(u.reporting_manager_id, []).append(u)
    counts = {}
    for q in Quotation.objects.filter(created_by_id__in=ids).exclude(status="Inactive").values_list(
            "created_by_id", "workflow_status"):
        c = counts.setdefault(q[0], {"total": 0, "pending": 0})
        c["total"] += 1
        if q[1] in (Quotation.PENDING_APPROVAL, Quotation.PARTIALLY_APPROVED, Quotation.EDIT_REQUESTED):
            c["pending"] += 1

    def node(u):
        return {
            "Id": u.id, "Name": u.name, "Email": u.email, "Role": H.effective_role(u), "Region": u.region,
            "Active": u.is_active, "Quotations": counts.get(u.id, {}).get("total", 0),
            "PendingQuotations": counts.get(u.id, {}).get("pending", 0),
            "Children": [node(c) for c in sorted(children.get(u.id, []), key=lambda x: (H.role_level(H.effective_role(x)), x.name))],
        }

    return ok(node(user))


# ---------------------------------------------------------------- customer signatures
def _client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "")) or ""


@api()
def esign_send(request):
    from . import esign

    d = request.data or {}
    sig = esign.send_esign(request.auth_user, d.get("QuotationNumber"), d.get("Email"))
    return ok({"Message": f"Signing link sent to {sig.email}.", "Email": sig.email,
               "ExpiresAt": sig.expires_at.isoformat()}, 201)


@api()
def esign_onsite(request):
    from . import esign

    d = request.data or {}
    sig = esign.sign_onsite(request.auth_user, d.get("QuotationNumber"), d.get("Signature"), d.get("Photo"),
                            d.get("SignerName"), _client_ip(request), request.META.get("HTTP_USER_AGENT", ""))
    return ok({"Message": "Signed onsite.", "SignedAt": sig.signed_at.isoformat()}, 201)


@api(methods=("GET",), auth=False)
def esign_public(request, token):
    from . import esign

    return ok(esign.public_summary(esign.by_token(token, allow_signed=True)))


@api(methods=("GET",), auth=False)
def esign_public_pdf(request, token):
    from . import esign
    from .pdf import generate_quote_pdf

    sig = esign.by_token(token, allow_signed=True)
    rel = generate_quote_pdf(sig.quotation)
    full = Path(settings.MEDIA_ROOT) / rel
    handle = open(full, "rb")
    try:
        full.unlink()  # streamed from the open handle — customer views don't pile up on disk
    except OSError:
        pass  # Windows cannot remove an open file; harmless in development
    # Opened directly by the browser (a plain link), so it works on phones and in-app mail browsers.
    return FileResponse(handle, content_type="application/pdf", as_attachment=bool(request.GET.get("download")),
                        filename=f"{sig.quotation.quotation_number}.pdf")


@api(methods=("POST",), auth=False)
def esign_public_sign(request, token):
    from . import esign

    d = request.data or {}
    sig = esign.sign_with_token(token, d.get("Signature"), d.get("Photo"), d.get("Consent"), d.get("SignerName"),
                                _client_ip(request), request.META.get("HTTP_USER_AGENT", ""))
    return ok({"Message": "Thank you — your quotation is signed.", "SignedAt": sig.signed_at.isoformat()})


# ---------------------------------------------------------------- deal outcome + analysis
@api()
def deal_outcome(request):
    from . import deals

    d = request.data or {}
    q = deals.set_outcome(request.auth_user, d.get("QuotationNumber"), d.get("Outcome"), d.get("Reason"), d.get("Note"))
    return ok({"DealStatus": q.deal_status, "Status": q.status})


@api(methods=("GET", "POST"))
def deal_analysis(request):
    from . import deals

    if H.effective_role(request.auth_user) not in (H.ADMIN, H.DIRECTOR, H.RSD, H.RM):
        return fail("Only managers can see the deal analysis.", 403)
    try:
        days = int((request.data or {}).get("days") or request.GET.get("days") or 0)
    except ValueError:
        days = 0
    return ok(deals.analysis(request.auth_user, days))
