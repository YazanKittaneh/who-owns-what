import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import Page from "components/Page";

const NotRegisteredPage: React.FC<withMachineInStateProps<"unregisteredFound">> = ({ state }) => {
  const { buildingInfo } = state.context;
  const title = buildingInfo?.address || buildingInfo?.pin || "Address not found";

  return (
    <Page title={title}>
      <div className="NotRegisteredPage Page">
        <div className="HomePage__content">
          <div className="HomePage__search">
            <h5 className="mt-4 text-center text-bold text-large">
              <Trans>No portfolio data found for this parcel.</Trans>
            </h5>
            <p className="text-center">
              <Trans>
                This parcel exists in our Chicago dataset, but we do not have enough owner data to
                associate it with a broader portfolio yet.
              </Trans>
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default NotRegisteredPage;
