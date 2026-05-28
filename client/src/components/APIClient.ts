import {
  SearchResults,
  BuildingInfoResults,
  IndicatorsHistoryResults,
  OverviewMapResults,
  NearbyPropertiesResults,
  OwnerProfileResults,
  OwnerAreaSearchResults,
  BusinessLinkageResults,
  AdminCoverageResults,
  AdminDataCoverageResults,
  AdminContactCoverageResults,
} from "./APIDataTypes";
import { SearchAddress } from "./AddressSearch";
import { NetworkError, HTTPError } from "error-reporting";
import {
  indicatorsInitialDataStructure,
  IndicatorsHistoryData,
  IndicatorsData,
  IndicatorTimelineMode,
  IndicatorsDatasetId,
  nycIndicatorsDatasetIds,
  standardIndicatorsDatasetIds,
  ihsIndicatorsDatasetIds,
} from "./IndicatorsTypes";

export interface EntitySearchResult {
  entity_id: number;
  entity_type: string;
  name: string;
  match_score: number;
  parcel_count: number;
}

export interface EntityContact {
  type: string;
  value: string;
  confidence: number;
  source: string;
  is_primary: boolean;
  is_verified: boolean;
  first_seen?: string;
  last_seen?: string;
}

export interface EntityContactsResult {
  entity: {
    id: number;
    type: string;
    name: string;
    parcel_count: number;
  };
  contacts: EntityContact[];
  min_confidence: number;
}

export interface ParcelEntity {
  entity_id: number;
  entity_type: string;
  name: string;
  mapping_confidence: number;
  owner_name_at_time: string | null;
  contacts: EntityContact[];
}

export interface ParcelEntitiesResult {
  pin: string;
  entities: ParcelEntity[];
  nearby?: {
    radius_m: number;
    owners: Array<{
      owner_key: string;
      owner_id?: string | null;
      owner_name?: string | null;
      mailing_address?: string | null;
      mailing_city?: string | null;
      mailing_state?: string | null;
      mailing_zip?: string | null;
      parcel_count: number;
      nearest_distance_m?: number | null;
      same_owner: boolean;
      parcels: Array<{ pin: string; address?: string | null; distance_m?: number | null }>;
      contacts: EntityContact[];
    }>;
    parcels: Array<{
      pin: string;
      address?: string | null;
      owner_id?: string | null;
      owner_name?: string | null;
      mailing_address?: string | null;
      mailing_city?: string | null;
      mailing_state?: string | null;
      mailing_zip?: string | null;
      distance_m?: number | null;
      same_owner?: boolean;
      contacts: EntityContact[];
    }>;
  };
}

function searchForAddress(searchAddress: SearchAddress): Promise<SearchResults> {
  if (!searchAddress.pin) {
    return Promise.resolve({ addrs: [], geosearch: undefined });
  }
  return getApiJson(`/api/address?pin=${encodeURIComponent(searchAddress.pin)}`);
}

function getBuildingInfo(pin: string): Promise<BuildingInfoResults> {
  return getApiJson(`/api/address/buildinginfo?pin=${encodeURIComponent(pin)}`);
}

function getPortfolioByPin(pin: string): Promise<SearchResults> {
  return searchForAddress({ pin, housenumber: "", streetname: "", city: "", state: "", zip: "" });
}

function getOverviewMapProperties(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
  limit?: number;
}): Promise<OverviewMapResults> {
  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  });
  if (bounds.limit) {
    params.set("limit", String(bounds.limit));
  }
  return getApiJson(`/api/address/overview-map?${params.toString()}`);
}

function getNearbyProperties(
  pin: string,
  radiusM = 200,
  limit = 25
): Promise<NearbyPropertiesResults> {
  const params = new URLSearchParams({
    pin,
    radius_m: String(radiusM),
    limit: String(limit),
  });
  return getApiJson(`/api/address/nearby?${params.toString()}`);
}

function getCurrentOwnerProfile(
  ownerType: "id" | "name",
  ownerKey: string
): Promise<OwnerProfileResults> {
  const params = new URLSearchParams(
    ownerType === "id" ? { owner_id: ownerKey } : { owner_name: ownerKey }
  );
  return getApiJson(`/api/owner/current?${params.toString()}`);
}

function searchOwnersByArea(args: {
  pin: string;
  radiusM?: number;
  buildingTypes?: string[];
  minParcels?: number;
  maxParcels?: number | null;
  limit?: number;
}): Promise<OwnerAreaSearchResults> {
  const params = new URLSearchParams({
    pin: args.pin,
    radius_m: String(args.radiusM ?? 600),
    min_parcels: String(args.minParcels ?? 1),
    limit: String(args.limit ?? 100),
  });

  if (args.maxParcels != null) {
    params.set("max_parcels", String(args.maxParcels));
  }

  if (args.buildingTypes && args.buildingTypes.length > 0) {
    params.set("building_types", args.buildingTypes.join(","));
  }

  return getApiJson(`/api/owner/search-by-area?${params.toString()}`);
}

function getBusinessLinkage(pin: string): Promise<BusinessLinkageResults> {
  const params = new URLSearchParams({ pin });
  return getApiJson(`/api/business-linkage?${params.toString()}`);
}

const indicatorColumns: Record<IndicatorsDatasetId, string[]> = {
  hpdcomplaints: ["emergency", "nonemergency", "total"],
  hpdviolations: ["class_a", "class_b", "class_c", "class_i", "total"],
  dobpermits: ["total"],
  dobviolations: ["regular", "ecb", "total"],
  evictionfilings: ["total"],
  rentstabilizedunits: ["total"],
  show_all: ["permits", "violations", "service_requests", "total"],
  permits: ["total"],
  violations: ["total"],
  service_requests: ["total"],
  ihs_sales: ["total"],
  ihs_foreclosures: ["total"],
  ihs_mortgages: ["total"],
  ihs_auctions: ["total"],
  ihs_business_buyers: ["total"],
};

const detectTimelineMode = (schemaHint: unknown, rawJson: any[]): IndicatorTimelineMode => {
  if (schemaHint === "nyc" || schemaHint === "standard") return schemaHint;
  const row = rawJson[0] || {};
  return Object.prototype.hasOwnProperty.call(row, "hpdcomplaints_total") ||
    Object.prototype.hasOwnProperty.call(row, "hpdviolations_total")
    ? "nyc"
    : "standard";
};

function createVizData(rawJson: any[], dataset: IndicatorsDatasetId): IndicatorsData {
  const vizData: IndicatorsData = {
    ...indicatorsInitialDataStructure[dataset],
    labels: [],
    values: { total: [] },
  };

  indicatorColumns[dataset].forEach((column) => {
    vizData.values[column] = [];
  });

  rawJson.forEach((row) => {
    vizData.labels?.push(row.month);
    if (dataset === "show_all") {
      const permits = parseInt(row.permits_total, 10) || 0;
      const violations = parseInt(row.violations_total, 10) || 0;
      const serviceRequests = parseInt(row.service_requests_total, 10) || 0;
      (vizData.values.permits as number[]).push(permits);
      (vizData.values.violations as number[]).push(violations);
      (vizData.values.service_requests as number[]).push(serviceRequests);
      (vizData.values.total as number[]).push(permits + violations + serviceRequests);
      return;
    }
    indicatorColumns[dataset].forEach((column) => {
      const values = vizData.values[column];
      if (!values) return;
      const sourceColumn = `${dataset}_${column}`;
      const fallbackColumn = column === "total" ? `${dataset}_total` : sourceColumn;
      const legacyColumn =
        dataset === "permits"
          ? "permits_total"
          : dataset === "violations"
          ? "violations_total"
          : dataset === "service_requests"
          ? "service_requests_total"
          : fallbackColumn;
      values.push(parseInt(row[sourceColumn] ?? row[fallbackColumn] ?? row[legacyColumn], 10) || 0);
    });
  });
  return vizData;
}

function getAvailableDatasets(mode: IndicatorTimelineMode, rawJson: any[]): IndicatorsDatasetId[] {
  const row = rawJson[0] || {};
  const candidateIds: IndicatorsDatasetId[] =
    mode === "nyc"
      ? [...nycIndicatorsDatasetIds]
      : [...standardIndicatorsDatasetIds, ...ihsIndicatorsDatasetIds];

  if (!rawJson.length) {
    return candidateIds;
  }

  return candidateIds.filter((datasetId) => {
    if (datasetId === "show_all") {
      return (
        Object.prototype.hasOwnProperty.call(row, "permits_total") &&
        Object.prototype.hasOwnProperty.call(row, "violations_total") &&
        Object.prototype.hasOwnProperty.call(row, "service_requests_total")
      );
    }
    const requiredColumns = indicatorColumns[datasetId];
    return requiredColumns.every((column) => {
      const sourceColumn = `${datasetId}_${column}`;
      const legacyColumn =
        datasetId === "permits"
          ? "permits_total"
          : datasetId === "violations"
          ? "violations_total"
          : datasetId === "service_requests"
          ? "service_requests_total"
          : sourceColumn;
      return (
        Object.prototype.hasOwnProperty.call(row, sourceColumn) ||
        Object.prototype.hasOwnProperty.call(row, legacyColumn)
      );
    });
  });
}

async function getIndicatorHistory(pin: string, _bbl?: string): Promise<IndicatorsHistoryData> {
  const apiData: IndicatorsHistoryResults = await getApiJson(
    `/api/address/indicatorhistory?pin=${encodeURIComponent(pin)}`
  );
  const raw = apiData.result || [];
  const mode = detectTimelineMode(apiData.schema, raw);
  const availableDatasets = getAvailableDatasets(mode, raw);
  const structured = { ...indicatorsInitialDataStructure };
  for (const dataset of Object.keys(structured) as IndicatorsDatasetId[]) {
    structured[dataset] = createVizData(raw, dataset);
  }
  return {
    mode,
    availableDatasets,
    data: structured,
  };
}

// Contact Data API Functions

async function searchEntities(
  query: string,
  entityType: string = "all",
  limit: number = 20
): Promise<EntitySearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    entity_type: entityType,
    limit: String(limit),
  });
  const result = await getApiJson(`/api/entity/search?${params.toString()}`);
  return result.result || [];
}

async function getEntityContacts(
  entityId: number,
  minConfidence: number = 70
): Promise<EntityContactsResult> {
  const params = new URLSearchParams({
    entity_id: String(entityId),
    min_confidence: String(minConfidence),
  });
  return getApiJson(`/api/entity/contacts?${params.toString()}`);
}

async function getParcelEntities(pin: string): Promise<ParcelEntitiesResult> {
  const params = new URLSearchParams({ pin });
  return getApiJson(`/api/parcel/entities?${params.toString()}`);
}

function adminHeaders(adminToken: string) {
  return {
    accept: "application/json",
    Authorization: `Token ${adminToken}`,
  };
}

async function getAdminCoverage(adminToken: string): Promise<AdminCoverageResults> {
  const [dataCoverage, contactCoverage] = await Promise.all([
    getApiJson("/api/admin/data-coverage", { headers: adminHeaders(adminToken) }) as Promise<
      AdminDataCoverageResults
    >,
    getApiJson("/api/admin/contact-coverage", { headers: adminHeaders(adminToken) }) as Promise<
      AdminContactCoverageResults
    >,
  ]);
  return { dataCoverage, contactCoverage };
}

async function uploadPropstreamCsv(
  file: File,
  adminToken?: string
): Promise<{
  imported_parcels: number;
  imported_rows: number;
  skipped_rows: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await friendlyFetch(apiURL("/api/propstream/upload"), {
    method: "POST",
    headers: adminToken
      ? { accept: "application/json", Authorization: `Token ${adminToken}` }
      : { accept: "application/json" },
    body: formData,
  });
  return res.json();
}

const friendlyFetch: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (e) {
    if (e instanceof Error) {
      throw new NetworkError(e.message);
    } else {
      throw new Error("Unexpected error");
    }
  }
  if (!response.ok) {
    throw new HTTPError(response);
  }
  return response;
};

function apiURL(url: string): string {
  return `${process.env.REACT_APP_API_BASE_URL || ""}${url}`;
}

async function getApiJson(url: string, init?: RequestInit): Promise<any> {
  const res = await friendlyFetch(apiURL(url), {
    ...init,
    headers: { accept: "application/json", ...init?.headers },
  });
  const contentType = res.headers.get("Content-Type");
  if (!(contentType && /^application\/json/.test(contentType))) {
    throw new NetworkError(`Expected JSON response but got ${contentType} from ${res.url}`, true);
  }
  try {
    return await res.json();
  } catch (e) {
    if (e instanceof Error) {
      throw new NetworkError(e.message);
    } else {
      throw new Error("Unexpected error");
    }
  }
}

const Client = {
  searchForAddress,
  getBuildingInfo,
  getPortfolioByPin,
  getOverviewMapProperties,
  getNearbyProperties,
  getCurrentOwnerProfile,
  searchOwnersByArea,
  getBusinessLinkage,
  getIndicatorHistory,
  // Contact data
  searchEntities,
  getEntityContacts,
  getParcelEntities,
  getAdminCoverage,
  uploadPropstreamCsv,
};

export default Client;
