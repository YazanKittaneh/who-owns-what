import React from "react";
import { withI18n } from "@lingui/react";
import { Trans } from "@lingui/macro";

import "styles/GetRepairs.css";
import "styles/Card.css";

const GetRepairsWithoutI18n = () => {
  return (
    <>
      <div className="Card GetRepairs card-body-table">
        <div className="table-row">
          <div className="table-small-font">
            <label className="card-label-container">
              <Trans>Need repairs in this building?</Trans>
            </label>
            <div className="table-content">
              <Trans render="div" className="card-description">
                Repair letter integrations are not included in this Chicago version yet.
              </Trans>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const GetRepairs = withI18n()(GetRepairsWithoutI18n);

export default GetRepairs;
