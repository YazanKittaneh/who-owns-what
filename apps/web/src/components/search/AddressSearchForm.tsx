"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AddressSearchForm() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "36rem" }}>
      <label htmlFor="address-search">Search by address, owner, or PIN</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          id="address-search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. 1234 W Division St"
          style={{ flex: 1, padding: "0.6rem" }}
        />
        <button type="submit" style={{ padding: "0.6rem 1rem" }}>
          Search
        </button>
      </div>
    </form>
  );
}
