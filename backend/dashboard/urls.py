from django.urls import path

from . import views

urlpatterns = [
    path("sales/modelwise-quotation-count", views.modelwise_quotation_count),
    path("sales/overview", views.sales_overview),
]
