import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";

const EvictionsSummary: React.FC<withMachineInStateProps<"portfolioFound">> = ({ state }) => {
  const addrs = state.context.portfolioData.assocAddrs;
  const totals = addrs.reduce(
    (acc, addr) => {
      return {
        filings: acc.filings + (addr.evictionfilings || 0),
        executed: acc.executed + (addr.evictions || 0),
      };
    },
    { filings: 0, executed: 0 }
  );

  return (
    <>
      <Trans render="h6">Evictions since 2017</Trans>
      <p>
        <Trans>
          Across this portfolio there were <b>{totals.filings}</b> eviction filings and{" "}
          <b>{totals.executed}</b> executed evictions.
        </Trans>{" "}
        {totals.filings === 0 && totals.executed === 0 && (
          <Trans>This dataset is limited for some properties and may undercount activity.</Trans>
        )}
      </p>
    </>
  );
};

export default EvictionsSummary;
