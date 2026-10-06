from django.urls import path

from . import views

urlpatterns = [
    path("quote/createquote", views.create_quote),
    path("quote/update", views.update_quote),
    path("quote/rules", views.my_rules),
    path("quote/evaluate", views.evaluate_quote),
    path("quote/history", views.quote_history),
    path("quote/request-edit", views.request_edit),
    path("quote/signature", views.set_signature),
    path("quote/getListofQuotation", views.get_quote_list),
    path("quote/getquote", views.get_quote),
    path("quote/getconfirmquote", views.confirm_quote),
    path("quote/deletequote", views.delete_quote),
    path("quote/editquote", views.edit_quote),
    path("quote/converthtmltopdfanduploadasync", views.download_quote),
    path("quote/preview", views.preview_quote),
    path("quote/esign/send", views.esign_send),
    path("quote/esign/onsite", views.esign_onsite),
    path("quote/deal", views.deal_outcome),
    path("deals/analysis", views.deal_analysis),
    # public (no login) — customer e-signature via emailed link
    path("public/esign/<str:token>", views.esign_public),
    path("public/esign/<str:token>/pdf", views.esign_public_pdf),
    path("public/esign/<str:token>/sign", views.esign_public_sign),
    # approvals
    path("approvals/list", views.approvals_list),
    path("approvals/counts", views.approvals_counts),
    path("approvals/act", views.approvals_act),
    path("approvals/reassign", views.approvals_reassign),
    # notifications / team
    path("notifications/list", views.notifications_list),
    path("notifications/read", views.notifications_read),
    path("team/tree", views.my_team),
]
