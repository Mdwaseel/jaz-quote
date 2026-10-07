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
    """A version and its items. Each item's Price is what the version charges for it — its
    own package price when set, else the product's list price."""
    items, value, gst = [], 0.0, 0.0
    for i in pkg.items.all():
        qty, price = float(i.qty), float(i.unit_price)
        value += qty * price
        gst += qty * price * float(i.product.effective_gst) / 100
        items.append({"ProductId": i.product_id, "Qty": qty, "Name": i.product.name, "Category": i.product.category.name,
                      "Brand": i.product.brands, "Unit": i.product.unit, "Price": price,
                      "PackagePrice": None if i.price is None else float(i.price), "ProductPrice": float(i.product.price)})
    return {
        "Id": pkg.id, "Name": pkg.name, "Configuration": pkg.configuration, "Tier": pkg.tier,
        "Description": pkg.description, "Active": pkg.is_active, "Items": items,
        "ListValue": round(value), "Gst": round(gst), "Total": round(value) + round(gst),
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
        "Series": [{"Name": n, "Description": d} for n, d in jaz.SERIES],
        "ProjectTypes": jaz.PROJECT_TYPES,
        "ConstructionStages": jaz.CONSTRUCTION_STAGES,
        "Configurations": jaz.CONFIGURATIONS,
        "ConfigGuide": jaz.CONFIG_GUIDE,
        "RoomGuide": jaz.ROOM_GUIDE,
        "RoomTips": jaz.ROOM_TIPS,
        "AcousticsNote": jaz.ACOUSTICS_NOTE,
        "Brands": jaz.BRANDS,
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
