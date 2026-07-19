#!/usr/bin/env python3
"""
Contact Data Ingestion for Illinois Secretary of State Records
Extracts entity identities and contact information from SOS corp/LLC records.
"""

import argparse
import csv
import json
import os
import re
import sys
import zipfile
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from csv_limits import set_max_csv_field_size_limit
from dbtool import DbContext
from load_audit import build_run_id, ensure_load_audit_table, record_load_audit

set_max_csv_field_size_limit()


@dataclass
class SOSEntity:
    """Represents an entity from SOS records."""

    file_number: str
    entity_name: str
    entity_type: str  # 'corporation', 'llc'
    status: str
    incorporation_date: Optional[str]
    registered_agent_name: Optional[str]
    registered_agent_address: Optional[str]
    principal_address: Optional[str]


class SOSContactExtractor:
    """Extracts contacts from Illinois SOS bulk records."""

    SOURCE_CORP = "il_sos_corporations"
    SOURCE_LLC = "il_sos_llc"

    def __init__(self, conn):
        self.conn = conn
        self.stats = {
            "corp_records_processed": 0,
            "llc_records_processed": 0,
            "entities_created": 0,
            "entities_matched": 0,
            "contacts_extracted": 0,
            "addresses_extracted": 0,
        }

    def normalize_name(self, name: str) -> str:
        """Normalize entity name for matching."""
        if not name:
            return ""
        name = re.sub(r"\s+", " ", name.strip()).lower()
        name = re.sub(r"[^a-z0-9\s]", "", name)
        return name

    def clean_address(self, address: str) -> Optional[str]:
        """Clean and validate address."""
        if not address:
            return None
        address = address.strip()
        if len(address) < 5:
            return None
        return address

    def process_corporation_record(self, row: Dict) -> Optional[SOSEntity]:
        """Process a corporation record from SOS master file."""
        file_number = row.get("File Number", "").strip()
        corp_name = row.get("Corporation Name", "").strip()

        if not file_number or not corp_name:
            return None

        self.stats["corp_records_processed"] += 1

        return SOSEntity(
            file_number=file_number,
            entity_name=corp_name,
            entity_type="corporation",
            status=row.get("Status", "").strip(),
            incorporation_date=row.get("Incorporation Date", "").strip() or None,
            registered_agent_name=None,  # From agents file
            registered_agent_address=None,  # From agents file
            principal_address=self.clean_address(row.get("Principal Address", "")),
        )

    def process_llc_record(self, row: Dict) -> Optional[SOSEntity]:
        """Process an LLC record from SOS master file."""
        file_number = row.get("File Number", "").strip()
        llc_name = row.get("LLC Name", "").strip()

        if not file_number or not llc_name:
            return None

        self.stats["llc_records_processed"] += 1

        return SOSEntity(
            file_number=file_number,
            entity_name=llc_name,
            entity_type="llc",
            status=row.get("Status", "").strip(),
            incorporation_date=row.get("File Date", "").strip() or None,
            registered_agent_name=None,
            registered_agent_address=None,
            principal_address=self.clean_address(row.get("Principal Address", "")),
        )

    def process_agent_record(self, row: Dict, entity_type: str) -> Dict:
        """Process an agent record to extract registered agent info."""
        file_number = row.get("File Number", "").strip()
        agent_name = row.get("Agent Name", row.get("Registered Agent", "")).strip()

        # Build address from components
        address_parts = []
        for key in ["Address 1", "Address 2", "City", "State", "Zip"]:
            val = row.get(key, "").strip()
            if val:
                address_parts.append(val)

        return {
            "file_number": file_number,
            "agent_name": agent_name,
            "agent_address": ", ".join(address_parts) if address_parts else None,
        }

    def ingest_sos_entities(self, data_dir: Path) -> None:
        """Ingest SOS entities from CSV files."""
        corp_master_path = data_dir / "corporations" / "corpmaster.csv"
        corp_agents_path = data_dir / "corporations" / "corpagents.csv"
        llc_master_path = data_dir / "llc" / "llcmaster.csv"
        llc_agents_path = data_dir / "llc" / "llcagents.csv"

        entities: Dict[str, SOSEntity] = {}
        agents: Dict[str, Dict] = {}

        # Load agents first
        print("Loading registered agents...")
        if corp_agents_path.exists():
            with corp_agents_path.open(
                "r", newline="", encoding="utf-8", errors="replace"
            ) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    agent = self.process_agent_record(row, "corporation")
                    agents[agent["file_number"]] = agent

        if llc_agents_path.exists():
            with llc_agents_path.open(
                "r", newline="", encoding="utf-8", errors="replace"
            ) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    agent = self.process_agent_record(row, "llc")
                    agents[agent["file_number"]] = agent

        print(f"Loaded {len(agents)} registered agents")

        # Load corporations
        print("Loading corporations...")
        if corp_master_path.exists():
            with corp_master_path.open(
                "r", newline="", encoding="utf-8", errors="replace"
            ) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    entity = self.process_corporation_record(row)
                    if entity:
                        # Add agent info if available
                        if entity.file_number in agents:
                            agent = agents[entity.file_number]
                            entity.registered_agent_name = agent["agent_name"]
                            entity.registered_agent_address = agent["agent_address"]
                        entities[entity.file_number] = entity

        # Load LLCs
        print("Loading LLCs...")
        if llc_master_path.exists():
            with llc_master_path.open(
                "r", newline="", encoding="utf-8", errors="replace"
            ) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    entity = self.process_llc_record(row)
                    if entity:
                        if entity.file_number in agents:
                            agent = agents[entity.file_number]
                            entity.registered_agent_name = agent["agent_name"]
                            entity.registered_agent_address = agent["agent_address"]
                        entities[entity.file_number] = entity

        print(f"Loaded {len(entities)} total entities")

        # Now ingest into database
        self.ingest_to_database(entities)

    def ingest_to_database(self, entities: Dict[str, SOSEntity]) -> None:
        """Ingest SOS entities into contact tables."""
        with self.conn.cursor() as cursor:
            for file_number, entity in entities.items():
                source_system = (
                    self.SOURCE_CORP
                    if entity.entity_type == "corporation"
                    else self.SOURCE_LLC
                )

                # Resolve or create canonical entity
                cursor.execute(
                    """
                    SELECT resolve_canonical_entity(%s, 'business', %s, TRUE)
                    """,
                    (entity.entity_name, source_system),
                )
                entity_id = cursor.fetchone()[0]

                if entity_id:
                    self.stats["entities_matched"] += 1

                    # Update entity with SOS-specific info
                    cursor.execute(
                        """
                        UPDATE canonical_entities
                        SET il_sos_file_number = %s
                        WHERE id = %s AND (il_sos_file_number IS NULL OR il_sos_file_number = %s)
                        """,
                        (file_number, entity_id, file_number),
                    )

                    # Add principal address as contact
                    if entity.principal_address:
                        cursor.execute(
                            """
                            SELECT link_contact_to_entity(
                                %s, 'mailing_address', %s, %s, %s, NULL, FALSE, %s
                            )
                            """,
                            (
                                entity_id,
                                entity.principal_address,
                                source_system,
                                file_number,
                                json.dumps(
                                    {
                                        "address_type": "principal",
                                        "sos_file_number": file_number,
                                        "entity_status": entity.status,
                                    }
                                ),
                            ),
                        )
                        self.stats["addresses_extracted"] += 1
                        self.stats["contacts_extracted"] += 1

                    # Add registered agent info if available
                    if entity.registered_agent_name and entity.registered_agent_address:
                        cursor.execute(
                            """
                            SELECT link_contact_to_entity(
                                %s, 'mailing_address', %s, %s, %s, NULL, FALSE, %s
                            )
                            """,
                            (
                                entity_id,
                                f"{entity.registered_agent_name} - {entity.registered_agent_address}",
                                source_system,
                                f"{file_number}_agent",
                                json.dumps(
                                    {
                                        "address_type": "registered_agent",
                                        "agent_name": entity.registered_agent_name,
                                        "sos_file_number": file_number,
                                    }
                                ),
                            ),
                        )
                        self.stats["addresses_extracted"] += 1
                        self.stats["contacts_extracted"] += 1

            self.conn.commit()

        print(
            f"Ingested {self.stats['entities_matched']} entities with {self.stats['contacts_extracted']} contacts"
        )

    def link_to_existing_entities(self) -> None:
        """Link SOS entities to existing canonical entities via name matching."""
        with self.conn.cursor() as cursor:
            cursor.execute(
                """
                WITH sos_matches AS (
                    SELECT 
                        ce.id as entity_id,
                        cbl.account_number,
                        cbl.legal_name,
                        similarity(ce.normalized_name, normalize_name(cbl.legal_name)) as sim
                    FROM canonical_entities ce
                    JOIN chi_business_licenses cbl 
                        ON ce.normalized_name % normalize_name(cbl.legal_name)
                    WHERE ce.il_sos_file_number IS NOT NULL
                      AND similarity(ce.normalized_name, normalize_name(cbl.legal_name)) > 0.8
                )
                SELECT entity_id, legal_name, sim FROM sos_matches
                LIMIT 1000
                """
            )

            matches = cursor.fetchall()
            print(f"Found {len(matches)} potential SOS-to-license matches")

            for match in matches:
                entity_id, legal_name, sim = match
                # Record as high-confidence alias
                cursor.execute(
                    """
                    INSERT INTO entity_aliases (entity_id, alias_name, normalized_alias, source_system, match_confidence)
                    VALUES (%s, %s, normalize_name(%s), 'il_sos_cross_match', %s)
                    ON CONFLICT (normalized_alias, source_system) DO UPDATE
                    SET match_confidence = GREATEST(entity_aliases.match_confidence, EXCLUDED.match_confidence)
                    """,
                    (entity_id, legal_name, legal_name, int(sim * 100)),
                )

            self.conn.commit()


def extract_sos_zip(zip_path: Path, extract_dir: Path) -> None:
    """Extract SOS ZIP files to a directory."""
    print(f"Extracting {zip_path}...")
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_dir)


def main():
    parser = argparse.ArgumentParser(
        description="Extract contacts from Illinois SOS records and link to entities."
    )
    parser.add_argument(
        "--data-dir",
        default="data/sos-bulk",
        help="Directory containing SOS bulk CSV files or ZIP files.",
    )
    parser.add_argument(
        "--link-existing",
        action="store_true",
        help="Link SOS entities to existing business license entities.",
    )
    args = parser.parse_args()

    root_dir = ROOT_DIR
    data_dir = (root_dir / args.data_dir).resolve()

    # Check for ZIP files and extract if needed
    zip_files = list(data_dir.glob("*.zip"))
    if zip_files:
        print(f"Found {len(zip_files)} ZIP files to extract")
        for zip_file in zip_files:
            extract_sos_zip(zip_file, data_dir)

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    db = DbContext.from_url(database_url)
    conn = db.connection()

    # Ensure contact tables exist
    sql_dir = root_dir / "sql"
    print("Ensuring contact tables exist...")
    with conn.cursor() as cursor:
        cursor.execute((sql_dir / "create_contact_tables.sql").read_text())
        cursor.execute((sql_dir / "create_contact_functions.sql").read_text())
    conn.commit()

    # Create load audit entry
    run_id = build_run_id("contact_ingest_sos")
    ensure_load_audit_table(conn)

    try:
        extractor = SOSContactExtractor(conn)
        extractor.ingest_sos_entities(data_dir)

        if args.link_existing:
            extractor.link_to_existing_entities()

        # Record success
        record_load_audit(
            conn,
            dataset_name="contact_ingest_sos",
            table_name="canonical_entities",
            row_count=extractor.stats["entities_matched"],
            source_ref=str(data_dir),
            run_id=run_id,
            status="success",
            details=extractor.stats,
        )

        print(f"\nSOS contact ingestion complete!")
        print(f"Stats: {json.dumps(extractor.stats, indent=2)}")

    except Exception as e:
        record_load_audit(
            conn,
            dataset_name="contact_ingest_sos",
            table_name="canonical_entities",
            row_count=0,
            source_ref=str(data_dir),
            run_id=run_id,
            status="failed",
            details={"error": str(e)},
        )
        raise


if __name__ == "__main__":
    main()
