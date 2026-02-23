import { NextResponse } from "next/server";
import { DataSourceUnavailableError, getAddressByPin } from "@/lib/dataSource";
import type { AddressRecord } from "@/lib/mvpData";

type Params = {
  params: Promise<{ pin: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { pin } = await params;
  let row: AddressRecord | null;
  try {
    row = await getAddressByPin(pin);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    geosearch: { pin: row.pin },
    addrs: [
      {
        pin: row.pin,
        address: row.address,
        ownerName: row.ownerName,
        violationsOpen: row.violationsOpen,
        permitsTotal: row.permitsTotal,
        prop_address: row.address,
        owner_name: row.ownerName,
        violations_open: row.violationsOpen,
        permits_total: row.permitsTotal,
      },
    ],
  });
}
