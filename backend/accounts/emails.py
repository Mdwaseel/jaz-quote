"""Account emails (welcome / login details)."""
import logging
import threading

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from . import hierarchy as H

log = logging.getLogger(__name__)


def _can_email(address):
    from quotes.notify import _email_enabled, _skip

    return _email_enabled() and not _skip(address)


def send_login_details(user, password, created_by=None):
    """Email a new user their login URL, email and password. Returns True when an
    email was queued (it is sent after the DB commit, in the background)."""
    if not _can_email(user.email):
        return False
    role = H.effective_role(user)
    base = settings.SITE_URL.rstrip("/")
    login_url = f"{base}/admin/login" if role == H.ADMIN else f"{base}/login"
    manager = user.reporting_manager.name if user.reporting_manager else None
    body = (
        f"Hello {user.name},\n\n"
        f"An account has been created for you on the JAZ Home Theatres quotation portal"
        f"{f' by {created_by.name}' if created_by else ''}.\n\n"
        f"Sign in here: {login_url}\n"
        f"Email: {user.email}\n"
        f"Temporary password: {password}\n"
        f"Role: {role}{f' (reporting to {manager})' if manager else ''}\n\n"
        "For your security, please change this password after you sign in "
        "(Profile → Change password). When you sign in, a one-time code may be emailed "
        "to you as a second step.\n\n"
        "— JAZ Home Theatres Quotation System"
    )
    message = ("Your JAZ Home Theatres quotation login details", body, user.email)

    def deliver():
        try:
            send_mail(message[0], message[1], settings.DEFAULT_FROM_EMAIL, [message[2]], fail_silently=False)
        except Exception:  # noqa: BLE001 — never fail account creation on email problems
            log.exception("Login-details email to %s failed", user.email)

    if "locmem" in settings.EMAIL_BACKEND:
        transaction.on_commit(deliver)
    else:
        transaction.on_commit(lambda: threading.Thread(target=deliver, daemon=True).start())
    return True
