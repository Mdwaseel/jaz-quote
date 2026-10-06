"""Customer signatures: e-signature (emailed link) and onsite (salesperson's device).

Both capture a drawn signature plus a LIVE camera photo (the UI offers no upload):
  * ESIGN  — the customer reviews the quotation from a private link, signs, accepts
             the photo-use disclaimer and takes a selfie.
  * ONSITE — the customer signs on the salesperson's device and the salesperson takes
             a photo with the customer.
A signature belongs to one quotation version; editing the quotation needs a new one.
Only fully-approved quotations can be signed (the customer never signs a price that
could still change).
"""
import base64
import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from accounts import hierarchy as H

from .models import CustomerSignature as CS, Quotation as Q
from .notify import notify
from .workflow import WorkflowError, can_view, clean_signature, download_state, log, financials, STATUS_LABEL

LINK_DAYS = 14
PHOTO_RE = re.compile(r"^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$")
MAX_PHOTO_BYTES = 2_000_000

CONSENT_TEXT = (
    "I confirm that I have reviewed this quotation and that this is my signature. "
    "I agree that JAZ Home Theatres may take my photo at the time of signing. The photo will be "
    "used solely to verify my identity for this signature and will not be used for any "
    "other purpose."
)
ONSITE_CONSENT_TEXT = (
    "The customer has signed this quotation in person and agreed to a photo being taken "
    "with the JAZ Home Theatres representative, used solely to verify the signature."
)


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def clean_photo(value):
    value = (value or "").strip()
    m = PHOTO_RE.match(value)
    if not m:
        raise WorkflowError("A live photo is required.")
    try:
        raw = base64.b64decode(m.group(2), validate=True)
    except ValueError:
        raise WorkflowError("The photo could not be read — please take it again.")
    if len(raw) > MAX_PHOTO_BYTES:
        raise WorkflowError("The photo is too large — please take it again.")
    return value


def signable(quote):
    """(ok, reason) — only fully approved, live quotations can be signed."""
    if quote.workflow_status in (Q.CANCELLED, Q.EXPIRED, Q.DRAFT):
        return False, f"This quotation is {STATUS_LABEL[quote.workflow_status].lower()}."
    if quote.approved_version != quote.current_version or quote.workflow_status not in (
            Q.APPROVED, Q.DOWNLOADED, Q.EDIT_REQUESTED):
        return False, "The quotation can be signed once all approvals are complete."
    return True, ""


def current_signature(quote):
    """The customer's valid signature for the quotation's current version, if any."""
    return quote.customer_signatures.filter(status=CS.SIGNED, version_number=quote.current_version).first()


def _record_signature(sig, quote, signature, photo, signer_name, ip, ua, actor=None):
    now = timezone.now()
    sig.signature, sig.photo = signature, photo
    sig.signer_name = (signer_name or quote.customer.name or "").strip()[:160]
    sig.status, sig.signed_at = CS.SIGNED, now
    sig.ip_address, sig.user_agent = (ip or "")[:64], (ua or "")[:300]
    sig.save()
    # Older signatures / pending links for this quotation are superseded.
    quote.customer_signatures.exclude(id=sig.id).filter(status__in=[CS.SENT, CS.SIGNED]).update(status=CS.CANCELLED)
    # The PDF prints the customer's signature in every "Signature with date" slot.
    quote.sales_info = {**(quote.sales_info or {}), "CustomerSign": signature}
    quote.save(update_fields=["sales_info", "updated_at"])
    how = "e-signature" if sig.method == CS.ESIGN else "onsite"
    log(quote, actor, f"Customer Signed ({'E-signature' if sig.method == CS.ESIGN else 'Onsite'})",
        field="SIGNATURE", new={"version": sig.version_number, "signer": sig.signer_name, "method": how},
        note=f"Signed by {sig.signer_name}" + (f" via link sent to {sig.email}" if sig.email else ""))
    return sig


# ---------------------------------------------------------------- e-signature
@transaction.atomic
def send_esign(user, number, email):
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer").filter(quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    ok_, reason = signable(quote)
    if not ok_:
        raise WorkflowError(reason)
    email = (email or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise WorkflowError("Enter a valid email address for the customer.")
    quote.customer_signatures.filter(status=CS.SENT).update(status=CS.CANCELLED)
    token = secrets.token_urlsafe(32)
    sig = CS.objects.create(quotation=quote, version_number=quote.current_version, method=CS.ESIGN,
                            email=email, token_hash=_hash(token), created_by=user,
                            expires_at=timezone.now() + timedelta(days=LINK_DAYS))
    link = f"{settings.SITE_URL.rstrip('/')}/sign/{token}"
    log(quote, user, "Sent for E-signature", field="SIGNATURE", new={"email": email, "version": quote.current_version})
    _email_customer(quote, email, link)
    return sig


def _email_customer(quote, email, link):
    from django.core.mail import send_mail

    from .notify import _deliver, _email_enabled, _skip

    sales = quote.sales_info or {}
    body = (
        f"Dear {quote.customer.name},\n\n"
        f"Thank you for considering JAZ Home Theatres for your home cinema. Please review your quotation "
        f"{quote.quotation_number} and sign it using the secure link below:\n\n{link}\n\n"
        f"The link is personal to you and expires in {LINK_DAYS} days. As part of signing, "
        "you will be asked to take a photo for identity verification only.\n\n"
        f"If you have any questions, please contact {sales.get('SalesBy') or 'your JAZ representative'}.\n\n"
        "— JAZ Home Theatres"
    )
    if not _email_enabled() or _skip(email):
        return False
    messages = [(f"Please review and sign your JAZ Home Theatres quotation {quote.quotation_number}", body, email)]
    if "locmem" in settings.EMAIL_BACKEND:
        transaction.on_commit(lambda: _deliver(messages))
    else:
        import threading

        transaction.on_commit(lambda: threading.Thread(target=_deliver, args=(messages,), daemon=True).start())
    return True


def by_token(token):
    sig = CS.objects.select_related("quotation__customer").filter(token_hash=_hash(token or ""), method=CS.ESIGN).first()
    if sig is None:
        raise WorkflowError("This signing link is not valid.", 404)
    if sig.status == CS.SIGNED:
        raise WorkflowError("This quotation has already been signed. Thank you!", 410)
    if sig.status == CS.CANCELLED:
        raise WorkflowError("This signing link has been replaced by a newer one. Please use the latest email.", 410)
    if sig.expires_at and sig.expires_at < timezone.now():
        sig.status = CS.EXPIRED
        sig.save(update_fields=["status"])
        raise WorkflowError("This signing link has expired. Please ask your JAZ representative for a new one.", 410)
    if sig.status != CS.SENT:
        raise WorkflowError("This signing link is no longer active.", 410)
    quote = sig.quotation
    if sig.version_number != quote.current_version or not signable(quote)[0]:
        raise WorkflowError("This quotation has changed since the link was sent. Please ask for a new link.", 410)
    return sig


def public_summary(sig):
    q = sig.quotation
    if not sig.viewed_at:
        sig.viewed_at = timezone.now()
        sig.save(update_fields=["viewed_at"])
    p = q.product_info or {}
    return {
        "QuotationNumber": q.quotation_number, "CustomerName": q.customer.name, "Email": sig.email,
        "Date": q.created_at.strftime("%d %b %Y"), "Version": sig.version_number,
        "Project": {k: p.get(k) for k in ("Package", "Configuration", "Tier", "Room", "ProjectType", "Seats",
                                          "RoomLength", "RoomWidth", "RoomHeight")},
        "Items": [{k: i.get(k) for k in ("Category", "Name", "Brand", "Qty", "Unit")}
                  for i in (p.get("Items") or []) if not i.get("Optional")],
        "Financials": financials(q), "PaymentTerms": q.payment_terms,
        "Warranty": q.warranty_details, "Amc": q.amc_details,
        "SalesBy": (q.sales_info or {}).get("SalesBy") or "",
        "Consent": CONSENT_TEXT, "ExpiresAt": sig.expires_at.isoformat() if sig.expires_at else None,
    }


@transaction.atomic
def sign_with_token(token, signature, photo, consent, signer_name, ip, ua):
    sig = by_token(token)
    sig = CS.objects.select_for_update(of=("self",)).get(id=sig.id)
    if sig.status != CS.SENT:
        raise WorkflowError("This quotation has already been signed.", 410)
    if consent is not True:
        raise WorkflowError("Please accept the terms to continue.")
    signature = clean_signature(signature, "Signature")
    if not signature:
        raise WorkflowError("Please draw your signature.")
    photo = clean_photo(photo)
    sig.consent_text = CONSENT_TEXT
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer", "created_by").get(id=sig.quotation_id)
    _record_signature(sig, quote, signature, photo, signer_name, ip, ua)
    notify([quote.created_by] + ([H.resolve_approver(quote.created_by, H.RM)] if quote.created_by else []), quote,
           "esign_signed", f"{sig.signer_name} signed quotation {quote.quotation_number} by e-signature "
                           f"({sig.email}). The signed PDF now includes their signature.")
    return sig


# ---------------------------------------------------------------- onsite
@transaction.atomic
def sign_onsite(user, number, signature, photo, signer_name, ip, ua):
    quote = Q.objects.select_for_update(of=("self",)).select_related("customer", "created_by").filter(
        quotation_number=number).first()
    if quote is None or not can_view(user, quote):
        raise WorkflowError("Quotation not found.", 404)
    ok_, reason = signable(quote)
    if not ok_:
        raise WorkflowError(reason)
    signature = clean_signature(signature, "Customer signature")
    if not signature:
        raise WorkflowError("The customer's signature is required.")
    photo = clean_photo(photo)
    sig = CS(quotation=quote, version_number=quote.current_version, method=CS.ONSITE, created_by=user,
             consent_text=ONSITE_CONSENT_TEXT)
    return _record_signature(sig, quote, signature, photo, signer_name, ip, ua, actor=user)


def serialize(quote, viewer):
    """Signature block for the quotation page."""
    valid = current_signature(quote)
    pending = quote.customer_signatures.filter(status=CS.SENT, version_number=quote.current_version).first()
    last = quote.customer_signatures.filter(status=CS.SIGNED).first()
    ok_, reason = signable(quote)

    def row(s, with_images):
        if s is None:
            return None
        return {
            "Id": s.id, "Method": s.method, "MethodLabel": s.get_method_display(), "Status": s.status,
            "Version": s.version_number, "Email": s.email, "SignerName": s.signer_name,
            "SignedAt": s.signed_at.isoformat() if s.signed_at else None,
            "SentAt": s.created_at.isoformat(), "ViewedAt": s.viewed_at.isoformat() if s.viewed_at else None,
            "ExpiresAt": s.expires_at.isoformat() if s.expires_at else None,
            "By": s.created_by.name if s.created_by else None,
            **({"Signature": s.signature, "Photo": s.photo} if with_images else {}),
        }

    return {
        "CanSign": ok_ and can_view(viewer, quote), "BlockedReason": reason,
        "Current": row(valid, True), "Pending": row(pending, False),
        "Outdated": row(last, False) if last and (valid is None or last.id != valid.id) else None,
        "CustomerEmail": quote.customer.email,
    }
