import AddressTabPage from "@/components/address/AddressTabPage";

type Props = {
  params: Promise<{ pin: string }>;
};

export default async function PinPortfolioPage({ params }: Props) {
  const { pin } = await params;
  return <AddressTabPage pin={pin} tab="portfolio" style="pin" />;
}
