import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  getAddressByPinFallback,
  getPortfolioByIdFallback,
  getPortfolioSummaryFallback,
  searchAddressesFallback,
  type AddressRecord,
  type PortfolioSummary,
} from "@/lib/mvpData";

const addressesSearchRef = makeFunctionReference<"query">("addresses:search");
const addressByPinRef = makeFunctionReference<"query">("addresses:getByPin");
const portfolioByIdRef = makeFunctionReference<"query">("portfolios:getById");
const portfolioSummaryRef = makeFunctionReference<"query">("portfolios:getSummary");

function getConvexUrl(): string {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
}

function getServerClient(): ConvexHttpClient | null {
  const convexUrl = getConvexUrl();
  if (!convexUrl) return null;

  const client = new ConvexHttpClient(convexUrl);
  return client;
}

export async function searchAddresses(query: string): Promise<AddressRecord[]> {
  const client = getServerClient();
  if (!client) {
    return searchAddressesFallback(query);
  }

  try {
    return (await client.query(addressesSearchRef, { query })) as AddressRecord[];
  } catch {
    return searchAddressesFallback(query);
  }
}

export async function getAddressByPin(pin: string): Promise<AddressRecord | null> {
  const client = getServerClient();
  if (!client) {
    return getAddressByPinFallback(pin);
  }

  try {
    const row = (await client.query(addressByPinRef, { pin })) as AddressRecord | null;
    return row ?? null;
  } catch {
    return getAddressByPinFallback(pin);
  }
}

export async function getPortfolioById(portfolioId: string): Promise<AddressRecord[]> {
  const client = getServerClient();
  if (!client) {
    return getPortfolioByIdFallback(portfolioId);
  }

  try {
    return (await client.query(portfolioByIdRef, { portfolioId })) as AddressRecord[];
  } catch {
    return getPortfolioByIdFallback(portfolioId);
  }
}

export async function getPortfolioSummary(
  portfolioId: string,
): Promise<PortfolioSummary | null> {
  const client = getServerClient();
  if (!client) {
    return getPortfolioSummaryFallback(portfolioId);
  }

  try {
    const row = (await client.query(portfolioSummaryRef, { portfolioId })) as PortfolioSummary | null;
    return row ?? getPortfolioSummaryFallback(portfolioId);
  } catch {
    return getPortfolioSummaryFallback(portfolioId);
  }
}
