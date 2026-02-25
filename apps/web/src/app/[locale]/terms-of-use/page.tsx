import StaticContentPage from "@/components/content/StaticContentPage";

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedTermsOfUsePage({ params }: Props) {
  const { locale } = await params;
  return <StaticContentPage page="terms-of-use" locale={locale} />;
}
