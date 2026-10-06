from django.db import models


class Country(models.Model):
    name = models.CharField(max_length=80)

    def __str__(self):
        return self.name


class State(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states")
    name = models.CharField(max_length=80)

    def __str__(self):
        return self.name


class City(models.Model):
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=80)

    def __str__(self):
        return self.name


class ProductCategory(models.Model):
    """BOQ section, e.g. 'Video', 'Front LCR', 'Acoustics', 'Cinema Seating'."""
    name = models.CharField(max_length=80, unique=True)
    order = models.IntegerField(default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=18)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "Product categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    """A quotable item. `price` is the list price (ex-GST) the sales team starts from;
    they can change it per quotation, and going below it counts as discount."""
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=160)  # "4K Laser Projector — High Performance"
    specification = models.TextField(blank=True, default="")  # "4K laser projector, HDR capable"
    brands = models.CharField(max_length=200, blank=True, default="")  # suggested model / class
    unit = models.CharField(max_length=20, default="Nos")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # None = category's
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["category__order", "order", "name"]

    def __str__(self):
        return self.name

    @property
    def effective_gst(self):
        return self.gst_percent if self.gst_percent is not None else self.category.gst_percent


class Package(models.Model):
    """A starting configuration (e.g. 7.2.4 Dolby Atmos Home Cinema) that pre-fills the
    specification and the BOQ. Everything stays editable on the quotation."""
    name = models.CharField(max_length=160)
    configuration = models.CharField(max_length=20, blank=True, default="")  # "7.2.4"
    tier = models.CharField(max_length=60, blank=True, default="")
    description = models.TextField(blank=True, default="")
    spec = models.JSONField(default=list, blank=True)  # [{"Label": ..., "Value": ...}]
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class PackageItem(models.Model):
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="package_items")
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class PaymentTerm(models.Model):
    term_name = models.CharField(max_length=160)  # "Advance against booking / design initiation"
    term_value = models.IntegerField(default=0)  # percentage
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.term_name
