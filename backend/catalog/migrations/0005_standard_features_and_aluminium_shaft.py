"""Historical (BRIO lift catalog): tagged standard features per lift version.

The JAZ Home Theatres catalog replaced the lift catalog (see 0006), so this data step
is a no-op — on a fresh database it never had lift models to tag anyway."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("catalog", "0004_spare_default_on_spare_standard_on")]
    operations = [migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop)]
