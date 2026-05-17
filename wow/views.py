import csv
import io
import json
import logging
import re
import zipfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from xml.etree import ElementTree
from django.http import HttpResponse, JsonResponse
from django.db import ProgrammingError, connections
from django.views.decorators.csrf import csrf_exempt

from .dbutil import call_db_func, exec_db_query
from .datautil import float_or_none, int_or_none, str_or_none
from . import csvutil, apiutil
from .apiutil import api, get_validated_form_data
from .forms import (
    PinForm,
    PinListForm,
    AddressSearchForm,
    PinOrBblForm,
    MapViewportForm,
    NearbyPropertiesForm,
    CurrentOwnerForm,
    EntitySearchForm,
    OwnerSearchByAreaForm,
)


MY_DIR = Path(__file__).parent.resolve()
SQL_DIR = MY_DIR / "sql"

logger = logging.getLogger(__name__)

MISSING_DB_OBJECT_PG_CODES = {"42P01", "42883"}


def iso_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def clean_addr_dict(addr):
    return {
        **addr,
        "propstream_records": list(addr.get("propstream_records") or []),
        "units_res": int_or_none(addr.get("units_res")),
        "permits_total": int_or_none(addr.get("permits_total")),
        "violations_open": int_or_none(addr.get("violations_open")),
        "violations_total": int_or_none(addr.get("violations_total")),
        "requests_311_total": int_or_none(addr.get("requests_311_total")),
        "annual_tax_sale_count": int_or_none(addr.get("annual_tax_sale_count")),
        "scavenger_tax_sale_count": int_or_none(addr.get("scavenger_tax_sale_count")),
        "tax_sale_event_count": int_or_none(addr.get("tax_sale_event_count")),
        "latest_tax_sale_year": int_or_none(addr.get("latest_tax_sale_year")),
        "latest_tax_sale_buyer_name": str_or_none(addr.get("latest_tax_sale_buyer_name")),
        "total_tax_sale_amount_paid": float_or_none(addr.get("total_tax_sale_amount_paid")),
        "recorder_doc_count": int_or_none(addr.get("recorder_doc_count")),
        "mortgage_doc_count": int_or_none(addr.get("mortgage_doc_count")),
        "quitclaim_doc_count": int_or_none(addr.get("quitclaim_doc_count")),
        "foreclosure_doc_count": int_or_none(addr.get("foreclosure_doc_count")),
        "latest_recorder_doc_date": str_or_none(addr.get("latest_recorder_doc_date")),
        "latest_mortgage_date": str_or_none(addr.get("latest_mortgage_date")),
        "latest_mortgage_amount": float_or_none(addr.get("latest_mortgage_amount")),
        "latest_quitclaim_date": str_or_none(addr.get("latest_quitclaim_date")),
        "latest_quitclaim_amount": float_or_none(addr.get("latest_quitclaim_amount")),
    }


def ensure_propstream_table():
    with connections["wow"].cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS propstream_parcel_records (
                pin text PRIMARY KEY,
                records jsonb NOT NULL DEFAULT '[]'::jsonb,
                uploaded_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )


def normalize_propstream_pin(row: Dict[str, Any]) -> str:
    value = row.get("APN#") or row.get("APN") or row.get("pin") or row.get("PIN") or ""
    return re.sub(r"\D", "", str(value))


def parse_xlsx_rows(upload) -> list[Dict[str, Any]]:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    def cell_index(cell_ref: str) -> int:
        letters = re.match(r"[A-Z]+", cell_ref).group(0)
        index = 0
        for letter in letters:
            index = index * 26 + ord(letter) - 64
        return index - 1

    with zipfile.ZipFile(upload.file) as workbook:
        shared_strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
            for shared_item in root.findall("a:si", ns):
                shared_strings.append(
                    "".join(text_node.text or "" for text_node in shared_item.findall(".//a:t", ns))
                )

        sheet_root = ElementTree.fromstring(workbook.read("xl/worksheets/sheet1.xml"))

        def cell_value(cell) -> str:
            value = cell.find("a:v", ns)
            if value is None:
                inline_text = cell.find(".//a:t", ns)
                return inline_text.text if inline_text is not None else ""
            raw_value = value.text or ""
            if cell.attrib.get("t") == "s":
                return shared_strings[int(raw_value)]
            return raw_value

        parsed_rows = []
        for row in sheet_root.findall(".//a:sheetData/a:row", ns):
            values = []
            for cell in row.findall("a:c", ns):
                index = cell_index(cell.attrib["r"])
                while len(values) < index:
                    values.append("")
                values.append(cell_value(cell))
            parsed_rows.append(values)

    if not parsed_rows:
        return []

    headers = [str(header or "").strip() for header in parsed_rows[0]]
    return [
        {headers[index]: value for index, value in enumerate(row) if index < len(headers) and headers[index]}
        for row in parsed_rows[1:]
    ]


def parse_propstream_upload_rows(upload) -> list[Dict[str, Any]]:
    filename = (upload.name or "").lower()
    if filename.endswith(".xlsx"):
        return parse_xlsx_rows(upload)

    text_file = io.TextIOWrapper(upload.file, encoding="utf-8-sig", newline="")
    return list(csv.DictReader(text_file))


def clean_propstream_records(rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    if isinstance(rows, str):
        rows = json.loads(rows)
    return [{key: value for key, value in row.items() if value not in (None, "")} for row in rows]


def fetch_propstream_records_for_pins(pins: list[str]) -> Dict[str, list[Dict[str, Any]]]:
    pins = [pin for pin in pins if pin]
    if not pins:
        return {}

    try:
        with connections["wow"].cursor() as cursor:
            cursor.execute(
                "SELECT pin, records FROM propstream_parcel_records WHERE pin = ANY(%s)",
                [pins],
            )
            return {pin: clean_propstream_records(records or []) for pin, records in cursor.fetchall()}
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        return {}


def attach_propstream_records(rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    records_by_pin = fetch_propstream_records_for_pins([row.get("pin") for row in rows])
    return [{**row, "propstream_records": records_by_pin.get(row.get("pin"), [])} for row in rows]


def clean_map_addr_dict(addr):
    return {
        **addr,
        "lat": float_or_none(addr.get("lat")),
        "lng": float_or_none(addr.get("lng")),
    }


def clean_nearby_addr_dict(addr):
    return {
        **clean_map_addr_dict(addr),
        "distance_m": int_or_none(addr.get("distance_m")),
        "same_owner": bool(addr.get("same_owner")),
    }


def clean_owner_search_seed_dict(addr):
    return {
        **clean_map_addr_dict(addr),
        "land_class": str_or_none(addr.get("land_class")),
    }


def clean_owner_search_result_dict(row):
    cleaned_parcels = []
    for parcel in row.get("parcels") or []:
        cleaned_parcels.append(
            {
                **parcel,
                "lat": float_or_none(parcel.get("lat")),
                "lng": float_or_none(parcel.get("lng")),
                "distance_m": int_or_none(parcel.get("distance_m")),
                "same_owner": bool(parcel.get("same_owner")),
            }
        )

    cleaned_building_type_counts = []
    for building_type_count in row.get("building_type_counts") or []:
        cleaned_building_type_counts.append(
            {
                **building_type_count,
                "parcel_count": int_or_none(building_type_count.get("parcel_count")),
            }
        )

    return {
        **row,
        "parcel_count": int_or_none(row.get("parcel_count")),
        "nearest_distance_m": int_or_none(row.get("nearest_distance_m")),
        "same_owner": bool(row.get("same_owner")),
        "building_type_counts": cleaned_building_type_counts,
        "parcels": cleaned_parcels,
    }


def normalize_lookup_value(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", value.lower()).strip())


def build_contact_payload(
    contact_type: str,
    contact_value: str,
    confidence_score: int,
    source_system: str,
    is_verified: bool = False,
) -> Dict[str, Any]:
    return {
        "type": contact_type,
        "value": contact_value,
        "confidence": confidence_score,
        "source": source_system,
        "is_verified": is_verified,
    }


def enrich_nearby_rows_with_contacts(rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    if not rows:
        return rows

    owner_name_keys = sorted(
        {
            normalize_lookup_value(row.get("owner_name"))
            for row in rows
            if normalize_lookup_value(row.get("owner_name"))
        }
    )
    mailing_keys = sorted(
        {
            (row.get("mailing_address") or "").strip().lower()
            for row in rows
            if (row.get("mailing_address") or "").strip()
        }
    )

    contacts_by_owner: Dict[str, list[Dict[str, Any]]] = {}
    contacts_by_mailing: Dict[str, list[Dict[str, Any]]] = {}

    with connections["wow"].cursor() as cursor:
        if owner_name_keys:
            cursor.execute(
                """
                SELECT DISTINCT
                    ea.normalized_alias,
                    ec.contact_type,
                    ec.contact_value,
                    ec.confidence_score,
                    ec.source_system,
                    ec.is_verified
                FROM entity_aliases ea
                JOIN entity_contacts ec ON ec.entity_id = ea.entity_id
                WHERE ea.normalized_alias = ANY(%s)
                ORDER BY ea.normalized_alias, ec.confidence_score DESC, ec.contact_value ASC
                """,
                [owner_name_keys],
            )
            for normalized_alias, contact_type, contact_value, confidence_score, source_system, is_verified in cursor.fetchall():
                contacts_by_owner.setdefault(normalized_alias, []).append(
                    build_contact_payload(
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        bool(is_verified),
                    )
                )

        if mailing_keys:
            cursor.execute(
                """
                SELECT DISTINCT
                    normalized_value,
                    contact_type,
                    contact_value,
                    confidence_score,
                    source_system,
                    is_verified
                FROM entity_contacts
                WHERE normalized_value = ANY(%s)
                ORDER BY normalized_value, confidence_score DESC, contact_value ASC
                """,
                [mailing_keys],
            )
            for normalized_value, contact_type, contact_value, confidence_score, source_system, is_verified in cursor.fetchall():
                contacts_by_mailing.setdefault(normalized_value, []).append(
                    build_contact_payload(
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        bool(is_verified),
                    )
                )

    enriched_rows: list[Dict[str, Any]] = []
    for row in rows:
        mailing_value = [
            row.get("mailing_address"),
            row.get("mailing_city"),
            row.get("mailing_state"),
            row.get("mailing_zip"),
        ]
        formatted_mailing = ", ".join([part for part in mailing_value if part])
        row_contacts: list[Dict[str, Any]] = []
        seen = set()

        if formatted_mailing:
            payload = build_contact_payload(
                "mailing_address",
                formatted_mailing,
                80,
                "wow_parcels_owner_record",
                True,
            )
            row_contacts.append(payload)
            seen.add((payload["type"], payload["value"], payload["source"]))

        owner_key = normalize_lookup_value(row.get("owner_name"))
        mailing_key = (row.get("mailing_address") or "").strip().lower()
        for payload in contacts_by_owner.get(owner_key, []) + contacts_by_mailing.get(mailing_key, []):
            dedupe_key = (payload["type"], payload["value"], payload["source"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            row_contacts.append(payload)

        enriched_rows.append({**row, "contacts": row_contacts})

    return enriched_rows


def get_nearby_rows(pin: str, radius_m: int, limit: int) -> list[Dict[str, Any]]:
    rows = list(
        map(
            clean_nearby_addr_dict,
            list(exec_db_query(SQL_DIR / "address_nearby.sql", {"pin": pin, "radius_m": radius_m, "limit": limit})),
        )
    )
    return enrich_nearby_rows_with_contacts(rows)


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


def is_missing_db_object_error(error: Exception) -> bool:
    current: Optional[Exception] = error
    while current is not None:
        if getattr(current, "pgcode", None) in MISSING_DB_OBJECT_PG_CODES:
            return True
        cause = getattr(current, "__cause__", None)
        current = cause if isinstance(cause, Exception) else None
    return False


def rollback_wow_connection() -> None:
    try:
        connections["wow"].rollback()
    except Exception:
        logger.exception("Failed to rollback WOW DB connection after SQL error.")


def get_address_result_from_fallback(pin: str):
    return exec_db_query(SQL_DIR / "address_query_fallback.sql", {"pin": pin})


def get_pin_from_request(request) -> str:
    return get_validated_form_data(PinForm, request.GET)["pin"]


@api
def address_search(request):
    args = get_validated_form_data(AddressSearchForm, request.GET)
    try:
        result = exec_db_query(SQL_DIR / "address_search.sql", {"q": args["q"]})
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using fallback address search query because WOW tables are missing."
        )
        result = exec_db_query(SQL_DIR / "address_search_fallback.sql", {"q": args["q"]})
    return JsonResponse({"result": list(result)})


@api
def address_query(request):
    pin = get_pin_from_request(request)
    try:
        addrs = call_db_func("get_assoc_addrs_from_pin", [pin])
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using fallback address query because WOW DB functions are missing."
        )
        addrs = get_address_result_from_fallback(pin)
    cleaned_addrs = list(map(clean_addr_dict, attach_propstream_records(list(addrs))))
    return JsonResponse(
        {
            "geosearch": {"pin": pin},
            "addrs": cleaned_addrs,
        }
    )


@api
def address_overview_map(request):
    args = get_validated_form_data(MapViewportForm, request.GET)
    try:
        result = exec_db_query(SQL_DIR / "address_overview_map.sql", args)
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using empty overview map because WOW parcel tables are missing."
        )
        result = []

    rows = list(result)
    total_count = int_or_none(rows[0].get("total_count")) if rows else 0
    cleaned_rows = list(map(clean_map_addr_dict, rows))
    return JsonResponse(
        {
            "result": cleaned_rows,
            "total_count": total_count,
            "truncated": total_count > args["limit"],
        }
    )


@api
def address_nearby(request):
    args = get_validated_form_data(NearbyPropertiesForm, request.GET)
    try:
        rows = get_nearby_rows(args["pin"], args["radius_m"], args["limit"])
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using empty nearby properties list because WOW parcel tables are missing."
        )
        rows = []

    return JsonResponse(
        {
            "seed": {"pin": args["pin"], "radius_m": args["radius_m"]},
            "result": rows,
        }
    )


@api
def owner_current(request):
    args = get_validated_form_data(CurrentOwnerForm, request.GET)
    try:
        result = exec_db_query(SQL_DIR / "owner_current.sql", args)
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Using empty owner profile because WOW parcel tables are missing.")
        result = []

    addrs = list(map(clean_addr_dict, list(result)))
    owner_name = addrs[0].get("owner_name") if addrs else args.get("owner_name")
    owner_id = addrs[0].get("owner_id") if addrs else args.get("owner_id")
    mailing = None
    if addrs:
        first = addrs[0]
        mailing = {
            "mailing_address": first.get("mailing_address"),
            "mailing_city": first.get("mailing_city"),
            "mailing_state": first.get("mailing_state"),
            "mailing_zip": first.get("mailing_zip"),
        }

    return JsonResponse(
        {
            "owner": {
                "owner_id": owner_id,
                "owner_name": owner_name,
                "parcel_count": len(addrs),
                **(mailing or {}),
            },
            "result": addrs,
        }
    )


@api
def owner_search_by_area(request):
    args = get_validated_form_data(OwnerSearchByAreaForm, request.GET)
    query_args = {
        **args,
        "apply_building_type_filter": bool(args.get("building_types")),
    }

    try:
        seed_rows = list(exec_db_query(SQL_DIR / "owner_search_seed.sql", {"pin": args["pin"]}))
        if not seed_rows:
            return JsonResponse({"error": "No mapped parcel found for this PIN."}, status=404)

        result_rows = list(exec_db_query(SQL_DIR / "owner_search_by_area.sql", query_args))
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning("Using empty owner area search because WOW parcel tables are missing.")
        seed_rows = []
        result_rows = []

    seed = clean_owner_search_seed_dict(seed_rows[0]) if seed_rows else None
    cleaned_rows = list(map(clean_owner_search_result_dict, result_rows))
    return JsonResponse(
        {
            "seed": seed,
            "filters": {
                "pin": args["pin"],
                "radius_m": args["radius_m"],
                "building_types": args.get("building_types") or [],
                "min_parcels": args["min_parcels"],
                "max_parcels": args.get("max_parcels"),
                "limit": args["limit"],
            },
            "result": cleaned_rows,
        }
    )


@api
def address_aggregate(request):
    pin = get_pin_from_request(request)
    result = call_db_func("get_agg_info_from_pin", [pin])
    cleaned_result = list(result)
    return JsonResponse({"result": cleaned_result})


@api
def address_buildinginfo(request):
    pin = get_pin_from_request(request)
    try:
        result = exec_db_query(SQL_DIR / "address_buildinginfo.sql", {"pin": pin})
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using fallback building info query because WOW tables are missing."
        )
        result = get_address_result_from_fallback(pin)
    cleaned_result = list(map(clean_addr_dict, attach_propstream_records(list(result))))
    return JsonResponse({"result": cleaned_result})


@csrf_exempt
@api
def propstream_upload(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"error": "Upload a CSV or Excel file in the 'file' field."}, status=400)

    try:
        rows_by_pin: Dict[str, list[Dict[str, Any]]] = {}
        skipped_rows = 0
        for row in parse_propstream_upload_rows(upload):
            pin = normalize_propstream_pin(row)
            if not pin:
                skipped_rows += 1
                continue
            rows_by_pin.setdefault(pin, []).append(row)
    except (UnicodeDecodeError, zipfile.BadZipFile, ElementTree.ParseError):
        return JsonResponse({"error": "Upload a valid UTF-8 CSV or Excel .xlsx file."}, status=400)

    ensure_propstream_table()
    with connections["wow"].cursor() as cursor:
        for pin, rows in rows_by_pin.items():
            cursor.execute(
                """
                INSERT INTO propstream_parcel_records (pin, records, uploaded_at)
                VALUES (%s, %s::jsonb, now())
                ON CONFLICT (pin) DO UPDATE SET records = EXCLUDED.records, uploaded_at = now()
                """,
                [pin, json.dumps(clean_propstream_records(rows))],
            )

    return JsonResponse(
        {
            "imported_parcels": len(rows_by_pin),
            "imported_rows": sum(len(rows) for rows in rows_by_pin.values()),
            "skipped_rows": skipped_rows,
        }
    )


@api
def address_indicatorhistory(request):
    args = get_validated_form_data(PinOrBblForm, request.GET)
    try:
        if args.get("bbl"):
            result = exec_db_query(SQL_DIR / "address_indicatorhistory.sql", {"bbl": args["bbl"]})
            schema = "nyc"
        else:
            # Use IHS-enhanced query if IHS tables exist
            try:
                result = exec_db_query(SQL_DIR / "address_indicatorhistory_chi_with_ihs.sql", {"pin": args["pin"]})
                schema = "standard"
            except ProgrammingError as ihs_error:
                if not is_missing_db_object_error(ihs_error):
                    raise
                # Fall back to original query if IHS tables are missing
                rollback_wow_connection()
                logger.warning("IHS tables not found, using standard indicator history query.")
                result = exec_db_query(SQL_DIR / "address_indicatorhistory_chi.sql", {"pin": args["pin"]})
                schema = "standard"
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using empty indicator history because timeline source tables are missing."
        )
        result = []
        schema = "standard"
    return JsonResponse({"schema": schema, "result": list(result)})


def _fixup_addr_for_csv(addr: Dict[str, Any]):
    csvutil.stringify_lists(addr)
    for key, value in addr.items():
        if value is None:
            addr[key] = ""


@api
def address_export(request):
    pin = get_pin_from_request(request)
    addrs = call_db_func("get_assoc_addrs_from_pin", [pin])

    if not addrs:
        return HttpResponse(status=404)

    first_row = addrs[0]

    for addr in addrs:
        _fixup_addr_for_csv(addr)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="wow-addresses-{pin}.csv"'

    writer = csv.DictWriter(response, list(first_row.keys()))
    writer.writeheader()
    writer.writerows(addrs)

    return response


def server_error(request):
    if apiutil.is_api_request(request):
        return apiutil.apply_cors_policy(
            request,
            JsonResponse(
                {"error": "An internal server error occurred."},
                status=500,
            ),
        )

    from django.views import defaults

    return defaults.server_error(request)


def health_check(request):
    """Health check endpoint for container orchestration."""
    try:
        # Check database connectivity
        with connections["wow"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return JsonResponse(
            {"status": "healthy", "database": "connected"},
            status=200
        )
    except Exception as e:
        logger.exception("Health check failed")
        return JsonResponse(
            {"status": "unhealthy", "error": str(e)},
            status=503
        )


@api
def admin_data_coverage(request):
    apiutil.authorize_for_admin(request)

    datasets = [
        {
            "name": "chi_owners",
            "table": "chi_owners",
            "missing_reason": None,
            "partial_reason": None,
        },
        {
            "name": "woodstock_mortgage_metadata",
            "table": "woodstock_mortgage_metadata",
            "missing_reason": None,
            "partial_reason": None,
        },
        {
            "name": "bor_search_results",
            "table": "bor_search_results",
            "missing_reason": None,
            "partial_reason": None,
        },
        {
            "name": "ihs_indicators",
            "table": "ihs_indicators",
            "missing_reason": None,
            "partial_reason": None,
        },
        {
            "name": "chi_foreclosed_rental_properties",
            "table": "chi_foreclosed_rental_properties",
            "missing_reason": None,
            "partial_reason": None,
        },
        {
            "name": "registered_chicago_taxpayer",
            "table": None,
            "missing_reason": "source_retired_no_bulk_endpoint",
            "partial_reason": None,
        },
        {
            "name": "bor_detail",
            "table": None,
            "missing_reason": None,
            "partial_reason": "captcha_limited_detail_flow",
        },
    ]

    def table_exists(cursor, table_name: str) -> bool:
        cursor.execute("SELECT to_regclass(%s)", [table_name])
        row = cursor.fetchone()
        return bool(row and row[0])

    def latest_load_audit(cursor, dataset_name: str) -> Optional[Dict[str, Any]]:
        if not table_exists(cursor, "data_load_audit"):
            return None
        cursor.execute(
            """
            SELECT loaded_at, row_count, source_ref, run_id, status
            FROM data_load_audit
            WHERE dataset_name = %s
            ORDER BY loaded_at DESC
            LIMIT 1
            """,
            [dataset_name],
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "loaded_at": row[0],
            "row_count": int(row[1]) if row[1] is not None else None,
            "source_ref": row[2],
            "run_id": row[3],
            "status": row[4],
        }

    coverage: list[Dict[str, Any]] = []

    with connections["wow"].cursor() as cursor:
        audit_table_available = table_exists(cursor, "data_load_audit")

        for dataset in datasets:
            name = dataset["name"]
            table = dataset["table"]
            row_count = 0
            min_year = None
            max_year = None
            last_loaded_at = None
            status = "ok"
            reason = None
            details: Dict[str, Any] = {}

            if table is None:
                if dataset["missing_reason"]:
                    status = "missing"
                    reason = dataset["missing_reason"]
                else:
                    status = "partial"
                    reason = dataset["partial_reason"]
                coverage.append(
                    {
                        "dataset": name,
                        "present": False,
                        "row_count": row_count,
                        "min_year": min_year,
                        "max_year": max_year,
                        "last_loaded_at": last_loaded_at,
                        "status": status,
                        "reason": reason,
                    }
                )
                continue

            present = table_exists(cursor, table)
            if not present:
                status = "missing"
                reason = dataset["missing_reason"] or "table_missing"
                coverage.append(
                    {
                        "dataset": name,
                        "present": False,
                        "row_count": row_count,
                        "min_year": min_year,
                        "max_year": max_year,
                        "last_loaded_at": last_loaded_at,
                        "status": status,
                        "reason": reason,
                    }
                )
                continue

            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count_row = cursor.fetchone()
            row_count = int(count_row[0]) if count_row and count_row[0] is not None else 0

            if table in {"chi_owners", "woodstock_mortgage_metadata", "bor_search_results", "ihs_indicators"}:
                cursor.execute(
                    f"""
                    SELECT MIN((year)::int), MAX((year)::int)
                    FROM {table}
                    WHERE year ~ '^[0-9]{{4}}$'
                    """
                )
                year_row = cursor.fetchone()
                if year_row:
                    min_year = int(year_row[0]) if year_row[0] is not None else None
                    max_year = int(year_row[1]) if year_row[1] is not None else None

            if name == "chi_owners":
                cursor.execute(
                    """
                    SELECT COUNT(*), COUNT(*) FILTER (WHERE years_seen >= 2)
                    FROM (
                        SELECT pin, COUNT(DISTINCT year) AS years_seen
                        FROM chi_owners
                        WHERE year ~ '^[0-9]{4}$'
                        GROUP BY pin
                    ) owner_history
                    """
                )
                depth_row = cursor.fetchone()
                total_pins = int(depth_row[0]) if depth_row and depth_row[0] is not None else 0
                pins_with_multi_year = int(depth_row[1]) if depth_row and depth_row[1] is not None else 0
                multi_year_pct = None
                if total_pins > 0:
                    multi_year_pct = round((pins_with_multi_year / total_pins) * 100, 2)
                details.update(
                    {
                        "total_pins": total_pins,
                        "pins_with_multi_year": pins_with_multi_year,
                        "pins_with_multi_year_pct": multi_year_pct,
                    }
                )
                if min_year is not None and max_year is not None and min_year == max_year:
                    status = "partial"
                    reason = "single_year_history_only"

            if audit_table_available:
                audit = latest_load_audit(cursor, name)
                if audit:
                    last_loaded_at = iso_or_none(audit["loaded_at"])
                    details.update(
                        {
                            "last_load_row_count": audit["row_count"],
                            "last_load_source_ref": audit["source_ref"],
                            "last_load_run_id": audit["run_id"],
                            "last_load_status": audit["status"],
                        }
                    )

            coverage.append(
                {
                    "dataset": name,
                    "present": True,
                    "row_count": row_count,
                    "min_year": min_year,
                    "max_year": max_year,
                    "last_loaded_at": last_loaded_at,
                    "status": status,
                    "reason": reason,
                    **details,
                }
            )

    return JsonResponse(
        {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "datasets": coverage,
        }
    )


# ============================================================================
# CONTACT DATA API ENDPOINTS
# ============================================================================

@api
def entity_search(request):
    """Search for entities by name with fuzzy matching."""
    args = get_validated_form_data(EntitySearchForm, request.GET)
    query = args["q"]
    entity_type = args.get("entity_type", "all")
    limit = args.get("limit", 20)
    
    try:
        with connections["wow"].cursor() as cursor:
            # Check if contact tables exist
            cursor.execute("SELECT to_regclass('canonical_entities')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})
            
            # Build query based on entity type filter
            type_filter = ""
            params = [query, query]
            if entity_type != "all":
                type_filter = "AND entity_type = %s"
                params = [query, query, entity_type]
            params.append(limit)
            
            cursor.execute(
                f"""
                SELECT 
                    id,
                    entity_type,
                    canonical_name,
                    similarity(normalize_name(canonical_name), normalize_name(%s)) as match_score,
                    parcel_count
                FROM canonical_entities
                WHERE normalize_name(canonical_name) %% normalize_name(%s)
                {type_filter}
                ORDER BY match_score DESC, parcel_count DESC
                LIMIT %s
                """,
                params
            )
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    "entity_id": row[0],
                    "entity_type": row[1],
                    "name": row[2],
                    "match_score": round(float(row[3]), 3) if row[3] else 0,
                    "parcel_count": row[4] or 0,
                })
            
            return JsonResponse({"result": results, "query": query})
    
    except Exception as e:
        logger.exception("Entity search failed")
        return JsonResponse({"error": str(e)}, status=500)


@api
def entity_contacts(request):
    """Get contact information for a specific entity."""
    entity_id = request.GET.get("entity_id")
    if not entity_id:
        return JsonResponse({"error": "entity_id is required"}, status=400)
    
    try:
        entity_id = int(entity_id)
    except ValueError:
        return JsonResponse({"error": "entity_id must be an integer"}, status=400)
    
    min_confidence = int(request.GET.get("min_confidence", 70))
    
    try:
        with connections["wow"].cursor() as cursor:
            # Check if contact tables exist
            cursor.execute("SELECT to_regclass('entity_contacts')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})
            
            # Get entity info
            cursor.execute(
                """
                SELECT id, entity_type, canonical_name, parcel_count
                FROM canonical_entities
                WHERE id = %s
                """,
                [entity_id]
            )
            entity_row = cursor.fetchone()
            
            if not entity_row:
                return JsonResponse({"error": "Entity not found"}, status=404)
            
            # Get contacts
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
                [entity_id, min_confidence]
            )
            
            contacts = []
            for row in cursor.fetchall():
                contacts.append({
                    "type": row[0],
                    "value": row[1],
                    "confidence": row[2],
                    "source": row[3],
                    "is_primary": row[4],
                    "is_verified": row[5],
                    "first_seen": iso_or_none(row[6]),
                    "last_seen": iso_or_none(row[7]),
                })
            
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
    
    except Exception as e:
        logger.exception("Entity contacts lookup failed")
        return JsonResponse({"error": str(e)}, status=500)


@api
def parcel_entities(request):
    """Get entities and their contacts associated with a parcel PIN."""
    try:
        args = get_validated_form_data(NearbyPropertiesForm, request.GET)
        pin = args["pin"]
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
    
    try:
        with connections["wow"].cursor() as cursor:
            # Check if contact tables exist
            cursor.execute("SELECT to_regclass('entity_parcel_mappings')")
            if not cursor.fetchone()[0]:
                return JsonResponse({"result": [], "note": "Contact tables not yet created"})
            
            # Get entities for this parcel
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
                [pin]
            )
            
            entities = []
            for row in cursor.fetchall():
                entity_id = row[0]
                
                # Get primary contacts for this entity
                cursor.execute(
                    """
                    SELECT 
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        is_verified
                    FROM entity_contacts
                    WHERE entity_id = %s AND is_primary = TRUE AND confidence_score >= 70
                    ORDER BY contact_type, confidence_score DESC
                    """,
                    [entity_id]
                )
                
                contacts = []
                for contact_row in cursor.fetchall():
                    contacts.append({
                        "type": contact_row[0],
                        "value": contact_row[1],
                        "confidence": contact_row[2],
                        "source": contact_row[3],
                        "is_verified": contact_row[4],
                    })
                
                entities.append({
                    "entity_id": entity_id,
                    "entity_type": row[1],
                    "name": row[2],
                    "mapping_confidence": row[3],
                    "owner_name_at_time": row[4],
                    "contacts": contacts,
                })

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
    
    except Exception as e:
        logger.exception("Parcel entities lookup failed")
        return JsonResponse({"error": str(e)}, status=500)


@api
def admin_contact_coverage(request):
    """Admin endpoint to view contact data coverage statistics."""
    apiutil.authorize_for_admin(request)
    
    try:
        with connections["wow"].cursor() as cursor:
            # Check if contact tables exist
            cursor.execute("SELECT to_regclass('canonical_entities')")
            if not cursor.fetchone()[0]:
                return JsonResponse({
                    "status": "not_initialized",
                    "message": "Contact tables have not been created yet."
                })
            
            # Get overall coverage stats
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
            
            # Get source breakdown
            cursor.execute(
                """
                SELECT 
                    source_system,
                    COUNT(DISTINCT entity_id) as entity_count,
                    COUNT(*) as contact_count,
                    AVG(confidence_score)::numeric(5,2) as avg_confidence
                FROM entity_contacts
                GROUP BY source_system
                ORDER BY entity_count DESC
                """
            )
            
            sources = []
            for row in cursor.fetchall():
                sources.append({
                    "source": row[0],
                    "entity_count": row[1],
                    "contact_count": row[2],
                    "avg_confidence": float(row[3]) if row[3] else 0,
                })
            
            # Get recent audit activity
            cursor.execute(
                """
                SELECT 
                    action,
                    COUNT(*) as count,
                    MAX(performed_at) as last_at
                FROM contact_audit_log
                WHERE performed_at > NOW() - INTERVAL '7 days'
                GROUP BY action
                ORDER BY count DESC
                """
            )
            
            recent_activity = []
            for row in cursor.fetchall():
                recent_activity.append({
                    "action": row[0],
                    "count": row[1],
                    "last_at": iso_or_none(row[2]),
                })
            
            return JsonResponse({
                "generated_at": datetime.now(tz=timezone.utc).isoformat(),
                "coverage": stats,
                "sources": sources,
                "recent_activity": recent_activity,
            })
    
    except Exception as e:
        logger.exception("Contact coverage stats failed")
        return JsonResponse({"error": str(e)}, status=500)
