import StaticContentPage from "@/components/content/StaticContentPage";

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedAboutPage({ params }: Props) {
  const { locale } = await params;
  return <StaticContentPage page="about" locale={locale} />;
}
