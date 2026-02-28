import AddressTabPage from "@/components/address/AddressTabPage";
import { isSupportedLocale } from "@/lib/routes";

type Props = {
  params: Promise<{ locale: string; pin: string }>;
};

export default async function LocalizedAddressSummaryPage({ params }: Props) {
  const { locale, pin } = await params;
  return <AddressTabPage pin={pin} tab="summary" style="address" locale={isSupportedLocale(locale) ? locale : undefined} />;
}
