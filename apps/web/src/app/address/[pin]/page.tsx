import { notFound } from "next/navigation";
import PropertySummary from "@/components/property/PropertySummary";
import { DataSourceUnavailableError, getAddressByPin } from "@/lib/dataSource";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  params: Promise<{ pin: string }>;
};

export default async function AddressPage({ params }: Props) {
  const { pin } = await params;
  let record: AddressRecord | null = null;
  let dataError = "";

  try {
    record = await getAddressByPin(pin);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      dataError = error.message;
    } else {
      throw error;
    }
  }

  if (dataError) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Property Details</h1>
        <p>{dataError}</p>
      </main>
    );
  }

  if (!record) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem" }}>
      <PropertySummary record={record} />
    </main>
  );
}
