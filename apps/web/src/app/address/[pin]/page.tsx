import { notFound } from "next/navigation";
import PropertySummary from "@/components/property/PropertySummary";
import { getAddressByPin } from "@/lib/mvpData";

type Props = {
  params: Promise<{ pin: string }>;
};

export default async function AddressPage({ params }: Props) {
  const { pin } = await params;
  const record = getAddressByPin(pin);

  if (!record) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem" }}>
      <PropertySummary record={record} />
    </main>
  );
}
