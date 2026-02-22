import { notFound } from "next/navigation";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import { getPortfolioById } from "@/lib/dataSource";

type Props = {
  params: Promise<{ portfolioId: string }>;
};

export default async function PortfolioPage({ params }: Props) {
  const { portfolioId } = await params;
  const rows = await getPortfolioById(portfolioId);

  if (!rows.length) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem" }}>
      <PortfolioTable portfolioId={portfolioId} rows={rows} />
    </main>
  );
}
