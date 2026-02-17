#!/usr/bin/env python3
import argparse
import csv
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests


DEFAULT_LIMIT = 50000
DEFAULT_TIMEOUT_SECS = 120
DEFAULT_MAX_RETRIES = 6


@dataclass(frozen=True)
class DatasetConfig:
    name: str
    domain: str
    view_id: str
    filename: str
    where: Optional[str] = None
    order_by: str = ":id"

    @property
    def csv_url(self) -> str:
        return f"https://{self.domain}/resource/{self.view_id}.csv"

    @property
    def json_url(self) -> str:
        return f"https://{self.domain}/resource/{self.view_id}.json"


DATASET_CONFIGS: Dict[str, DatasetConfig] = {
    # Keep these aligned with dbtool.py DATASETS keys.
    "chi_parcels": DatasetConfig(
        name="chi_parcels",
        domain="datacatalog.cookcountyil.gov",
        view_id="pabr-t5kh",
        filename="chi_parcels.csv",
        where="cook_municipality_name = 'CITY OF CHICAGO'",
    ),
    "chi_owners": DatasetConfig(
        name="chi_owners",
        domain="datacatalog.cookcountyil.gov",
        view_id="3723-97qp",
        filename="chi_owners.csv",
        # Filled at runtime from latest Chicago parcel-address year.
        where=None,
    ),
    "chi_permits": DatasetConfig(
        name="chi_permits",
        domain="data.cityofchicago.org",
        view_id="ydr8-5enu",
        filename="chi_permits.csv",
    ),
    "chi_violations": DatasetConfig(
        name="chi_violations",
        domain="data.cityofchicago.org",
        view_id="22u3-xenr",
        filename="chi_violations.csv",
    ),
    "chi_311": DatasetConfig(
        name="chi_311",
        domain="data.cityofchicago.org",
        view_id="v6vf-nfxy",
        filename="chi_311.csv",
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Chicago WoW source CSVs from Socrata APIs using pagination."
    )
    parser.add_argument(
        "--datasets",
        default="chi_parcels,chi_owners,chi_permits,chi_violations,chi_311",
        help="Comma-separated dataset names to fetch.",
    )
    parser.add_argument(
        "--output-dir",
        default="data",
        help="Directory to write CSVs (default: data).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Page size for each API request (default: {DEFAULT_LIMIT}).",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Optional cap on number of pages per dataset (0 means no cap).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECS,
        help=f"HTTP timeout in seconds (default: {DEFAULT_TIMEOUT_SECS}).",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=DEFAULT_MAX_RETRIES,
        help=f"Max retries for transient API errors (default: {DEFAULT_MAX_RETRIES}).",
    )
    parser.add_argument(
        "--app-token",
        default=os.environ.get("SOCRATA_APP_TOKEN", ""),
        help="Socrata app token (or set SOCRATA_APP_TOKEN).",
    )
    return parser.parse_args()


def build_headers(app_token: str) -> Dict[str, str]:
    headers = {"Accept": "text/csv"}
    if app_token:
        headers["X-App-Token"] = app_token
    return headers


def request_with_retries(
    session: requests.Session,
    url: str,
    params: Dict[str, str],
    headers: Dict[str, str],
    timeout: int,
    max_retries: int,
) -> requests.Response:
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.get(url, params=params, headers=headers, timeout=timeout)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(
                    f"transient status={resp.status_code}", response=resp
                )
            resp.raise_for_status()
            return resp
        except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as err:
            if attempt >= max_retries:
                raise
            wait_secs = min(2 ** (attempt - 1), 30)
            print(
                f"Request failed ({err}); retrying in {wait_secs}s "
                f"[{attempt}/{max_retries}]",
                file=sys.stderr,
            )
            time.sleep(wait_secs)
    raise RuntimeError("retry loop exhausted unexpectedly")


def resolve_latest_owners_year(
    session: requests.Session,
    headers: Dict[str, str],
    timeout: int,
    max_retries: int,
) -> str:
    config = DATASET_CONFIGS["chi_owners"]
    params = {"$select": "max(year) AS max_year", "$where": "prop_address_city_name = 'CHICAGO'"}
    response = request_with_retries(
        session=session,
        url=config.json_url,
        params=params,
        headers={**headers, "Accept": "application/json"},
        timeout=timeout,
        max_retries=max_retries,
    )
    rows = response.json()
    if not rows or not rows[0].get("max_year"):
        raise RuntimeError("Could not resolve latest year for chi_owners.")
    return str(rows[0]["max_year"])


def iter_dataset_names(csv_names: str) -> Iterable[str]:
    for name in (part.strip() for part in csv_names.split(",")):
        if name:
            yield name


def count_rows_in_page(csv_text: str) -> int:
    # csv module handles quoted newlines safely.
    rows = list(csv.reader(csv_text.splitlines()))
    if not rows:
        return 0
    return max(len(rows) - 1, 0)


def fetch_dataset(
    session: requests.Session,
    config: DatasetConfig,
    output_dir: Path,
    headers: Dict[str, str],
    limit: int,
    max_pages: int,
    timeout: int,
    max_retries: int,
) -> int:
    output_path = output_dir / config.filename
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    offset = 0
    page = 0
    total_rows = 0
    wrote_header = False

    while True:
        if max_pages > 0 and page >= max_pages:
            break

        params = {"$limit": str(limit), "$offset": str(offset), "$order": config.order_by}
        if config.where:
            params["$where"] = config.where

        response = request_with_retries(
            session=session,
            url=config.csv_url,
            params=params,
            headers=headers,
            timeout=timeout,
            max_retries=max_retries,
        )
        payload = response.text
        page_rows = count_rows_in_page(payload)
        if page_rows == 0:
            break

        lines = payload.splitlines(keepends=True)
        mode = "w" if not wrote_header else "a"
        with temp_path.open(mode, encoding="utf-8") as handle:
            if not wrote_header:
                handle.writelines(lines)
                wrote_header = True
            else:
                handle.writelines(lines[1:])

        total_rows += page_rows
        page += 1
        offset += limit
        print(f"{config.name}: page={page} rows={page_rows} total={total_rows}")

        if page_rows < limit:
            break

    if total_rows == 0:
        raise RuntimeError(
            f"{config.name}: fetched 0 rows. Check filters or API availability."
        )

    temp_path.replace(output_path)
    print(f"{config.name}: wrote {total_rows} rows to {output_path}")
    return total_rows


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    selected = list(iter_dataset_names(args.datasets))
    invalid = [name for name in selected if name not in DATASET_CONFIGS]
    if invalid:
        raise SystemExit(f"Unknown dataset(s): {', '.join(invalid)}")

    headers = build_headers(args.app_token)
    session = requests.Session()

    configs = {name: DATASET_CONFIGS[name] for name in selected}
    if "chi_owners" in configs:
        owners_year = resolve_latest_owners_year(
            session=session,
            headers=headers,
            timeout=args.timeout,
            max_retries=args.max_retries,
        )
        base = configs["chi_owners"]
        configs["chi_owners"] = DatasetConfig(
            name=base.name,
            domain=base.domain,
            view_id=base.view_id,
            filename=base.filename,
            where=f"year = '{owners_year}' AND prop_address_city_name = 'CHICAGO'",
            order_by=base.order_by,
        )
        print(f"chi_owners: using latest Chicago year={owners_year}")

    totals: Dict[str, int] = {}
    for name in selected:
        totals[name] = fetch_dataset(
            session=session,
            config=configs[name],
            output_dir=output_dir,
            headers=headers,
            limit=args.limit,
            max_pages=args.max_pages,
            timeout=args.timeout,
            max_retries=args.max_retries,
        )

    print("Fetch complete:")
    for name in selected:
        print(f"- {name}: {totals[name]} rows")


if __name__ == "__main__":
    main()
