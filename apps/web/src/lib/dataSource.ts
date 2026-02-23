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

export class DataSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceUnavailableError";
  }
}

function getConvexUrl(): string {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
}

function isSampleDataAllowed(): boolean {
  return process.env.WOW_ALLOW_SAMPLE_DATA === "1";
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
    if (isSampleDataAllowed()) {
      return searchAddressesFallback(query);
    }
    throw new DataSourceUnavailableError(
      "Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.",
    );
  }

  try {
    return (await client.query(addressesSearchRef, { query })) as AddressRecord[];
  } catch (error) {
    if (isSampleDataAllowed()) {
      return searchAddressesFallback(query);
    }
    throw new DataSourceUnavailableError(
      `Failed to query Convex for address search: ${String(error)}`,
    );
  }
}

export async function getAddressByPin(pin: string): Promise<AddressRecord | null> {
  const client = getServerClient();
  if (!client) {
    if (isSampleDataAllowed()) {
      return getAddressByPinFallback(pin);
    }
    throw new DataSourceUnavailableError(
      "Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.",
    );
  }

  try {
    const row = (await client.query(addressByPinRef, { pin })) as AddressRecord | null;
    return row ?? null;
  } catch (error) {
    if (isSampleDataAllowed()) {
      return getAddressByPinFallback(pin);
    }
    throw new DataSourceUnavailableError(
      `Failed to query Convex for address lookup: ${String(error)}`,
    );
  }
}

export async function getPortfolioById(portfolioId: string): Promise<AddressRecord[]> {
  const client = getServerClient();
  if (!client) {
    if (isSampleDataAllowed()) {
      return getPortfolioByIdFallback(portfolioId);
    }
    throw new DataSourceUnavailableError(
      "Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.",
    );
  }

  try {
    return (await client.query(portfolioByIdRef, { portfolioId })) as AddressRecord[];
  } catch (error) {
    if (isSampleDataAllowed()) {
      return getPortfolioByIdFallback(portfolioId);
    }
    throw new DataSourceUnavailableError(
      `Failed to query Convex for portfolio rows: ${String(error)}`,
    );
  }
}

export async function getPortfolioSummary(
  portfolioId: string,
): Promise<PortfolioSummary | null> {
  const client = getServerClient();
  if (!client) {
    if (isSampleDataAllowed()) {
      return getPortfolioSummaryFallback(portfolioId);
    }
    throw new DataSourceUnavailableError(
      "Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.",
    );
  }

  try {
    const row = (await client.query(portfolioSummaryRef, { portfolioId })) as PortfolioSummary | null;
    if (!row && isSampleDataAllowed()) {
      return getPortfolioSummaryFallback(portfolioId);
    }
    return row;
  } catch (error) {
    if (isSampleDataAllowed()) {
      return getPortfolioSummaryFallback(portfolioId);
    }
    throw new DataSourceUnavailableError(
      `Failed to query Convex for portfolio summary: ${String(error)}`,
    );
  }
}
