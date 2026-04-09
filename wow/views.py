import csv
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from django.http import HttpResponse, JsonResponse
from django.db import ProgrammingError, connections

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
    cleaned_addrs = list(map(clean_addr_dict, addrs))
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
        result = exec_db_query(SQL_DIR / "address_nearby.sql", args)
    except ProgrammingError as error:
        if not is_missing_db_object_error(error):
            raise
        rollback_wow_connection()
        logger.warning(
            "Using empty nearby properties list because WOW parcel tables are missing."
        )
        result = []

    rows = list(map(clean_nearby_addr_dict, list(result)))
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
    cleaned_result = list(map(clean_addr_dict, result))
    return JsonResponse({"result": cleaned_result})


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
