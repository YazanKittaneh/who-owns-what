#!/usr/bin/env python3
"""
Extract metadata from Woodstock XLSX files using only stdlib.
Uses incremental XML parsing for sharedStrings and regex chunking for sheet data.
"""
import argparse
import csv
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = (
    ROOT_DIR / "data" / "supplemental-20260331" / "housing" / "woodstock"
)
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data" / "supplemental-20260331" / "normalized"


@dataclass
class WorkbookMetadata:
    filename: str
    year: str
    sheet_name: str
    sheet_range: str
    row_count: int
    column_count: int
    headers: list[str]


def extract_shared_strings_iter(
    zf: zipfile.ZipFile, max_strings: int = 200
) -> list[str]:
    """Extract first N shared strings incrementally."""
    try:
        with zf.open("xl/sharedStrings.xml") as f:
            strings = []
            for event, elem in ET.iterparse(f, events=("end",)):
                if elem.tag.endswith("}si"):
                    t_elem = elem.find(
                        ".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                    )
                    strings.append(
                        t_elem.text if t_elem is not None and t_elem.text else ""
                    )
                    elem.clear()
                    if len(strings) >= max_strings:
                        break
            return strings
    except (KeyError, ET.ParseError) as e:
        print(f"Error parsing shared strings: {e}")
        return []


def get_sheet_names(zf: zipfile.ZipFile) -> list[str]:
    """Extract sheet names from xl/workbook.xml."""
    with zf.open("xl/workbook.xml") as f:
        tree = ET.parse(f)

    root = tree.getroot()
    sheets = []
    for sheet in root.findall(
        ".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"
    ):
        name = sheet.get("name")
        if name:
            sheets.append(name)
    return sheets


def get_sheet_info(zf: zipfile.ZipFile) -> tuple[str, int, int]:
    """
    Get dimension, row count, and column count from sheet1.xml.
    Uses regex chunking for speed with large files.
    """
    try:
        dimension = ""
        max_row = 0
        max_col = 0

        with zf.open("xl/worksheets/sheet1.xml") as f:
            # Read first chunk for dimension
            first_chunk = f.read(4096).decode("utf-8", errors="ignore")
            dim_match = re.search(r'dimension ref="([^"]+)"', first_chunk)
            if dim_match:
                dimension = dim_match.group(1)
                # Parse dimension for column count
                if ":" in dimension:
                    _, end_ref = dimension.split(":")
                    # Parse column letter
                    col_str = ""
                    for c in end_ref:
                        if c.isalpha():
                            col_str += c
                        else:
                            break
                    max_col = 0
                    for c in col_str.upper():
                        max_col = max_col * 26 + (ord(c) - ord("A") + 1)

            # Count rows using regex
            chunk_size = 1024 * 1024  # 1MB chunks
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="ignore")
                rows = re.findall(r'\u003crow r="(\d+)"', text)
                for r in rows:
                    max_row = max(max_row, int(r))

        return dimension, max_row, max_col
    except (KeyError, Exception) as e:
        print(f"Error parsing sheet: {e}")
        return "", 0, 0


def parse_cell_ref(ref: str) -> tuple[int, int]:
    """Parse Excel cell reference like 'A1' to (col, row)."""
    col_str = ""
    row_str = ""
    for c in ref:
        if c.isalpha():
            col_str += c
        else:
            row_str += c

    col = 0
    for c in col_str.upper():
        col = col * 26 + (ord(c) - ord("A") + 1)
    row = int(row_str) if row_str else 0
    return col, row


def extract_headers(zf: zipfile.ZipFile, shared_strings: list[str]) -> list[str]:
    """Extract header row (row 1) from sheet1.xml by reading just the header section."""
    try:
        with zf.open("xl/worksheets/sheet1.xml") as f:
            # Read in chunks until we find the end of row 1
            content = b""
            chunk_size = 65536  # 64KB chunks
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                content += chunk
                # Check if we have complete row 1
                if b"/row>" in content and b'row r="1"' in content:
                    text = content.decode("utf-8", errors="ignore")
                    if "</row>" in text and 'row r="1"' in text:
                        break
                # Safety limit
                if len(content) > 512000:
                    break

        text = content.decode("utf-8", errors="ignore")

        # Find row 1 content
        row1_match = re.search(
            r'\u003crow r="1"[^\u003e]*\u003e(.*?)\u003c/row\u003e', text, re.DOTALL
        )
        if not row1_match:
            return []

        row1_content = row1_match.group(1)
        headers = {}

        # Find all cells in row 1 with string type
        for cell_match in re.finditer(
            r'\u003cc r="([A-Z]+\d+)"[^\u003e]*t="s"[^\u003e]*\u003e\s*\u003cv\u003e(\d+)\u003c/v\u003e',
            row1_content,
        ):
            cell_ref = cell_match.group(1)
            str_idx = int(cell_match.group(2))
            if str_idx < len(shared_strings):
                col, _ = parse_cell_ref(cell_ref)
                headers[col] = shared_strings[str_idx]

        return [headers[k] for k in sorted(headers.keys())]
    except (KeyError, Exception) as e:
        print(f"Error extracting headers: {e}")
        return []


def analyze_workbook(filepath: Path) -> WorkbookMetadata | None:
    """Analyze a single XLSX file and return metadata."""
    filename = filepath.name

    # Extract year from filename (e.g., illinois_mortgage_2024.xlsx)
    year_match = re.search(r"(\d{4})", filename)
    year = year_match.group(1) if year_match else "unknown"

    try:
        with zipfile.ZipFile(filepath, "r") as zf:
            sheets = get_sheet_names(zf)
            if not sheets:
                print(f"Warning: No sheets found in {filename}")
                return None

            sheet_name = sheets[0]
            # Get enough shared strings to cover header row
            shared_strings = extract_shared_strings_iter(zf, max_strings=200)
            dimension, row_count, col_count = get_sheet_info(zf)
            headers = extract_headers(zf, shared_strings)

            return WorkbookMetadata(
                filename=filename,
                year=year,
                sheet_name=sheet_name,
                sheet_range=dimension,
                row_count=row_count,
                column_count=col_count,
                headers=headers,
            )
    except Exception as e:
        print(f"Error processing {filename}: {e}")
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract metadata from Woodstock XLSX files."
    )
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    xlsx_files = sorted(input_dir.glob("*.xlsx"))
    if not xlsx_files:
        print(f"No .xlsx files found in {input_dir}")
        return

    print(f"Found {len(xlsx_files)} workbooks")

    metadata_list = []
    for filepath in xlsx_files:
        print(f"Analyzing {filepath.name}...")
        meta = analyze_workbook(filepath)
        if meta:
            metadata_list.append(meta)
            print(
                f"  -> {meta.row_count:,} rows, {meta.column_count} cols, {len(meta.headers)} headers"
            )

    # Write metadata JSON
    json_path = output_dir / "woodstock_metadata.json"
    with json_path.open("w", encoding="utf-8") as f:
        json.dump([asdict(m) for m in metadata_list], f, indent=2)
    print(f"Wrote metadata JSON: {json_path}")

    # Write headers CSV for reference
    csv_path = output_dir / "woodstock_headers.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "year", "header"])
        for meta in metadata_list:
            for header in meta.headers:
                writer.writerow([meta.filename, meta.year, header])
    print(f"Wrote headers CSV: {csv_path}")

    # Write summary
    summary_path = output_dir / "woodstock_summary.txt"
    with summary_path.open("w", encoding="utf-8") as f:
        f.write("Woodstock Workbook Summary\n")
        f.write("=" * 50 + "\n\n")
        for meta in metadata_list:
            f.write(f"{meta.filename} ({meta.year})\n")
            f.write(f"  Sheet: {meta.sheet_name}\n")
            f.write(f"  Range: {meta.sheet_range}\n")
            f.write(f"  Rows: {meta.row_count:,}\n")
            f.write(f"  Columns: {meta.column_count}\n")
            f.write(f"  Headers: {len(meta.headers)}\n")
            f.write("\n")
    print(f"Wrote summary: {summary_path}")


if __name__ == "__main__":
    main()
