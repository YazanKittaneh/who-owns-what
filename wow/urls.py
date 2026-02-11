from django.urls import path

from . import views

app_name = "wow"

urlpatterns = [
    path("address/search", views.address_search, name="address_search"),
    path("address", views.address_query, name="address_query"),
    path("address/aggregate", views.address_aggregate, name="address_aggregate"),
    path("address/buildinginfo", views.address_buildinginfo, name="address_buildinginfo"),
    path("address/export", views.address_export, name="address_export"),
]
