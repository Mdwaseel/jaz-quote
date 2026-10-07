from django.core.management import call_command
from django.test import TestCase

from accounts.models import CompanyProfile, Role, User
from catalog.models import Package, PaymentTerm, Product

PROJECTOR = "TK710 4K Laser Projector"
MOUNT = "Ceiling Mount Kit for Projector"

# Totals (ex-GST, installation included) of every block in the JAZ Sales Hand Book.
HANDBOOK_TOTALS = {
    "CinePrime 5.1.2 · Taga Harmony · Full HD": 530490,
    "CinePrime 7.1.2 · Wharfedale Diamond": 1224075,
    "CinePrime 7.1.2 · Pylon Opal": 1331075,
    "CinePrime 7.1.2 · DALI Sonik 5": 1458075,
    "CineLuxe 7.1.2 · DALI Sonik 7": 1423075,
    "CineLuxe 7.1.2 · DALI Phantom In-Wall": 1811275,
    "CineLuxe 7.2.2 · DALI Sonik 9 + Sony 4K": 2093075,
    "CineLuxe 7.2.2 · Bowers & Wilkins 603 S3": 2175075,
    "CineRoyale 7.1.2 · Perlisten X-Series": 3183975,
    "CineRoyale 7.1.2 · Perlisten A3t": 3346475,
    "CineRoyale 7.2.2 · Bowers & Wilkins CT7.3": 3427175,
}


class SeedIsSafeToRepeatTests(TestCase):
    """`seed` runs on every container start — it must never undo production edits."""

    def test_repeat_seed_keeps_admin_edits(self):
        call_command("seed", verbosity=0)
        count = Product.objects.count()
        Product.objects.filter(name=PROJECTOR).update(price=1234567)
        Product.objects.filter(name=MOUNT).delete()  # admin removed a product
        CompanyProfile.objects.update(gstin="36ABCDE1234F1Z5")

        call_command("seed", verbosity=0)

        self.assertEqual(Product.objects.get(name=PROJECTOR).price, 1234567)
        self.assertFalse(Product.objects.filter(name=MOUNT).exists())
        self.assertEqual(Product.objects.count(), count - 1)
        self.assertEqual(CompanyProfile.objects.get().gstin, "36ABCDE1234F1Z5")
        self.assertEqual(User.objects.filter(roles__name="Admin").count(), 1)  # first admin only once
        self.assertTrue(Role.objects.filter(name="Sr. BDM").exists())
        self.assertEqual(list(PaymentTerm.objects.values_list("term_value", flat=True)), [30, 60, 10])

    def test_reset_catalog_rebuilds_on_request(self):
        call_command("seed", verbosity=0)
        Product.objects.filter(name=PROJECTOR).update(price=1)
        call_command("seed", "--reset-catalog", verbosity=0)
        self.assertEqual(Product.objects.get(name=PROJECTOR).price, 349000)

    def test_versions_match_the_sales_handbook(self):
        call_command("seed", verbosity=0)
        totals = {p.name: sum(i.qty * i.unit_price for i in p.items.all()) for p in Package.objects.all()}
        self.assertEqual(totals, HANDBOOK_TOTALS)
        self.assertEqual(sorted(set(Package.objects.values_list("tier", flat=True))), ["CineLuxe", "CinePrime", "CineRoyale"])
        # The handbook prices TK710 at ₹2,49,000 in CineLuxe Sonik 7 only — a version price, not the list price.
        item = Package.objects.get(name="CineLuxe 7.1.2 · DALI Sonik 7").items.get(product__name=PROJECTOR)
        self.assertEqual((item.price, item.product.price), (249000, 349000))

    def test_demo_quote_uses_a_handbook_version_at_a_discounted_price(self):
        call_command("seed", "--demo", verbosity=0)
        from quotes.models import Quotation

        q = Quotation.objects.get()
        self.assertEqual((q.base_amount, q.exclude_tax, q.include_tax), (1224075, 1200000, 1416000))
        self.assertEqual(q.product_info["Version"], "CinePrime 7.1.2 · Wharfedale Diamond")
