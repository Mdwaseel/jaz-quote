from django.contrib import admin
from django.utils.html import format_html

from .models import Customer, Quotation


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = (
        "quotation_number", "customer", "package", "configuration", "room",
        "status", "exclude_tax", "include_tax", "created_by", "created_at", "pdf_link",
    )
    list_editable = ("status",)              # monitor + change status inline
    list_filter = ("status", "configuration", "tier", "created_at")
    search_fields = ("quotation_number", "customer__name", "customer__mobile")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    fieldsets = (
        (None, {"fields": ("quotation_number", "customer", "status", "created_by")}),
        ("Project & BOQ", {"fields": ("package", "configuration", "tier", "room", "product_info")}),
        ("Pricing", {"fields": ("base_amount", "discount_percent", "special_cost", "exclude_tax", "tax", "include_tax")}),
        ("Terms", {"fields": ("payment_terms", "warranty_details", "amc_details", "sales_info")}),
        ("File", {"fields": ("quote_file",)}),
        ("Meta", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="PDF")
    def pdf_link(self, obj):
        if obj.quote_file:
            return format_html('<a href="/media/{}" target="_blank">Open</a>', obj.quote_file)
        return "—"


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "mobile", "email", "city", "state", "is_active", "created_at")
    list_filter = ("state", "city", "is_active")
    search_fields = ("name", "mobile", "email")
    date_hierarchy = "created_at"
