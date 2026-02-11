from typing import TextIO
import json


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
    with conn.cursor() as cursor:
        cursor.execute(f"TRUNCATE {table}")
        cursor.execute(
            f"""
            INSERT INTO {table} (orig_id, pins, owner_names, graph)
            WITH latest_parcels AS (
                SELECT DISTINCT ON (pin)
                    *
                FROM chi_parcels
                ORDER BY
                    pin,
                    NULLIF(year, '')::int DESC NULLS LAST
            ),
            latest_owners AS (
                SELECT DISTINCT ON (pin)
                    *
                FROM chi_owners
                ORDER BY
                    pin,
                    NULLIF(year, '')::int DESC NULLS LAST
            )
            SELECT
                row_number() OVER (
                    ORDER BY coalesce(nullif(o.mail_address_name, ''), nullif(o.row_id, ''), p.pin)
                ) AS orig_id,
                array_agg(p.pin ORDER BY p.pin) AS pins,
                ARRAY[coalesce(nullif(o.mail_address_name, ''), nullif(o.row_id, ''), p.pin)] AS owner_names,
                '{{}}'::jsonb AS graph
            FROM latest_parcels AS p
            LEFT JOIN latest_owners AS o ON o.pin = p.pin
            GROUP BY coalesce(nullif(o.mail_address_name, ''), nullif(o.row_id, ''), p.pin)
            HAVING count(p.pin) > 0
            """
        )
