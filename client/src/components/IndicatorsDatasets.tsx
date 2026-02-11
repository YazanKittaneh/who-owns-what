import React from "react";

export type IndicatorsDataset = {
  name: (i18n: any) => string;
  analyticsName: string;
  quantity: (i18n: any, value: number) => string;
  startYear: number;
  yAxisLabel: (i18n: any) => string;
  explanation: (i18n: any) => JSX.Element;
};
export const INDICATORS_DATASETS: Record<string, IndicatorsDataset> = {};
