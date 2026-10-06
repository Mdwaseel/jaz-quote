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
