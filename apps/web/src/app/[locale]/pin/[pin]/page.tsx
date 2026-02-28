import AddressTabPage from "@/components/address/AddressTabPage";
import { isSupportedLocale } from "@/lib/routes";

type Props = {
  params: Promise<{ locale: string; pin: string }>;
};

export default async function LocalizedPinOverviewPage({ params }: Props) {
  const { locale, pin } = await params;
  return <AddressTabPage pin={pin} tab="overview" style="pin" locale={isSupportedLocale(locale) ? locale : undefined} />;
}
