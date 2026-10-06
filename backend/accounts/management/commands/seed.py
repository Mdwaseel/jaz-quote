"""Seed the database with JAZ Home Theatres reference data.

Runs on every container start (docker-entrypoint.sh), so it must be safe to
repeat against production: it only ever *adds* what is missing and never
overwrites or deletes data an admin has changed. The product catalog is only
built when it is empty — use ``--reset-catalog`` to deliberately rebuild it.

    python manage.py seed                 # reference data + the first admin login
    python manage.py seed --demo          # also a sample 7.2.4 quotation (local testing)
"""
import os

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Branch, CompanyProfile, Franchise, Role, User
from catalog import geo_data, jaz
from catalog.models import City, Country, Package, PackageItem, PaymentTerm, Product, ProductCategory, State
from quotes.models import Quotation

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@jazhometheatres.com")
# Used only when the account is first created. Set SEED_ADMIN_PASSWORD in production.
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "JazAdmin@2026")


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
        admin.set_password(ADMIN_PASSWORD)
        admin.save()
        # Admin panel + the sales app (Admin can also create quotations).
        admin.roles.add(Role.objects.get(name="Admin"), Role.objects.get(name="BDM"))
        self.stdout.write(f"Created admin login {ADMIN_EMAIL} — change the password after first sign-in.")

    def sample_quote(self):
        """A 7.2.4 quotation matching the JAZ template (₹18.9 L list → ₹17.9 L offer)."""
        from quotes import workflow as W

        if Quotation.objects.exists():
            return
        admin = User.objects.filter(email=ADMIN_EMAIL).first()
        pkg = Package.objects.filter(configuration="7.2.4").prefetch_related("items__product__category").first()
        if admin is None or pkg is None:
            return
        items = [{"ProductId": i.product_id, "Category": i.product.category.name, "Name": i.product.name,
                  "Specification": i.product.specification, "Brand": i.product.brands, "Unit": i.product.unit,
                  "Qty": float(i.qty), "UnitPrice": float(i.product.price), "GstPercent": float(i.product.effective_gst)}
                 for i in pkg.items.all()]
        W.create_quotation(admin, {
            "CustomerName": "Sample Customer", "CustomerMobile": "9000000000", "CustomerEmail": "sample@example.com",
            "CustomerAddress": "Jubilee Hills", "CityName": "Hyderabad", "StateName": "Telangana",
            "CountryName": "India", "ZipCode": "500033",
            "ProductInfo": {
                "PackageId": pkg.id, "Package": pkg.name, "Configuration": pkg.configuration, "Tier": pkg.tier,
                "Room": "Basement home theatre", "ProjectType": "Dedicated Home Cinema",
                "RoomLength": "22", "RoomWidth": "16", "RoomHeight": "10", "Seats": "6", "Rows": "2",
                "ConstructionStage": "Civil ready", "Spec": pkg.spec, "Scope": jaz.SCOPE,
                "Finishes": jaz.DEFAULT_FINISHES, "Items": items,
            },
            "DiscountPercent": 5.291,  # ₹18,90,000 list → ₹17,90,000 offer, as in the template
            "SalesInfo": {"SalesBy": admin.name, "DeliveryAt": "8–10 weeks after site readiness", "ValidityDays": 15},
        })
        self.stdout.write("Created a sample 7.2.4 quotation.")
