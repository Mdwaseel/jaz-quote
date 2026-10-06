"""Quotations already marked "Confirmed" are deals that were done."""
from django.db import migrations
from django.db.models import F


def forwards(apps, schema_editor):
    Quotation = apps.get_model("quotes", "Quotation")
    Quotation.objects.filter(status="Confirmed", deal_status="OPEN").update(
        deal_status="WON", deal_closed_at=F("updated_at"))


class Migration(migrations.Migration):
    dependencies = [("quotes", "0004_quotation_deal_closed_at_quotation_deal_closed_by_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
