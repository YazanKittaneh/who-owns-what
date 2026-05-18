#!/usr/bin/env python3
import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable
from urllib import error, request


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data" / "supplemental-20260331"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)


@dataclass(frozen=True)
class DownloadSpec:
    family: str
    name: str
    url: str
    relpath: str
    kind: str
    notes: str


DOWNLOAD_SPECS: tuple[DownloadSpec, ...] = (
    DownloadSpec(
        family="ihs",
        name="IHS data portal landing page",
        url="https://www.housingstudies.org/data-portal/",
        relpath="housing/ihs/data_portal_landing.html",
        kind="html",
        notes="Landing page describing the available Chicago-region housing indicators.",
    ),
    DownloadSpec(
        family="ihs",
        name="IHS total sales activity",
        url="https://www.housingstudies.org/data-portal/browse/?indicator=total-sales-activity",
        relpath="housing/ihs/browse_total_sales_activity.html",
        kind="html",
        notes="Browse table with in-page sales activity data across geographies.",
    ),
    DownloadSpec(
        family="ihs",
        name="IHS share sales business buyers",
        url="https://www.housingstudies.org/data-portal/browse/?indicator=share-sales-business",
        relpath="housing/ihs/browse_share_sales_business.html",
        kind="html",
        notes="Browse table with investor/business-buyer share across geographies.",
    ),
    DownloadSpec(
        family="ihs",
        name="IHS total mortgage activity",
        url="https://www.housingstudies.org/data-portal/browse/?indicator=total-mortgage-activity",
        relpath="housing/ihs/browse_total_mortgage_activity.html",
        kind="html",
        notes="Browse table with mortgage activity across geographies.",
    ),
    DownloadSpec(
        family="ihs",
        name="IHS total foreclosure activity",
        url="https://www.housingstudies.org/data-portal/browse/?indicator=total-foreclosure-activity",
        relpath="housing/ihs/browse_total_foreclosure_activity.html",
        kind="html",
        notes="Browse table with foreclosure filing activity across geographies.",
    ),
    DownloadSpec(
        family="ihs",
        name="IHS total auctions",
        url="https://www.housingstudies.org/data-portal/browse/?indicator=total-auctions",
        relpath="housing/ihs/browse_total_auctions.html",
        kind="html",
        notes="Browse table with foreclosure auction activity across geographies.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2024",
        url="https://woodstockinst.org/wp-content/uploads/2025/07/Illinois_2024_7.8.25-1.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2024.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2023",
        url="https://woodstockinst.org/wp-content/uploads/2025/06/Illinois_2023_4.1.25-1.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2023.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2022",
        url="https://woodstockinst.org/wp-content/uploads/2025/06/Illinois_2022_4.1.25-1.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2022.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2021",
        url="https://woodstockinst.org/wp-content/uploads/2025/04/Illinois_2021_4.1.25.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2021.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2020",
        url="https://woodstockinst.org/wp-content/uploads/2025/04/Illinois_2020_4.1.25.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2020.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2019",
        url="https://woodstockinst.org/wp-content/uploads/2025/04/Illinois_2019_4.1.25.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2019.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="woodstock",
        name="Woodstock Illinois mortgage 2018",
        url="https://woodstockinst.org/wp-content/uploads/2025/04/Illinois_2018_4.1.25.xlsx",
        relpath="housing/woodstock/illinois_mortgage_2018.xlsx",
        kind="xlsx",
        notes="Illinois mortgage dataset with race and ethnicity breakout.",
    ),
    DownloadSpec(
        family="board_of_review",
        name="Cook County Board of Review home page",
        url="https://www.cookcountyboardofreview.com/",
        relpath="appeals/board_of_review/home_page.html",
        kind="html",
        notes="Current landing page describing the appeals process and decision history search.",
    ),
    DownloadSpec(
        family="board_of_review",
        name="Cook County Board of Review decision search",
        url="https://apps.cookcountyil.gov/BORDecisionSearch/decision.php",
        relpath="appeals/board_of_review/decision_search.html",
        kind="html",
        notes="Search UI for appeal decisions; there is no obvious bulk export on the public page.",
    ),
    DownloadSpec(
        family="registered_taxpayer",
        name="Legacy registered Chicago taxpayer search",
        url="https://www.chicago.gov/content/city/en/depts/fin/provdrs/tax_division/svcs/registered_chicagotaxpayersearch.html",
        relpath="tax/registered_taxpayer/legacy_registered_taxpayer_search.html",
        kind="html",
        notes="Legacy page from older source lists. The current public URL returns 404 and is retained to document the blocker.",
    ),
    DownloadSpec(
        family="registered_taxpayer",
        name="Chicago finance tax information and resources",
        url="https://www.chicago.gov/content/city/en/depts/fin/provdrs/tax_division/svcs/tax-information-and-resources.html",
        relpath="tax/registered_taxpayer/tax_information_and_resources.html",
        kind="html",
        notes="Current tax information hub page used to verify whether the old registered taxpayer search is still linked.",
    ),
    DownloadSpec(
        family="registered_taxpayer",
        name="Chicago finance tax list",
        url="https://www.chicago.gov/city/en/depts/fin/supp_info/revenue/tax_list.html",
        relpath="tax/registered_taxpayer/tax_list.html",
        kind="html",
        notes="Current tax list page; useful as the present replacement page exposed from the finance site.",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch selected external source expansion files.")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Destination directory (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--family",
        action="append",
        choices=sorted({spec.family for spec in DOWNLOAD_SPECS}),
        help="Optional source family filter. May be passed multiple times.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="HTTP timeout in seconds.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download files even when the output path already exists.",
    )
    return parser.parse_args()


def iter_specs(families: list[str] | None) -> Iterable[DownloadSpec]:
    if not families:
        return DOWNLOAD_SPECS
    family_set = set(families)
    return tuple(spec for spec in DOWNLOAD_SPECS if spec.family in family_set)


def fetch_bytes(url: str, timeout: int) -> bytes:
    req = request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with request.urlopen(req, timeout=timeout) as response:
        return response.read()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, object] = {
        "generated_by": "scripts/fetch_source_expansion.py",
        "output_dir": str(output_dir),
        "sources": [],
    }

    for spec in iter_specs(args.family):
        destination = output_dir / spec.relpath
        destination.parent.mkdir(parents=True, exist_ok=True)
        entry = asdict(spec)
        entry["output_path"] = str(destination.relative_to(output_dir))
        if destination.exists() and not args.force:
            entry["status"] = "existing"
            entry["bytes"] = destination.stat().st_size
            print(f"{spec.name}: existing {destination}")
            manifest["sources"].append(entry)
            continue
        try:
            payload = fetch_bytes(spec.url, timeout=args.timeout)
        except error.HTTPError as exc:
            entry["status"] = "http_error"
            entry["http_status"] = exc.code
            entry["error"] = str(exc)
            print(f"{spec.name}: HTTP {exc.code}")
        except error.URLError as exc:
            entry["status"] = "url_error"
            entry["error"] = str(exc)
            print(f"{spec.name}: URL error {exc}")
        else:
            destination.write_bytes(payload)
            entry["status"] = "downloaded"
            entry["bytes"] = len(payload)
            print(f"{spec.name}: downloaded {len(payload)} bytes -> {destination}")
        manifest["sources"].append(entry)

    manifest_path = output_dir / "source_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote manifest: {manifest_path}")


if __name__ == "__main__":
    main()
