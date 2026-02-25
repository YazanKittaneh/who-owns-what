import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, mapLegacySlugToModernPath } from "@/lib/routes";

type Props = { params: Promise<{ locale: string; slug: string[] }> };

export default async function LocaleLegacyCatchAllPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const target = mapLegacySlugToModernPath(slug, locale);
  if (!target) notFound();
  redirect(target);
}
