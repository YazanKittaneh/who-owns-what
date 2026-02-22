import { NextResponse } from "next/server";
import { getAddressByPin } from "@/lib/dataSource";

type Params = {
  params: Promise<{ pin: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { pin } = await params;
  const row = await getAddressByPin(pin);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    geosearch: { pin: row.pin },
    addrs: [
      {
        pin: row.pin,
        prop_address: row.address,
        owner_name: row.ownerName,
        violations_open: row.violationsOpen,
        permits_total: row.permitsTotal,
      },
    ],
  });
}
