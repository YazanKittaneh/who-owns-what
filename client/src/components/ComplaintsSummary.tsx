import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import { calculateAggDataFromAddressList } from "./SummaryCalculation";
import helpers from "util/helpers";

const ComplaintsSummary: React.FC<withMachineInStateProps<"portfolioFound">> = ({ state }) => {
  const addrs = state.context.portfolioData.assocAddrs;
  const totals = calculateAggDataFromAddressList(addrs);
  const complaintTypes = helpers.getMostCommonElementsInArray(
    addrs.flatMap((a) =>
      (a.recentcomplaintsbytype || []).flatMap((c) => Array(c.count).fill(c.type))
    ),
    3
  );

  return (
    <>
      <Trans render="h6">Complaints to 311</Trans>
      <p>
        <Trans>
          Tenants in this portfolio reported <b>{totals.requests_311_total}</b> total 311
          complaints.
        </Trans>{" "}
        {complaintTypes.length > 0 && (
          <Trans>
            Common recent complaint categories include <b>{complaintTypes.join(", ")}</b>.
          </Trans>
        )}
      </p>
    </>
  );
};

export default ComplaintsSummary;
