import { NextResponse } from "next/server";
import {
  DataSourceUnavailableError,
  getPortfolioById,
  getPortfolioSummary,
} from "@/lib/dataSource";
import type { AddressRecord, PortfolioSummary } from "@/lib/mvpData";

type Params = {
  params: Promise<{ portfolioId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { portfolioId } = await params;
  let rows: AddressRecord[];
  let summary: PortfolioSummary | null;
  try {
    [rows, summary] = await Promise.all([
      getPortfolioById(portfolioId),
      getPortfolioSummary(portfolioId),
    ]);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    portfolioId,
    summary,
    properties: rows.map((row) => ({
      pin: row.pin,
      prop_address: row.address,
      owner_name: row.ownerName,
      violations_open: row.violationsOpen,
      permits_total: row.permitsTotal,
    })),
  });
}
