import { NextRequest, NextResponse } from "next/server";
import { searchAddresses } from "@/lib/mvpData";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = searchAddresses(q).map((row) => ({
    pin: row.pin,
    prop_address: row.address,
    owner_name: row.ownerName,
  }));

  return NextResponse.json({ result: results });
}
