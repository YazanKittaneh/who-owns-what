import AddressTabPage from "@/components/address/AddressTabPage";

type Props = {
  params: Promise<{ pin: string; indicator?: string[] }>;
};

export default async function AddressTimelinePage({ params }: Props) {
  const { pin, indicator } = await params;
  return (
    <AddressTabPage
      pin={pin}
      tab="timeline"
      style="address"
      timelineIndicator={indicator?.[0]}
    />
  );
}
