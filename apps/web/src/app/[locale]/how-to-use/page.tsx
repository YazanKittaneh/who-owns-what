import StaticContentPage from "@/components/content/StaticContentPage";

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedHowToUsePage({ params }: Props) {
  const { locale } = await params;
  return <StaticContentPage page="how-to-use" locale={locale} />;
}
