import csv
import logging
from pathlib import Path
from typing import Any, Dict
from django.http import HttpResponse, JsonResponse

from .dbutil import call_db_func, exec_db_query
from .datautil import int_or_none
from . import csvutil, apiutil
from .apiutil import api, get_validated_form_data
from .forms import PinForm, PinListForm, AddressSearchForm


MY_DIR = Path(__file__).parent.resolve()
SQL_DIR = MY_DIR / "sql"

logger = logging.getLogger(__name__)


def clean_addr_dict(addr):
    return {
        **addr,
        "units_res": int_or_none(addr.get("units_res")),
        "permits_total": int_or_none(addr.get("permits_total")),
        "violations_open": int_or_none(addr.get("violations_open")),
        "violations_total": int_or_none(addr.get("violations_total")),
        "requests_311_total": int_or_none(addr.get("requests_311_total")),
    }


def get_pin_from_request(request) -> str:
    return get_validated_form_data(PinForm, request.GET)["pin"]


@api
def address_search(request):
    args = get_validated_form_data(AddressSearchForm, request.GET)
    query_sql = SQL_DIR / "address_search.sql"
    result = exec_db_query(query_sql, {"q": args["q"]})
    return JsonResponse({"result": list(result)})


@api
def address_query(request):
    pin = get_pin_from_request(request)
    addrs = call_db_func("get_assoc_addrs_from_pin", [pin])
    cleaned_addrs = list(map(clean_addr_dict, addrs))
    return JsonResponse(
        {
            "geosearch": {"pin": pin},
            "addrs": cleaned_addrs,
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
    result = exec_db_query(SQL_DIR / "address_buildinginfo.sql", {"pin": pin})
    cleaned_result = list(map(clean_addr_dict, result))
    return JsonResponse({"result": cleaned_result})


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
