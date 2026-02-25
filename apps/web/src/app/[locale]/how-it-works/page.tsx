import StaticContentPage from "@/components/content/StaticContentPage";

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedHowItWorksPage({ params }: Props) {
  const { locale } = await params;
  return <StaticContentPage page="how-it-works" locale={locale} />;
}
