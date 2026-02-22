import Link from "next/link";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  portfolioId: string;
  rows: AddressRecord[];
};

export default function PortfolioTable({ portfolioId, rows }: Props) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h1>Portfolio: {portfolioId}</h1>
      <p>Properties in this MVP dataset: {rows.length}</p>
      <ul style={{ listStyle: "none", display: "grid", gap: "0.75rem", padding: 0 }}>
        {rows.map((row) => (
          <li key={row.pin} style={{ border: "1px solid #ddd", padding: "0.8rem" }}>
            <p>{row.address}</p>
            <p>PIN: {row.pin}</p>
            <Link href={`/address/${row.pin}`}>Open property</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
