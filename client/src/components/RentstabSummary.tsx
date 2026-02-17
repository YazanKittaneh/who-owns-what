import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";

const RentstabSummary: React.FC<withMachineInStateProps<"portfolioFound">> = ({ state }) => {
  const addrs = state.context.portfolioData.assocAddrs;
  const withRentData = addrs.filter((a) => a.rsunitslatest !== null && a.rsunitslatest !== undefined);
  const withLoss = addrs.filter((a) => (a.rsdiff || 0) < 0);
  const totalLoss = withLoss.reduce((sum, a) => sum + Math.abs(a.rsdiff || 0), 0);

  return (
    <>
      <Trans render="h6">Rent-stabilized units</Trans>
      <p>
        {withRentData.length > 0 ? (
          <Trans>
            We found rent-stabilized unit data for <b>{withRentData.length}</b> buildings in this
            portfolio. Estimated net unit loss across those buildings is <b>{totalLoss}</b>.
          </Trans>
        ) : (
          <Trans>Rent-stabilized unit history is unavailable for this portfolio in this dataset.</Trans>
        )}
      </p>
    </>
  );
};

export default RentstabSummary;
