from django.core.management import call_command
from django.test import TestCase

from accounts.models import CompanyProfile, Role, User
from catalog.models import Package, PaymentTerm, Product

PROJECTOR = "4K Laser Projector — Premium Value"


class SeedIsSafeToRepeatTests(TestCase):
    """`seed` runs on every container start — it must never undo production edits."""

    def test_repeat_seed_keeps_admin_edits(self):
        call_command("seed", verbosity=0)
        count = Product.objects.count()
        Product.objects.filter(name=PROJECTOR).update(price=1234567)
        Product.objects.filter(name="Ventilated AV Rack").delete()  # admin removed a product
        CompanyProfile.objects.update(gstin="36ABCDE1234F1Z5")

        call_command("seed", verbosity=0)

        self.assertEqual(Product.objects.get(name=PROJECTOR).price, 1234567)
        self.assertFalse(Product.objects.filter(name="Ventilated AV Rack").exists())
        self.assertEqual(Product.objects.count(), count - 1)
        self.assertEqual(CompanyProfile.objects.get().gstin, "36ABCDE1234F1Z5")
        self.assertEqual(User.objects.filter(roles__name="Admin").count(), 1)  # first admin only once
        self.assertTrue(Role.objects.filter(name="Sr. BDM").exists())
        self.assertEqual(list(PaymentTerm.objects.values_list("term_value", flat=True)), [30, 60, 10])

    def test_reset_catalog_rebuilds_on_request(self):
        call_command("seed", verbosity=0)
        Product.objects.filter(name=PROJECTOR).update(price=1)
        call_command("seed", "--reset-catalog", verbosity=0)
        self.assertEqual(Product.objects.get(name=PROJECTOR).price, 285000)
        pkg = Package.objects.get(configuration="7.2.4")
        self.assertEqual(sum(i.qty * i.product.price for i in pkg.items.all()), 1890000)  # the template's actual price

    def test_demo_quote_matches_the_template(self):
        call_command("seed", "--demo", verbosity=0)
        from quotes.models import Quotation

        q = Quotation.objects.get()
        self.assertEqual((q.base_amount, q.exclude_tax, q.include_tax), (1890000, 1790000, 2112200))
