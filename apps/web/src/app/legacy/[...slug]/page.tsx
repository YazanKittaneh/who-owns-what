import { notFound, redirect } from "next/navigation";
import { mapLegacySlugToModernPath } from "@/lib/routes";

type Props = { params: Promise<{ slug: string[] }> };

export default async function LegacyCatchAllPage({ params }: Props) {
  const { slug } = await params;
  const target = mapLegacySlugToModernPath(slug);
  if (!target) notFound();
  redirect(target);
}
