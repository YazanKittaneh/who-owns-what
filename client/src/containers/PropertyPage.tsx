import React, { Component } from "react";
import { Link, RouteComponentProps } from "react-router-dom";
import { Trans, Plural } from "@lingui/macro";
import _find from "lodash/find";

import { withMachineProps } from "state-machine";
import { SearchAddress } from "../components/AddressSearch";
import { AddrNotFoundPage } from "./NotFoundPage";
import NotRegisteredPage from "./NotRegisteredPage";
import { NetworkErrorMessage } from "components/NetworkErrorMessage";
import Page from "../components/Page";
import AddressToolbar from "../components/AddressToolbar";
import BuildingStatsTable from "../components/BuildingStatsTable";
import PropertiesMap from "../components/PropertiesMap";
import PropertiesSummary from "../components/PropertiesSummary";
import NearbyOwners from "../components/NearbyOwners";
import BusinessLinkage from "../components/BusinessLinkage";
import Indicators from "../components/Indicators";
import { UsefulLinks } from "../components/UsefulLinks";
import PropertiesList, { FilterContextProvider } from "../components/PropertiesList";
import { LoadingPage } from "../components/Loader";
import { createAddressPageRoutes, createRouteForAddressPage, removeIndicatorSuffix } from "routes";
import { searchAddrsAreEqual } from "util/helpers";
import { localeFromRouter } from "i18n";
import { isLegacyPath } from "../components/WowzaToggle";

import "styles/PropertyPage.css";

type RouteParams = {
  locale?: string;
  pin?: string;
};

type PropertyPageProps = RouteComponentProps<RouteParams> &
  withMachineProps & {
    useNewPortfolioMethod?: boolean;
  };

const validateRouteParams = (params: RouteParams) => {
  if (!params.pin) {
    throw new Error("Property Page URL params did not contain a proper PIN!");
  }
  const searchAddress: SearchAddress = {
    pin: params.pin,
    housenumber: "",
    streetname: "",
    city: "",
    state: "",
    zip: "",
  };
  return {
    ...searchAddress,
    locale: params.locale,
  };
};

export default class PropertyPage extends Component<PropertyPageProps> {
  componentDidMount() {
    this.syncRouteToState();
  }

  componentDidUpdate() {
    this.syncRouteToState();
  }

  syncRouteToState = () => {
    const routeAddr = validateRouteParams(this.props.match.params);
    const { state, send, useNewPortfolioMethod } = this.props;

    if (state.matches("searchInProgress")) {
      return;
    }

    if (state.matches("portfolioFound")) {
      const { assocAddrs, detailAddr } = state.context.portfolioData;
      if (detailAddr.pin === routeAddr.pin) {
        return;
      }

      if (_find(assocAddrs, { pin: routeAddr.pin })) {
        send({ type: "SELECT_DETAIL_ADDR", pin: routeAddr.pin });
        return;
      }
    }

    if (searchAddrsAreEqual(state.context.searchAddrParams || {}, routeAddr)) {
      return;
    }

    send({
      type: "SEARCH",
      address: routeAddr,
      useNewPortfolioMethod: useNewPortfolioMethod || false,
    });
  };

  setAddrUrl = (pin: string) => {
    const addr = _find(this.props.state.context.portfolioData?.assocAddrs, { pin });
    if (!addr) return;
    const locale = localeFromRouter(this.props);
    const isLegacy = isLegacyPath(this.props.location.pathname);
    const addrRoute = createRouteForAddressPage({ pin, locale }, isLegacy);
    this.props.history.replace(addrRoute);
  };

  handleAddrChange = (newFocusPin: string) => {
    if (!this.props.state.matches("portfolioFound")) {
      throw new Error("A change of detail address was attempted without any portfolio data found.");
    }
    const detailPin = this.props.state.context.portfolioData.detailAddr.pin;
    if (newFocusPin !== detailPin) {
      this.props.send({ type: "SELECT_DETAIL_ADDR", pin: newFocusPin });
      this.setAddrUrl(newFocusPin);
    }
  };

  render() {
    const { state, send, useNewPortfolioMethod } = this.props;

    if (state.matches("pinNotFound")) {
      return <AddrNotFoundPage />;
    } else if (state.matches("unregisteredFound")) {
      return <NotRegisteredPage state={state} send={send} />;
    } else if (state.matches("networkErrorOccurred")) {
      return <NetworkErrorMessage />;
    } else if (!state.matches("portfolioFound")) {
      return <LoadingPage />;
    }

    const { assocAddrs, searchAddr, detailAddr } = state.context.portfolioData;
    const locale = localeFromRouter(this.props);
    const routes = createAddressPageRoutes(
      validateRouteParams(this.props.match.params),
      !useNewPortfolioMethod
    );
    const addressLine =
      detailAddr.address ||
      [detailAddr.housenumber, detailAddr.streetname].filter(Boolean).join(" ") ||
      detailAddr.pin;
    const mailingLine = [
      detailAddr.mailing_address,
      detailAddr.mailing_city,
      detailAddr.mailing_state,
      detailAddr.mailing_zip,
    ]
      .filter(Boolean)
      .join(detailAddr.mailing_address ? ", " : " ");

    return (
      <Page title={addressLine}>
        <div className="PropertyPage Page">
          <div className="PropertyPage__header card">
            <div className="PropertyPage__headerMain">
              <p className="PropertyPage__eyebrow">
                <Trans>Property profile</Trans>
              </p>
              <h1>{addressLine}</h1>
              <p className="PropertyPage__owner">{detailAddr.owner_name || "Unknown owner"}</p>
              {mailingLine && (
                <p className="PropertyPage__mailing">
                  <Trans>Mail-to:</Trans> {mailingLine}
                </p>
              )}
              <p className="PropertyPage__portfolioLink">
                <Trans>
                  This property is associated with <strong>{assocAddrs.length}</strong>{" "}
                  <Plural value={assocAddrs.length} one="parcel" other="parcels" /> in the current
                  portfolio view.
                </Trans>
              </p>
            </div>
            <div className="PropertyPage__headerActions">
              <AddressToolbar searchAddr={searchAddr} assocAddrs={assocAddrs} />
              <div className="PropertyPage__quickLinks">
                <Link to={routes.portfolio}>
                  <Trans>Open portfolio view</Trans>
                </Link>
                <Link to={removeIndicatorSuffix(routes.timeline)}>
                  <Trans>Open timeline view</Trans>
                </Link>
              </div>
            </div>
          </div>

          <div className="PropertyPage__hero">
            <div className="PropertyPage__map card">
              <PropertiesMap
                state={state}
                send={send}
                onAddrChange={(pin: string) => this.handleAddrChange(pin)}
                isVisible={true}
                addressPageRoutes={routes}
                location="overview"
              />
            </div>
            <div className="PropertyPage__detail card">
              <BuildingStatsTable
                addr={detailAddr}
                timelineHref={removeIndicatorSuffix(routes.timeline)}
              />
              <div className="PropertyPage__links">
                <UsefulLinks addrForLinks={detailAddr} location="property-page" />
              </div>
            </div>
          </div>

          <PropertiesSummary state={state} send={send} />

          <NearbyOwners
            pin={detailAddr.pin}
            locale={locale}
            isLegacyRoute={isLegacyPath(this.props.location.pathname)}
          />

          <BusinessLinkage pin={detailAddr.pin} />

          <section className="PropertyPage__section card">
            <div className="PropertyPage__sectionHeader">
              <h2>
                <Trans>Portfolio trends</Trans>
              </h2>
            </div>
            <Indicators state={state} send={send} isVisible={true} />
          </section>

          <section className="PropertyPage__section card">
            <div className="PropertyPage__sectionHeader">
              <h2>
                <Trans>Portfolio parcels</Trans>
              </h2>
              <p>
                <Trans>Switch between table and map views to inspect associated parcels.</Trans>
              </p>
            </div>
            <FilterContextProvider>
              <PropertiesList
                state={state}
                send={send}
                onAddrChange={(pin: string) => this.handleAddrChange(pin)}
                addressPageRoutes={routes}
                isVisible={true}
              />
            </FilterContextProvider>
          </section>
        </div>
      </Page>
    );
  }
}
