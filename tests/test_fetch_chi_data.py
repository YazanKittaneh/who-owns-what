import pytest

from scripts import fetch_chi_data


def owners_where(years_spec, monkeypatch, latest_year="2026"):
    monkeypatch.setattr(
        fetch_chi_data,
        "resolve_latest_owners_year",
        lambda session, headers, timeout, max_retries: latest_year,
    )
    return fetch_chi_data.build_owners_where_clause(
        years_spec=years_spec,
        session=object(),
        headers={},
        timeout=1,
        max_retries=1,
    )


def test_chi_owners_years_latest_uses_resolved_latest_year(monkeypatch):
    where, description = owners_where("latest", monkeypatch, latest_year="2025")

    assert where == "year = '2025' AND prop_address_city_name = 'CHICAGO'"
    assert description == "latest Chicago year=2025"


def test_chi_owners_years_all_uses_city_only_filter(monkeypatch):
    where, description = owners_where("all", monkeypatch)

    assert where == "prop_address_city_name = 'CHICAGO'"
    assert description == "all available Chicago years"


def test_chi_owners_years_single_year(monkeypatch):
    where, description = owners_where("2024", monkeypatch)

    assert where == "year = '2024' AND prop_address_city_name = 'CHICAGO'"
    assert description == "Chicago year=2024"


def test_chi_owners_years_bounded_range(monkeypatch):
    where, description = owners_where("2022-2026", monkeypatch)

    assert (
        where
        == "year >= '2022' AND year <= '2026' AND prop_address_city_name = 'CHICAGO'"
    )
    assert description == "Chicago years=2022-2026"


@pytest.mark.parametrize("years_spec", ["2026-2022", "202", "abcd", "2022-xx"])
def test_chi_owners_years_invalid_values_raise(years_spec, monkeypatch):
    with pytest.raises(SystemExit):
        owners_where(years_spec, monkeypatch)
