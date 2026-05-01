import json
from datetime import datetime, timezone
from typing import Any


def build_run_id(prefix: str) -> str:
    return datetime.now(tz=timezone.utc).strftime(f"{prefix}-%Y%m%dT%H%M%SZ")


def ensure_load_audit_table(conn) -> None:
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS data_load_audit (
                    id bigserial PRIMARY KEY,
                    dataset_name text NOT NULL,
                    table_name text,
                    row_count bigint,
                    source_ref text,
                    run_id text,
                    status text NOT NULL DEFAULT 'success',
                    details jsonb,
                    loaded_at timestamptz NOT NULL DEFAULT now()
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_data_load_audit_dataset_loaded_at
                ON data_load_audit (dataset_name, loaded_at DESC)
                """
            )


def record_load_audit(
    conn,
    *,
    dataset_name: str,
    table_name: str | None,
    row_count: int,
    source_ref: str,
    run_id: str,
    status: str = "success",
    details: dict[str, Any] | None = None,
) -> None:
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO data_load_audit
                    (dataset_name, table_name, row_count, source_ref, run_id, status, details)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    dataset_name,
                    table_name,
                    row_count,
                    source_ref,
                    run_id,
                    status,
                    json.dumps(details) if details is not None else None,
                ),
            )
