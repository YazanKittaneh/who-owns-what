#!/usr/bin/env python3
"""
Scrape Cook County Board of Review decision search results.
Uses stdlib only (no requests, no BeautifulSoup).
"""
import argparse
import csv
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data" / "supplemental-20260331" / "normalized"

SEARCH_URL = "https://apps.cookcountyil.gov/BORDecisionSearch/decision.php"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)


@dataclass
class SearchResult:
    address: str
    pin: str
    year: str
    prop_no: str
    trunk_no: str
    seq_no: str
    result_id: str


def create_opener() -> urllib.request.OpenerDirector:
    """Create an opener that handles cookies."""
    cookie_processor = urllib.request.HTTPCookieProcessor()
    return urllib.request.build_opener(cookie_processor)


def extract_text(html: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_results_table(html: str) -> list[SearchResult]:
    """Parse the decision results table from HTML."""
    results = []

    # Find the results table
    table_match = re.search(
        r'id="decision_results"[^\u003e]*\u003e(.*?)\u003c/table\u003e', html, re.DOTALL
    )
    if not table_match:
        return results

    table_html = table_match.group(1)

    # Find all rows in tbody
    tbody_match = re.search(
        r"\u003ctbody[^\u003e]*\u003e(.*?)\u003c/tbody\u003e", table_html, re.DOTALL
    )
    if not tbody_match:
        return results

    tbody_html = tbody_match.group(1)

    # Parse each row
    for row_match in re.finditer(
        r"\u003ctr[^\u003e]*\u003e(.*?)\u003c/tr\u003e", tbody_html, re.DOTALL
    ):
        row_html = row_match.group(1)

        # Extract cells
        cells = re.findall(
            r"\u003ctd[^\u003e]*\u003e(.*?)\u003c/td\u003e", row_html, re.DOTALL
        )
        if len(cells) < 4:
            continue

        address = extract_text(cells[0])
        pin = extract_text(cells[1])
        year = extract_text(cells[2])

        # Extract hidden form fields from the action column
        prop_no = ""
        trunk_no = ""
        seq_no = ""
        result_id = ""

        prop_match = re.search(r'name="PROP-NO"\s+value="([^"]*)"', row_html)
        if prop_match:
            prop_no = prop_match.group(1)

        trunk_match = re.search(r'name="TRUNK-NO"\s+value="([^"]*)"', row_html)
        if trunk_match:
            trunk_no = trunk_match.group(1)

        seq_match = re.search(r'name="SEQ-NO"\s+value="([^"]*)"', row_html)
        if seq_match:
            seq_no = seq_match.group(1)

        id_match = re.search(r'name="ID"\s+value="([^"]*)"', row_html)
        if id_match:
            result_id = id_match.group(1)

        results.append(
            SearchResult(
                address=address,
                pin=pin,
                year=year,
                prop_no=prop_no,
                trunk_no=trunk_no,
                seq_no=seq_no,
                result_id=result_id,
            )
        )

    return results


def search_by_address(
    opener: urllib.request.OpenerDirector,
    houseno: str,
    strtdir: str,
    strtname: str,
    cityname: str = "CHICAGO",
    aptcode: str = "",
) -> list[SearchResult]:
    """Search by address and return results."""
    data = urlencode(
        {
            "type": "mainform_address",
            "houseno": houseno,
            "strtdir": strtdir,
            "strtname": strtname,
            "aptcode": aptcode,
            "cityname": cityname,
        }
    )

    req = urllib.request.Request(
        SEARCH_URL,
        data=data.encode("utf-8"),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        method="POST",
    )

    try:
        with opener.open(req, timeout=60) as response:
            html = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(f"HTTP error: {e.code}")
        return []
    except urllib.error.URLError as e:
        print(f"URL error: {e}")
        return []

    # Check for security check / captcha
    if "Security Check" in html or "captcha" in html.lower():
        print("Warning: Security check / captcha detected")
        return []

    # Check for no records
    if "No records" in html or "no records" in html.lower():
        return []

    return parse_results_table(html)


def search_by_pin(
    opener: urllib.request.OpenerDirector,
    pin: str,
) -> list[SearchResult]:
    """Search by PIN and return results."""
    # Parse PIN into segments
    pin_clean = re.sub(r"\D", "", pin)
    if len(pin_clean) != 14:
        print(f"Invalid PIN format: {pin}")
        return []

    data = urlencode(
        {
            "type": "mainform_pin",
            "PIN": pin_clean,
            "PIN1": pin_clean[0:2],
            "PIN2": pin_clean[2:4],
            "PIN3": pin_clean[4:7],
            "PIN4": pin_clean[7:10],
            "PIN5": pin_clean[10:14],
        }
    )

    req = urllib.request.Request(
        SEARCH_URL,
        data=data.encode("utf-8"),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        method="POST",
    )

    try:
        with opener.open(req, timeout=60) as response:
            html = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(f"HTTP error: {e.code}")
        return []
    except urllib.error.URLError as e:
        print(f"URL error: {e}")
        return []

    # Check for security check / captcha
    if "Security Check" in html or "captcha" in html.lower():
        print("Warning: Security check / captcha detected")
        return []

    # Check for no records
    if "No records" in html or "no records" in html.lower():
        return []

    return parse_results_table(html)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Cook County Board of Review decisions."
    )
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--sample-pins", nargs="+", help="Sample PINs to search")
    parser.add_argument(
        "--sample-addresses",
        nargs="+",
        help="Sample addresses (format: 'houseno|direction|street')",
    )
    parser.add_argument(
        "--delay", type=float, default=1.0, help="Delay between requests in seconds"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    opener = create_opener()
    all_results = []

    # Search by sample PINs if provided
    if args.sample_pins:
        for pin in args.sample_pins:
            print(f"Searching PIN: {pin}")
            results = search_by_pin(opener, pin)
            print(f"  -> {len(results)} results")
            all_results.extend(results)
            time.sleep(args.delay)

    # Search by sample addresses if provided
    if args.sample_addresses:
        for addr_str in args.sample_addresses:
            parts = addr_str.split("|")
            if len(parts) >= 3:
                houseno, direction, street = parts[0], parts[1], parts[2]
                print(f"Searching address: {houseno} {direction} {street}")
                results = search_by_address(opener, houseno, direction, street)
                print(f"  -> {len(results)} results")
                all_results.extend(results)
                time.sleep(args.delay)

    # Default: search a few sample addresses
    if not args.sample_pins and not args.sample_addresses:
        sample_addrs = [
            ("118", "N", "CLARK"),
            ("850", "N", "DEWITT"),
            ("100", "W", "RANDOLPH"),
        ]
        for houseno, direction, street in sample_addrs:
            print(f"Searching address: {houseno} {direction} {street}")
            results = search_by_address(opener, houseno, direction, street)
            print(f"  -> {len(results)} results")
            all_results.extend(results)
            time.sleep(args.delay)

    # Write results
    if all_results:
        output_path = output_dir / "bor_search_results.csv"
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                ["address", "pin", "year", "prop_no", "trunk_no", "seq_no", "result_id"]
            )
            for r in all_results:
                writer.writerow(
                    [
                        r.address,
                        r.pin,
                        r.year,
                        r.prop_no,
                        r.trunk_no,
                        r.seq_no,
                        r.result_id,
                    ]
                )
        print(f"Wrote {len(all_results)} results to {output_path}")
    else:
        print("No results found")


if __name__ == "__main__":
    main()
