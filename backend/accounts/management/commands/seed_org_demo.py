"""Create a demo organisation for testing the approval hierarchy locally.

Mirrors the org chart (Telangana branch) plus a second, unrelated branch so
cross-branch routing can be verified. Emails use @example.com, which the
notifier never emails. NOT for production data.

    python manage.py seed_org_demo            # password: Demo@12345
"""
from django.core.management.base import BaseCommand

from accounts.hierarchy import ADMIN, BDM, DIRECTOR, RM, RSD, SR_BDM
from accounts.models import Branch, Franchise, Role, User

# (key, name, role, manager key, region)
ORG = [
    ("venkatesh", "Venkatesh", ADMIN, None, ""),
    # Telangana — from the org chart
    ("nandini", "Nandini", RSD, "venkatesh", "Telangana"),
    ("raviteja", "Ravi Teja", RM, "nandini", "Telangana"),
    ("tajuddin", "Tajuddin Syed", SR_BDM, "raviteja", "Telangana"),
    ("daniel", "Daniel", BDM, "tajuddin", "Telangana"),
    ("shiva", "Shiva Venkat", RM, "nandini", "Telangana"),
    ("haji", "Haji", SR_BDM, "shiva", "Telangana"),
    ("avinash", "Avinash", SR_BDM, "haji", "Telangana"),
    ("azar", "Azar", BDM, "avinash", "Telangana"),
    # A second, unrelated branch (Director level included)
    ("meera", "Meera", DIRECTOR, "venkatesh", "South"),
    ("karthik", "Karthik", RSD, "meera", "Karnataka"),
    ("farhan", "Farhan", RM, "karthik", "Karnataka"),
    ("priya", "Priya", BDM, "farhan", "Karnataka"),
]
PASSWORD = "Demo@12345"


class Command(BaseCommand):
    help = "Create demo users forming a multi-branch org hierarchy"

    def handle(self, *args, **opts):
        jaz = Franchise.objects.filter(name="JAZ").first()
        branch = Branch.objects.filter(franchise=jaz).first() if jaz else None
        users = {}
        for key, name, role, mgr, region in ORG:
            u, created = User.objects.get_or_create(
                email=f"{key}@example.com",
                defaults=dict(name=name, franchise=jaz, branch=branch, employee_code=f"DEMO-{key[:4].upper()}"),
            )
            if created:
                u.set_password(PASSWORD)
            u.name, u.region = name, region
            u.reporting_manager = users.get(mgr)
            u.is_staff = u.is_superuser = role == ADMIN
            u.is_active = True
            u.save()
            u.roles.set([Role.objects.get_or_create(name=role)[0]])
            users[key] = u
            self.stdout.write(f"  {role:<9} {name:<14} {u.email}")
        self.stdout.write(self.style.SUCCESS(f"Demo org ready. Password for all: {PASSWORD}"))
