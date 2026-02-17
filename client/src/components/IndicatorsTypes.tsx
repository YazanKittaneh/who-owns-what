export const nycIndicatorsDatasetIds = [
  "hpdcomplaints",
  "hpdviolations",
  "dobpermits",
  "dobviolations",
  "evictionfilings",
  "rentstabilizedunits",
] as const;

export const standardIndicatorsDatasetIds = [
  "show_all",
  "permits",
  "violations",
  "service_requests",
] as const;

export const indicatorsDatasetIds = [
  ...nycIndicatorsDatasetIds,
  ...standardIndicatorsDatasetIds,
] as const;

export type IndicatorsDatasetId = typeof indicatorsDatasetIds[number];

export type IndicatorsTimeSpan = "month" | "quarter" | "year";
export const indicatorsTimeSpans: IndicatorsTimeSpan[] = ["month", "quarter", "year"];

export type IndicatorTimelineMode = "nyc" | "standard";

type IndicatorsDataValues = {
  [k: string]: number[] | null;
} & {
  total: number[] | null;
};

export type IndicatorsData = {
  labels: string[] | null;
  values: IndicatorsDataValues;
};

export type IndicatorsDataFromAPI = Record<IndicatorsDatasetId, IndicatorsData>;

export type IndicatorsHistoryData = {
  mode: IndicatorTimelineMode;
  availableDatasets: IndicatorsDatasetId[];
  data: IndicatorsDataFromAPI;
};

export const indicatorsInitialDataStructure: IndicatorsDataFromAPI = {
  hpdcomplaints: {
    labels: null,
    values: {
      emergency: null,
      nonemergency: null,
      total: null,
    },
  },
  hpdviolations: {
    labels: null,
    values: {
      class_a: null,
      class_b: null,
      class_c: null,
      class_i: null,
      total: null,
    },
  },
  dobpermits: {
    labels: null,
    values: {
      total: null,
    },
  },
  dobviolations: {
    labels: null,
    values: {
      regular: null,
      ecb: null,
      total: null,
    },
  },
  evictionfilings: {
    labels: null,
    values: {
      total: null,
    },
  },
  rentstabilizedunits: {
    labels: null,
    values: {
      total: null,
    },
  },
  permits: {
    labels: null,
    values: {
      total: null,
    },
  },
  violations: {
    labels: null,
    values: {
      total: null,
    },
  },
  service_requests: {
    labels: null,
    values: {
      total: null,
    },
  },
  show_all: {
    labels: null,
    values: {
      permits: null,
      violations: null,
      service_requests: null,
      total: null,
    },
  },
};

export type IndicatorsProps = { isVisible: boolean };
