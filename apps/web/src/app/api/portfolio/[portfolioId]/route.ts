import { NextResponse } from "next/server";
import { getPortfolioById, getPortfolioSummary } from "@/lib/dataSource";

type Params = {
  params: Promise<{ portfolioId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { portfolioId } = await params;
  const [rows, summary] = await Promise.all([
    getPortfolioById(portfolioId),
    getPortfolioSummary(portfolioId),
  ]);

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
