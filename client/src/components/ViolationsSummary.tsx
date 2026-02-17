import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import { calculateAggDataFromAddressList } from "./SummaryCalculation";

const VIOLATIONS_CITYWIDE_AVG = 0.8;

const ViolationsSummary: React.FC<withMachineInStateProps<"portfolioFound">> = ({ state }) => {
  const totals = calculateAggDataFromAddressList(state.context.portfolioData.assocAddrs);
  const byUnit = totals.violations_open_per_unit;

  return (
    <>
      <Trans render="h6">Maintenance code violations</Trans>
      <p>
        <Trans>
          This portfolio has <b>{totals.violations_open}</b> open violations and{" "}
          <b>{totals.violations_total}</b> total violations on record.
        </Trans>{" "}
        {totals.units_res > 0 && (
          <Trans>
            That is <b>{byUnit.toFixed(1)}</b> open violations per residential unit, compared with
            a citywide benchmark of about {VIOLATIONS_CITYWIDE_AVG}.
          </Trans>
        )}
      </p>
    </>
  );
};

export default ViolationsSummary;
