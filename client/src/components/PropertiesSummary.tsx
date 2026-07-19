import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import { calculateAggDataFromAddressList } from "./SummaryCalculation";
import "styles/PropertiesSummary.css";

const formatNumber = new Intl.NumberFormat("en-US");
const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PropertiesSummary: React.FC<withMachineInStateProps<"portfolioFound">> = ({ state }) => {
  const addrs = state.context.portfolioData.assocAddrs;
  const totals = calculateAggDataFromAddressList(addrs);

  return (
    <section className="PropertiesSummary">
      <div className="PropertiesSummary__grid">
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Portfolio totals</Trans>
          </h3>
          <p>
            {formatNumber.format(totals.parcels)} <Trans>parcels</Trans>
          </p>
          <p>
            {formatNumber.format(totals.units_res)} <Trans>residential units</Trans>
          </p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Violations</Trans>
          </h3>
          <p>
            {formatNumber.format(totals.violations_open)} <Trans>open</Trans>
          </p>
          <p>
            {formatNumber.format(totals.violations_total)} <Trans>total</Trans>
          </p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Permits</Trans>
          </h3>
          <p>{formatNumber.format(totals.permits_total)}</p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>311 requests</Trans>
          </h3>
          <p>{formatNumber.format(totals.requests_311_total)}</p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Tax sale history</Trans>
          </h3>
          <p>
            {formatNumber.format(totals.parcels_with_tax_sale_history)}{" "}
            <Trans>parcels affected</Trans>
          </p>
          <p>
            {formatNumber.format(totals.tax_sale_event_count)} <Trans>events</Trans>
          </p>
          <p>
            {formatCurrency.format(totals.total_tax_sale_amount_paid)} <Trans>paid at sale</Trans>
          </p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Recorder history</Trans>
          </h3>
          <p>
            {formatNumber.format(totals.parcels_with_recorder_history)}{" "}
            <Trans>parcels with filings</Trans>
          </p>
          <p>
            {formatNumber.format(totals.recorder_doc_count)} <Trans>documents</Trans>
          </p>
          <p>
            {formatNumber.format(totals.foreclosure_doc_count)}{" "}
            <Trans>foreclosure-related docs</Trans>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PropertiesSummary;
