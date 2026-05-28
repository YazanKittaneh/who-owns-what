from django.urls import path

from . import views, views_entity

app_name = "wow"

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("admin/data-coverage", views.admin_data_coverage, name="admin_data_coverage"),
    path(
        "admin/contact-coverage",
        views_entity.admin_contact_coverage,
        name="admin_contact_coverage",
    ),
    path("address/search", views.address_search, name="address_search"),
    path("address", views.address_query, name="address_query"),
    path(
        "address/overview-map", views.address_overview_map, name="address_overview_map"
    ),
    path("address/nearby", views.address_nearby, name="address_nearby"),
    path("owner/current", views.owner_current, name="owner_current"),
    path(
        "owner/search-by-area", views.owner_search_by_area, name="owner_search_by_area"
    ),
    path("business-linkage", views.business_linkage, name="business_linkage"),
    path("address/aggregate", views.address_aggregate, name="address_aggregate"),
    path(
        "address/buildinginfo", views.address_buildinginfo, name="address_buildinginfo"
    ),
    path(
        "address/indicatorhistory",
        views.address_indicatorhistory,
        name="address_indicatorhistory",
    ),
    path("address/export", views.address_export, name="address_export"),
    path("propstream/upload", views.propstream_upload, name="propstream_upload"),
    # Contact data endpoints (defined in views_entity.py).
    path("entity/search", views_entity.entity_search, name="entity_search"),
    path("entity/contacts", views_entity.entity_contacts, name="entity_contacts"),
    path("parcel/entities", views_entity.parcel_entities, name="parcel_entities"),
]
