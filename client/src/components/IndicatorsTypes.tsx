export type IndicatorsDatasetId = "permits" | "violations" | "service_requests";
export type IndicatorsTimeSpan = "month" | "quarter" | "year";
export const indicatorsDatasetIds: IndicatorsDatasetId[] = [
  "permits",
  "violations",
  "service_requests",
];
export const indicatorsTimeSpans: IndicatorsTimeSpan[] = ["month", "quarter", "year"];
export type IndicatorsData = { labels: string[] | null; values: { total: number[] | null } };
export type IndicatorsDataFromAPI = {
  permits: IndicatorsData;
  violations: IndicatorsData;
  service_requests: IndicatorsData;
};
export const indicatorsInitialDataStructure: IndicatorsDataFromAPI = {
  permits: { labels: null, values: { total: null } },
  violations: { labels: null, values: { total: null } },
  service_requests: { labels: null, values: { total: null } },
};
export type IndicatorsProps = { isVisible: boolean };
