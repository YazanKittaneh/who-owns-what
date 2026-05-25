import json
from collections.abc import Iterator

import pytest
from django.test import RequestFactory, override_settings

from wow import views


class FakeCoverageCursor:
    def __init__(self, state):
        self.state = state
        self.result = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        normalized_sql = " ".join(sql.split())

        if normalized_sql.startswith("SELECT to_regclass("):
            table_name = params[0]
            self.result = (table_name,) if self.state["table_exists"].get(table_name, False) else (None,)
            return

        if normalized_sql.startswith("SELECT loaded_at, row_count, source_ref, run_id, status FROM data_load_audit"):
            dataset_name = params[0]
            self.result = self.state["audit_rows"].get(dataset_name)
            return

        if normalized_sql == "SELECT COUNT(*), COUNT(*) FILTER (WHERE years_seen >= 2) FROM ( SELECT pin, COUNT(DISTINCT year) AS years_seen FROM chi_owners WHERE year ~ '^[0-9]{4}$' GROUP BY pin ) owner_history":
            self.result = self.state.get("chi_owners_depth")
            return

        if normalized_sql.startswith("SELECT COUNT(*) FROM "):
            table_name = normalized_sql.removeprefix("SELECT COUNT(*) FROM ")
            self.result = (self.state["row_counts"].get(table_name, 0),)
            return

        if normalized_sql.startswith("SELECT MIN((year)::int), MAX((year)::int) FROM "):
            table_name = normalized_sql.split(" FROM ", 1)[1].split(" WHERE ", 1)[0]
            self.result = self.state["year_ranges"].get(table_name, (None, None))
            return

        raise AssertionError(f"Unhandled SQL in test: {normalized_sql}")

    def fetchone(self):
        return self.result


class FakeCoverageConnection:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCoverageCursor(self.state)

    def rollback(self):
        return None


@pytest.fixture
def rf() -> Iterator[RequestFactory]:
    yield RequestFactory()


def test_admin_data_coverage_requires_auth(rf):
    request = rf.get(
        "/api/admin/data-coverage",
        HTTP_ORIGIN="http://localhost:3000",
    )

    response = views.admin_data_coverage(request)

    assert response.status_code == 401
    assert json.loads(response.content)["error"] == "Unauthorized request"
    assert "Access-Control-Allow-Origin" in response


@override_settings(ADMIN_API_TOKEN="coverage-secret")
def test_admin_data_coverage_reports_present_partial_missing_and_auditless_states(rf, monkeypatch):
    state = {
        "table_exists": {
            "data_load_audit": False,
            "chi_owners": True,
            "woodstock_mortgage_metadata": False,
            "bor_search_results": True,
            "ihs_indicators": True,
        },
        "row_counts": {
            "chi_owners": 3,
            "bor_search_results": 5,
            "ihs_indicators": 12,
        },
        "year_ranges": {
            "chi_owners": (2026, 2026),
            "bor_search_results": (2024, 2024),
            "ihs_indicators": (2005, 2024),
        },
        "chi_owners_depth": (2, 0),
        "audit_rows": {},
    }
    monkeypatch.setattr(views, "connections", {"wow": FakeCoverageConnection(state)})

    request = rf.get(
        "/api/admin/data-coverage",
        HTTP_AUTHORIZATION="Token coverage-secret",
    )

    response = views.admin_data_coverage(request)

    assert response.status_code == 200
    payload = json.loads(response.content)
    datasets = {item["dataset"]: item for item in payload["datasets"]}

    assert datasets["chi_owners"]["present"] is True
    assert datasets["chi_owners"]["status"] == "partial"
    assert datasets["chi_owners"]["reason"] == "single_year_history_only"
    assert datasets["chi_owners"]["last_loaded_at"] is None
    assert datasets["woodstock_mortgage_metadata"]["status"] == "missing"
    assert datasets["woodstock_mortgage_metadata"]["reason"] == "table_missing"
    assert datasets["bor_detail"]["status"] == "partial"
    assert datasets["registered_chicago_taxpayer"]["status"] == "missing"


@override_settings(ADMIN_API_TOKEN="coverage-secret")
def test_admin_data_coverage_includes_latest_audit_metadata_when_available(rf, monkeypatch):
    state = {
        "table_exists": {
            "data_load_audit": True,
            "chi_owners": True,
            "woodstock_mortgage_metadata": True,
            "bor_search_results": True,
            "ihs_indicators": True,
        },
        "row_counts": {
            "chi_owners": 10,
            "woodstock_mortgage_metadata": 4,
            "bor_search_results": 5,
            "ihs_indicators": 12,
        },
        "year_ranges": {
            "chi_owners": (2024, 2026),
            "woodstock_mortgage_metadata": (2018, 2024),
            "bor_search_results": (2024, 2024),
            "ihs_indicators": (2005, 2024),
        },
        "chi_owners_depth": (4, 2),
        "audit_rows": {
            "chi_owners": (
                "2026-04-09T00:00:00+00:00",
                10,
                "data/chi_owners.csv",
                "core-20260409T000000Z",
                "success",
            )
        },
    }
    monkeypatch.setattr(views, "connections", {"wow": FakeCoverageConnection(state)})

    response = views.admin_data_coverage(
        rf.get(
            "/api/admin/data-coverage",
            HTTP_AUTHORIZATION="Token coverage-secret",
        )
    )

    payload = json.loads(response.content)
    datasets = {item["dataset"]: item for item in payload["datasets"]}

    assert datasets["chi_owners"]["status"] == "ok"
    assert datasets["chi_owners"]["last_loaded_at"] == "2026-04-09T00:00:00+00:00"
    assert datasets["chi_owners"]["last_load_row_count"] == 10
    assert datasets["chi_owners"]["last_load_run_id"] == "core-20260409T000000Z"


@override_settings(RATELIMIT_ENABLE=True)
def test_ratelimited_address_search_returns_json_429(rf, monkeypatch):
    from django.core.cache import cache

    cache.clear()
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, params: [{"pin": "17032270221140", "address": "X"}],
    )

    # 120/m, so the 121st request from a single IP should be rate-limited.
    last_response = None
    for _ in range(121):
        last_response = views.address_search(
            rf.get(
                "/api/address/search",
                {"q": "test"},
                HTTP_X_FORWARDED_FOR="203.0.113.10",
            )
        )

    assert last_response.status_code == 429
    assert json.loads(last_response.content)["error"].startswith("Too many requests")
    cache.clear()


@override_settings(RATELIMIT_ENABLE=True)
def test_ratelimit_uses_x_forwarded_for_first_ip(rf, monkeypatch):
    from django.core.cache import cache

    cache.clear()
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, params: [],
    )

    # First IP exhausts its budget.
    for _ in range(120):
        views.address_search(
            rf.get(
                "/api/address/search",
                {"q": "test"},
                HTTP_X_FORWARDED_FOR="203.0.113.20, 10.0.0.1",
            )
        )

    blocked = views.address_search(
        rf.get(
            "/api/address/search",
            {"q": "test"},
            HTTP_X_FORWARDED_FOR="203.0.113.20, 10.0.0.1",
        )
    )
    assert blocked.status_code == 429

    # A different upstream IP, same proxy chain, should still be allowed.
    allowed = views.address_search(
        rf.get(
            "/api/address/search",
            {"q": "test"},
            HTTP_X_FORWARDED_FOR="203.0.113.21, 10.0.0.1",
        )
    )
    assert allowed.status_code == 200
    cache.clear()


def test_apply_cors_policy_only_echoes_allowed_origin(rf):
    from wow import apiutil

    allowed = rf.get("/api/health/", HTTP_ORIGIN="http://localhost:3000")
    blocked = rf.get("/api/health/", HTTP_ORIGIN="http://evil.example")
    no_origin = rf.get("/api/health/")

    from django.http import JsonResponse

    allowed_resp = apiutil.apply_cors_policy(allowed, JsonResponse({}))
    blocked_resp = apiutil.apply_cors_policy(blocked, JsonResponse({}))
    no_origin_resp = apiutil.apply_cors_policy(no_origin, JsonResponse({}))

    assert allowed_resp["Access-Control-Allow-Origin"] == "http://localhost:3000"
    assert allowed_resp["Access-Control-Allow-Credentials"] == "true"
    assert "Access-Control-Allow-Origin" not in blocked_resp
    assert "Access-Control-Allow-Origin" not in no_origin_resp


def test_health_check_returns_healthy_when_db_cursor_succeeds(rf, monkeypatch):
    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, sql):
            assert sql == "SELECT 1"

        def fetchone(self):
            return (1,)

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

    monkeypatch.setattr(views, "connections", {"wow": FakeConnection()})

    response = views.health_check(rf.get("/api/health/"))

    assert response.status_code == 200
    assert json.loads(response.content) == {"status": "healthy", "database": "connected"}


def test_address_search_smoke_uses_pin_search_contract(rf, monkeypatch):
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, params: [
            {
                "pin": "17032270221140",
                "address": "118 N CLARK ST",
                "city": "CHICAGO",
                "state": "IL",
                "zip": "60602",
            }
        ],
    )

    response = views.address_search(rf.get("/api/address/search", {"q": "118 n clark"}))

    assert response.status_code == 200
    assert json.loads(response.content)["result"][0]["pin"] == "17032270221140"


def test_address_query_smoke_returns_cleaned_numeric_fields(rf, monkeypatch):
    monkeypatch.setattr(
        views,
        "call_db_func",
        lambda _name, _args: [
            {
                "pin": "17032270221140",
                "address": "118 N CLARK ST",
                "units_res": "12",
                "permits_total": "3",
                "violations_open": "1",
                "violations_total": "4",
                "requests_311_total": "2",
                "tax_sale_event_count": "0",
                "latest_tax_sale_year": None,
                "total_tax_sale_amount_paid": "0",
                "recorder_doc_count": "5",
                "mortgage_doc_count": "2",
                "quitclaim_doc_count": "1",
                "foreclosure_doc_count": "0",
                "latest_recorder_doc_date": None,
                "latest_mortgage_date": None,
                "latest_mortgage_amount": None,
                "latest_quitclaim_date": None,
                "latest_quitclaim_amount": None,
            }
        ],
    )

    response = views.address_query(rf.get("/api/address", {"pin": "17032270221140"}))

    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["geosearch"] == {"pin": "17032270221140"}
    assert payload["addrs"][0]["units_res"] == 12
    assert payload["addrs"][0]["permits_total"] == 3


def test_address_overview_map_smoke_returns_bounds_results_and_truncation(rf, monkeypatch):
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, _params: [
            {
                "pin": "17032270221140",
                "address": "118 N CLARK ST",
                "owner_name": "CITY OWNER LLC",
                "lat": "41.885",
                "lng": "-87.630",
                "total_count": 901,
            }
        ],
    )

    response = views.address_overview_map(
        rf.get(
            "/api/address/overview-map",
            {
                "north": 41.9,
                "south": 41.8,
                "east": -87.6,
                "west": -87.7,
                "limit": 800,
            },
        )
    )

    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["truncated"] is True
    assert payload["total_count"] == 901
    assert payload["result"][0]["lat"] == 41.885


def test_address_nearby_smoke_returns_owner_and_mailing_fields(rf, monkeypatch):
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, params: [
            {
                "pin": "13262030270000",
                "address": "3130 N KIMBALL AVE",
                "owner_name": "ROBERT F CARDONA",
                "mailing_address": "123 EXAMPLE ST",
                "mailing_city": "CHICAGO",
                "mailing_state": "IL",
                "mailing_zip": "60618",
                "lat": "41.9381",
                "lng": "-87.7135",
                "distance_m": 19,
                "same_owner": False,
            }
        ],
    )

    response = views.address_nearby(
        rf.get(
            "/api/address/nearby",
            {"pin": "13262030280000", "radius_m": 200, "limit": 10},
        )
    )

    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["seed"] == {"pin": "13262030280000", "radius_m": 200}
    assert payload["result"][0]["owner_name"] == "ROBERT F CARDONA"
    assert payload["result"][0]["distance_m"] == 19


def test_owner_current_smoke_returns_owner_summary_and_parcels(rf, monkeypatch):
    monkeypatch.setattr(
        views,
        "exec_db_query",
        lambda _sql_path, params: [
            {
                "pin": "13262030280000",
                "address": "3134 N KIMBALL AVE",
                "owner_id": "row-1",
                "owner_name": "SO 3134 N KIMBALL LLC",
                "mailing_address": "1343 N OAKLEY BLVD",
                "mailing_city": "CHICAGO",
                "mailing_state": "IL",
                "mailing_zip": "60622",
            }
        ],
    )

    response = views.owner_current(
        rf.get("/api/owner/current", {"owner_id": "row-1"})
    )

    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["owner"]["owner_id"] == "row-1"
    assert payload["owner"]["owner_name"] == "SO 3134 N KIMBALL LLC"
    assert payload["owner"]["parcel_count"] == 1
    assert payload["result"][0]["pin"] == "13262030280000"


def test_address_indicatorhistory_smoke_prefers_pin_path(rf, monkeypatch):
    calls = []

    def fake_exec_db_query(sql_path, params):
        calls.append(sql_path.name)
        assert params == {"pin": "17032270221140"}
        return [{"month": "2026-01", "permits_total": 1}]

    monkeypatch.setattr(views, "exec_db_query", fake_exec_db_query)

    response = views.address_indicatorhistory(
        rf.get("/api/address/indicatorhistory", {"pin": "17032270221140"})
    )

    assert response.status_code == 200
    assert json.loads(response.content)["schema"] == "standard"
    assert calls[0] == "address_indicatorhistory_chi_with_ihs.sql"
