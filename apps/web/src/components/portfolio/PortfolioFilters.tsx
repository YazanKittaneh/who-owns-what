"use client";

import { useMemo, useState } from "react";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  rows: AddressRecord[];
};

export default function PortfolioFilters({ rows }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        row.address.toLowerCase().includes(q) ||
        row.pin.includes(q) ||
        row.ownerName.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <label htmlFor="portfolio-filter">Filter by address, owner, or PIN</label>
      <input
        id="portfolio-filter"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Start typing..."
        style={{ maxWidth: "24rem", padding: "0.6rem" }}
      />
      <p>Showing {filtered.length} of {rows.length} properties</p>
      <ul style={{ listStyle: "none", display: "grid", gap: "0.75rem", padding: 0 }}>
        {filtered.map((row) => (
          <li key={row.pin} style={{ border: "1px solid #ddd", padding: "0.8rem" }}>
            <p>{row.address}</p>
            <p>PIN: {row.pin}</p>
            <p>Open violations: {row.violationsOpen} | Permits: {row.permitsTotal}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
