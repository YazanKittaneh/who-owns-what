import { NextRequest, NextResponse } from "next/server";
import { DataSourceUnavailableError, searchAddresses } from "@/lib/dataSource";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = (await searchAddresses(q)).map((row) => ({
      pin: row.pin,
      address: row.address,
      ownerName: row.ownerName,
      prop_address: row.address,
      owner_name: row.ownerName,
    }));

    return NextResponse.json({ result: results });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
