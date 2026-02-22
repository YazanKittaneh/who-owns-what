import Link from "next/link";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  query: string;
  results: AddressRecord[];
};

export default function SearchResults({ query, results }: Props) {
  if (!results.length) {
    return <p>No records found for &quot;{query}&quot;.</p>;
  }

  return (
    <ul style={{ listStyle: "none", display: "grid", gap: "0.75rem", padding: 0 }}>
      {results.map((row) => (
        <li key={row.pin} style={{ border: "1px solid #ddd", padding: "1rem" }}>
          <p>
            <strong>{row.address}</strong>
          </p>
          <p>
            {row.city}, {row.state} {row.zip}
          </p>
          <p>PIN: {row.pin}</p>
          <p>Owner: {row.ownerName}</p>
          <Link href={`/address/${row.pin}`}>Open property details</Link>
        </li>
      ))}
    </ul>
  );
}
