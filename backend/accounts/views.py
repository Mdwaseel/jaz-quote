import secrets
from django.conf import settings
from django.contrib.auth import authenticate
from django.http import JsonResponse

import functools

from common.api import api, fail, ok
from common import jwt

from . import hierarchy as H

from . import otp as otp_service
from .models import Bank, Branch, Franchise, Role, User


def _user_profile_payload(user):
    return {
        "userId": user.id,
        "profileImage": user.profile_image,
        "profileName": user.name,
        "employeeCode": user.employee_code,
        "roles": user.role_names or ([user.primary_role] if user.primary_role else []),
        # Highest-authority role — drives the role-based UI. The API re-checks it.
        "role": H.effective_role(user),
        "region": user.region,
        "reportingManager": user.reporting_manager.name if user.reporting_manager else "",
        "franchize": user.franchise.name if user.franchise else "",
    }


def admin_only(view):
    """Only Admins may manage users / org structure (Directors and below may not)."""
    @functools.wraps(view)
    def checked(request, *args, **kwargs):
        if not H.is_admin(request.auth_user):
            return fail("Admin access required.", 403)
        return view(request, *args, **kwargs)

    return checked


def _issue_tokens(user):
    access, refresh = jwt.make_tokens(user)
    # Original returns a bare object (no envelope) for auth endpoints.
    return JsonResponse(
        {"accessToken": access, "refreshToken": refresh, "userProfile": _user_profile_payload(user)}
    )


def _mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    if not domain:
        return email
    shown = name[:2] if len(name) > 2 else name[:1]
    return f"{shown}{'*' * max(1, len(name) - len(shown))}@{domain}"


# ---------------------------------------------------------------- auth/*
@api(methods=("POST",), auth=False)
def login(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    user = authenticate(request, username=email, password=password)
    if user is None:
        return fail("Invalid email or password.", 401)
    if not user.is_active:
        return fail("Account is inactive.", 403)

    # Step 1 of two-step verification: password is correct, now email an OTP.
    if otp_service.otp_enabled():
        try:
            otp_service.generate_and_send(user, purpose="login")
        except Exception:
            return fail("Could not send the verification code. Please try again.", 502)
        return JsonResponse({
            "otpRequired": True,
            "email": user.email,
            "maskedEmail": _mask_email(user.email),
            "message": f"A 6-digit code was sent to {_mask_email(user.email)}.",
        })

    # OTP disabled (e.g. no SMTP configured) → single-step login.
    return _issue_tokens(user)


@api(methods=("POST",), auth=False)
def verify_otp(request):
    email = (request.data.get("email") or "").strip().lower()
    code = request.data.get("otp") or request.data.get("code") or ""
    user = User.objects.filter(email=email, is_active=True).first()
    if user is None:
        return fail("Invalid or expired code.", 401)
    ok_, message = otp_service.verify(user, code, purpose="login")
    if not ok_:
        return fail(message, 401)
    return _issue_tokens(user)


@api(methods=("POST",), auth=False)
def resend_otp(request):
    email = (request.data.get("email") or "").strip().lower()
    user = User.objects.filter(email=email, is_active=True).first()
    # Generic response regardless of whether the account exists (no enumeration).
    if user is not None and otp_service.otp_enabled():
        try:
            otp_service.generate_and_send(user, purpose="login")
        except Exception:
            return fail("Could not send the verification code. Please try again.", 502)
    return JsonResponse({"message": "If the account exists, a new code has been sent."})


@api(methods=("POST",), auth=False)
def forgot_password(request):
    email = (request.data.get("email") or "").strip().lower()
    user = User.objects.filter(email=email, is_active=True).first()
    # Generic response (no account enumeration).
    if user is not None and settings.EMAIL_HOST_USER:
        try:
            otp_service.generate_reset(user)
        except Exception:
            return fail("Could not send the reset email. Please try again.", 502)
    return JsonResponse({"message": "If that email is registered, a reset link has been sent."})


@api(methods=("POST",), auth=False)
def reset_password(request):
    email = (request.data.get("email") or "").strip().lower()
    token = request.data.get("token") or ""
    password = request.data.get("password") or ""
    if len(password) < 8:
        return fail("Password must be at least 8 characters.", 400)
    user = User.objects.filter(email=email, is_active=True).first()
    if user is None or not otp_service.verify_reset(user, token):
        return fail("This reset link is invalid or has expired.", 400)
    user.set_password(password)
    user.save(update_fields=["password"])
    return JsonResponse({"message": "Password updated. You can now sign in."})


@api(methods=("POST",), auth=False)
def refresh_token(request):
    token = request.data.get("refreshToken") or request.data.get("RefreshToken")
    if not token:
        return fail("Refresh token is required.", 400)
    try:
        payload = jwt.decode(token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user = User.objects.get(id=payload["sub"], is_active=True)
    except Exception:
        return fail("Invalid refresh token.", 401)
    access, new_refresh = jwt.make_tokens(user)
    from django.http import JsonResponse

    return JsonResponse({"accessToken": access, "refreshToken": new_refresh})


@api(methods=("POST",), auth=False)
def logout(request):
    from django.http import JsonResponse

    return JsonResponse({"message": "Logged out."})


# ---------------------------------------------------------------- user/*
@api()
def get_user_profile(request):
    u = request.auth_user
    return ok(
        {
            "UserId": u.id,
            "Name": u.name,
            "Email": u.email,
            "Mobile": u.mobile,
            "EmployeeCode": u.employee_code,
            "ProfileImage": u.profile_image,
            "Signature": u.signature,
            "Roles": u.role_names,
            "Franchize": u.franchise.name if u.franchise else "",
            "Branch": u.branch.name if u.branch else "",
            "ReportingManager": u.reporting_manager.name if u.reporting_manager else "",
            "Role": H.effective_role(u),
            "Region": u.region,
            "Approvers": H.chain_summary(u),
        }
    )


@api(methods=("GET", "POST"))
def me(request):
    """Fresh profile (roles can change after login) for the role-based UI."""
    return ok(_user_profile_payload(request.auth_user))


@api()
def get_roles(request):
    return ok([{"Id": r.id, "Roles": r.name} for r in Role.objects.all().order_by("id")])


@api()
def get_franchize(request):
    return ok([{"Id": f.id, "FranchizeName": f.name} for f in Franchise.objects.all().order_by("id")])


@api()
def get_franchize_short_code(request):
    f = Franchise.objects.filter(id=request.data.get("franchizeId")).first()
    return ok({"shortCode": f.short_code if f else ""})


@api()
def get_branch(request):
    fid = request.data.get("franchizeId")
    qs = Branch.objects.filter(franchise_id=fid) if fid else Branch.objects.all()
    return ok([
        {"Id": b.id, "BranchName": b.name, "Address": b.address, "City": b.city, "State": b.state}
        for b in qs
    ])


@api()
def get_branch_list(request):
    return ok([
        {
            "Id": b.id, "BranchName": b.name, "Franchize": b.franchise.name,
            "Address": b.address, "City": b.city, "State": b.state, "Pincode": b.pincode,
        }
        for b in Branch.objects.select_related("franchise").all()
    ])


@api()
@admin_only
def get_reporting_manager(request):
    fid = request.data.get("franchizeId")
    qs = User.objects.filter(is_active=True)
    if fid:
        qs = qs.filter(franchise_id=fid)
    return ok([{"Id": u.id, "Name": u.name, "EmployeeCode": u.employee_code} for u in qs])


@api()
@admin_only
def get_rm_by_userid(request):
    u = User.objects.filter(id=request.data.get("userId")).first()
    rm = u.reporting_manager if u else None
    return ok({"ReportingManagerId": rm.id if rm else None, "ReportingManager": rm.name if rm else ""})


@api()
def get_bank_list(request):
    return ok([
        {
            "Id": b.id, "EntityId": b.entity_id, "AccountHolderName": b.account_holder_name,
            "BankName": b.bank_name, "AccountNumber": b.account_number,
            "IFSCCode": b.ifsc_code, "BranchName": b.branch_name,
        }
        for b in Bank.objects.all()
    ])


@api()
@admin_only
def user_list(request):
    rows = []
    for u in User.objects.filter(is_deleted=False).prefetch_related("roles").select_related("franchise").order_by("-id"):
        rows.append(
            {
                "UserId": u.id, "Name": u.name, "Email": u.email, "Mobile": u.mobile,
                "DOJ": u.date_of_joining.isoformat() if u.date_of_joining else None,
                "EmployeeCode": u.employee_code, "Role": u.primary_role,
                "Franchize": u.franchise.name if u.franchise else "",
                "Status": "Active" if u.is_active else "Inactive",
            }
        )
    return ok({"StatusCode": 200, "Message": "User list fetched successfully.", "Data": rows})


@api()
@admin_only
def create_user(request):
    d = request.data
    email = (d.get("Email") or d.get("email") or "").strip().lower()
    if not email:
        return fail("Email is required.")
    if User.objects.filter(email=email).exists():
        return fail("A user with this email already exists.")
    # No shared default password: generate one and email it when the admin leaves it blank.
    password = d.get("Password") or secrets.token_urlsafe(9)
    user = User.objects.create_user(
        email=email,
        password=password,
        name=d.get("Name") or d.get("name") or "",
        mobile=d.get("Mobile") or "",
        employee_code=d.get("EmployeeCode") or "",
        franchise_id=d.get("FranchizeId") or None,
        branch_id=d.get("BranchId") or None,
        reporting_manager_id=d.get("ReportingManagerId") or None,
    )
    role = Role.objects.filter(id=d.get("RoleId")).first()
    if role:
        user.roles.add(role)
    if user.reporting_manager:
        err = H.validate_assignment(user, H.effective_role(user), user.reporting_manager)
        if err:
            user.delete()
            return fail(err, 400)
    from .emails import send_login_details

    emailed = send_login_details(user, password, request.auth_user)
    return ok({"UserId": user.id, "EmailSent": emailed, "Message": "User created successfully."}, 201)


@api()
@admin_only
def delete_user(request):
    from quotes.workflow import escalate_for_inactive

    u = User.objects.filter(id=request.data.get("userId")).first()
    if u is None:
        return fail("User not found.", 404)
    if u.id == request.auth_user.id:
        return fail("You cannot deactivate your own account.", 400)
    u.is_active = False
    u.save(update_fields=["is_active"])
    escalate_for_inactive(u, request.auth_user)
    return ok({"Message": "User deactivated."})


@api()
@admin_only
def create_franchise(request):
    d = request.data
    f = Franchise.objects.create(name=d.get("FranchizeName") or d.get("name") or "", short_code=d.get("ShortCode") or "")
    return ok({"Id": f.id, "Message": "Franchise created."}, 201)


@api()
@admin_only
def create_branch(request):
    d = request.data
    b = Branch.objects.create(
        franchise_id=d.get("FranchizeId"), name=d.get("BranchName") or d.get("name") or "",
        address=d.get("Address") or "", city=d.get("City") or "", state=d.get("State") or "",
        pincode=d.get("Pincode") or "",
    )
    return ok({"Id": b.id, "Message": "Branch created."}, 201)


@api()
def update_personal_info(request):
    u = request.auth_user
    d = request.data
    for src, attr in [("Name", "name"), ("Mobile", "mobile"), ("ProfileImage", "profile_image"), ("Signature", "signature")]:
        if d.get(src) is not None:
            setattr(u, attr, d.get(src))
    u.save()
    return ok({"Message": "Profile updated."})


@api()
def update_password(request):
    u = request.auth_user
    old = request.data.get("OldPassword") or request.data.get("oldPassword")
    new = request.data.get("NewPassword") or request.data.get("newPassword")
    if old and not u.check_password(old):
        return fail("Current password is incorrect.")
    if not new:
        return fail("New password is required.")
    u.set_password(new)
    u.save()
    return ok({"Message": "Password updated."})


@api()
@admin_only
def edit_user(request):
    d = request.data
    u = User.objects.filter(id=d.get("UserId") or d.get("userId")).first()
    if not u:
        return fail("User not found.", 404)
    for src, attr in [("Name", "name"), ("Mobile", "mobile"), ("EmployeeCode", "employee_code")]:
        if d.get(src) is not None:
            setattr(u, attr, d.get(src))
    if d.get("FranchizeId"):
        u.franchise_id = d.get("FranchizeId")
    if d.get("BranchId"):
        u.branch_id = d.get("BranchId")
    if d.get("ReportingManagerId"):
        manager = User.objects.filter(id=d.get("ReportingManagerId")).first()
        err = H.validate_assignment(u, H.effective_role(u), manager)
        if err:
            return fail(err, 400)
        u.reporting_manager = manager
    u.save()
    return ok({"Message": "User updated."})


# ---------------------------------------------------------------- delete user (Admin / Director)
def _delete_target(request):
    from .deletion import DeleteError

    u = User.objects.filter(id=(request.data or {}).get("userId"), is_deleted=False).first()
    if u is None:
        raise DeleteError("User not found.", 404)
    return u


@api()
def delete_user_preview(request):
    from .deletion import preview

    return ok(preview(request.auth_user, _delete_target(request)))


@api()
def delete_user_account(request):
    from .deletion import delete_user

    summary = delete_user(request.auth_user, _delete_target(request))
    return ok({**summary, "Message": f"{summary['Name']} was deleted. Their work now belongs to {summary['Successor']['Name']}."})
