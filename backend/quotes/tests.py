"""End-to-end tests of the approval engine through the real API.

Org used (two unrelated branches so cross-branch routing is verifiable):

    Admin ─┬─ RSD Nandini ─┬─ RM Ravi ── Sr.BDM Taj ── BDM Daniel
           │               └─ RM Shiva ── Sr.BDM Haji ── BDM Azar
           └─ Director Meera ── RSD Karthik ── RM Farhan ── BDM Priya
"""
import json
import shutil
import tempfile
from pathlib import Path
from unittest import mock

from django.core import mail
from django.test import TestCase, override_settings

from accounts.hierarchy import ADMIN, BDM, DIRECTOR, RM, RSD, SR_BDM
from accounts.models import Role, User
from catalog.models import Product, ProductCategory
from common import jwt
from quotes.models import ApprovalRequest, ApprovalStep, Customer, Quotation, QuotationVersion

MEDIA = tempfile.mkdtemp()


def fake_pdf(quote, watermark=""):
    rel = f"quotes/{quote.quotation_number}.pdf"
    path = Path(MEDIA) / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"%PDF-1.4 fake")
    return rel


@override_settings(MEDIA_ROOT=MEDIA, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                   NOTIFY_SKIP_DOMAINS=[])
@mock.patch("quotes.pdf.generate_quote_pdf", fake_pdf)
class EngineTestBase(TestCase):
    """Shared org + helpers (no tests of its own)."""

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cat = ProductCategory.objects.create(name="Video", order=1, gst_percent=18)
        cls.projector = Product.objects.create(category=cat, name="4K Laser Projector", price=1_000_000)

        def mk(key, role, mgr=None):
            u = User.objects.create_user(email=f"{key}@brio.test", password="x" * 10, name=key.title(),
                                         reporting_manager=mgr)
            u.roles.add(Role.objects.get_or_create(name=role)[0])
            return u

        cls.admin = mk("admin", ADMIN)
        cls.nandini = mk("nandini", RSD, cls.admin)
        cls.ravi = mk("ravi", RM, cls.nandini)
        cls.taj = mk("taj", SR_BDM, cls.ravi)
        cls.daniel = mk("daniel", BDM, cls.taj)
        cls.shiva = mk("shiva", RM, cls.nandini)
        cls.haji = mk("haji", SR_BDM, cls.shiva)
        cls.azar = mk("azar", BDM, cls.haji)
        cls.meera = mk("meera", DIRECTOR, cls.admin)
        cls.karthik = mk("karthik", RSD, cls.meera)
        cls.farhan = mk("farhan", RM, cls.karthik)
        cls.priya = mk("priya", BDM, cls.farhan)

    # ------------------------------------------------------------ helpers
    def call(self, user, path, data=None, method="post"):
        token = jwt.make_tokens(user)[0]
        fn = getattr(self.client, method)
        # Emails are sent on transaction commit; run those callbacks in tests.
        with self.captureOnCommitCallbacks(execute=True):
            if method == "get":
                return fn(f"/api/{path}", data or {}, HTTP_AUTHORIZATION=f"Bearer {token}")
            return fn(f"/api/{path}", json.dumps(data or {}), content_type="application/json",
                      HTTP_AUTHORIZATION=f"Bearer {token}")

    def payload(self, discount=0, reasons=None, **extra):
        d = {
            "CustomerName": "ACME Towers", "CustomerMobile": "9000000000", "CityName": "Hyderabad",
            "ProductInfo": {"Package": "7.2.4 Dolby Atmos Home Cinema", "Configuration": "7.2.4", "Room": "Basement",
                            "Items": [{"ProductId": self.projector.id, "Name": "4K Laser Projector", "Qty": 1,
                                       "UnitPrice": 1_000_000, "GstPercent": 18}]},
            "DiscountPercent": discount,
            # client-sent totals must be ignored
            "ExcludeTax": 1, "IncludeTax": 1, "Tax": 0,
            "Reasons": reasons if reasons is not None else {
                "DISCOUNT": "Customer negotiation", "WARRANTY": "Key account",
                "AMC": "Competitive bid", "PAYMENT_TERMS": "Customer cash-flow"},
        }
        d.update(extra)
        return d

    def create(self, user, discount=0, **extra):
        r = self.call(user, "quote/createquote", self.payload(discount, **extra))
        self.assertEqual(r.status_code, 200, r.content)
        return Quotation.objects.get(quotation_number=r.json()["data"]["QuotationNumber"])

    def steps(self, quote, category="DISCOUNT"):
        req = quote.approval_requests.filter(category=category, version_number=quote.current_version) \
            .exclude(status="CANCELLED").latest("id")
        return req, [(s.role, s.assigned_to.name, s.status) for s in req.steps.order_by("order")]

    def act(self, user, req, action="approve", note="ok", **extra):
        return self.call(user, "approvals/act", {"requestId": req.id, "action": action, "note": note, **extra})

    def download(self, user, quote):
        return self.call(user, "quote/converthtmltopdfanduploadasync", {"QuotationNumber": quote.quotation_number})


@override_settings(MEDIA_ROOT=MEDIA, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                   NOTIFY_SKIP_DOMAINS=[])
@mock.patch("quotes.pdf.generate_quote_pdf", fake_pdf)
class ApprovalEngineTests(EngineTestBase):
    # ------------------------------------------------------------ discount paths
    def test_bdm_no_discount_downloads_directly(self):
        q = self.create(self.daniel, 0)
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        self.assertFalse(q.approval_requests.exists())
        self.assertEqual(float(q.include_tax), 1_180_000)  # server-priced, ignores IncludeTax=1
        self.assertEqual(self.download(self.daniel, q).status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.DOWNLOADED)

    def test_bdm_20_goes_to_own_rm_only(self):
        q = self.create(self.daniel, 20)
        req, steps = self.steps(q)
        self.assertEqual(steps, [(RM, "Ravi", "PENDING")])  # never Shiva
        self.assertEqual(self.download(self.daniel, q).status_code, 423)
        # Other branch's RM can neither act nor even see it
        self.assertEqual(self.act(self.shiva, req).status_code, 404)
        self.assertEqual(self.call(self.shiva, "quote/getquote", {"QuoteId": q.quotation_number}, "get")
                         .json()["data"]["response"], None)
        self.assertEqual(self.act(self.ravi, req, note="Approved").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        self.assertEqual(self.download(self.daniel, q).status_code, 200)
        subjects = [m.subject for m in mail.outbox]
        self.assertIn(f"Quotation Approval Required — {q.quotation_number}", subjects)
        self.assertIn(f"Quotation Approved — {q.quotation_number}", subjects)
        self.assertEqual(mail.outbox[0].to, ["ravi@brio.test"])

    def test_bdm_32_goes_rsd_then_admin(self):
        q = self.create(self.daniel, 32)
        req, steps = self.steps(q)
        self.assertEqual(steps, [(RSD, "Nandini", "PENDING"), (ADMIN, "Admin", "WAITING")])
        self.assertEqual(float(q.special_cost), 320_000)
        # Admin stage can't be acted on by the RM, and RSD goes first
        self.assertEqual(self.act(self.ravi, req).status_code, 403)
        self.assertEqual(self.act(self.nandini, req, note="Approved based on customer negotiation.").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.PARTIALLY_APPROVED)
        self.assertEqual(self.download(self.daniel, q).status_code, 423)
        self.assertIn(f"Quotation Escalated to Admin — {q.quotation_number}", [m.subject for m in mail.outbox])
        self.assertEqual(self.act(self.admin, req, note="Approved.").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        actions = list(q.events.values_list("action", flat=True))
        for a in ("Quotation Created", "Discount Requested", "Submitted to RSD", "Discount Approved by RSD",
                  "Submitted to Admin", "Discount Approved by Admin"):
            self.assertIn(a, actions)

    def test_bdm_42_goes_to_admin_outside_limit_and_needs_reason(self):
        r = self.call(self.daniel, "quote/createquote", self.payload(42, reasons={}))
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Quotation.objects.exists())  # nothing half-created
        q = self.create(self.daniel, 42)
        req, steps = self.steps(q)
        self.assertEqual(steps, [(ADMIN, "Admin", "PENDING")])
        self.assertTrue(req.outside_limit)

    def test_discount_slabs(self):
        expect = {15: [], 15.5: [RM], 25: [RM], 26: [RSD], 30: [RSD], 31: [RSD, ADMIN], 35: [RSD, ADMIN], 36: [ADMIN]}
        for pct, path in expect.items():
            q = self.create(self.daniel, pct)
            if not path:
                self.assertEqual(q.workflow_status, Quotation.APPROVED, pct)
                continue
            self.assertEqual([s[0] for s in self.steps(q)[1]], path, pct)
            self.assertEqual(self.steps(q)[0].outside_limit, pct > 35, pct)

    def test_sr_bdm_paths(self):
        q = self.create(self.taj, 20)
        self.assertEqual(self.steps(q)[1], [(RM, "Ravi", "PENDING")])
        q = self.create(self.haji, 32)
        self.assertEqual(self.steps(q)[1], [(RSD, "Nandini", "PENDING"), (ADMIN, "Admin", "WAITING")])

    def test_rsd_director_admin_authority(self):
        self.assertEqual(self.create(self.nandini, 28).workflow_status, Quotation.APPROVED)
        q = self.create(self.nandini, 32)
        self.assertEqual(self.steps(q)[1], [(ADMIN, "Admin", "PENDING")])
        self.assertEqual(self.create(self.meera, 50).workflow_status, Quotation.APPROVED)
        q = self.create(self.meera, 55)
        self.assertEqual(self.steps(q)[1], [(ADMIN, "Admin", "PENDING")])
        self.assertEqual(self.create(self.admin, 80).workflow_status, Quotation.APPROVED)

    def test_other_branch_routes_through_director_branch(self):
        q = self.create(self.priya, 32)
        self.assertEqual(self.steps(q)[1], [(RSD, "Karthik", "PENDING"), (ADMIN, "Admin", "WAITING")])
        q = self.create(self.azar, 20)
        self.assertEqual(self.steps(q)[1], [(RM, "Shiva", "PENDING")])

    # ------------------------------------------------------------ rejection / resubmission
    def test_rejection_requires_reason_and_resubmission(self):
        q = self.create(self.daniel, 20)
        req, _ = self.steps(q)
        self.assertEqual(self.act(self.ravi, req, "reject", note="  ").status_code, 400)
        self.assertEqual(self.act(self.ravi, req, "reject", note="Too high for this customer").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.REJECTED)
        self.assertEqual(self.download(self.daniel, q).status_code, 423)
        self.assertIn(f"Quotation Rejected — {q.quotation_number}", [m.subject for m in mail.outbox])
        # Rejected → creator revises and re-submits
        r = self.call(self.daniel, "quote/update", {**self.payload(18), "QuotationNumber": q.quotation_number})
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(q.current_version, 2)
        req2, steps = self.steps(q)
        self.assertNotEqual(req2.id, req.id)
        self.assertEqual(steps, [(RM, "Ravi", "PENDING")])

    # ------------------------------------------------------------ lock / edit request / re-evaluation
    def test_edit_after_approval_requires_rm_and_reevaluates(self):
        q = self.create(self.daniel, 20)
        req, _ = self.steps(q)
        self.act(self.ravi, req)
        # Locked: direct API edit refused
        r = self.call(self.daniel, "quote/update", {**self.payload(32), "QuotationNumber": q.quotation_number})
        self.assertEqual(r.status_code, 403)
        # Reason required
        self.assertEqual(self.call(self.daniel, "quote/request-edit",
                                   {"QuotationNumber": q.quotation_number, "Reason": ""}).status_code, 400)
        r = self.call(self.daniel, "quote/request-edit",
                      {"QuotationNumber": q.quotation_number, "Reason": "Customer changed door finish"})
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.EDIT_REQUESTED)
        edit_req = q.approval_requests.get(category="EDIT")
        self.assertEqual([s.assigned_to_id for s in edit_req.steps.all()], [self.ravi.id])
        self.assertEqual(self.act(self.ravi, edit_req, note="Proceed").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.EDITING)
        self.assertEqual(self.download(self.daniel, q).status_code, 423)
        # Edit raises the discount → old RM approval is not enough
        r = self.call(self.daniel, "quote/update", {**self.payload(32), "QuotationNumber": q.quotation_number})
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(q.current_version, 2)
        self.assertEqual(q.workflow_status, Quotation.PENDING_APPROVAL)
        self.assertEqual(self.steps(q)[1], [(RSD, "Nandini", "PENDING"), (ADMIN, "Admin", "WAITING")])
        self.assertEqual(self.download(self.daniel, q).status_code, 423)
        self.assertEqual(QuotationVersion.objects.filter(quotation=q).count(), 2)
        # Locked again for the BDM
        r = self.call(self.daniel, "quote/update", {**self.payload(32), "QuotationNumber": q.quotation_number})
        self.assertEqual(r.status_code, 403)

    def test_unchanged_approval_carries_over_on_edit(self):
        q = self.create(self.daniel, 20)
        req, _ = self.steps(q)
        self.act(self.ravi, req)
        self.call(self.daniel, "quote/request-edit", {"QuotationNumber": q.quotation_number, "Reason": "Door"})
        self.act(self.ravi, q.approval_requests.get(category="EDIT"))
        p = self.payload(20)
        p["ProductInfo"] = {**p["ProductInfo"], "Room": "Lounge"}
        self.call(self.daniel, "quote/update", {**p, "QuotationNumber": q.quotation_number})
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        self.assertEqual(q.approved_version, 2)
        self.assertIn("Discount Approval Carried Over", q.events.values_list("action", flat=True))

    # ------------------------------------------------------------ self-approval / authority
    def test_never_self_approve(self):
        q = self.create(self.ravi, 28)  # RM's own quote → RSD (25–30% slab)
        req, steps = self.steps(q)
        self.assertEqual(steps, [(RSD, "Nandini", "PENDING")])
        self.assertEqual(self.act(self.ravi, req).status_code, 403)
        # An Admin's own request never happens (unrestricted), and BDMs can't approve anything
        q2 = self.create(self.daniel, 20)
        self.assertEqual(self.act(self.taj, self.steps(q2)[0]).status_code, 403)

    def test_admin_override_covers_remaining_levels(self):
        q = self.create(self.daniel, 32)
        req, _ = self.steps(q)
        self.assertEqual(self.act(self.admin, req, note="Urgent").status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        self.assertTrue(req.steps.get(role=RSD).note.startswith("[Admin override]"))

    def test_approver_lowers_discount_and_amount_recalculates(self):
        q = self.create(self.daniel, 33)
        req, _ = self.steps(q)
        r = self.act(self.nandini, req, note="Max 18%", approvedPercent=18)
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(float(q.discount_percent), 18)
        self.assertEqual(float(q.include_tax), 967_600)  # 820000 + 18% GST
        self.assertEqual(q.workflow_status, Quotation.APPROVED)  # Admin not needed at 18%
        self.assertEqual(req.steps.get(role=ADMIN).status, ApprovalStep.SKIPPED)
        self.assertEqual(q.approved_version, q.current_version)
        self.assertIn("Discount Modified by Approver", q.events.values_list("action", flat=True))

    # ------------------------------------------------------------ warranty / AMC / payment terms
    def test_warranty_rules(self):
        q = self.create(self.daniel, WarrentyDetails=[{"TypeOfParts": "Workmanship", "Duration": 4}])
        self.assertEqual(self.steps(q, "WARRANTY")[1], [(RSD, "Nandini", "PENDING"), (ADMIN, "Admin", "WAITING")])
        q = self.create(self.daniel, WarrentyDetails=[{"TypeOfParts": "Workmanship", "Duration": 2}])
        self.assertEqual(self.steps(q, "WARRANTY")[1], [(RSD, "Nandini", "PENDING")])
        q = self.create(self.nandini, WarrentyDetails=[{"TypeOfParts": "Workmanship", "Duration": 3}])
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        q = self.create(self.daniel)
        self.assertEqual(q.warranty_details[0]["Duration"], 1.0)  # standard default

    def test_amc_rules(self):
        q = self.create(self.daniel, Amc=[{"AmcType": "Comprehensive", "Duration": 6.5}])
        self.assertEqual(self.steps(q, "AMC")[1], [(RM, "Ravi", "PENDING")])
        q = self.create(self.daniel, Amc=[{"AmcType": "Comprehensive", "Duration": 5.5}])
        self.assertEqual(self.steps(q, "AMC")[1], [(RSD, "Nandini", "PENDING")])
        q = self.create(self.nandini, Amc=[{"AmcType": "Comprehensive", "Duration": 5},
                                           {"AmcType": "Preventive", "Duration": 3}])
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        q = self.create(self.daniel, Amc=[{"AmcType": "Comprehensive", "Duration": 9}])
        self.assertEqual(q.workflow_status, Quotation.APPROVED)  # higher than standard is fine

    def test_payment_term_rules(self):
        custom = [{"TermName": "Advance", "TermValue": 20}, {"TermName": "On delivery", "TermValue": 80}]
        q = self.create(self.daniel, PaymentTerms=custom)
        self.assertEqual(self.steps(q, "PAYMENT_TERMS")[1], [(RM, "Ravi", "PENDING")])
        # The JAZ standard 30 / 60 / 10 schedule needs no approval, in any order or wording case.
        standard = [{"TermName": "against completion, testing and handover", "TermValue": 10},
                    {"TermName": "Advance against booking / design initiation", "TermValue": 30},
                    {"TermName": "Before installation / dispatch of major AV equipment", "TermValue": 60}]
        self.assertEqual(self.create(self.daniel, PaymentTerms=standard).workflow_status, Quotation.APPROVED)
        q = self.create(self.nandini, PaymentTerms=custom)  # RSD → next level up
        self.assertEqual(self.steps(q, "PAYMENT_TERMS")[1], [(ADMIN, "Admin", "PENDING")])
        bad = [{"TermName": "Advance", "TermValue": 50}]
        self.assertEqual(self.call(self.daniel, "quote/createquote", self.payload(PaymentTerms=bad)).status_code, 400)

    def test_multiple_requirements_tracked_independently(self):
        custom = [{"TermName": "Advance", "TermValue": 20}, {"TermName": "On delivery", "TermValue": 80}]
        q = self.create(self.daniel, 32, PaymentTerms=custom)
        disc, _ = self.steps(q, "DISCOUNT")
        terms, _ = self.steps(q, "PAYMENT_TERMS")
        self.act(self.ravi, terms)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.PARTIALLY_APPROVED)
        self.act(self.nandini, disc)
        self.act(self.admin, disc)
        q.refresh_from_db()
        self.assertEqual(q.workflow_status, Quotation.APPROVED)
        counts = self.call(self.ravi, "approvals/counts", method="get").json()["data"]
        self.assertEqual(counts["PendingTotal"], 0)

    # ------------------------------------------------------------ deactivation
    def test_deactivated_approver_is_escalated(self):
        q = self.create(self.daniel, 20)
        r = self.call(self.admin, "admin-api/users/toggle", {"userId": self.ravi.id, "active": False})
        self.assertEqual(r.json()["data"]["EscalatedApprovals"], 1)
        self.assertEqual(self.steps(q)[1], [(RM, "Nandini", "PENDING")])  # next person up the same chain
        # New requests skip the inactive RM too
        q2 = self.create(self.taj, 20)
        self.assertEqual(self.steps(q2)[1][0][1], "Nandini")

    def test_admin_reassign(self):
        q = self.create(self.daniel, 20)
        req, _ = self.steps(q)
        step = req.steps.get()
        self.assertEqual(self.call(self.nandini, "approvals/reassign",
                                   {"stepId": step.id, "userId": self.shiva.id}).status_code, 403)
        self.assertEqual(self.call(self.admin, "approvals/reassign",
                                   {"stepId": step.id, "userId": self.daniel.id}).status_code, 400)
        self.assertEqual(self.call(self.admin, "approvals/reassign",
                                   {"stepId": step.id, "userId": self.shiva.id}).status_code, 200)
        self.assertEqual(self.act(self.shiva, req).status_code, 200)

    # ------------------------------------------------------------ authorisation
    def test_unauthorized_api_access(self):
        for user in (self.daniel, self.ravi, self.meera):
            self.assertEqual(self.call(user, "admin-api/users").status_code, 403)
            self.assertEqual(self.call(user, "admin-api/users/create",
                                       {"name": "x", "email": "x@x.com", "password": "12345678"}).status_code, 403)
            self.assertEqual(self.call(user, "user/createuser", {"Email": "y@y.com"}).status_code, 403)
            self.assertEqual(self.call(user, "user/deleteuser", {"userId": self.admin.id}).status_code, 403)
            self.assertEqual(self.call(user, "user/edit-user", {"UserId": user.id,
                                                                "ReportingManagerId": self.admin.id}).status_code, 403)
        self.assertEqual(self.client.post("/api/quote/createquote").status_code, 401)
        self.assertEqual(self.call(self.daniel, "approvals/list", {"scope": "all"}).status_code, 403)

    def test_visibility_follows_hierarchy(self):
        qd = self.create(self.daniel, 0)
        qa = self.create(self.azar, 0)
        rows = lambda u: {r["QuotationNumber"] for r in self.call(u, "quote/getListofQuotation").json()["data"]}
        self.assertEqual(rows(self.ravi), {qd.quotation_number})
        self.assertEqual(rows(self.shiva), {qa.quotation_number})
        self.assertEqual(rows(self.nandini), {qd.quotation_number, qa.quotation_number})
        self.assertEqual(rows(self.daniel), {qd.quotation_number})
        self.assertEqual(rows(self.meera), set())  # other branch
        self.assertEqual(rows(self.admin), {qd.quotation_number, qa.quotation_number})
        # Cannot download someone else's quote by legacy customerId either
        r = self.call(self.azar, "quote/converthtmltopdfanduploadasync", {"customerId": qd.customer_id})
        self.assertEqual(r.status_code, 404)

    def test_hierarchy_assignment_validation(self):
        r = self.call(self.admin, "admin-api/users/update", {"userId": self.nandini.id, "managerId": self.daniel.id})
        self.assertEqual(r.status_code, 400)  # RSD under a BDM
        r = self.call(self.admin, "admin-api/users/update", {"userId": self.ravi.id, "managerId": self.taj.id,
                                                             "role": SR_BDM})
        self.assertEqual(r.status_code, 400)  # loop (Taj reports to Ravi)
        r = self.call(self.admin, "admin-api/users/update", {"userId": self.azar.id, "managerId": self.farhan.id})
        self.assertEqual(r.status_code, 200)
        q = self.create(self.azar, 20)
        self.assertEqual(self.steps(q)[1], [(RM, "Farhan", "PENDING")])

    def test_in_flight_chain_is_snapshotted(self):
        q = self.create(self.daniel, 20)
        self.call(self.admin, "admin-api/users/update", {"userId": self.taj.id, "managerId": self.shiva.id})
        self.assertEqual(self.steps(q)[1], [(RM, "Ravi", "PENDING")])  # unchanged mid-flight
        self.assertEqual(self.act(self.ravi, self.steps(q)[0]).status_code, 200)

    def test_evaluate_endpoint(self):
        r = self.call(self.daniel, "quote/evaluate", self.payload(32)).json()["data"]
        self.assertEqual(r["Financials"]["FinalAmount"], 802_400)
        self.assertEqual(r["Approvals"][0]["Path"], [{"Role": RSD, "Name": "Nandini"}, {"Role": ADMIN, "Name": "Admin"}])


class PdfAmcTests(TestCase):
    """The customer PDF must print the AMC rates entered on the quotation."""

    def test_pdf_uses_quotation_amc_rates(self):
        from quotes.pdf import build_context

        c = Customer.objects.create(name="ACME")
        q = Quotation(quotation_number="T-1", customer=c, amc_details=[
            {"AmcType": "Comprehensive", "Duration": 7.5}, {"AmcType": "Preventive", "Duration": 6.0}])
        ctx = build_context(q)
        self.assertEqual((ctx["amc_comp"], ctx["amc_prev"]), (7.5, 6))
        from django.template.loader import render_to_string
        html = render_to_string("quotation.html", ctx)
        self.assertIn("Comprehensive AMC at 7.5%", html)
        self.assertIn("Preventive AMC at 6%", html)


PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGA"
       "hKmMIQAAAABJRU5ErkJggg==")


@override_settings(MEDIA_ROOT=MEDIA, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                   NOTIFY_SKIP_DOMAINS=[])
@mock.patch("quotes.pdf.generate_quote_pdf", fake_pdf)
class CustomerSignatureTests(EngineTestBase):
    """Signature images: validated; customer signatures only via e-sign/onsite (see
    tests_features); the authorised signatory's can still be added after submission."""

    def sign(self, user, q, image, kind="signatory"):
        return self.call(user, "quote/signature", {"QuotationNumber": q.quotation_number, "Kind": kind, "Image": image})

    def test_signature_printed_on_pdf(self):
        q = self.create(self.daniel, 0)
        q.sales_info = {**q.sales_info, "CustomerSign": PNG}
        q.save()
        from quotes.pdf import build_context
        self.assertEqual(build_context(q)["customer_sign"], PNG)
        from django.template.loader import render_to_string
        self.assertEqual(render_to_string("quotation.html", build_context(q)).count('alt="Customer signature"'), 1)

    def test_customer_signature_cannot_be_set_through_the_quotation_api(self):
        q = self.create(self.daniel, 0, SalesInfo={"CustomerSign": PNG})
        self.assertEqual(q.sales_info["CustomerSign"], "")  # ignored — only e-sign / onsite set it
        self.assertEqual(self.sign(self.daniel, q, PNG, kind="customer").status_code, 400)

    def test_invalid_or_huge_signature_rejected(self):
        for bad in ("https://evil.example/x.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,@@@"):
            r = self.call(self.daniel, "quote/createquote", self.payload(SalesInfo={"SignatorySign": bad}))
            self.assertEqual(r.status_code, 400, bad)
        import base64
        huge = "data:image/png;base64," + base64.b64encode(b"x" * 700_000).decode()
        self.assertEqual(self.call(self.daniel, "quote/createquote", self.payload(SalesInfo={"SignatorySign": huge})).status_code, 400)
        self.assertFalse(Quotation.objects.exists())

    def test_signatory_signature_after_submission_on_locked_quote(self):
        q = self.create(self.daniel, 20)  # submitted → locked, pending RM
        r = self.sign(self.daniel, q, PNG)
        self.assertEqual(r.status_code, 200, r.content)
        q.refresh_from_db()
        self.assertEqual(q.sales_info["SignatorySign"], PNG)
        self.assertEqual(q.workflow_status, Quotation.PENDING_APPROVAL)  # approvals untouched
        self.assertIn("Authorised signatory signature Added", q.events.values_list("action", flat=True))
        self.assertEqual(self.sign(self.daniel, q, "").status_code, 200)
        self.assertIn("Authorised signatory signature Removed", q.events.values_list("action", flat=True))

    def test_signature_scope_and_validation(self):
        q = self.create(self.daniel, 0)
        self.assertEqual(self.sign(self.azar, q, PNG).status_code, 404)  # other branch can't see it
        self.assertEqual(self.sign(self.daniel, q, "not-an-image").status_code, 400)
        self.assertEqual(self.sign(self.daniel, q, PNG, kind="ceo").status_code, 400)
        self.assertEqual(self.sign(self.ravi, q, PNG).status_code, 200)  # manager in the chain can add it
