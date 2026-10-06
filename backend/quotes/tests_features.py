"""Tests: login emails, delete user, JAZ BOQ pricing (manual line prices, optional and
custom lines), catalog + admin management, company profile, e-signature + onsite
signing, deal outcome and analysis."""
import re

from django.core import mail
from django.test import override_settings
from unittest import mock

from accounts.hierarchy import ADMIN, BDM, DIRECTOR, RM, RSD
from accounts.models import User
from catalog.models import Package, Product, ProductCategory
from quotes.models import ApprovalStep, CustomerSignature, Quotation
from quotes.tests import MEDIA, EngineTestBase, fake_pdf

PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGA"
       "hKmMIQAAAABJRU5ErkJggg==")
JPEG = "data:image/jpeg;base64," + __import__("base64").b64encode(bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"0" * 300).decode()


@override_settings(MEDIA_ROOT=MEDIA, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                   NOTIFY_SKIP_DOMAINS=[], SITE_URL="https://quotes.test")
@mock.patch("quotes.pdf.generate_quote_pdf", fake_pdf)
class FeatureTests(EngineTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        seating = ProductCategory.objects.create(name="Cinema Seating", order=2, gst_percent=18)
        cls.recliner = Product.objects.create(category=seating, name="Motorised Electric Recliner", price=100_000)

    def items_payload(self, items, discount=0, **extra):
        p = self.payload(discount, **extra)
        p["ProductInfo"] = {**p["ProductInfo"], "Items": items}
        return p

    def line(self, product=None, qty=1, price=None, **kw):
        product = product or self.projector
        return {"ProductId": product.id, "Name": product.name, "Qty": qty,
                "UnitPrice": float(product.price) if price is None else price, **kw}

    # ------------------------------------------------------------ 1. login details email
    def test_new_user_gets_login_details(self):
        r = self.call(self.admin, "admin-api/users/create", {"name": "Kiran", "email": "kiran@brio.test",
                                                             "password": "Start@1234", "role": "BDM",
                                                             "managerId": self.ravi.id})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["data"]["EmailSent"])
        m = [x for x in mail.outbox if x.to == ["kiran@brio.test"]][0]
        self.assertIn("Start@1234", m.body)
        self.assertIn("https://quotes.test/login", m.body)
        self.assertIn("reporting to Ravi", m.body)

    # ------------------------------------------------------------ 2. delete user
    def test_admin_deletes_rm_and_everything_moves_up(self):
        q = self.create(self.taj, 0)  # Taj (Sr. BDM) reports to Ravi
        pending = self.create(self.daniel, 20)  # waiting on Ravi
        own = self.create(self.ravi, 0)
        prev = self.call(self.admin, "user/delete-preview", {"userId": self.ravi.id}).json()["data"]
        self.assertEqual((prev["Successor"]["Name"], prev["Quotations"], prev["DirectReports"], prev["OpenApprovals"]),
                         ("Nandini", 1, 1, 1))
        r = self.call(self.admin, "user/delete", {"userId": self.ravi.id})
        self.assertEqual(r.status_code, 200, r.content)
        ravi = User.objects.get(id=self.ravi.id)
        self.assertTrue(ravi.is_deleted)
        self.assertFalse(ravi.is_active)
        self.assertEqual(ravi.deleted_email, "ravi@brio.test")
        self.assertEqual(User.objects.get(id=self.taj.id).reporting_manager_id, self.nandini.id)
        own.refresh_from_db()
        self.assertEqual(own.created_by_id, self.nandini.id)
        self.assertIn("Quotation Transferred", own.events.values_list("action", flat=True))
        step = ApprovalStep.objects.get(request__quotation=pending, status="PENDING")
        self.assertEqual(step.assigned_to_id, self.nandini.id)  # escalated up the chain
        self.assertNotIn(self.ravi.id, [u["UserId"] for u in self.call(self.admin, "admin-api/users").json()["data"]])
        login = self.client.post("/api/auth/login", '{"email": "ravi@brio.test", "password": "xxxxxxxxxx"}',
                                 content_type="application/json")
        self.assertEqual(login.status_code, 401)
        q.refresh_from_db()
        self.assertEqual(q.created_by_id, self.taj.id)  # other people's quotes untouched

    def test_director_can_delete_only_in_own_team(self):
        self.assertEqual(self.call(self.meera, "user/delete", {"userId": self.ravi.id}).status_code, 403)  # other branch
        self.assertEqual(self.call(self.meera, "user/delete", {"userId": self.priya.id}).status_code, 200)
        self.assertEqual(User.objects.get(id=self.priya.id).is_deleted, True)
        for user in (self.ravi, self.daniel, self.nandini):
            self.assertEqual(self.call(user, "user/delete", {"userId": self.taj.id}).status_code, 403)
        self.assertEqual(self.call(self.admin, "user/delete", {"userId": self.admin.id}).status_code, 400)

    # ------------------------------------------------------------ 3. JAZ BOQ pricing
    def test_line_price_below_list_counts_as_discount(self):
        r = self.call(self.daniel, "quote/createquote", self.items_payload([self.line(price=800_000)]))
        self.assertEqual(r.status_code, 200, r.content)
        q = Quotation.objects.get(quotation_number=r.json()["data"]["QuotationNumber"])
        self.assertEqual((float(q.base_amount), float(q.exclude_tax), float(q.include_tax)), (1_000_000, 800_000, 944_000))
        self.assertEqual(float(q.discount_percent), 20)  # 20% below list, with no "discount" entered
        self.assertEqual(self.steps(q)[1], [("RM", "Ravi", "PENDING")])  # beyond the BDM's 15%

    def test_markup_on_one_line_does_not_hide_a_cut_on_another(self):
        items = [self.line(price=900_000), self.line(self.recliner, qty=1, price=200_000)]
        ev = self.call(self.daniel, "quote/evaluate", self.items_payload(items)).json()["data"]["Financials"]
        self.assertEqual((ev["BaseAmount"], ev["QuotedAmount"]), (1_200_000, 1_100_000))
        self.assertAlmostEqual(ev["DiscountPercent"], 8.33)

    def test_optional_custom_lines_and_per_line_gst(self):
        items = [self.line(), {"Name": "Engineered riser", "Category": "Interiors", "Qty": 1, "UnitPrice": 100_000, "GstPercent": 5},
                 self.line(self.recliner, qty=2, Optional=True)]
        q = self.create(self.daniel, 0, ProductInfo=self.items_payload(items)["ProductInfo"])
        self.assertEqual((float(q.base_amount), float(q.tax)), (1_100_000, 185_000))  # 18% + 5%, optional excluded
        self.assertEqual(q.workflow_status, Quotation.APPROVED)  # custom line priced = its own list
        fin = self.call(self.daniel, "quote/getquote", {"QuoteId": q.quotation_number}, "get").json()["data"]["response"]["Workflow"]["Financials"]
        self.assertEqual((fin["OptionalAmount"], fin["OptionalCount"], fin["GstRates"]), (200_000, 1, [5, 18]))
        self.assertEqual([c["Category"] for c in fin["Categories"]], ["Video", "Interiors"])

    def test_list_price_is_never_taken_from_the_client(self):
        q = self.create(self.daniel, 0, ProductInfo=self.items_payload([self.line(price=800_000, ListPrice=800_000)])["ProductInfo"])
        self.assertEqual(float(q.base_amount), 1_000_000)
        self.assertEqual(q.product_info["Items"][0]["ListPrice"], 1_000_000)

    def test_invalid_boq_rejected(self):
        for items in ([], [self.line(qty=0)], [self.line(GstPercent=40)], [self.line(price=-5)], [self.line(price=0)]):
            r = self.call(self.daniel, "quote/createquote", self.items_payload(items))
            self.assertEqual(r.status_code, 400, items)
        self.assertFalse(Quotation.objects.exists())

    def test_quotation_numbers_follow_the_jaz_format(self):
        year = __import__("datetime").datetime.now().year
        a, b = self.create(self.daniel, 0), self.create(self.daniel, 0)
        self.assertEqual((a.quotation_number, b.quotation_number), (f"JAZHT-{year}-0001", f"JAZHT-{year}-0002"))

    def test_approver_cannot_go_below_the_line_price_cut(self):
        q = self.create(self.daniel, 0, ProductInfo=self.items_payload([self.line(price=680_000)])["ProductInfo"])
        req, _ = self.steps(q)  # 32% below list → RSD + Admin
        r = self.act(self.nandini, req, approvedPercent=20)
        self.assertEqual(r.status_code, 400)
        self.assertIn("line prices", r.json()["message"])
        q2 = self.create(self.daniel, 25, ProductInfo=self.items_payload([self.line(price=900_000)])["ProductInfo"])
        req2, _ = self.steps(q2)  # 10% line cut + 25% → 32.5% overall → RSD, then Admin
        self.assertEqual(self.act(self.nandini, req2, approvedPercent=20).status_code, 200)
        q2.refresh_from_db()
        self.assertEqual((float(q2.discount_percent), float(q2.exclude_tax)), (20, 800_000))

    def test_builder_catalog(self):
        Package.objects.create(name="7.2.4 Dolby Atmos Home Cinema", configuration="7.2.4", tier="Complete Home Cinema")
        d = self.call(self.daniel, "quote/catalog", method="get").json()["data"]
        self.assertIn("4K Laser Projector", [p["Name"] for p in d["Products"]])
        self.assertEqual(d["Packages"][0]["Configuration"], "7.2.4")
        self.assertTrue(d["DefaultSpec"] and d["DefaultScope"] and d["Brands"]["Speakers & Subwoofers"])

    def test_admin_manages_catalog(self):
        call = lambda u, path, body: self.call(u, f"admin-api/catalog/{path}", body)  # noqa: E731
        self.assertEqual(call(self.daniel, "list", {"kind": "product"}).status_code, 403)
        cat = call(self.admin, "create", {"kind": "category", "name": "Automation", "gstPercent": 18}).json()["data"]["Id"]
        pid = call(self.admin, "create", {"kind": "product", "name": "Cinema Control System", "categoryId": cat,
                                          "value": 55_000, "unit": "Lot"}).json()["data"]["Id"]
        self.assertEqual(call(self.admin, "update", {"kind": "product", "id": pid, "value": 60_000}).status_code, 200)
        self.assertEqual(float(Product.objects.get(id=pid).price), 60_000)
        self.assertEqual(call(self.admin, "update", {"kind": "product", "id": pid, "gstPercent": 40}).status_code, 400)
        r = call(self.admin, "create", {"kind": "package", "name": "Media Room", "configuration": "5.1.2",
                                        "items": [{"productId": pid, "qty": 2}, {"productId": self.projector.id, "qty": 1}]})
        self.assertEqual(r.status_code, 200, r.content)
        pkg = next(p for p in call(self.admin, "list", {"kind": "package"}).json()["data"] if p["Name"] == "Media Room")
        self.assertEqual(pkg["ListValue"], 1_120_000)
        self.assertEqual(call(self.admin, "delete", {"kind": "category", "id": cat}).status_code, 400)  # has products

    def test_company_profile_and_bank_print_on_the_pdf(self):
        r = self.call(self.admin, "admin-api/company/update", {
            "company": {"name": "JAZ Home Theatres", "gstin": "36ABCDE1234F1Z5", "phone": "+91 90000 00000"},
            "bank": {"accountHolderName": "JAZ Home Theatres", "bankName": "HDFC Bank", "accountNumber": "123456789",
                     "ifscCode": "HDFC0000001", "branchName": "Jubilee Hills"}})
        self.assertEqual(r.status_code, 200, r.content)
        q = self.create(self.daniel, 0)
        from django.template.loader import render_to_string

        from quotes.pdf import amount_in_words, build_context
        ctx = build_context(q)
        html = render_to_string("quotation.html", ctx)
        for text in ("123456789", "36ABCDE1234F1Z5", "+91 90000 00000", "Rupees Eleven Lakh Eighty Thousand Only"):
            self.assertIn(text, html)
        self.assertEqual(ctx["boq"][0]["category"], "Video")
        # Customer acceptance is its own chapter (new page) and is never split across pages.
        accept = html.index('<div class="accept">')
        self.assertIn('class="chapter brk"', html[html.rindex("<table", 0, accept) - 1:accept])
        self.assertIn(".accept { break-inside: avoid;", html)
        self.assertEqual(amount_in_words(12_34_56_789), "Rupees Twelve Crore Thirty-Four Lakh Fifty-Six Thousand "
                                                        "Seven Hundred Eighty-Nine Only")

    # ------------------------------------------------------------ 4. e-signature
    def _link_token(self, to):
        m = [x for x in mail.outbox if x.to == [to]][-1]
        return re.search(r"/sign/([\w-]+)", m.body).group(1)

    def test_esign_flow(self):
        q = self.create(self.daniel, 0)  # approved straight away
        r = self.call(self.daniel, "quote/esign/send", {"QuotationNumber": q.quotation_number, "Email": "client@other.test"})
        self.assertEqual(r.status_code, 200, r.content)
        token = self._link_token("client@other.test")
        pub = self.client.get(f"/api/public/esign/{token}")
        self.assertEqual(pub.status_code, 200, pub.content)
        self.assertEqual(pub.json()["data"]["QuotationNumber"], q.quotation_number)
        post = lambda body: self.client.post(f"/api/public/esign/{token}/sign", __import__("json").dumps(body),  # noqa: E731
                                             content_type="application/json")
        self.assertEqual(post({"Signature": PNG, "Photo": JPEG, "Consent": False}).status_code, 400)
        self.assertEqual(post({"Signature": PNG, "Photo": "", "Consent": True}).status_code, 400)
        self.assertEqual(post({"Signature": "", "Photo": JPEG, "Consent": True}).status_code, 400)
        ok = post({"Signature": PNG, "Photo": JPEG, "Consent": True, "SignerName": "Mr Client"})
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(post({"Signature": PNG, "Photo": JPEG, "Consent": True}).status_code, 410)  # single use
        # The same link still opens the (now signed) quotation and its PDF — viewing, not re-signing.
        after = self.client.get(f"/api/public/esign/{token}")
        self.assertEqual((after.status_code, after.json()["data"]["Status"]), (200, "SIGNED"))
        for url, disposition in ((f"/api/public/esign/{token}/pdf", "inline"),
                                 (f"/api/public/esign/{token}/pdf?download=1", "attachment")):
            pdf = self.client.get(url)
            self.assertEqual(pdf.status_code, 200, url)
            self.assertTrue(pdf["Content-Disposition"].startswith(disposition), pdf["Content-Disposition"])
            self.assertEqual(b"".join(pdf.streaming_content), b"%PDF-1.4 fake")
            pdf.close()
        q.refresh_from_db()
        self.assertEqual(q.sales_info["CustomerSign"], PNG)
        sig = CustomerSignature.objects.get(quotation=q, status="SIGNED")
        self.assertEqual((sig.method, sig.email, sig.signer_name, sig.photo), ("ESIGN", "client@other.test", "Mr Client", JPEG))
        self.assertIn("used solely to verify", sig.consent_text)
        self.assertIn("Customer Signed (E-signature)", q.events.values_list("action", flat=True))
        detail = self.call(self.daniel, "quote/getquote", {"QuoteId": q.quotation_number}, "get").json()["data"]["response"]
        self.assertEqual(detail["Signatures"]["Current"]["Method"], "ESIGN")
        from quotes.pdf import build_context
        self.assertTrue(build_context(q)["sign_note"].startswith("E-signed on"))

    def test_esign_rules(self):
        pending = self.create(self.daniel, 20)  # waiting on RM
        r = self.call(self.daniel, "quote/esign/send", {"QuotationNumber": pending.quotation_number, "Email": "c@x.test"})
        self.assertEqual(r.status_code, 400)  # only approved quotations can be signed
        q = self.create(self.daniel, 0)
        self.assertEqual(self.call(self.daniel, "quote/esign/send", {"QuotationNumber": q.quotation_number,
                                                                     "Email": "not-an-email"}).status_code, 400)
        self.assertEqual(self.call(self.azar, "quote/esign/send", {"QuotationNumber": q.quotation_number,
                                                                   "Email": "c@x.test"}).status_code, 404)
        self.call(self.daniel, "quote/esign/send", {"QuotationNumber": q.quotation_number, "Email": "c@x.test"})
        old = self._link_token("c@x.test")
        self.call(self.daniel, "quote/esign/send", {"QuotationNumber": q.quotation_number, "Email": "c@x.test"})
        self.assertEqual(self.client.get(f"/api/public/esign/{old}").status_code, 410)  # replaced by the newer link
        self.assertEqual(self.client.get("/api/public/esign/garbage").status_code, 404)
        # Customer signatures cannot be pushed through the old upload endpoint.
        r = self.call(self.daniel, "quote/signature", {"QuotationNumber": q.quotation_number, "Kind": "customer", "Image": PNG})
        self.assertEqual(r.status_code, 400)

    def test_onsite_sign_and_edit_requires_new_signature(self):
        q = self.create(self.daniel, 20)
        self.act(self.ravi, self.steps(q)[0])  # approved
        r = self.call(self.daniel, "quote/esign/onsite", {"QuotationNumber": q.quotation_number, "Signature": PNG,
                                                          "Photo": JPEG, "SignerName": "Mrs Client"})
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(q.sales_info["CustomerSign"], PNG)
        self.assertIn("Customer Signed (Onsite)", q.events.values_list("action", flat=True))
        self.assertEqual(self.call(self.daniel, "quote/esign/onsite", {"QuotationNumber": q.quotation_number,
                                                                       "Signature": PNG, "Photo": ""}).status_code, 400)
        # Edit → new version → the old signature no longer counts.
        self.call(self.daniel, "quote/request-edit", {"QuotationNumber": q.quotation_number, "Reason": "Door"})
        self.act(self.ravi, q.approval_requests.get(category="EDIT"))
        self.call(self.daniel, "quote/update", {**self.payload(0), "QuotationNumber": q.quotation_number})
        q.refresh_from_db()
        self.assertEqual(q.sales_info["CustomerSign"], "")
        detail = self.call(self.daniel, "quote/getquote", {"QuoteId": q.quotation_number}, "get").json()["data"]["response"]
        self.assertIsNone(detail["Signatures"]["Current"])
        self.assertEqual(detail["Signatures"]["Outdated"]["Version"], 1)

    # ------------------------------------------------------------ 5. deal outcome + analysis
    def test_deal_outcome_and_analysis(self):
        won = self.create(self.daniel, 0)
        lost = self.create(self.daniel, 0)
        other = self.create(self.azar, 0)
        pending = self.create(self.daniel, 20)
        deal = lambda u, q, outcome, **kw: self.call(u, "quote/deal", {"QuotationNumber": q.quotation_number,  # noqa: E731
                                                                        "Outcome": outcome, **kw})
        self.assertEqual(deal(self.daniel, pending, "WON").status_code, 400)  # not approved yet
        self.assertEqual(deal(self.daniel, won, "WON").status_code, 200)
        self.assertEqual(deal(self.daniel, lost, "LOST").status_code, 400)  # reason required
        self.assertEqual(deal(self.daniel, lost, "LOST", Reason="Other").status_code, 400)  # note required for Other
        self.assertEqual(deal(self.daniel, lost, "LOST", Reason="Price too high", Note="Wanted 30% off").status_code, 200)
        self.assertEqual(deal(self.azar, other, "LOST", Reason="Chose a competitor").status_code, 200)
        won.refresh_from_db()
        lost.refresh_from_db()
        self.assertEqual((won.deal_status, won.status), ("WON", "Confirmed"))
        self.assertEqual((lost.deal_status, lost.status, lost.deal_reason), ("LOST", "Lost", "Price too high"))
        self.assertIn("Deal Not Done", lost.events.values_list("action", flat=True))

        a = self.call(self.meera, "deals/analysis", method="get")
        self.assertEqual(a.status_code, 200)
        self.assertEqual(a.json()["data"]["Totals"]["Quotations"], 0)  # Meera's branch has none
        a = self.call(self.admin, "deals/analysis", method="get").json()["data"]
        self.assertEqual((a["Totals"]["Won"], a["Totals"]["Lost"], a["Totals"]["WinRate"]), (1, 2, 33))
        self.assertEqual({r["Reason"] for r in a["Reasons"]}, {"Price too high", "Chose a competitor"})
        ravi = self.call(self.ravi, "deals/analysis", method="get").json()["data"]
        self.assertEqual(ravi["Totals"]["Lost"], 1)  # only his team (Daniel)
        self.assertEqual(self.call(self.daniel, "deals/analysis", method="get").status_code, 403)
        self.assertEqual(deal(self.daniel, lost, "OPEN").status_code, 200)  # reopen
        lost.refresh_from_db()
        self.assertEqual(lost.deal_status, "OPEN")
