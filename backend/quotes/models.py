from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=160)
    mobile = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    address2 = models.TextField(blank=True, default="")
    landmark = models.CharField(max_length=160, blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="")
    state = models.CharField(max_length=80, blank=True, default="")
    country = models.CharField(max_length=80, blank=True, default="India")
    zipcode = models.CharField(max_length=12, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Quotation(models.Model):
    # Sales status (customer-facing lifecycle, pre-existing).
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Confirmed", "Confirmed"),
        ("Rebate", "Rebate"),
        ("Inactive", "Inactive"),
        ("Lost", "Lost"),
    ]

    # Workflow status (approval lifecycle) — kept separate from the sales status.
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    APPROVED = "APPROVED"  # shown as "Ready for Download"
    REJECTED = "REJECTED"
    EDIT_REQUESTED = "EDIT_REQUESTED"
    EDITING = "EDITING"
    DOWNLOADED = "DOWNLOADED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    WORKFLOW_CHOICES = [
        (DRAFT, "Draft"),
        (PENDING_APPROVAL, "Pending Approval"),
        (PARTIALLY_APPROVED, "Partially Approved"),
        (APPROVED, "Ready for Download"),
        (REJECTED, "Rejected"),
        (EDIT_REQUESTED, "Edit Requested"),
        (EDITING, "Editing"),
        (DOWNLOADED, "Downloaded"),
        (EXPIRED, "Expired"),
        (CANCELLED, "Cancelled"),
    ]

    quotation_number = models.CharField(max_length=40, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="quotations")

    # list-column denormalised fields (the full project + BOQ lives in product_info)
    package = models.CharField(max_length=160, blank=True, default="")  # cover "MODEL", e.g. "7.2.4 Dolby Atmos Home Cinema"
    configuration = models.CharField(max_length=20, blank=True, default="")  # "7.2.4"
    tier = models.CharField(max_length=60, blank=True, default="")  # investment level
    room = models.CharField(max_length=160, blank=True, default="")  # "Room / Area"

    # full captured payload objects
    product_info = models.JSONField(default=dict, blank=True)
    sales_info = models.JSONField(default=dict, blank=True)
    payment_terms = models.JSONField(default=list, blank=True)
    warranty_details = models.JSONField(default=list, blank=True)
    amc_details = models.JSONField(default=list, blank=True)

    # pricing (server-computed, see quotes.pricing):
    #   base_amount      = list ("actual") value of the included BOQ lines, ex-GST
    #   discount_percent = total discount vs list (line price cuts + additional discount) — what approvals use
    #   special_cost     = total discount amount (base_amount - exclude_tax)
    base_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    exclude_tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    include_tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    special_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    # Deal outcome, recorded by the sales team after the quotation is shared.
    DEAL_OPEN, DEAL_WON, DEAL_LOST = "OPEN", "WON", "LOST"
    DEAL_CHOICES = [(DEAL_OPEN, "Open"), (DEAL_WON, "Deal done"), (DEAL_LOST, "Deal not done")]
    deal_status = models.CharField(max_length=8, choices=DEAL_CHOICES, default=DEAL_OPEN)
    deal_reason = models.CharField(max_length=80, blank=True, default="")
    deal_note = models.TextField(blank=True, default="")
    deal_closed_at = models.DateTimeField(null=True, blank=True)
    deal_closed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    workflow_status = models.CharField(max_length=24, choices=WORKFLOW_CHOICES, default=DRAFT)
    # Cancellation — a cancelled quotation is kept (and can be restored); only its status changes.
    cancel_reason = models.CharField(max_length=80, blank=True, default="")
    cancel_note = models.TextField(blank=True, default="")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cancelled_from = models.CharField(max_length=24, blank=True, default="")  # workflow status before cancelling
    current_version = models.PositiveIntegerField(default=0)
    # Latest version that was fully approved (the only one that may be downloaded).
    approved_version = models.PositiveIntegerField(null=True, blank=True)
    quote_file = models.CharField(max_length=255, blank=True, default="")

    created_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations")
    created_by_role = models.CharField(max_length=20, blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.quotation_number


class QuotationVersion(models.Model):
    """Immutable snapshot of a quotation each time it is submitted/edited."""
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    note = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["quotation", "number"]
        unique_together = [("quotation", "number")]


class ApprovalRequest(models.Model):
    DISCOUNT = "DISCOUNT"
    WARRANTY = "WARRANTY"
    AMC = "AMC"
    PAYMENT_TERMS = "PAYMENT_TERMS"
    EDIT = "EDIT"
    CATEGORY_CHOICES = [
        (DISCOUNT, "Discount"),
        (WARRANTY, "Warranty"),
        (AMC, "AMC"),
        (PAYMENT_TERMS, "Payment Terms"),
        (EDIT, "Quotation Edit"),
    ]

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"  # superseded by a newer version / quotation cancelled
    STATUS_CHOICES = [(PENDING, "Pending"), (APPROVED, "Approved"), (REJECTED, "Rejected"), (CANCELLED, "Cancelled")]

    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="approval_requests")
    version_number = models.PositiveIntegerField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    requested_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="approval_requests")
    requested_by_role = models.CharField(max_length=20, blank=True, default="")
    reason = models.TextField(blank=True, default="")
    existing_value = models.JSONField(null=True, blank=True)
    requested_value = models.JSONField(null=True, blank=True)
    approved_value = models.JSONField(null=True, blank=True)
    outside_limit = models.BooleanField(default=False)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class ApprovalStep(models.Model):
    """One level of an approval chain — snapshotted when the request is created,
    so later org changes never silently re-route an in-flight approval."""
    WAITING = "WAITING"  # a lower level has not approved yet
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SKIPPED = "SKIPPED"  # not needed any more (e.g. approver lowered the discount)
    CANCELLED = "CANCELLED"
    STATUS_CHOICES = [(s, s.title()) for s in (WAITING, PENDING, APPROVED, REJECTED, SKIPPED, CANCELLED)]

    request = models.ForeignKey(ApprovalRequest, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveSmallIntegerField()
    role = models.CharField(max_length=20)
    assigned_to = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="approval_steps")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=WAITING)
    acted_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    note = models.TextField(blank=True, default="")
    acted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["request", "order"]


class QuotationEvent(models.Model):
    """Append-only audit trail. Never edited or deleted by application code."""
    quotation = models.ForeignKey(Quotation, on_delete=models.PROTECT, related_name="events")
    version_number = models.PositiveIntegerField(default=0)
    actor = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    actor_role = models.CharField(max_length=20, blank=True, default="")
    action = models.CharField(max_length=60)
    field = models.CharField(max_length=40, blank=True, default="")
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    note = models.TextField(blank=True, default="")
    status = models.CharField(max_length=24, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class Notification(models.Model):
    """In-app copy of every workflow notification (email is sent alongside)."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    quotation = models.ForeignKey(Quotation, null=True, on_delete=models.SET_NULL, related_name="+")
    subject = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class CustomerSignature(models.Model):
    """A customer's signature on a specific quotation version.

    ESIGN: emailed link → customer reviews, signs and takes a live selfie.
    ONSITE: signed on the salesperson's device + a live photo of both of them.
    Images are stored as data URLs (signature PNG, photo JPEG).
    """
    ESIGN, ONSITE = "ESIGN", "ONSITE"
    METHOD_CHOICES = [(ESIGN, "E-signature"), (ONSITE, "Onsite")]
    SENT, SIGNED, CANCELLED, EXPIRED = "SENT", "SIGNED", "CANCELLED", "EXPIRED"
    STATUS_CHOICES = [(SENT, "Sent"), (SIGNED, "Signed"), (CANCELLED, "Cancelled"), (EXPIRED, "Expired")]

    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="customer_signatures")
    version_number = models.PositiveIntegerField()
    method = models.CharField(max_length=8, choices=METHOD_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=SENT)
    email = models.EmailField(blank=True, default="")  # where the e-sign link was sent
    token_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    signer_name = models.CharField(max_length=160, blank=True, default="")
    signature = models.TextField(blank=True, default="")
    photo = models.TextField(blank=True, default="")
    consent_text = models.TextField(blank=True, default="")
    ip_address = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=300, blank=True, default="")
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
