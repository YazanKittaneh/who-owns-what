import React from "react";
import { t, Trans, plural } from "@lingui/macro";
import { IndicatorsDatasetId, IndicatorTimelineMode } from "./IndicatorsTypes";

export type IndicatorSeriesMeta = {
  key: string;
  label: (i18n: any) => string;
  backgroundColor: string;
  borderColor: string;
};

export type IndicatorsDataset = {
  mode: IndicatorTimelineMode;
  name: (i18n: any) => string;
  analyticsName: string;
  quantity: (i18n: any, value: number) => string;
  startYear: number;
  yAxisLabel: (i18n: any) => string;
  explanation: (i18n: any) => JSX.Element;
  series: IndicatorSeriesMeta[];
};

export const INDICATORS_DATASETS: Record<IndicatorsDatasetId, IndicatorsDataset> = {
  hpdcomplaints: {
    mode: "nyc",
    name: (i18n) => i18n._(t`HPD Complaints`),
    analyticsName: "hpdcomplaints",
    quantity: (i18n, value) =>
      i18n._(
        plural({
          value,
          one: "One HPD Complaint Issued since 2012",
          other: "# HPD Complaints Issued since 2012",
        })
      ),
    startYear: 2012,
    yAxisLabel: (i18n) => i18n._(t`Complaints Issued`),
    explanation: () => (
      <Trans render="span">
        HPD Complaints are housing issues reported to the City <b>by a tenant calling 311</b>. When
        someone issues a complaint, the Department of Housing Preservation and Development begins a
        process of investigation that may lead to an official violation from the City.
      </Trans>
    ),
    series: [
      {
        key: "emergency",
        label: (i18n) => i18n._(t`Emergency`),
        backgroundColor: "rgba(227,74,51,0.6)",
        borderColor: "rgba(227,74,51,1)",
      },
      {
        key: "nonemergency",
        label: (i18n) => i18n._(t`Non-Emergency`),
        backgroundColor: "rgba(255,219,170,0.6)",
        borderColor: "rgba(255,219,170,1)",
      },
    ],
  },
  hpdviolations: {
    mode: "nyc",
    name: (i18n) => i18n._(t`HPD Violations`),
    analyticsName: "hpdviolations",
    quantity: (i18n, value) =>
      i18n._(
        plural({
          value,
          one: "One HPD Violation Issued since 2012",
          other: "# HPD Violations Issued since 2012",
        })
      ),
    startYear: 2012,
    yAxisLabel: (i18n) => i18n._(t`Violations Issued`),
    explanation: (i18n) => <>{i18n._(t`HPD violations by hazard class over time.`)}</>,
    series: [
      {
        key: "class_i",
        label: (i18n) => i18n._(t`Class I`),
        backgroundColor: "rgba(87,0,83,0.6)",
        borderColor: "rgba(87,0,83,1)",
      },
      {
        key: "class_c",
        label: (i18n) => i18n._(t`Class C`),
        backgroundColor: "rgba(136,65,157,0.6)",
        borderColor: "rgba(136,65,157,1)",
      },
      {
        key: "class_b",
        label: (i18n) => i18n._(t`Class B`),
        backgroundColor: "rgba(140,150,198,0.6)",
        borderColor: "rgba(140,150,198,1)",
      },
      {
        key: "class_a",
        label: (i18n) => i18n._(t`Class A`),
        backgroundColor: "rgba(157,194,227,0.6)",
        borderColor: "rgba(157,194,227,1)",
      },
    ],
  },
  dobpermits: {
    mode: "nyc",
    name: (i18n) => i18n._(t`Building Permit Applications`),
    analyticsName: "dobpermits",
    quantity: (i18n, value) =>
      i18n._(
        plural({
          value,
          one: "One Building Permit Application since 2010",
          other: "# Building Permit Applications since 2010",
        })
      ),
    startYear: 2010,
    yAxisLabel: (i18n) => i18n._(t`Building Permits Applied For`),
    explanation: (i18n) => <>{i18n._(t`DOB permit application activity over time.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`Building Permits Applied For`),
        backgroundColor: "rgba(73,192,179,0.6)",
        borderColor: "rgba(73,192,179,1)",
      },
    ],
  },
  dobviolations: {
    mode: "nyc",
    name: (i18n) => i18n._(t`DOB/ECB Violations`),
    analyticsName: "dobviolations",
    quantity: (i18n, value) =>
      i18n._(
        plural({
          value,
          one: "One DOB/ECB Violation Issued since 2010",
          other: "# DOB/ECB Violations Issued since 2010",
        })
      ),
    startYear: 2010,
    yAxisLabel: (i18n) => i18n._(t`Violations Issued`),
    explanation: (i18n) => <>{i18n._(t`DOB and ECB violations over time.`)}</>,
    series: [
      {
        key: "ecb",
        label: (i18n) => i18n._(t`ECB`),
        backgroundColor: "rgba(217,95,14,0.6)",
        borderColor: "rgba(217,95,14,1)",
      },
      {
        key: "regular",
        label: (i18n) => i18n._(t`Non-ECB`),
        backgroundColor: "rgba(254,217,142,0.6)",
        borderColor: "rgba(254,217,142,1)",
      },
    ],
  },
  evictionfilings: {
    mode: "nyc",
    name: (i18n) => i18n._(t`Eviction Filings`),
    analyticsName: "evictionfilings",
    quantity: (i18n, value) =>
      i18n._(
        plural({
          value,
          one: "One Eviction Filing since 2017",
          other: "# Eviction Filings since 2017",
        })
      ),
    startYear: 2017,
    yAxisLabel: (i18n) => i18n._(t`Eviction Filings`),
    explanation: (i18n) => <>{i18n._(t`Eviction filing counts over time.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`Eviction Filings`),
        backgroundColor: "rgba(227,74,51,0.6)",
        borderColor: "rgba(227,74,51,1)",
      },
    ],
  },
  rentstabilizedunits: {
    mode: "nyc",
    name: (i18n) => i18n._(t`Rent Stabilized Units`),
    analyticsName: "rentstabilizedunits",
    quantity: (i18n) => i18n._(t`Rent Stabilized Units registered since 2007`),
    startYear: 2007,
    yAxisLabel: (i18n) => i18n._(t`Number of Units`),
    explanation: (i18n) => <>{i18n._(t`Registered rent stabilized unit counts over time.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`Rent Stabilized Units`),
        backgroundColor: "rgba(131,207,162,0.6)",
        borderColor: "rgba(131,207,162,1)",
      },
    ],
  },
  permits: {
    mode: "standard",
    name: (i18n) => i18n._(t`Permits`),
    analyticsName: "permits",
    quantity: (_i18n, value) => `${value} permits`,
    startYear: 2007,
    yAxisLabel: (i18n) => i18n._(t`Permits`),
    explanation: (i18n) => <>{i18n._(t`Building permit activity over time for this property.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`Permits`),
        backgroundColor: "#ff813a",
        borderColor: "#242323",
      },
    ],
  },
  violations: {
    mode: "standard",
    name: (i18n) => i18n._(t`Violations`),
    analyticsName: "violations",
    quantity: (_i18n, value) => `${value} violations`,
    startYear: 2007,
    yAxisLabel: (i18n) => i18n._(t`Violations`),
    explanation: (i18n) => <>{i18n._(t`Code violations recorded for this property over time.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`Violations`),
        backgroundColor: "#ff813a",
        borderColor: "#242323",
      },
    ],
  },
  service_requests: {
    mode: "standard",
    name: (i18n) => i18n._(t`311 Requests`),
    analyticsName: "service_requests",
    quantity: (_i18n, value) => `${value} requests`,
    startYear: 2007,
    yAxisLabel: (i18n) => i18n._(t`311 requests`),
    explanation: (i18n) => <>{i18n._(t`311 service request volume over time for this property.`)}</>,
    series: [
      {
        key: "total",
        label: (i18n) => i18n._(t`311 requests`),
        backgroundColor: "#ff813a",
        borderColor: "#242323",
      },
    ],
  },
};
