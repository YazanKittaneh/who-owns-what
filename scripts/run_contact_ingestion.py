#!/usr/bin/env python3
"""
Master script to run the complete contact data ingestion workflow.
Orchestrates the extraction and linking of contact data from multiple sources.
"""

import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext


def run_command(cmd: list, description: str) -> bool:
    """Run a command and return success status."""
    import subprocess
    
    print(f"\n{'='*60}")
    print(f"Step: {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        if result.stderr:
            print("Stderr:", result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Command failed with exit code {e.returncode}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False


def table_has_rows(database_url: str, table_name: str) -> bool:
    db = DbContext.from_url(database_url)
    conn = db.connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT to_regclass(%s)", [table_name])
            if cursor.fetchone()[0] is None:
                return False
            cursor.execute(f"SELECT EXISTS (SELECT 1 FROM {table_name} LIMIT 1)")
            return bool(cursor.fetchone()[0])
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Run the complete contact data ingestion workflow."
    )
    parser.add_argument(
        "--skip-business-licenses",
        action="store_true",
        help="Skip business license contact extraction."
    )
    parser.add_argument(
        "--skip-building-permits",
        action="store_true",
        help="Skip building permit contact extraction."
    )
    parser.add_argument(
        "--skip-sos",
        action="store_true",
        help="Skip SOS contact extraction."
    )
    parser.add_argument(
        "--skip-foreclosed-rental",
        action="store_true",
        help="Skip foreclosed rental contact extraction."
    )
    parser.add_argument(
        "--link-parcels",
        action="store_true",
        default=True,
        help="Link entities to parcels via address matching."
    )
    parser.add_argument(
        "--recalculate-confidence",
        action="store_true",
        help="Recalculate all confidence scores after ingestion."
    )
    args = parser.parse_args()
    
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")
    
    print("Starting contact data ingestion workflow...")
    print(f"Working directory: {ROOT_DIR}")
    
    steps_completed = 0
    steps_failed = 0
    
    # Step 1: Extract business license contacts
    if not args.skip_business_licenses:
        if run_command(
            [
                sys.executable,
                "scripts/extract_business_license_contacts.py",
                "--data-dir", "data/supplemental-20260329",
            ] + (["--link-parcels"] if args.link_parcels else []),
            "Extract contacts from Chicago Business Licenses"
        ):
            steps_completed += 1
        else:
            steps_failed += 1
            print("WARNING: Business license extraction failed, continuing...")

    # Step 2: Extract building permit contact-adjacent entities
    if not args.skip_building_permits:
        if table_has_rows(database_url, "chi_permits"):
            if run_command(
                [
                    sys.executable,
                    "scripts/extract_building_permit_contacts.py",
                ] + (["--link-parcels"] if args.link_parcels else []),
                "Extract permit contact-adjacent entities"
            ):
                steps_completed += 1
            else:
                steps_failed += 1
                print("WARNING: Building permit extraction failed, continuing...")
        else:
            print("Skipping building permit extraction (table missing or empty: chi_permits)")

    # Step 3: Extract foreclosed rental contacts
    if not args.skip_foreclosed_rental:
        if table_has_rows(database_url, "chi_foreclosed_rental_properties"):
            if run_command(
                [
                    sys.executable,
                    "scripts/extract_foreclosed_rental_contacts.py",
                ] + (["--link-parcels"] if args.link_parcels else []),
                "Extract contacts from foreclosed rental registrations"
            ):
                steps_completed += 1
            else:
                steps_failed += 1
                print("WARNING: Foreclosed rental extraction failed, continuing...")
        else:
            print("Skipping foreclosed rental extraction (table missing or empty: chi_foreclosed_rental_properties)")

    # Step 4: Extract SOS contacts
    if not args.skip_sos:
        sos_data_dir = ROOT_DIR / "data" / "sos-bulk"
        if sos_data_dir.exists():
            if run_command(
                [
                    sys.executable,
                    "scripts/extract_sos_contacts.py",
                    "--data-dir", "data/sos-bulk",
                    "--link-existing",
                ],
                "Extract contacts from Illinois SOS records"
            ):
                steps_completed += 1
            else:
                steps_failed += 1
                print("WARNING: SOS extraction failed, continuing...")
        else:
            print(f"Skipping SOS extraction (data directory not found: {sos_data_dir})")
    
    # Step 5: Recalculate confidence scores if requested
    if args.recalculate_confidence:
        print(f"\n{'='*60}")
        print("Step: Recalculate confidence scores")
        print(f"{'='*60}")
        
        db = DbContext.from_url(database_url)
        conn = db.connection()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT recalculate_all_confidence_scores()")
                count = cursor.fetchone()[0]
                conn.commit()
                print(f"Recalculated confidence scores for {count} contacts")
                steps_completed += 1
        except Exception as e:
            print(f"ERROR: Failed to recalculate confidence scores: {e}")
            steps_failed += 1
    
    # Step 6: Print summary
    print(f"\n{'='*60}")
    print("WORKFLOW COMPLETE")
    print(f"{'='*60}")
    print(f"Steps completed: {steps_completed}")
    print(f"Steps failed: {steps_failed}")
    
    # Get final stats
    try:
        db = DbContext.from_url(database_url)
        conn = db.connection()
        
        with conn.cursor() as cursor:
            cursor.execute("SELECT to_regclass('canonical_entities')")
            if cursor.fetchone()[0]:
                cursor.execute("SELECT * FROM get_contact_coverage_stats()")
                stats = cursor.fetchone()
                
                print(f"\nCurrent contact coverage:")
                print(f"  - Total entities: {stats[0]:,}")
                print(f"  - With phone: {stats[1]:,}")
                print(f"  - With email: {stats[2]:,}")
                print(f"  - With address: {stats[3]:,}")
                print(f"  - Avg confidence: {stats[4]:.1f}%")
                print(f"  - High confidence: {stats[5]:,}")
    except Exception as e:
        print(f"Could not retrieve final stats: {e}")
    
    print("\nNext steps:")
    print("  - Verify data quality with: curl http://localhost:8000/api/admin/contact-coverage")
    print("  - Search entities: curl 'http://localhost:8000/api/entity/search?q=example'")
    print("  - Get entity contacts: curl 'http://localhost:8000/api/entity/contacts?entity_id=1'")
    
    return 0 if steps_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
