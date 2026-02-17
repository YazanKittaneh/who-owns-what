import React from "react";
import { t, Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import { useHistory, useLocation, useParams } from "react-router-dom";
import "styles/Indicators.css";
import {
  IndicatorsDataFromAPI,
  IndicatorsDatasetId,
  IndicatorsHistoryData,
  IndicatorsTimeSpan,
} from "./IndicatorsTypes";
import IndicatorsViz, { groupIndicatorsData } from "./IndicatorsViz";
import APIClient from "./APIClient";
import { INDICATORS_DATASETS } from "./IndicatorsDatasets";
import { NetworkErrorMessage } from "./NetworkErrorMessage";
import { FixedLoadingLabel } from "./Loader";
import { I18n } from "@lingui/react";
import { removeIndicatorSuffix } from "routes";
import { UsefulLinks } from "./UsefulLinks";
import { AmplitudeEvent, logAmplitudeEvent } from "./Amplitude";

export const validateIndicatorParam = (indicatorParam?: string) => {
  const candidate = indicatorParam as IndicatorsDatasetId;
  return candidate in INDICATORS_DATASETS ? candidate : undefined;
};

type IndicatorsProps = withMachineInStateProps<"portfolioFound"> & {
  isVisible?: boolean;
};

type RouteParams = {
  indicator?: string;
};

const DEFAULT_DATASET: IndicatorsDatasetId = "violations";

const getXAxisViewableColumns = (timeSpan: IndicatorsTimeSpan) =>
  timeSpan === "month" ? 24 : timeSpan === "quarter" ? 20 : Number.MAX_SAFE_INTEGER;

const Indicators: React.FC<IndicatorsProps> = ({ state, isVisible = true }) => {
  const pin = state.context.portfolioData.detailAddr.pin;
  const detailAddr = state.context.portfolioData.detailAddr;
  const history = useHistory();
  const location = useLocation();
  const { indicator } = useParams<RouteParams>();

  const [activeVis, setActiveVis] = React.useState<IndicatorsDatasetId>(
    validateIndicatorParam(indicator) || DEFAULT_DATASET
  );
  const [activeTimeSpan, setActiveTimeSpan] = React.useState<IndicatorsTimeSpan>("quarter");
  const [xAxisStart, setXAxisStart] = React.useState(0);
  const [timelineData, setTimelineData] = React.useState<IndicatorsDataFromAPI | null>(null);
  const [availableDatasets, setAvailableDatasets] = React.useState<IndicatorsDatasetId[]>([]);
  const [isLoading, setLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const timelinePathBase = React.useMemo(
    () => removeIndicatorSuffix(location.pathname),
    [location.pathname]
  );
  const xAxisViewableColumns = React.useMemo(
    () => getXAxisViewableColumns(activeTimeSpan),
    [activeTimeSpan]
  );

  React.useEffect(() => {
    if (!isVisible) return;
    const validatedIndicator = validateIndicatorParam(indicator);
    if (validatedIndicator && validatedIndicator !== activeVis) {
      setActiveVis(validatedIndicator);
    }
  }, [indicator, isVisible, activeVis]);

  React.useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    setLoading(true);
    setHasError(false);
    APIClient.getIndicatorHistory(pin, detailAddr.bbl)
      .then((historyData: IndicatorsHistoryData) => {
        if (!isMounted) return;
        setTimelineData(historyData.data);
        setAvailableDatasets(historyData.availableDatasets);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [pin, detailAddr.bbl, isVisible]);

  React.useEffect(() => {
    if (!availableDatasets.length) return;
    if (!availableDatasets.includes(activeVis)) {
      setActiveVis(availableDatasets[0]);
    }
  }, [availableDatasets, activeVis]);

  const groupedData = React.useMemo(() => {
    if (!timelineData) {
      return { labels: [], values: [] };
    }
    const dataset = timelineData[activeVis] || timelineData[DEFAULT_DATASET];
    return groupIndicatorsData(dataset.labels || [], dataset.values.total || [], activeTimeSpan);
  }, [timelineData, activeVis, activeTimeSpan]);

  React.useEffect(() => {
    const nextXAxisStart = Math.max(groupedData.labels.length - xAxisViewableColumns, 0);
    setXAxisStart(nextXAxisStart);
  }, [groupedData.labels.length, xAxisViewableColumns, activeVis, activeTimeSpan]);

  const handleDatasetChange = (dataset: IndicatorsDatasetId) => {
    setActiveVis(dataset);
    if (isVisible) {
      history.replace(`${timelinePathBase}/${dataset}`);
    }
    logAmplitudeEvent(`${dataset}TimelineTab` as AmplitudeEvent);
    window.gtag("event", `${dataset}-timeline-tab`);
  };

  const handleTimeSpanChange = (timeSpan: IndicatorsTimeSpan) => {
    setActiveTimeSpan(timeSpan);
    logAmplitudeEvent(`${timeSpan}TimelineTab` as AmplitudeEvent);
    window.gtag("event", `${timeSpan}-timeline-tab`);
  };

  const indicatorTotal = timelineData?.[activeVis]?.values.total?.reduce((sum, value) => sum + value, 0) || 0;

  const canShiftAxis = activeTimeSpan !== "year" && groupedData.labels.length > xAxisViewableColumns;
  const canShiftLeft = canShiftAxis && xAxisStart > 0;
  const canShiftRight = canShiftAxis && xAxisStart + xAxisViewableColumns < groupedData.labels.length;

  const detailAddrStr =
    detailAddr.address ||
    [detailAddr.housenumber, detailAddr.streetname, detailAddr.city].filter(Boolean).join(" ");

  return (
    <section className="Indicators">
      <div className="Indicators__content">
        {isLoading ? (
          <FixedLoadingLabel />
        ) : hasError || !timelineData ? (
          <NetworkErrorMessage />
        ) : availableDatasets.length === 0 ? (
          <p>
            <Trans>No timeline datasets are available for this building yet.</Trans>
          </p>
        ) : (
          <I18n>
            {({ i18n }) => (
              <div className="columns">
                <div className="column col-8 col-lg-12">
                  <div className="title-card">
                    <h4 className="title">
                      <b>{detailAddrStr}</b>
                    </h4>
                  </div>
                  <div className="Indicators__links">
                    <div className="Indicators__linksContainer">
                      <label className="Indicators__linksTitle text-uppercase" htmlFor="dataset-select">
                        <Trans>Display:</Trans>
                      </label>
                      <select
                        id="dataset-select"
                        className="form-select"
                        value={activeVis}
                        onChange={(e) => handleDatasetChange(e.currentTarget.value as IndicatorsDatasetId)}
                      >
                        {availableDatasets.map((datasetId) => (
                          <option key={datasetId} value={datasetId}>
                            {INDICATORS_DATASETS[datasetId].name(i18n)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="Indicators__linksContainer">
                      <label className="Indicators__linksTitle text-uppercase" htmlFor="timespan-select">
                        <Trans>View by:</Trans>
                      </label>
                      <select
                        id="timespan-select"
                        className="form-select"
                        value={activeTimeSpan}
                        onChange={(e) => handleTimeSpanChange(e.currentTarget.value as IndicatorsTimeSpan)}
                      >
                        <option value="month">{i18n._(t`month`)}</option>
                        <option value="quarter">{i18n._(t`quarter`)}</option>
                        <option value="year">{i18n._(t`year`)}</option>
                      </select>
                    </div>
                  </div>
                  <span className="title viz-title">
                    {INDICATORS_DATASETS[activeVis].quantity(i18n, indicatorTotal)}
                  </span>
                  <div className="Indicators__viz">
                    <button
                      aria-label={i18n._(t`Move chart data left.`)}
                      aria-hidden={!canShiftLeft}
                      aria-disabled={!canShiftLeft}
                      className={!canShiftLeft ? "btn btn-off btn-axis-shift" : "btn btn-axis-shift"}
                      onClick={() => setXAxisStart((previous) => Math.max(previous - 6, 0))}
                    >
                      ‹
                    </button>
                    <IndicatorsViz
                      datasetId={activeVis}
                      activeTimeSpan={activeTimeSpan}
                      data={timelineData[activeVis] || timelineData[DEFAULT_DATASET]}
                      xAxisStart={xAxisStart}
                      xAxisViewableColumns={xAxisViewableColumns}
                    />
                    <button
                      aria-label={i18n._(t`Move chart data right.`)}
                      aria-hidden={!canShiftRight}
                      aria-disabled={!canShiftRight}
                      className={!canShiftRight ? "btn btn-off btn-axis-shift" : "btn btn-axis-shift"}
                      onClick={() =>
                        setXAxisStart((previous) =>
                          Math.min(previous + 6, groupedData.labels.length - xAxisViewableColumns)
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="column column-context col-4 col-lg-12">
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title h5">
                        <Trans>What are {INDICATORS_DATASETS[activeVis].name(i18n)}?</Trans>
                      </div>
                      <div className="card-subtitle text-gray" />
                    </div>
                    <div className="card-body">{INDICATORS_DATASETS[activeVis].explanation(i18n)}</div>
                  </div>
                  <UsefulLinks addrForLinks={detailAddr} location="timeline-tab" />
                </div>
              </div>
            )}
          </I18n>
        )}
      </div>
    </section>
  );
};

export default Indicators;
