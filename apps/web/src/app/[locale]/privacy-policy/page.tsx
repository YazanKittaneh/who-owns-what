import StaticContentPage from "@/components/content/StaticContentPage";

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedPrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  return <StaticContentPage page="privacy-policy" locale={locale} />;
}
