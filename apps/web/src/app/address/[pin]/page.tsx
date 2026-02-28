import AddressTabPage from "@/components/address/AddressTabPage";

type Props = {
  params: Promise<{ pin: string }>;
};

export default async function AddressPage({ params }: Props) {
  const { pin } = await params;
  return <AddressTabPage pin={pin} tab="overview" style="address" />;
}
