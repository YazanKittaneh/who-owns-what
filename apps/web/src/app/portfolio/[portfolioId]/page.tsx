import { notFound } from "next/navigation";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import { getPortfolioById, getPortfolioSummary } from "@/lib/dataSource";

type Props = {
  params: Promise<{ portfolioId: string }>;
};

export default async function PortfolioPage({ params }: Props) {
  const { portfolioId } = await params;
  const [rows, summary] = await Promise.all([
    getPortfolioById(portfolioId),
    getPortfolioSummary(portfolioId),
  ]);

  if (!rows.length) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem" }}>
      <PortfolioTable portfolioId={portfolioId} rows={rows} summary={summary} />
    </main>
  );
}
