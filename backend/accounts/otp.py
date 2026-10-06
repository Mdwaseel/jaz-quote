"""Two-step login OTP + password-reset tokens: generation, hashing, emailing and verification."""
import hashlib
import hmac
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailOTP

MAX_ATTEMPTS = 5
RESET_TTL_MINUTES = 30


def _hash(code: str) -> str:
    """Keyed hash of the code so plaintext OTPs are never stored."""
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def otp_enabled() -> bool:
    """OTP is on only when explicitly enabled AND SMTP credentials are present."""
    return bool(getattr(settings, "OTP_ENABLED", False) and settings.EMAIL_HOST_USER)


def generate_and_send(user, purpose: str = "login") -> None:
    """Create a fresh OTP for the user, invalidate old ones, and email it."""
    length = int(getattr(settings, "OTP_LENGTH", 6))
    ttl = int(getattr(settings, "OTP_TTL_MINUTES", 5))
    code = "".join(secrets.choice("0123456789") for _ in range(length))

    # Invalidate any outstanding codes for this purpose.
    EmailOTP.objects.filter(user=user, purpose=purpose, consumed=False).update(consumed=True)
    EmailOTP.objects.create(
        user=user,
        code_hash=_hash(code),
        purpose=purpose,
        expires_at=timezone.now() + timedelta(minutes=ttl),
    )
    _send_email(user, code, ttl)


def verify(user, code: str, purpose: str = "login") -> tuple[bool, str]:
    """Return (ok, message). Consumes the OTP on success."""
    code = (code or "").strip()
    otp = (
        EmailOTP.objects.filter(user=user, purpose=purpose, consumed=False)
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        return False, "No active code. Please request a new one."
    if otp.expires_at < timezone.now():
        otp.consumed = True
        otp.save(update_fields=["consumed"])
        return False, "Code expired. Please request a new one."
    if otp.attempts >= MAX_ATTEMPTS:
        otp.consumed = True
        otp.save(update_fields=["consumed"])
        return False, "Too many attempts. Please request a new code."
    if not hmac.compare_digest(otp.code_hash, _hash(code)):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        return False, "Incorrect code."
    otp.consumed = True
    otp.save(update_fields=["consumed"])
    return True, "Verified."


def _send_email(user, code: str, ttl: int) -> None:
    subject = f"{code} is your JAZ Home Theatres verification code"
    text = (
        f"Hi {user.name or 'there'},\n\n"
        f"Your JAZ Home Theatres login verification code is: {code}\n\n"
        f"It expires in {ttl} minutes. If you did not try to sign in, you can ignore this email.\n\n"
        f"— JAZ Home Theatres"
    )
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f6f8;padding:32px">
  <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6ebf0">
    <div style="background:#14110d;padding:22px 28px;border-bottom:2px solid #a8813d">
      <span style="color:#d4ab55;font-size:22px;font-weight:700;letter-spacing:2px;font-family:Georgia,serif">JAZ</span>
      <span style="color:#f3ead8;font-size:10px;font-weight:700;letter-spacing:3px;margin-left:8px">HOME THEATRES</span>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 6px;color:#1c1813;font-size:16px;font-weight:600">Verify your sign-in</p>
      <p style="margin:0 0 20px;color:#67757f;font-size:14px">Hi {user.name or 'there'}, use this code to finish signing in.</p>
      <div style="text-align:center;background:#faf6ee;border:1px dashed #a8813d;border-radius:12px;padding:18px 0;margin-bottom:18px">
        <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#1c1813">{code}</span>
      </div>
      <p style="margin:0;color:#8a97a1;font-size:13px">This code expires in {ttl} minutes. If you didn't request it, ignore this email.</p>
    </div>
    <div style="padding:14px 28px;background:#fafbfc;border-top:1px solid #eef2f6;color:#9aa6b0;font-size:12px">
      © JAZ Home Theatres
    </div>
  </div>
</div>"""
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or settings.EMAIL_HOST_USER
    send_mail(subject, text, from_email, [user.email], html_message=html, fail_silently=False)


# ------------------------------------------------------------------ password reset

def generate_reset(user) -> None:
    """Create a single-use password-reset token and email a reset link."""
    token = secrets.token_urlsafe(32)
    EmailOTP.objects.filter(user=user, purpose="reset", consumed=False).update(consumed=True)
    EmailOTP.objects.create(
        user=user,
        code_hash=_hash(token),
        purpose="reset",
        expires_at=timezone.now() + timedelta(minutes=RESET_TTL_MINUTES),
    )
    _send_reset_email(user, token)


def verify_reset(user, token: str) -> bool:
    """Validate a reset token and consume it on success."""
    token = (token or "").strip()
    if not token:
        return False
    rec = (
        EmailOTP.objects.filter(user=user, purpose="reset", consumed=False)
        .order_by("-created_at")
        .first()
    )
    if rec is None:
        return False
    if rec.expires_at < timezone.now():
        rec.consumed = True
        rec.save(update_fields=["consumed"])
        return False
    if not hmac.compare_digest(rec.code_hash, _hash(token)):
        return False
    rec.consumed = True
    rec.save(update_fields=["consumed"])
    return True


def _send_reset_email(user, token: str) -> None:
    base = getattr(settings, "SITE_URL", "").rstrip("/")
    link = f"{base}/reset-password?" + urlencode({"token": token, "email": user.email})
    subject = "Reset your JAZ Home Theatres password"
    text = (
        f"Hi {user.name or 'there'},\n\n"
        f"We received a request to reset your JAZ Home Theatres password. Open the link below to choose a new one:\n\n"
        f"{link}\n\n"
        f"This link expires in {RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.\n\n"
        f"— JAZ Home Theatres"
    )
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f6f8;padding:32px">
  <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6ebf0">
    <div style="background:#14110d;padding:22px 28px;border-bottom:2px solid #a8813d">
      <span style="color:#d4ab55;font-size:22px;font-weight:700;letter-spacing:2px;font-family:Georgia,serif">JAZ</span>
      <span style="color:#f3ead8;font-size:10px;font-weight:700;letter-spacing:3px;margin-left:8px">HOME THEATRES</span>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 6px;color:#1c1813;font-size:16px;font-weight:600">Reset your password</p>
      <p style="margin:0 0 20px;color:#67757f;font-size:14px">Hi {user.name or 'there'}, click the button below to choose a new password.</p>
      <div style="text-align:center;margin-bottom:18px">
        <a href="{link}" style="display:inline-block;background:#1f1a14;color:#f3ead8;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px">Reset password</a>
      </div>
      <p style="margin:0;color:#8a97a1;font-size:13px">This link expires in {RESET_TTL_MINUTES} minutes. If you didn't request it, ignore this email.</p>
    </div>
    <div style="padding:14px 28px;background:#fafbfc;border-top:1px solid #eef2f6;color:#9aa6b0;font-size:12px">
      © JAZ Home Theatres
    </div>
  </div>
</div>"""
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or settings.EMAIL_HOST_USER
    send_mail(subject, text, from_email, [user.email], html_message=html, fail_silently=False)
