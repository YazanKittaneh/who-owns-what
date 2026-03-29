import React from "react";

import LegalFooter from "../components/LegalFooter";
import "styles/HomePage.css";

import AddressSearch, { SearchAddress } from "../components/AddressSearch";
import { Trans } from "@lingui/macro";
import Page from "../components/Page";
import { createRouteForAddressPage } from "../routes";
import { withMachineProps } from "state-machine";
import { parseLocaleFromPath } from "i18n";
import { useHistory, useLocation } from "react-router-dom";
import { logAmplitudeEvent } from "components/Amplitude";

type HomePageProps = {
  useNewPortfolioMethod?: boolean;
} & withMachineProps;

const HomePage: React.FC<HomePageProps> = ({ useNewPortfolioMethod }) => {
  const { pathname } = useLocation();
  const locale = parseLocaleFromPath(pathname) || undefined;
  const history = useHistory();

  const handleFormSubmit = (searchAddress: SearchAddress, error: any) => {
    logAmplitudeEvent("searchByAddress");
    window.gtag("event", "search", { pin: searchAddress.pin });

    if (error) {
      window.gtag("event", "search-error");
    } else {
      const addressPage = createRouteForAddressPage({ pin: searchAddress.pin, locale }, false);
      history.push(addressPage);
    }
  };

  const labelText = <Trans>Search a Chicago address</Trans>;

  return (
    <Page>
      <div className="HomePage Page">
        <div className="HomePage__content">
          <div className="HomePage__search">
            <h1 className="text-center">
              <Trans>Search a Chicago address to explore who owns what</Trans>
            </h1>
            <p className="text-center">
              <Trans>
                An independent fan-made adaptation inspired by the original Who Owns What
                project by JustFix. Built and maintained by Yazan at yazan.io. Not
                affiliated with or endorsed by JustFix.
              </Trans>
            </p>
            <AddressSearch labelText={labelText} labelClass="text-assistive" onFormSubmit={handleFormSubmit} />
          </div>
          <LegalFooter />
        </div>
      </div>
    </Page>
  );
};

export default HomePage;
