from django.urls import path

from . import views

urlpatterns = [
    path("admin-api/catalog/list", views.catalog_list),
    path("admin-api/catalog/update", views.catalog_update),
    path("admin-api/catalog/create", views.catalog_create),
    path("admin-api/catalog/delete", views.catalog_delete),
    path("admin-api/catalog/refs", views.catalog_refs),
    path("admin-api/company", views.company),
    path("admin-api/company/update", views.company_update),
    path("admin-api/stats", views.stats),
    path("admin-api/quotations", views.quotations),
    path("admin-api/quotations/status", views.quotation_status),
    path("admin-api/users", views.users),
    path("admin-api/users/toggle", views.toggle_user),
    path("admin-api/users/create", views.create_user),
    path("admin-api/users/refs", views.user_refs),
    path("admin-api/users/update", views.update_user),
    path("admin-api/org/tree", views.org_tree),
    path("admin-api/audit", views.audit_log),
]
