from django.urls import path

from . import views

urlpatterns = [
    path("quote/getCountries", views.get_countries),
    path("quote/getStates", views.get_states),
    path("quote/getCities", views.get_cities),
    path("quote/catalog", views.builder_catalog),
    path("quote/getPaymentTerms", views.get_payment_terms),
]
