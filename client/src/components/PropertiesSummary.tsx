import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import { calculateAggDataFromAddressList } from "./SummaryCalculation";
import "styles/PropertiesSummary.css";

const formatNumber = new Intl.NumberFormat("en-US");

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
          <p>{formatNumber.format(totals.parcels)} <Trans>parcels</Trans></p>
          <p>{formatNumber.format(totals.units_res)} <Trans>residential units</Trans></p>
        </div>
        <div className="PropertiesSummary__card">
          <h3>
            <Trans>Violations</Trans>
          </h3>
          <p>{formatNumber.format(totals.violations_open)} <Trans>open</Trans></p>
          <p>{formatNumber.format(totals.violations_total)} <Trans>total</Trans></p>
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
      </div>
    </section>
  );
};

export default PropertiesSummary;
