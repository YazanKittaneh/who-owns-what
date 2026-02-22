export type AddressRecord = {
  pin: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
  portfolioId: string;
  violationsOpen: number;
  permitsTotal: number;
};

export const SAMPLE_ADDRESSES: AddressRecord[] = [
  {
    pin: "17062010120000",
    address: "1234 W Division St",
    city: "Chicago",
    state: "IL",
    zip: "60642",
    ownerName: "Division Property Group LLC",
    portfolioId: "pf-division-group",
    violationsOpen: 3,
    permitsTotal: 5,
  },
  {
    pin: "17062010130000",
    address: "1238 W Division St",
    city: "Chicago",
    state: "IL",
    zip: "60642",
    ownerName: "Division Property Group LLC",
    portfolioId: "pf-division-group",
    violationsOpen: 1,
    permitsTotal: 2,
  },
  {
    pin: "17071090050000",
    address: "4500 N Sheridan Rd",
    city: "Chicago",
    state: "IL",
    zip: "60640",
    ownerName: "Sheridan Portfolio Holdings",
    portfolioId: "pf-sheridan-holdings",
    violationsOpen: 7,
    permitsTotal: 8,
  },
];

export function searchAddresses(query: string): AddressRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return SAMPLE_ADDRESSES.filter((row) => {
    return (
      row.address.toLowerCase().includes(q) ||
      row.pin.includes(q) ||
      row.ownerName.toLowerCase().includes(q)
    );
  });
}

export function getAddressByPin(pin: string): AddressRecord | null {
  return SAMPLE_ADDRESSES.find((row) => row.pin === pin) ?? null;
}

export function getPortfolioById(portfolioId: string): AddressRecord[] {
  return SAMPLE_ADDRESSES.filter((row) => row.portfolioId === portfolioId);
}
