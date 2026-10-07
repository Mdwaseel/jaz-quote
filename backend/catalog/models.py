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
    """A priced version of a configuration (e.g. "CinePrime 7.1.2 · Wharfedale Diamond")
    that fills the BOQ. Everything stays editable on the quotation."""
    name = models.CharField(max_length=160)
    configuration = models.CharField(max_length=20, blank=True, default="")  # "7.1.2"
    tier = models.CharField(max_length=60, blank=True, default="")  # series: CinePrime / CineLuxe / CineRoyale
    description = models.TextField(blank=True, default="")
    spec = models.JSONField(default=list, blank=True)  # legacy, no longer used
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
    # This version's own unit price for the product (ex-GST); None = the product's list price.
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    @property
    def unit_price(self):
        return self.price if self.price is not None else self.product.price


def package_prices(package_id):
    """{product id: unit price} for a version's items that carry their own package price."""
    if not package_id:
        return {}
    return dict(PackageItem.objects.filter(package_id=package_id, price__isnull=False).values_list("product_id", "price"))


class PaymentTerm(models.Model):
    term_name = models.CharField(max_length=160)  # "Advance against booking / design initiation"
    term_value = models.IntegerField(default=0)  # percentage
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.term_name
