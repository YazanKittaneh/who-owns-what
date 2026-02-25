import ContentfulRichText from "@/components/content/ContentfulRichText";
import { getStaticPageDoc, type StaticPageKey } from "@/lib/content/staticPages";

type Props = {
  page: StaticPageKey;
  locale?: string;
};

export default function StaticContentPage({ page, locale }: Props) {
  const doc = getStaticPageDoc(page, locale);

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem", maxWidth: "56rem" }}>
      <h1>{doc.title}</h1>
      <div style={{ display: "grid", gap: "0.75rem", lineHeight: 1.5 }}>
        <ContentfulRichText node={doc.content} />
      </div>
    </main>
  );
}
