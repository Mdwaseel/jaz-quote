"""
Django settings for the JAZ Home Theatres quotation backend.

Pure-Django implementation (no DRF) reproducing the original quoteauth / quoteapi
services and their {success, statusCode, data} envelope.

Configuration is environment-driven so the same code runs locally (SQLite) and
on a VPS (PostgreSQL). Copy ``.env.example`` to ``.env`` and fill it in — the
file is loaded automatically at startup (no external dependency required).
"""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Minimal .env loader (avoids a hard dependency on python-dotenv)
# ---------------------------------------------------------------------------
def _load_dotenv(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


_load_dotenv(BASE_DIR / ".env")


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    return str(os.environ.get(key, str(default))).lower() in ("1", "true", "yes", "on")


def env_list(key, default=""):
    raw = os.environ.get(key, default)
    return [x.strip() for x in raw.split(",") if x.strip()]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env("SECRET_KEY", "django-insecure-brio-quotation-dev-key-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "*" if DEBUG else "")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

# Fernet key used to encrypt issued auth tokens (see common/crypto.py).
FERNET_KEY = env("FERNET_KEY", "")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "catalog",
    "quotes",
    "dashboard",
    "adminpanel",
]

MIDDLEWARE = [
    "common.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# WhiteNoise is optional locally; drop it from the chain if not installed.
try:
    import whitenoise  # noqa: F401
except Exception:
    MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]

ROOT_URLCONF = "brio.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "brio.wsgi.application"


# ---------------------------------------------------------------------------
# Database — PostgreSQL when DB_ENGINE=postgres (VPS), SQLite otherwise (dev)
# ---------------------------------------------------------------------------
if env("DB_ENGINE", "sqlite").lower() in ("postgres", "postgresql", "psql"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", "jaz"),
            "USER": env("DB_USER", "jaz"),
            "PASSWORD": env("DB_PASSWORD", ""),
            "HOST": env("DB_HOST", "127.0.0.1"),
            "PORT": env("DB_PORT", "5432"),
            "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / env("SQLITE_NAME", "jaz.sqlite3"),
        }
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

# Prefer Argon2 when argon2-cffi is installed (VPS); fall back to PBKDF2 (dev).
_password_hashers = []
try:
    import argon2  # noqa: F401
    _password_hashers.append("django.contrib.auth.hashers.Argon2PasswordHasher")
except Exception:
    pass
_password_hashers += [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]
PASSWORD_HASHERS = _password_hashers

LOGIN_REDIRECT_URL = "/admin/"
LOGIN_URL = "/admin/login/"


# ---------------------------------------------------------------------------
# I18N / TZ
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = False  # avoid zoneinfo/tzdata dependency on Windows


# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
        if not DEBUG and "whitenoise.middleware.WhiteNoiseMiddleware" in MIDDLEWARE
        else "django.contrib.staticfiles.storage.StaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# JWT (hand-rolled HS256 + Fernet wrapping, see common/jwt.py & common/crypto.py)
# ---------------------------------------------------------------------------
JWT_ACCESS_LIFETIME = timedelta(days=1)
JWT_REFRESH_LIFETIME = timedelta(days=7)


# ---------------------------------------------------------------------------
# Email (SMTP) — used to deliver two-step login OTPs
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@jazhometheatres.com")
EMAIL_TIMEOUT = int(env("EMAIL_TIMEOUT", "20"))

# ---------------------------------------------------------------------------
# Two-step login OTP
# ---------------------------------------------------------------------------
OTP_ENABLED = env_bool("OTP_ENABLED", True)
OTP_LENGTH = int(env("OTP_LENGTH", "6"))
OTP_TTL_MINUTES = int(env("OTP_TTL_MINUTES", "5"))

# Public base URL, used to build password-reset links in emails.
SITE_URL = env("SITE_URL", "http://localhost:3000")


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Same-origin behind Nginx in production; open in dev for the Vite proxy.
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", DEBUG)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "")


# ---------------------------------------------------------------------------
# Production security hardening (only when DEBUG is off)
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
