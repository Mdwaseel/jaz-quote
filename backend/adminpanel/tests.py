import json

from django.test import TestCase

from accounts.models import Franchise, Role, User
from common import jwt


class EditUserDetailsTests(TestCase):
    """Admin → Users → Edit can change every personal detail, safely."""

    @classmethod
    def setUpTestData(cls):
        cls.brio = Franchise.objects.create(name="BRIO", short_code="BE")
        cls.kaar = Franchise.objects.create(name="KAAR VENTURES", short_code="KV")
        cls.admin = User.objects.create_user(email="admin@brio.test", password="x" * 10, name="Admin", franchise=cls.brio)
        cls.admin.roles.add(Role.objects.create(name="Admin"))
        cls.bdm = User.objects.create_user(email="old@brio.test", password="oldpass123", name="Old Name",
                                           employee_code="BE1", mobile="1", franchise=cls.brio, reporting_manager=cls.admin)
        cls.bdm.roles.add(Role.objects.create(name="BDM"))
        cls.other = User.objects.create_user(email="taken@brio.test", password="x" * 10, name="Other")

    def edit(self, **data):
        token = jwt.make_tokens(self.admin)[0]
        return self.client.post("/api/admin-api/users/update", json.dumps({"userId": self.bdm.id, **data}),
                                content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_edit_all_details(self):
        r = self.edit(name="New Name", email="  New@Brio.test ", mobile="9999999999", employeeCode="BE42",
                      region="Telangana", franchiseId=self.kaar.id, password="newpass123")
        self.assertEqual(r.status_code, 200, r.content)
        u = User.objects.get(id=self.bdm.id)
        self.assertEqual((u.name, u.email, u.mobile, u.employee_code, u.region, u.franchise_id),
                         ("New Name", "new@brio.test", "9999999999", "BE42", "Telangana", self.kaar.id))
        self.assertTrue(u.check_password("newpass123"))
        self.assertEqual(u.reporting_manager_id, self.admin.id)  # untouched when not sent
        self.assertEqual(u.role_names, ["BDM"])

    def test_blank_password_keeps_existing(self):
        self.assertEqual(self.edit(name="Same Pw", password="").status_code, 200)
        self.assertTrue(User.objects.get(id=self.bdm.id).check_password("oldpass123"))

    def test_rejects_bad_input_without_partial_changes(self):
        for bad in ({"email": "taken@brio.test"}, {"email": "not-an-email"}, {"name": "  "},
                    {"password": "short"}, {"franchiseId": 99999}):
            r = self.edit(mobile="changed", **bad)
            self.assertEqual(r.status_code, 400, bad)
        u = User.objects.get(id=self.bdm.id)
        self.assertEqual((u.email, u.mobile, u.name), ("old@brio.test", "1", "Old Name"))

    def test_non_admin_cannot_edit(self):
        token = jwt.make_tokens(self.bdm)[0]
        r = self.client.post("/api/admin-api/users/update", json.dumps({"userId": self.other.id, "email": "x@y.com"}),
                             content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(r.status_code, 403)


class ProductsCsvTests(TestCase):
    """Admin → Prices & Catalog → Import CSV: preview first, all-or-nothing apply."""

    @classmethod
    def setUpTestData(cls):
        from catalog.models import Product, ProductCategory

        cls.admin = User.objects.create_user(email="csvadmin@brio.test", password="x" * 10, name="Admin")
        cls.admin.roles.add(Role.objects.get_or_create(name="Admin")[0])
        cls.bdm = User.objects.create_user(email="csvbdm@brio.test", password="x" * 10, name="BDM")
        cls.bdm.roles.add(Role.objects.get_or_create(name="BDM")[0])
        video = ProductCategory.objects.create(name="Video", order=10, gst_percent=18)
        cls.projector = Product.objects.create(category=video, name="4K Laser Projector", price=285000, unit="Nos")
        cls.rack = Product.objects.create(category=video, name="AV Rack", price=24000, unit="Nos")

    def post(self, path, data, user=None):
        token = jwt.make_tokens(user or self.admin)[0]
        return self.client.post(f"/api/admin-api/catalog/{path}", json.dumps(data), content_type="application/json",
                                HTTP_AUTHORIZATION=f"Bearer {token}")

    def upload(self, text, apply=False, user=None, encoding="utf-8-sig"):
        import base64

        return self.post("import", {"file": base64.b64encode(text.encode(encoding)).decode(), "apply": apply}, user)

    CSV = ("ID,Category,Name,Specification,Brands,Unit,List Price,GST %,Active\r\n"
           ",Video,4K Laser Projector,,,Nos,\"₹ 2,95,000\",,yes\r\n"        # price change, matched by name
           ",Video,AV Rack,,,Nos,24000,,yes\r\n"                             # nothing changes
           ",Cinema Seating,Motorised Recliner,Electric recliner,,nos,38000,,\r\n")  # new + new category

    def test_preview_then_apply(self):
        from catalog.models import Product, ProductCategory

        d = self.upload(self.CSV).json()["data"]
        self.assertEqual((d["Created"], d["Updated"], d["Unchanged"], d["Errors"], d["Applied"]), (1, 1, 1, 0, False))
        self.assertEqual(d["NewCategories"], ["Cinema Seating"])
        upd = next(r for r in d["Rows"] if r["Action"] == "update")
        self.assertEqual(upd["Changes"]["list_price"], ["285000", "295000"])
        self.assertEqual(Product.objects.get(id=self.projector.id).price, 285000)  # preview writes nothing
        d = self.upload(self.CSV, apply=True).json()["data"]
        self.assertTrue(d["Applied"])
        self.assertEqual(Product.objects.get(id=self.projector.id).price, 295000)
        recliner = Product.objects.get(name="Motorised Recliner")
        self.assertEqual((recliner.category.name, recliner.unit, recliner.is_active, recliner.gst_percent),
                         ("Cinema Seating", "Nos", True, None))
        self.assertTrue(ProductCategory.objects.filter(name="Cinema Seating").exists())

    def test_errors_block_the_whole_import(self):
        from catalog.models import Product

        bad = self.CSV + ",Video,Broken,,,Boxes,abc,40,maybe\r\n"
        d = self.upload(bad).json()["data"]
        err = next(r for r in d["Rows"] if r["Action"] == "error")
        self.assertEqual(err["Row"], 5)
        self.assertEqual(self.upload(bad, apply=True).status_code, 400)
        self.assertEqual(Product.objects.get(id=self.projector.id).price, 285000)  # nothing applied
        self.assertFalse(Product.objects.filter(name="Motorised Recliner").exists())

    def test_export_round_trip_excel_encoding_and_access(self):
        r = self.post("export", {})
        self.assertEqual(r.status_code, 200)
        text = r.content.decode("utf-8-sig")
        self.assertTrue(text.startswith("id,category,name"))
        d = self.upload(text).json()["data"]  # re-importing an export changes nothing
        self.assertEqual((d["Created"], d["Updated"], d["Errors"]), (0, 0, 0))
        win = "name,category,list_price\r\nProjector — Reference,Video,100\r\n"  # Excel's Windows-1252 CSV
        self.assertEqual(self.upload(win, encoding="cp1252").json()["data"]["Rows"][0]["Name"], "Projector — Reference")
        self.assertEqual(self.upload(self.CSV, user=self.bdm).status_code, 403)
        self.assertEqual(self.post("export", {}, user=self.bdm).status_code, 403)
