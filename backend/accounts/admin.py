from django.contrib import admin

from .models import Bank, Branch, CompanyProfile, Franchise, Role, User

# Branding for the standalone admin panel.
admin.site.site_header = "JAZ Home Theatres — Quotation Admin"
admin.site.site_title = "JAZ Admin"
admin.site.index_title = "Manage products, prices, quotations & users"


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "employee_code", "primary_role", "franchise", "is_active", "is_staff")
    list_editable = ("is_active",)
    list_filter = ("is_active", "is_staff", "roles", "franchise")
    search_fields = ("name", "email", "employee_code")
    filter_horizontal = ("roles",)
    exclude = ("password", "user_permissions", "groups", "last_login")


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ("bank_name", "account_holder_name", "account_number", "ifsc_code", "branch_name")


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "email", "phone", "gstin")


@admin.register(Franchise)
class FranchiseAdmin(admin.ModelAdmin):
    list_display = ("name", "short_code")
    search_fields = ("name",)


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "franchise", "city", "state", "pincode")
    list_filter = ("franchise", "state")
    search_fields = ("name", "city")


admin.site.register(Role)
