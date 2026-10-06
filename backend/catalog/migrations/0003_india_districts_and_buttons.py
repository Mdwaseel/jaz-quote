"""Load every Indian state / UT with its districts, and fix the button (LOP) options.

- Locations: 36 states/UTs, 780 districts from catalog/data/india_districts.json.
  The old sample "cities" that are not districts (e.g. Secunderabad) are removed;
  quotations store the city name as text, so existing quotes are unaffected.
- Buttons: exactly "Push Button LOP" and "Touch LOP", available on every lift model.
"""
from django.db import migrations

BUTTONS = ["Push Button LOP", "Touch LOP"]


def forwards(apps, schema_editor):
    from catalog import geo_data

    geo_data.sync(apps.get_model("catalog", "Country"), apps.get_model("catalog", "State"),
                  apps.get_model("catalog", "City"), prune=True)

    SpareType = apps.get_model("catalog", "SpareType")
    Spare = apps.get_model("catalog", "Spare")
    lop, _ = SpareType.objects.get_or_create(type="LOP")
    for name in BUTTONS:
        spare, _ = Spare.objects.get_or_create(spare_type=lop, name=name)
        spare.versions.clear()  # no version scoping = offered for all lift models
    Spare.objects.filter(spare_type=lop).exclude(name__in=BUTTONS).delete()


class Migration(migrations.Migration):
    dependencies = [("catalog", "0002_feature_versions_shaft_applicable_models_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
