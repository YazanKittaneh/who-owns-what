import React from "react";
import { Trans, t } from "@lingui/macro";
import { i18n } from "@lingui/core";
import { Button } from "@justfixnyc/component-library";
import { createWhoOwnsWhatRoutePaths } from "routes";
import { useLocation } from "react-router-dom";
import { AddressRecord } from "./APIDataTypes";

import "styles/EmailAlertSignup.css";
import "styles/Card.css";

type EmailAlertSignupProps = {
  addr: AddressRecord;
};

const getLocalePrefix = (pathname: string) => {
  const localeMatch = pathname.match(/^\/(en|es)(?:\/|$)/);
  return localeMatch ? `/${localeMatch[1]}` : "/en";
};

const EmailAlertSignup: React.FC<EmailAlertSignupProps> = ({ addr }) => {
  const { pathname } = useLocation();
  const { account } = createWhoOwnsWhatRoutePaths();

  return (
    <div className="Card EmailAlertSignup card-body-table">
      <div className="table-row">
        <div className="table-small-font">
          <label className="card-label-container">
            <Trans>Building Alerts</Trans>
          </label>
          <div className="table-content building-subscribe">
            <Trans render="div" className="card-description">
              Get a weekly email alert on complaints, violations, permits, and 311 activity for this
              building.
            </Trans>
            <Button
              variant="primary"
              size="small"
              className="is-full-width"
              labelText={i18n._(t`Follow building`)}
              labelIcon="circlePlus"
              onClick={() => {
                window.gtag("event", "follow-building-overview");
                const loginPath = `${getLocalePrefix(pathname)}${account.login}`;
                window.location.assign(loginPath);
              }}
            />
            <span className="small text-gray">
              <Trans>
                Tracking: {addr.housenumber || ""} {addr.streetname || addr.address || addr.pin}
              </Trans>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailAlertSignup;
