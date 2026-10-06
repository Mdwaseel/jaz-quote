"""Lightweight view helpers reproducing the original API's JSON envelope + JWT auth."""
import functools
import json

from django.http import JsonResponse

from accounts.models import User

from . import jwt


def ok(data=None, status_code=200):
    return JsonResponse({"success": True, "statusCode": status_code, "data": data})


def fail(message, status_code=400):
    return JsonResponse(
        {"success": False, "statusCode": status_code, "message": message}, status=status_code
    )


def _parse_body(request):
    if request.body:
        try:
            return json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}
    return {}


def _authenticate(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    try:
        payload = jwt.decode(token)
        if payload.get("type") != "access":
            return None
        return User.objects.filter(id=payload["sub"], is_active=True).first()
    except Exception:
        return None


def api(methods=("POST",), auth=True):
    """Decorator: enforce method + auth, parse JSON, wrap errors in the envelope."""

    def decorator(view):
        @functools.wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method == "OPTIONS":
                return ok(None)
            if request.method not in methods:
                return fail("Method not allowed.", 405)
            request.data = _parse_body(request)
            user = _authenticate(request)
            request.auth_user = user
            if auth and user is None:
                return fail("Unauthorized.", 401)
            try:
                return view(request, *args, **kwargs)
            except Exception as exc:  # noqa: BLE001 - surface as envelope error
                # Domain errors (e.g. quotes.workflow.WorkflowError) carry their own status.
                return fail(str(exc) or "Internal error.", getattr(exc, "status", 500))

        wrapped.csrf_exempt = True
        return wrapped

    return decorator
