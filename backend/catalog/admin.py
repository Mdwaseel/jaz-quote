from django.contrib import admin

from . import models


@admin.register(models.ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "gst_percent")
    list_editable = ("order", "gst_percent")


@admin.register(models.Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "brands", "unit", "price", "gst_percent", "is_active")
    list_editable = ("price", "is_active")  # change list prices right in the list
    list_filter = ("category", "is_active")
    search_fields = ("name", "specification", "brands")


class PackageItemInline(admin.TabularInline):
    model = models.PackageItem
    extra = 0
    autocomplete_fields = ("product",)


@admin.register(models.Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("name", "configuration", "tier", "is_active", "order")
    list_editable = ("is_active", "order")
    inlines = [PackageItemInline]


@admin.register(models.PaymentTerm)
class PaymentTermAdmin(admin.ModelAdmin):
    list_display = ("term_name", "term_value", "order")
    list_editable = ("term_value", "order")
    ordering = ("order",)
