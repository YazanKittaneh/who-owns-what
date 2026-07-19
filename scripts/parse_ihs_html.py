#!/usr/bin/env python3
"""
Parse IHS Data Portal HTML browse pages into normalized CSV.
Uses only stdlib (no BeautifulSoup) for lightweight parsing.
"""
import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT_DIR / "data" / "supplemental-20260331" / "housing" / "ihs"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data" / "supplemental-20260331" / "normalized"


@dataclass(frozen=True)
class IndicatorSpec:
    slug: str
    filename: str
    title: str
    is_percentage: bool


INDICATORS = (
    IndicatorSpec(
        "total-sales-activity",
        "browse_total_sales_activity.html",
        "Total Sales Activity",
        False,
    ),
    IndicatorSpec(
        "share-sales-business",
        "browse_share_sales_business.html",
        "Share of Sales, Business Buyers",
        True,
    ),
    IndicatorSpec(
        "total-mortgage-activity",
        "browse_total_mortgage_activity.html",
        "Total Mortgage Activity",
        False,
    ),
    IndicatorSpec(
        "total-foreclosure-activity",
        "browse_total_foreclosure_activity.html",
        "Total Foreclosure Filings Activity",
        False,
    ),
    IndicatorSpec(
        "total-auctions", "browse_total_auctions.html", "Total Auction Activity", False
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse IHS HTML indicator pages to CSV."
    )
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument(
        "--indicator",
        choices=[i.slug for i in INDICATORS],
        help="Process single indicator.",
    )
    return parser.parse_args()


def extract_text(html: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_focus_table(html: str) -> tuple[list[str], list[dict]]:
    """
    Extract the focus table: Geography + year columns.
    Returns (headers, rows) where rows are dicts with header keys.
    """
    # Find the focus table
    table_start = html.find('id="focus"')
    if table_start == -1:
        raise ValueError("No table with id='focus' found")

    # Find thead and tbody
    thead_start = html.find("<thead>", table_start)
    thead_end = html.find("</thead>", thead_start)
    tbody_start = html.find("<tbody>", thead_end)
    tbody_end = html.find("</tbody>", tbody_start)

    thead_html = html[thead_start:thead_end]
    tbody_html = html[tbody_start:tbody_end]

    # Extract headers from thead
    headers = []
    for th_match in re.finditer(r"<th[^>]*>(.*?)</th>", thead_html, re.DOTALL):
        header_text = extract_text(th_match.group(1))
        headers.append(header_text)

    if not headers:
        raise ValueError("No headers found in focus table")

    # Extract rows from tbody
    rows = []
    for tr_match in re.finditer(r"<tr[^>]*>(.*?)</tr>", tbody_html, re.DOTALL):
        tr_html = tr_match.group(1)
        # Skip if this is the footer row (contains "Chicago Total")
        if "Chicago Total" in tr_html:
            continue

        cells = []
        for td_match in re.finditer(r"<td[^>]*>(.*?)</td>", tr_html, re.DOTALL):
            td_html = td_match.group(1)
            # Try data-order first for numeric value
            data_order_match = re.search(r'data-order="([^"]*)"', td_html)
            if data_order_match:
                value = data_order_match.group(1).strip()
            else:
                value = extract_text(td_html)
            cells.append(value)

        if len(cells) == len(headers):
            row_dict = dict(zip(headers, cells))
            rows.append(row_dict)

    return headers, rows


def parse_indicator_file(input_path: Path, spec: IndicatorSpec) -> list[dict]:
    """Parse an IHS indicator HTML file into normalized records."""
    html = input_path.read_text(encoding="utf-8")
    headers, rows = parse_focus_table(html)

    # Extract geography slug from first row's link if present
    records = []
    for row in rows:
        geography = row.get("Geography", "").strip()
        if not geography:
            continue

        # For each year column (2005-2024)
        for year_col in headers[1:]:  # Skip Geography column
            value = row.get(year_col, "").strip()
            # Skip missing values (displayed as --)
            if value in ("", "--"):
                continue

            # Clean percentage values and remove commas from numbers
            if spec.is_percentage and value.endswith("%"):
                value = value[:-1]
            # Remove commas from numeric values (e.g., "1,006" -> "1006")
            value = value.replace(",", "")

            records.append(
                {
                    "indicator_slug": spec.slug,
                    "indicator_title": spec.title,
                    "property_type": "All Residential Properties",
                    "area_slug": "chicago-community-areas",
                    "geography_name": geography,
                    "year": year_col,
                    "value": value,
                    "is_percentage": "true" if spec.is_percentage else "false",
                }
            )

    return records


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    indicators_to_process = [
        i for i in INDICATORS if not args.indicator or i.slug == args.indicator
    ]

    all_records = []
    for spec in indicators_to_process:
        input_path = input_dir / spec.filename
        if not input_path.exists():
            print(f"Warning: {input_path} not found, skipping")
            continue

        print(f"Processing {spec.slug}...")
        records = parse_indicator_file(input_path, spec)
        all_records.extend(records)
        print(f"  -> {len(records)} records")

    if not all_records:
        print("No records found")
        return

    output_path = output_dir / "ihs_indicators.csv"
    fieldnames = [
        "indicator_slug",
        "indicator_title",
        "property_type",
        "area_slug",
        "geography_name",
        "year",
        "value",
        "is_percentage",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_records)

    print(f"Wrote {len(all_records)} records to {output_path}")


if __name__ == "__main__":
    main()
