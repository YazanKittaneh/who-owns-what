from typing import Any, List, TextIO, Tuple
import json

from psycopg2.extras import Json, execute_values

from .chicago import build_owner_row, build_portfolio_groups


# Selects the latest-year owner record for every latest-year parcel pin,
# mirroring the DISTINCT ON pattern used in sql/create_parcels_table.sql.
_LATEST_OWNER_ROWS_SQL = """
    WITH latest_parcels AS (
        SELECT DISTINCT ON (pin)
            pin
        FROM chi_parcels
        ORDER BY
            pin,
            NULLIF(regexp_replace(year::text, '\\.0+$', ''), '')::int DESC NULLS LAST
    ),
    latest_owners AS (
        SELECT DISTINCT ON (pin)
            pin,
            mail_address_name,
            mail_address_full,
            mail_address_city_name,
            mail_address_state,
            mail_address_zipcode_1,
            row_id
        FROM chi_owners
        ORDER BY
            pin,
            NULLIF(regexp_replace(year::text, '\\.0+$', ''), '')::int DESC NULLS LAST
    )
    SELECT
        p.pin,
        o.mail_address_name,
        o.mail_address_full,
        o.mail_address_city_name,
        o.mail_address_state,
        o.mail_address_zipcode_1,
        o.row_id
    FROM latest_parcels AS p
    LEFT JOIN latest_owners AS o ON o.pin = p.pin
"""


def export_portfolios_table_json(conn, outfile: TextIO):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT orig_id, pins, owner_names, graph
            FROM wow_portfolios
            ORDER BY orig_id
            """
        )
        rows = cursor.fetchall()

    outfile.write("[\n")
    for idx, (orig_id, pins, owner_names, graph) in enumerate(rows):
        if idx > 0:
            outfile.write(",\n")
        outfile.write(
            json.dumps(
                {
                    "orig_id": orig_id,
                    "pins": pins,
                    "owner_names": owner_names,
                    "portfolio": graph,
                }
            )
        )
    outfile.write("\n]\n")


def populate_portfolios_table(conn, table="wow_portfolios"):
    """Rebuild ``wow_portfolios`` using the Chicago normalization/graph engine.

    Reads the latest-year owner record for every parcel, groups parcels into
    portfolios in Python (see :mod:`portfoliograph.chicago`), then TRUNCATEs and
    batch-inserts the result. Runs within the caller's transaction.
    """
    # Read all latest owner rows and normalize them into engine inputs. A
    # server-side (named) cursor streams the (potentially hundreds of thousands
    # of) rows without loading them all into libpq at once.
    owner_rows = []
    read_cursor = conn.cursor(name="chi_latest_owner_rows")
    read_cursor.itersize = 50000
    try:
        read_cursor.execute(_LATEST_OWNER_ROWS_SQL)
        for (
            pin,
            mail_address_name,
            mail_address_full,
            mail_address_city_name,
            mail_address_state,
            mail_address_zipcode_1,
            row_id,
        ) in read_cursor:
            owner_rows.append(
                build_owner_row(
                    pin,
                    mail_address_name,
                    mail_address_full,
                    mail_address_city_name,
                    mail_address_state,
                    mail_address_zipcode_1,
                    row_id,
                )
            )
    finally:
        read_cursor.close()

    groups = build_portfolio_groups(owner_rows)

    # Plain tuples keep the insert payload compact for large portfolios.
    insert_rows: List[Tuple[Any, ...]] = [
        (orig_id, group.pins, group.owner_names, Json(group.graph))
        for orig_id, group in enumerate(groups, start=1)
    ]

    with conn.cursor() as cursor:
        cursor.execute(f"TRUNCATE {table}")
        if insert_rows:
            execute_values(
                cursor,
                f"""
                INSERT INTO {table} (orig_id, pins, owner_names, graph)
                VALUES %s
                """,
                insert_rows,
                page_size=1000,
            )
