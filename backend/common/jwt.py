"""Minimal HS256 JWT implementation (stdlib only) — no external dependency.

Issued tokens are additionally wrapped with Fernet symmetric encryption (see
``common.crypto``) when a ``FERNET_KEY`` is configured, so the token that leaves
the server is opaque ciphertext rather than a readable ``header.payload.sig``
JWT. Decoding transparently unwraps it, and falls back to plain JWTs when no
key / the cryptography package is unavailable (offline dev)."""
import base64
import hashlib
import hmac
import json
import time

from django.conf import settings

from . import crypto


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(seg: str) -> bytes:
    pad = "=" * (-len(seg) % 4)
    return base64.urlsafe_b64decode(seg + pad)


def _sign(message: bytes) -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest()


def encode(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    p = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{h}.{p}".encode()
    sig = _b64url_encode(_sign(signing_input))
    jwt = f"{h}.{p}.{sig}"
    # Wrap in Fernet ciphertext when a key is configured (opaque token).
    return crypto.encrypt(jwt)


def decode(token: str) -> dict:
    # Unwrap Fernet ciphertext if present; plain JWTs pass through untouched.
    token = crypto.decrypt(token)
    try:
        h, p, sig = token.split(".")
    except ValueError:
        raise ValueError("Malformed token")
    signing_input = f"{h}.{p}".encode()
    expected = _b64url_encode(_sign(signing_input))
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Bad signature")
    payload = json.loads(_b64url_decode(p))
    if "exp" in payload and time.time() > payload["exp"]:
        raise ValueError("Token expired")
    return payload


def make_tokens(user) -> tuple[str, str]:
    now = int(time.time())
    common = {
        "sub": str(user.id),
        "name": user.name,
        "employeeCode": user.employee_code,
        "role": user.primary_role,
        "iat": now,
    }
    access = encode({**common, "type": "access", "exp": now + int(settings.JWT_ACCESS_LIFETIME.total_seconds())})
    refresh = encode({**common, "type": "refresh", "exp": now + int(settings.JWT_REFRESH_LIFETIME.total_seconds())})
    return access, refresh
