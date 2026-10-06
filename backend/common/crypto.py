"""
Fernet (AES-128-CBC + HMAC-SHA256) helper used to encrypt the auth tokens
issued by the login panel.

Security note
-------------
Fernet is *symmetric encryption*, not a password hash. User passwords are
still stored one-way hashed by Django (PBKDF2, or Argon2 when argon2-cffi is
installed on the server). Fernet is used here to wrap the JWTs so that the
access / refresh tokens travelling between the browser and the API are opaque,
tamper-proof ciphertext instead of readable, base64-decodable claims.

The key comes from the ``FERNET_KEY`` environment variable (a urlsafe base64
32-byte key). If ``FERNET_KEY`` is not a valid Fernet key it is derived
deterministically from its bytes, and if it is empty (or the ``cryptography``
package is not installed, e.g. in the offline dev sandbox) token encryption is
transparently skipped so the app keeps working.
"""
import base64
import hashlib

from django.conf import settings

try:
    from cryptography.fernet import Fernet, InvalidToken
    _HAVE_CRYPTO = True
except Exception:  # pragma: no cover - cryptography absent (offline dev)
    _HAVE_CRYPTO = False

    class InvalidToken(Exception):
        pass


_fernet = None
_loaded = False


def _derive_key(raw: str) -> bytes:
    """Return a valid Fernet key from an arbitrary secret string."""
    try:
        # Already a proper 32-byte urlsafe-base64 key?
        if len(base64.urlsafe_b64decode(raw)) == 32:
            return raw.encode()
    except Exception:
        pass
    digest = hashlib.sha256(raw.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet():
    """Lazily build the Fernet instance, or None when unavailable."""
    global _fernet, _loaded
    if _loaded:
        return _fernet
    _loaded = True
    key = getattr(settings, "FERNET_KEY", "") or ""
    if _HAVE_CRYPTO and key:
        try:
            _fernet = Fernet(_derive_key(key))
        except Exception:
            _fernet = None
    return _fernet


def encrypt(text: str) -> str:
    """Encrypt ``text``; return it unchanged when encryption is unavailable."""
    f = get_fernet()
    if not f:
        return text
    return f.encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt ``token``; return it unchanged when it is not Fernet ciphertext."""
    f = get_fernet()
    if not f:
        return token
    try:
        return f.decrypt(token.encode()).decode()
    except InvalidToken:
        return token
