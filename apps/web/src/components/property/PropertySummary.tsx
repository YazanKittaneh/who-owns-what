import Link from "next/link";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  record: AddressRecord;
};

export default function PropertySummary({ record }: Props) {
  return (
    <section style={{ display: "grid", gap: "0.5rem" }}>
      <h1>{record.address}</h1>
      <p>
        {record.city}, {record.state} {record.zip}
      </p>
      <p>PIN: {record.pin}</p>
      <p>Owner: {record.ownerName}</p>
      <p>Open violations: {record.violationsOpen}</p>
      <p>Total permits: {record.permitsTotal}</p>
      <Link href={`/portfolio/${record.portfolioId}`}>View associated portfolio</Link>
    </section>
  );
}
