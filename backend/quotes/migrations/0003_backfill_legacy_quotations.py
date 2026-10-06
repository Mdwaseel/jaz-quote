"""Quotations created before the approval engine existed are treated as
approved version 1 so they keep working (download, confirm) unchanged."""
from decimal import Decimal

from django.db import migrations


def forwards(apps, schema_editor):
    Quotation = apps.get_model("quotes", "Quotation")
    QuotationVersion = apps.get_model("quotes", "QuotationVersion")
    QuotationEvent = apps.get_model("quotes", "QuotationEvent")
    for q in Quotation.objects.filter(current_version=0).select_related("customer"):
        base = (q.exclude_tax or Decimal(0)) + (q.special_cost or Decimal(0))
        q.base_amount = base
        q.discount_percent = (q.special_cost / base * 100).quantize(Decimal("0.01")) if base else Decimal(0)
        q.current_version = 1
        q.approved_version = 1
        q.workflow_status = "CANCELLED" if q.status == "Inactive" else "APPROVED"
        q.save()
        QuotationVersion.objects.create(
            quotation=q, number=1, created_by=q.created_by, note="Legacy quotation (pre-approval engine)",
            snapshot={"product_info": q.product_info, "payment_terms": q.payment_terms,
                      "warranty_details": q.warranty_details, "amc_details": q.amc_details,
                      "financials": {"BaseAmount": float(base), "DiscountAmount": float(q.special_cost),
                                     "NetAmount": float(q.exclude_tax), "Tax": float(q.tax),
                                     "FinalAmount": float(q.include_tax)}},
        )
        QuotationEvent.objects.create(
            quotation=q, version_number=1, actor=q.created_by, action="Legacy Quotation Imported",
            note="Created before the approval workflow; treated as approved v1.", status=q.workflow_status,
        )


class Migration(migrations.Migration):
    dependencies = [("quotes", "0002_quotation_approved_version_quotation_base_amount_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
