"""Seed the database with JAZ Home Theatres reference data.

Runs on every container start (docker-entrypoint.sh), so it must be safe to
repeat against production: it only ever *adds* what is missing and never
overwrites or deletes data an admin has changed. The product catalog is only
built when it is empty — use ``--reset-catalog`` to deliberately rebuild it.

    python manage.py seed                 # reference data + the first admin login
    python manage.py seed --demo          # also a sample 7.1.2 quotation (local testing)
"""
import os
import secrets

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Branch, CompanyProfile, Franchise, Role, User
from catalog import geo_data, jaz
from catalog.models import City, Country, Package, PackageItem, PaymentTerm, Product, ProductCategory, State
from quotes.models import Quotation

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@jazhometheatres.com")
# Used only when the account is first created. There is deliberately no default: without
# SEED_ADMIN_PASSWORD a random password is generated and printed once.
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD") or ""


class Command(BaseCommand):
    help = "Load JAZ reference data (idempotent; never overwrites existing data)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-catalog", action="store_true",
            help="DELETE and rebuild the products, categories and packages (loses admin price edits).",
        )
        parser.add_argument("--demo", action="store_true", help="Also create a sample quotation.")

    def handle(self, *args, **opts):
        self.roles()
        self.franchises()
        CompanyProfile.get()
        geo_data.sync(Country, State, City)
        if opts["reset_catalog"] or not Product.objects.exists():
            self.catalog(reset=opts["reset_catalog"])
        else:
            self.stdout.write("Catalog already present — left untouched (use --reset-catalog to rebuild).")
        self.payment_terms()
        self.users()
        if opts["demo"]:
            self.sample_quote()
        self.stdout.write(self.style.SUCCESS("Seed complete."))

    # ------------------------------------------------------------------
    def roles(self):
        for name in ["BDM", "Admin", "RM", "RSD", "Director", "Sr. BDM"]:
            Role.objects.get_or_create(name=name)

    def franchises(self):
        jaz_f, _ = Franchise.objects.get_or_create(name="JAZ", defaults={"short_code": "JZ"})
        Branch.objects.get_or_create(
            franchise=jaz_f, name="Hyderabad",
            defaults={"city": "Hyderabad", "state": "Telangana"},
        )

    @transaction.atomic
    def catalog(self, reset=False):
        if reset:
            PackageItem.objects.all().delete()
            Package.objects.all().delete()
            Product.objects.all().delete()
            ProductCategory.objects.all().delete()
        jaz.seed_catalog(ProductCategory, Product, Package, PackageItem)
        self.stdout.write(f"Catalog: {Product.objects.count()} products, {Package.objects.count()} packages.")

    def payment_terms(self):
        if PaymentTerm.objects.exists():
            return
        for i, (name, value) in enumerate(jaz.STANDARD_PAYMENT_TERMS, start=1):
            PaymentTerm.objects.create(term_name=name, term_value=value, order=i)

    def users(self):
        if User.objects.filter(roles__name="Admin").exists() or User.objects.filter(email=ADMIN_EMAIL).exists():
            return
        jaz_f = Franchise.objects.get(name="JAZ")
        admin = User.objects.create(
            email=ADMIN_EMAIL, name="JAZ Admin", employee_code="JZ001", franchise=jaz_f,
            branch=Branch.objects.filter(franchise=jaz_f).first(), date_of_joining=timezone.now().date(),
            is_staff=True, is_superuser=True,
        )
        password = ADMIN_PASSWORD or secrets.token_urlsafe(12)
        admin.set_password(password)
        admin.save()
        # Admin panel + the sales app (Admin can also create quotations).
        admin.roles.add(Role.objects.get(name="Admin"), Role.objects.get(name="BDM"))
        shown = "" if ADMIN_PASSWORD else f" with the generated password: {password}"
        self.stdout.write(f"Created admin login {ADMIN_EMAIL}{shown} — change it after first sign-in.")

    def sample_quote(self):
        """A CinePrime 7.1.2 quotation from the handbook (₹12,24,075) at a discounted price of ₹12,00,000."""
        from decimal import Decimal

        from quotes import workflow as W

        if Quotation.objects.exists():
            return
        admin = User.objects.filter(email=ADMIN_EMAIL).first()
        pkg = Package.objects.filter(name="CinePrime 7.1.2 · Wharfedale Diamond").prefetch_related("items__product__category").first()
        if admin is None or pkg is None:
            return
        items = [{"ProductId": i.product_id, "Category": i.product.category.name, "Name": i.product.name,
                  "Specification": i.product.specification, "Brand": i.product.brands, "Unit": i.product.unit,
                  "Qty": float(i.qty), "UnitPrice": float(i.unit_price), "GstPercent": float(i.product.effective_gst)}
                 for i in pkg.items.all()]
        quoted = sum(Decimal(str(i["Qty"])) * Decimal(str(i["UnitPrice"])) for i in items)
        price = Decimal(1200000)
        W.create_quotation(admin, {
            "CustomerName": "Sample Customer", "CustomerMobile": "9000000000", "CustomerEmail": "sample@example.com",
            "CustomerAddress": "Jubilee Hills", "CityName": "Hyderabad", "StateName": "Telangana",
            "CountryName": "India", "ZipCode": "500033",
            "ProductInfo": {
                "PackageId": pkg.id, "Package": f"{pkg.tier} {pkg.configuration}", "Version": pkg.name,
                "Configuration": pkg.configuration, "Recommended": "7.1.2", "Tier": pkg.tier,
                "Room": "Basement home theatre", "ProjectType": "Dedicated Home Cinema",
                "RoomLength": "16", "RoomWidth": "14", "RoomHeight": "10", "Seats": "6", "Rows": "1",
                "ConstructionStage": "Civil ready", "Scope": jaz.SCOPE, "Finishes": jaz.DEFAULT_FINISHES, "Items": items,
            },
            "DiscountPercent": float(((quoted - price) / quoted * 100).quantize(Decimal("0.000001"))),
            "SalesInfo": {"SalesBy": admin.name, "DeliveryAt": "6–8 weeks after site readiness", "ValidityDays": 15,
                          "DiscountMode": "price", "DiscountPrice": float(price), "DiscountPriceBasis": "ex"},
        })
        self.stdout.write("Created a sample CinePrime 7.1.2 quotation.")
