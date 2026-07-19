"""Contact / entity-resolution endpoints.

Split out of `views.py` to keep that module focused on parcel/owner data
and to give the contact-data feature a clear home for new additions.

The endpoints here read from the canonical_entities / entity_contacts /
entity_parcel_mappings schema defined in `sql/create_contact_tables.sql`.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from django.db import ProgrammingError, connections
from django.http import JsonResponse
from django_ratelimit.decorators import ratelimit

from . import apiutil
from .apiutil import api, client_ip, get_validated_form_data
from .forms import EntityContactsForm, EntitySearchForm, NearbyPropertiesForm
from .views import (
    get_nearby_rows,
    is_missing_db_object_error,
    iso_or_none,
    rollback_wow_connection,
)


logger = logging.getLogger(__name__)


def group_nearby_owner_rows(rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        owner_key = row.get("owner_id") or row.get("owner_name") or row.get("pin")
        if owner_key not in grouped:
            grouped[owner_key] = {
                "owner_key": owner_key,
                "owner_id": row.get("owner_id"),
                "owner_name": row.get("owner_name"),
                "mailing_address": row.get("mailing_address"),
                "mailing_city": row.get("mailing_city"),
                "mailing_state": row.get("mailing_state"),
                "mailing_zip": row.get("mailing_zip"),
                "parcel_count": 0,
                "nearest_distance_m": row.get("distance_m"),
                "same_owner": bool(row.get("same_owner")),
                "parcels": [],
                "contacts": [],
            }

        group = grouped[owner_key]
        group["parcel_count"] += 1
        group["parcels"].append({
            "pin": row.get("pin"),
            "address": row.get("address"),
            "distance_m": row.get("distance_m"),
        })
        if group["nearest_distance_m"] is None or (
            row.get("distance_m") is not None and row.get("distance_m") < group["nearest_distance_m"]
        ):
            group["nearest_distance_m"] = row.get("distance_m")
        group["same_owner"] = group["same_owner"] or bool(row.get("same_owner"))

        seen = {(item["type"], item["value"], item["source"]) for item in group["contacts"]}
        for contact in row.get("contacts", []):
            dedupe_key = (contact["type"], contact["value"], contact["source"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            group["contacts"].append(contact)

    return sorted(
        grouped.values(),
        key=lambda row: (
            not row["same_owner"],
            row["nearest_distance_m"] if row["nearest_distance_m"] is not None else 10**9,
            -(row["parcel_count"] or 0),
        ),
    )


@api
@ratelimit(key=client_ip, rate="60/m", block=True)
def entity_search(request):
    """Search for entities by name with fuzzy matching."""
    args = get_validated_form_data(EntitySearchForm, request.GET)
    query = args["q"]
    entity_type = args.get("entity_type") or "all"
    limit = args.get("limit") or 20

    try:
        with connections["wow"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('canonical_entities')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})

            params: list[Any] = [query, query]
            type_filter = ""
            if entity_type != "all":
                type_filter = "AND entity_type = %s"
                params.append(entity_type)
            params.append(limit)

            # `type_filter` is a literal SQL fragment chosen from a closed set
            # above; user input only flows in via parameterized placeholders.
            cursor.execute(
                f"""
                SELECT
                    id,
                    entity_type,
                    canonical_name,
                    similarity(normalize_name(canonical_name), normalize_name(%s)) AS match_score,
                    parcel_count
                FROM canonical_entities
                WHERE normalize_name(canonical_name) %% normalize_name(%s)
                {type_filter}
                ORDER BY match_score DESC, parcel_count DESC
                LIMIT %s
                """,
                params,
            )

            results = [
                {
                    "entity_id": row[0],
                    "entity_type": row[1],
                    "name": row[2],
                    "match_score": round(float(row[3]), 3) if row[3] else 0,
                    "parcel_count": row[4] or 0,
                }
                for row in cursor.fetchall()
            ]

            return JsonResponse({"result": results, "query": query})
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Entity search skipped because contact tables are missing.")
        return JsonResponse({"result": [], "note": "Contact tables not yet created"})


@api
@ratelimit(key=client_ip, rate="60/m", block=True)
def entity_contacts(request):
    """Get contact information for a specific entity."""
    args = get_validated_form_data(EntityContactsForm, request.GET)
    entity_id = args["entity_id"]
    min_confidence = args.get("min_confidence") or 70

    try:
        with connections["wow"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('entity_contacts')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})

            cursor.execute(
                """
                SELECT id, entity_type, canonical_name, parcel_count
                FROM canonical_entities
                WHERE id = %s
                """,
                [entity_id],
            )
            entity_row = cursor.fetchone()

            if not entity_row:
                return JsonResponse({"error": "Entity not found"}, status=404)

            cursor.execute(
                """
                SELECT
                    contact_type,
                    contact_value,
                    confidence_score,
                    source_system,
                    is_primary,
                    is_verified,
                    first_seen_at,
                    last_seen_at
                FROM entity_contacts
                WHERE entity_id = %s AND confidence_score >= %s
                ORDER BY
                    CASE contact_type
                        WHEN 'phone' THEN 1
                        WHEN 'email' THEN 2
                        WHEN 'mailing_address' THEN 3
                        ELSE 4
                    END,
                    confidence_score DESC,
                    is_primary DESC
                """,
                [entity_id, min_confidence],
            )

            contacts = [
                {
                    "type": row[0],
                    "value": row[1],
                    "confidence": row[2],
                    "source": row[3],
                    "is_primary": row[4],
                    "is_verified": row[5],
                    "first_seen": iso_or_none(row[6]),
                    "last_seen": iso_or_none(row[7]),
                }
                for row in cursor.fetchall()
            ]

            return JsonResponse({
                "entity": {
                    "id": entity_row[0],
                    "type": entity_row[1],
                    "name": entity_row[2],
                    "parcel_count": entity_row[3] or 0,
                },
                "contacts": contacts,
                "min_confidence": min_confidence,
            })
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Entity contacts skipped because contact tables are missing.")
        return JsonResponse({"result": [], "note": "Contact tables not yet created"})


@api
@ratelimit(key=client_ip, rate="30/m", block=True)
def parcel_entities(request):
    """Get entities and their contacts associated with a parcel PIN."""
    args = get_validated_form_data(NearbyPropertiesForm, request.GET)
    pin = args["pin"]

    try:
        with connections["wow"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('entity_parcel_mappings')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})

            cursor.execute(
                """
                SELECT
                    ce.id,
                    ce.entity_type,
                    ce.canonical_name,
                    epm.mapping_confidence,
                    epm.owner_name_at_time
                FROM entity_parcel_mappings epm
                JOIN canonical_entities ce ON ce.id = epm.entity_id
                WHERE epm.pin = %s
                ORDER BY epm.mapping_confidence DESC
                """,
                [pin],
            )
            entity_rows = cursor.fetchall()
            entity_ids = [row[0] for row in entity_rows]

            contacts_by_entity: Dict[int, list[Dict[str, Any]]] = {}
            if entity_ids:
                cursor.execute(
                    """
                    SELECT
                        entity_id,
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        is_verified
                    FROM entity_contacts
                    WHERE entity_id = ANY(%s)
                      AND is_primary = TRUE
                      AND confidence_score >= 70
                    ORDER BY entity_id, contact_type, confidence_score DESC
                    """,
                    [entity_ids],
                )
                for entity_id, contact_type, contact_value, confidence, source, is_verified in cursor.fetchall():
                    contacts_by_entity.setdefault(entity_id, []).append({
                        "type": contact_type,
                        "value": contact_value,
                        "confidence": confidence,
                        "source": source,
                        "is_verified": is_verified,
                    })

            entities = [
                {
                    "entity_id": row[0],
                    "entity_type": row[1],
                    "name": row[2],
                    "mapping_confidence": row[3],
                    "owner_name_at_time": row[4],
                    "contacts": contacts_by_entity.get(row[0], []),
                }
                for row in entity_rows
            ]

        nearby_rows = get_nearby_rows(pin, args["radius_m"], args["limit"])
        nearby_owners = group_nearby_owner_rows(nearby_rows)

        return JsonResponse({
            "pin": pin,
            "entities": entities,
            "nearby": {
                "radius_m": args["radius_m"],
                "owners": nearby_owners,
                "parcels": nearby_rows,
            },
        })
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Parcel entities skipped because contact tables are missing.")
        return JsonResponse({"result": [], "note": "Contact tables not yet created"})


@api
@ratelimit(key=client_ip, rate="30/m", block=True)
def admin_contact_coverage(request):
    """Admin endpoint to view contact data coverage statistics."""
    apiutil.authorize_for_admin(request)

    try:
        with connections["wow"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('canonical_entities')")
            if not cursor.fetchone()[0]:
                return JsonResponse({
                    "status": "not_initialized",
                    "message": "Contact tables have not been created yet.",
                })

            cursor.execute("SELECT * FROM get_contact_coverage_stats()")
            stats_row = cursor.fetchone()

            stats = {
                "entity_count": stats_row[0] or 0,
                "entities_with_phone": stats_row[1] or 0,
                "entities_with_email": stats_row[2] or 0,
                "entities_with_address": stats_row[3] or 0,
                "avg_confidence": round(float(stats_row[4]), 2) if stats_row[4] else 0,
                "high_confidence_entities": stats_row[5] or 0,
            }

            cursor.execute(
                """
                SELECT
                    source_system,
                    COUNT(DISTINCT entity_id) AS entity_count,
                    COUNT(*) AS contact_count,
                    AVG(confidence_score)::numeric(5,2) AS avg_confidence
                FROM entity_contacts
                GROUP BY source_system
                ORDER BY entity_count DESC
                """
            )
            sources = [
                {
                    "source": row[0],
                    "entity_count": row[1],
                    "contact_count": row[2],
                    "avg_confidence": float(row[3]) if row[3] else 0,
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT
                    action,
                    COUNT(*) AS count,
                    MAX(performed_at) AS last_at
                FROM contact_audit_log
                WHERE performed_at > NOW() - INTERVAL '7 days'
                GROUP BY action
                ORDER BY count DESC
                """
            )
            recent_activity = [
                {
                    "action": row[0],
                    "count": row[1],
                    "last_at": iso_or_none(row[2]),
                }
                for row in cursor.fetchall()
            ]

            return JsonResponse({
                "generated_at": datetime.now(tz=timezone.utc).isoformat(),
                "coverage": stats,
                "sources": sources,
                "recent_activity": recent_activity,
            })
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Contact coverage stats skipped because contact tables are missing.")
        return JsonResponse({
            "status": "not_initialized",
            "message": "Contact tables have not been created yet.",
        })
