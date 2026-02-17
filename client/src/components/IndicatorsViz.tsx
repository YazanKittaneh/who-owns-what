import React from "react";
import { Bar } from "react-chartjs-2";
import { IndicatorsData, IndicatorsDatasetId, IndicatorsTimeSpan } from "./IndicatorsTypes";
import { INDICATORS_DATASETS } from "./IndicatorsDatasets";
import { I18n } from "@lingui/react";

type IndicatorsVizProps = {
  datasetId: IndicatorsDatasetId;
  activeTimeSpan: IndicatorsTimeSpan;
  data: IndicatorsData;
  xAxisStart: number;
  xAxisViewableColumns: number;
};

export type GroupedIndicatorsSeries = {
  labels: string[];
  values: number[];
};

const buildGroupKey = (label: string, timeSpan: Exclude<IndicatorsTimeSpan, "month">): string => {
  const [year, monthValue] = label.split("-");
  const month = parseInt(monthValue || "1", 10);
  if (timeSpan === "year") {
    return year;
  }
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
};

export const groupIndicatorsData = (
  labels: string[],
  values: number[],
  timeSpan: IndicatorsTimeSpan
): GroupedIndicatorsSeries => {
  if (timeSpan === "month") {
    return { labels, values };
  }

  const grouped = new Map<string, number>();
  labels.forEach((label, idx) => {
    const key = buildGroupKey(label, timeSpan);
    grouped.set(key, (grouped.get(key) || 0) + (values[idx] || 0));
  });

  return { labels: Array.from(grouped.keys()), values: Array.from(grouped.values()) };
};

const IndicatorsViz: React.FC<IndicatorsVizProps> = ({
  datasetId,
  activeTimeSpan,
  data,
  xAxisStart,
  xAxisViewableColumns,
}) => {
  const labels = data.labels || [];
  const groupedTotal = groupIndicatorsData(labels, data.values.total || [], activeTimeSpan);
  const xAxisMax = Math.max(groupedTotal.labels.length - xAxisViewableColumns, 0);
  const clampedXAxisStart = Math.min(Math.max(xAxisStart, 0), xAxisMax);
  const datasetMeta = INDICATORS_DATASETS[datasetId];

  const sliced =
    activeTimeSpan === "year"
      ? groupedTotal
      : {
          labels: groupedTotal.labels.slice(
            clampedXAxisStart,
            clampedXAxisStart + xAxisViewableColumns
          ),
          values: groupedTotal.values.slice(
            clampedXAxisStart,
            clampedXAxisStart + xAxisViewableColumns
          ),
        };

  return (
    <I18n>
      {({ i18n }) => (
        <div className="Indicators__chart">
          <Bar
            data={{
              labels: sliced.labels,
              datasets: datasetMeta.series.map((series) => {
                const groupedSeries = groupIndicatorsData(
                  labels,
                  data.values[series.key] || data.values.total || [],
                  activeTimeSpan
                );
                const slicedSeries =
                  activeTimeSpan === "year"
                    ? groupedSeries.values
                    : groupedSeries.values.slice(
                        clampedXAxisStart,
                        clampedXAxisStart + xAxisViewableColumns
                      );
                return {
                  label: series.label(i18n),
                  data: slicedSeries,
                  backgroundColor: series.backgroundColor,
                  borderColor: series.borderColor,
                  borderWidth: 1,
                };
              }),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              legend: {
                display: datasetMeta.series.length > 1,
              },
              scales: {
                yAxes: [
                  {
                    ticks: { beginAtZero: true },
                    stacked: datasetMeta.series.length > 1,
                  },
                ],
                xAxes: [
                  {
                    stacked: datasetMeta.series.length > 1,
                  },
                ],
              },
            }}
            height={340}
          />
        </div>
      )}
    </I18n>
  );
};

export default IndicatorsViz;
