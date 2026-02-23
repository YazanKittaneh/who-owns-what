import { notFound } from "next/navigation";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import {
  DataSourceUnavailableError,
  getPortfolioById,
  getPortfolioSummary,
} from "@/lib/dataSource";
import type { AddressRecord, PortfolioSummary } from "@/lib/mvpData";

type Props = {
  params: Promise<{ portfolioId: string }>;
};

export default async function PortfolioPage({ params }: Props) {
  const { portfolioId } = await params;
  let rows: AddressRecord[] = [];
  let summary: PortfolioSummary | null = null;
  let dataError = "";

  try {
    [rows, summary] = await Promise.all([
      getPortfolioById(portfolioId),
      getPortfolioSummary(portfolioId),
    ]);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      dataError = error.message;
    } else {
      throw error;
    }
  }

  if (dataError) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Portfolio</h1>
        <p>{dataError}</p>
      </main>
    );
  }

  if (!rows.length) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem" }}>
      <PortfolioTable portfolioId={portfolioId} rows={rows} summary={summary} />
    </main>
  );
}
