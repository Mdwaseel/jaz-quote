from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Franchise(models.Model):
    name = models.CharField(max_length=120)
    short_code = models.CharField(max_length=20, blank=True, default="")  # e.g. "BE"
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Role(models.Model):
    name = models.CharField(max_length=60, unique=True)  # BDM, Admin, RM, RSD

    def __str__(self):
        return self.name


class Branch(models.Model):
    """Office address / branch, belonging to a franchise."""
    franchise = models.ForeignKey(Franchise, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=160)
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="")
    state = models.CharField(max_length=80, blank=True, default="")
    pincode = models.CharField(max_length=12, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.franchise.name})"


class Bank(models.Model):
    entity_id = models.IntegerField(default=1)
    account_holder_name = models.CharField(max_length=160)
    bank_name = models.CharField(max_length=120)
    account_number = models.CharField(max_length=40)
    ifsc_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_number}"


class CompanyProfile(models.Model):
    """Single row: the company details printed on every quotation (footer, bank page,
    acceptance block). Edited from Admin → Company & Bank."""
    name = models.CharField(max_length=160, default="JAZ Home Theatres")
    tagline = models.CharField(max_length=200, blank=True, default="Turnkey Home Cinema · Design · Acoustics · AV · Automation")
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="Hyderabad")
    state = models.CharField(max_length=80, blank=True, default="Telangana")
    email = models.EmailField(blank=True, default="srinivas@jazhometheatres.com")
    phone = models.CharField(max_length=40, blank=True, default="")
    website = models.CharField(max_length=120, blank=True, default="www.jazhometheatres.com")
    gstin = models.CharField(max_length=20, blank=True, default="")
    pan = models.CharField(max_length=20, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company profile"

    def __str__(self):
        return self.name

    @classmethod
    def get(cls):
        obj = cls.objects.order_by("id").first()
        return obj or cls.objects.create()


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=160)
    employee_code = models.CharField(max_length=40, blank=True, default="")  # BE243
    mobile = models.CharField(max_length=20, blank=True, default="")
    date_of_joining = models.DateField(null=True, blank=True)
    profile_image = models.CharField(max_length=255, blank=True, default="")
    signature = models.CharField(max_length=255, blank=True, default="")

    franchise = models.ForeignKey(Franchise, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    roles = models.ManyToManyField(Role, blank=True, related_name="users")
    reporting_manager = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="reports")
    region = models.CharField(max_length=80, blank=True, default="")  # e.g. "Telangana" (org-tree label)
    # Soft delete: the account is hidden and cannot sign in, but its name stays on
    # quotation history / audit records. The email is freed for re-use.
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_email = models.CharField(max_length=254, blank=True, default="")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    def __str__(self):
        return f"{self.name} <{self.email}>"

    @property
    def role_names(self):
        return list(self.roles.values_list("name", flat=True))

    @property
    def primary_role(self):
        first = self.roles.first()
        return first.name if first else ""


class EmailOTP(models.Model):
    """One-time password emailed to a user for two-step login verification."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=20, default="login")
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP<{self.user_id} {self.purpose} {'used' if self.consumed else 'active'}>"
