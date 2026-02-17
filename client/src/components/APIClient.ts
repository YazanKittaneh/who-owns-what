import { SearchResults, BuildingInfoResults, IndicatorsHistoryResults } from "./APIDataTypes";
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
} from "./IndicatorsTypes";

function searchForAddress(searchAddress: SearchAddress): Promise<SearchResults> {
  if (!searchAddress.pin) {
    return Promise.resolve({ addrs: [], geosearch: undefined });
  }
  return getApiJson(`/api/address?pin=${encodeURIComponent(searchAddress.pin)}`);
}

function getBuildingInfo(pin: string): Promise<BuildingInfoResults> {
  return getApiJson(`/api/address/buildinginfo?pin=${encodeURIComponent(pin)}`);
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
    mode === "nyc" ? [...nycIndicatorsDatasetIds] : [...standardIndicatorsDatasetIds];

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

async function getIndicatorHistory(pin: string, bbl?: string): Promise<IndicatorsHistoryData> {
  const apiData: IndicatorsHistoryResults = await getApiJson(
    bbl
      ? `/api/address/indicatorhistory?bbl=${encodeURIComponent(bbl)}`
      : `/api/address/indicatorhistory?pin=${encodeURIComponent(pin)}`
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

async function getApiJson(url: string): Promise<any> {
  const res = await friendlyFetch(apiURL(url), { headers: { accept: "application/json" } });
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
  getIndicatorHistory,
};

export default Client;
