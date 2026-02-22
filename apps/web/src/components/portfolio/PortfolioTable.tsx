import Link from "next/link";
import type { AddressRecord, PortfolioSummary } from "@/lib/mvpData";
import PortfolioFilters from "@/components/portfolio/PortfolioFilters";

type Props = {
  portfolioId: string;
  rows: AddressRecord[];
  summary: PortfolioSummary | null;
};

export default function PortfolioTable({ portfolioId, rows, summary }: Props) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h1>Portfolio: {portfolioId}</h1>
      <p>Properties in this MVP dataset: {rows.length}</p>
      {summary ? (
        <div style={{ border: "1px solid #ddd", padding: "0.75rem", display: "grid", gap: "0.25rem" }}>
          <p><strong>Owner:</strong> {summary.ownerName}</p>
          <p><strong>Total properties:</strong> {summary.pinCount}</p>
          <p><strong>Total open violations:</strong> {summary.totalViolationsOpen}</p>
          <p><strong>Total permits:</strong> {summary.totalPermits}</p>
        </div>
      ) : null}
      <PortfolioFilters rows={rows} />
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
