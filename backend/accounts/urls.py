from django.urls import path

from . import views

urlpatterns = [
    # auth
    path("auth/login", views.login),
    path("auth/verify-otp", views.verify_otp),
    path("auth/resend-otp", views.resend_otp),
    path("auth/forgot-password", views.forgot_password),
    path("auth/reset-password", views.reset_password),
    path("auth/refreshtoken", views.refresh_token),
    path("auth/logout", views.logout),
    # user
    path("user/getuserprofile", views.get_user_profile),
    path("user/me", views.me),
    path("user/getroles", views.get_roles),
    path("user/getfranchize", views.get_franchize),
    path("user/getempidprefix", views.get_franchize_short_code),
    path("user/getofficeaddress", views.get_branch),
    path("user/getofficeaddresslist", views.get_branch_list),
    path("user/getreportingmanger", views.get_reporting_manager),
    path("user/editreportingmanger", views.get_rm_by_userid),
    path("user/getbankdetails", views.get_bank_list),
    path("user/userlist", views.user_list),
    path("user/createuser", views.create_user),
    path("user/deleteuser", views.delete_user),
    path("user/createfranchize", views.create_franchise),
    path("user/createbranch", views.create_branch),
    path("user/updatepersonalinfo", views.update_personal_info),
    path("user/updatepassword", views.update_password),
    path("user/edit-user", views.edit_user),
    path("user/delete-preview", views.delete_user_preview),
    path("user/delete", views.delete_user_account),
]
