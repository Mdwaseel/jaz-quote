"""Workflow notifications: an in-app Notification row plus an email.

Emails go to the actual person resolved from the org hierarchy. They are sent
after the DB transaction commits, in a background thread, and never break the
request if SMTP fails.
"""
import logging
import threading

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .models import Notification

log = logging.getLogger(__name__)

SUBJECTS = {
    "request": "Quotation Approval Required — {no}",
    "approved": "Quotation Approved — {no}",
    "rejected": "Quotation Rejected — {no}",
    "next_level": "Quotation Moved to Next Approval Level — {no}",
    "escalated": "Quotation Escalated to Admin — {no}",
    "downloadable": "Quotation Ready for Download — {no}",
    "downloaded": "Quotation Downloaded — {no}",
    "changed": "Quotation Details Changed — {no}",
    "edit_request": "Quotation Edit Requested — {no}",
    "edit_approved": "Quotation Edit Approved — {no}",
    "edit_rejected": "Quotation Edit Rejected — {no}",
    "reassigned": "Approval Reassigned to You — {no}",
    "needs_reassign": "Pending Approvals Need Reassignment — {no}",
    "transferred": "Quotations Transferred to You — {no}",
    "esign_signed": "Quotation Signed by Customer — {no}",
    "deal": "Deal Update — {no}",
    "cancelled": "Quotation Cancelled — {no}",
    "restored": "Quotation Restored — {no}",
}


def _email_enabled():
    backend = settings.EMAIL_BACKEND
    if "smtp" in backend and not settings.EMAIL_HOST_USER:
        return False
    return getattr(settings, "WORKFLOW_EMAILS_ENABLED", True)


def _skip(address):
    domains = getattr(settings, "NOTIFY_SKIP_DOMAINS", ["example.com"])
    return not address or address.rsplit("@", 1)[-1].lower() in domains


def _deliver(messages):
    for subject, body, to in messages:
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
        except Exception:  # noqa: BLE001 — never fail the workflow on email problems
            log.exception("Workflow email to %s failed", to)


def notify(users, quote, kind, body, **fmt):
    """Notify each distinct active user. ``kind`` selects the subject line."""
    subject = SUBJECTS[kind].format(no=quote.quotation_number, **fmt)
    link = f"{settings.SITE_URL.rstrip('/')}/quotation/view/{quote.quotation_number}"
    full_body = f"{body}\n\nOpen the quotation: {link}\n\n— JAZ Home Theatres Quotation System"
    seen, messages = set(), []
    for u in users:
        if u is None or u.id in seen or not u.is_active:
            continue
        seen.add(u.id)
        Notification.objects.create(user=u, quotation=quote, subject=subject, body=body)
        if _email_enabled() and not _skip(u.email):
            messages.append((subject, full_body, u.email))
    if not messages:
        return
    if "locmem" in settings.EMAIL_BACKEND:  # tests: deliver synchronously
        transaction.on_commit(lambda: _deliver(messages))
    else:
        transaction.on_commit(lambda: threading.Thread(target=_deliver, args=(messages,), daemon=True).start())
