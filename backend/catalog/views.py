from django.db.models import Prefetch

from common.api import api, ok

from . import jaz
from .models import City, Country, Package, PackageItem, PaymentTerm, Product, ProductCategory, State


# ---- geography ----
@api()
def get_countries(request):
    return ok([{"Id": c.id, "CountryName": c.name} for c in Country.objects.all()], 201)


@api()
def get_states(request):
    cid = request.data.get("CountryId")
    qs = (State.objects.filter(country_id=cid) if cid else State.objects.all()).order_by("name")
    return ok([{"Id": s.id, "StateName": s.name} for s in qs], 201)


@api()
def get_cities(request):
    sid = request.data.get("StateId")
    qs = (City.objects.filter(state_id=sid) if sid else City.objects.all()).order_by("name")
    return ok([{"Id": c.id, "CityName": c.name} for c in qs], 201)


# ---- home theatre catalog ----
def product_row(p):
    return {
        "Id": p.id, "CategoryId": p.category_id, "Category": p.category.name, "Name": p.name,
        "Specification": p.specification, "Brands": p.brands, "Unit": p.unit, "Price": float(p.price),
        "GstPercent": float(p.effective_gst), "OwnGst": None if p.gst_percent is None else float(p.gst_percent),
        "Active": p.is_active,
    }


def package_row(pkg):
    items = [{"ProductId": i.product_id, "Qty": float(i.qty), "Name": i.product.name, "Category": i.product.category.name,
              "Price": float(i.product.price)} for i in pkg.items.all()]
    return {
        "Id": pkg.id, "Name": pkg.name, "Configuration": pkg.configuration, "Tier": pkg.tier,
        "Description": pkg.description, "Spec": pkg.spec or [], "Active": pkg.is_active, "Items": items,
        "ListValue": round(sum(i["Qty"] * i["Price"] for i in items)),
    }


def packages_qs():
    return Package.objects.prefetch_related(
        Prefetch("items", queryset=PackageItem.objects.select_related("product__category").order_by("order", "id")))


@api(methods=("GET", "POST"))
def builder_catalog(request):
    """Everything the quotation builder needs in one call."""
    products = Product.objects.select_related("category").filter(is_active=True)
    return ok({
        "Categories": [{"Id": c.id, "Name": c.name, "GstPercent": float(c.gst_percent)} for c in ProductCategory.objects.all()],
        "Products": [product_row(p) for p in products],
        "Packages": [package_row(p) for p in packages_qs().filter(is_active=True)],
        "Tiers": jaz.TIERS,
        "ProjectTypes": jaz.PROJECT_TYPES,
        "ConstructionStages": jaz.CONSTRUCTION_STAGES,
        "Configurations": jaz.CONFIGURATIONS,
        "Brands": jaz.BRANDS,
        "SpecLabels": jaz.SPEC_LABELS,
        "DefaultSpec": jaz.DEFAULT_SPEC,
        "DefaultScope": jaz.SCOPE,
        "DefaultFinishes": jaz.DEFAULT_FINISHES,
        "Timelines": jaz.TIMELINES,
        "ValidityDays": jaz.VALIDITY_DAYS,
        "PaymentTermNames": [n for n, _ in jaz.STANDARD_PAYMENT_TERMS],
    })


@api()
def get_payment_terms(request):
    return ok(
        [{"Id": t.id, "TermName": t.term_name, "TermValue": t.term_value} for t in PaymentTerm.objects.all()],
        200,
    )
