import AddressTabPage from "@/components/address/AddressTabPage";
import { isSupportedLocale } from "@/lib/routes";

type Props = {
  params: Promise<{ locale: string; pin: string; indicator?: string[] }>;
};

export default async function LocalizedAddressTimelinePage({ params }: Props) {
  const { locale, pin, indicator } = await params;
  return (
    <AddressTabPage
      pin={pin}
      tab="timeline"
      style="address"
      locale={isSupportedLocale(locale) ? locale : undefined}
      timelineIndicator={indicator?.[0]}
    />
  );
}
