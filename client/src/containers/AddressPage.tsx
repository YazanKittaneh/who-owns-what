import React, { Component } from "react";

import AddressToolbar from "../components/AddressToolbar";
import PropertiesList, { FilterContextProvider } from "../components/PropertiesList";
import DetailView from "../components/DetailView";
import PropertiesMap from "../components/PropertiesMap";
import PropertiesSummary from "../components/PropertiesSummary";
import Indicators from "../components/Indicators";
import ComplaintsSummary from "../components/ComplaintsSummary";
import ViolationsSummary from "../components/ViolationsSummary";
import EvictionsSummary from "../components/EvictionsSummary";
import RentstabSummary from "../components/RentstabSummary";
import { LoadingPage } from "../components/Loader";

import "styles/AddressPage.css";
import NotRegisteredPage from "./NotRegisteredPage";
import { Trans, Plural } from "@lingui/macro";
import { Link, RouteComponentProps } from "react-router-dom";
import _find from "lodash/find";
import Page from "../components/Page";
import { SearchAddress } from "../components/AddressSearch";
import { withMachineProps } from "state-machine";
import { AddrNotFoundPage } from "./NotFoundPage";
import { searchAddrsAreEqual } from "util/helpers";
import { NetworkErrorMessage } from "components/NetworkErrorMessage";
import { createAddressPageRoutes, createRouteForAddressPage, removeIndicatorSuffix } from "routes";
import { isLegacyPath } from "../components/WowzaToggle";
import { logAmplitudeEvent } from "components/Amplitude";
import { localeFromRouter } from "i18n";

type RouteParams = {
  locale?: string;
  pin?: string;
  indicator?: string;
};

type AddressPageProps = RouteComponentProps<RouteParams> &
  withMachineProps & {
    currentTab: number;
    useNewPortfolioMethod?: boolean;
  };

type State = {
  detailMobileSlide: boolean;
};

const validateRouteParams = (params: RouteParams) => {
  if (!params.pin) {
    throw new Error("Address Page URL params did not contain a proper PIN!");
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

export default class AddressPage extends Component<AddressPageProps, State> {
  constructor(props: AddressPageProps) {
    super(props);

    this.state = {
      detailMobileSlide: false,
    };
  }

  componentDidMount() {
    const { state, send, match } = this.props;
    if (
      state.matches("portfolioFound") &&
      searchAddrsAreEqual(state.context.portfolioData.searchAddr, validateRouteParams(match.params))
    )
      return;
    send({
      type: "SEARCH",
      address: validateRouteParams(match.params),
      useNewPortfolioMethod: this.props.useNewPortfolioMethod || false,
    });
    this.handleCloseDetail();
  }

  componentDidUpdate(prevProps: AddressPageProps, prevState: State) {
    return;
  }

  handleOpenDetail = () => {
    this.setState({
      detailMobileSlide: true,
    });
  };

  handleCloseDetail = () => {
    this.setState({
      detailMobileSlide: false,
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
    this.handleOpenDetail();
  };

  render() {
    const { state, send, useNewPortfolioMethod } = this.props;

    if (state.matches("pinNotFound")) {
      window.gtag("event", "pin-not-found-page");
      return <AddrNotFoundPage />;
    } else if (state.matches("unregisteredFound")) {
      window.gtag("event", "unregistered-page");
      return <NotRegisteredPage state={state} send={send} />;
    } else if (state.matches("portfolioFound")) {
      const { assocAddrs, searchAddr } = state.context.portfolioData;
      const analyticsEventData = {
        portfolioSize: assocAddrs.length,
        portfolioMappingMethod: !!useNewPortfolioMethod ? "wowza" : "legacy",
      };
      logAmplitudeEvent("portfolioFound", analyticsEventData);
      window.gtag("event", "portfolio-found-page");

      const routes = createAddressPageRoutes(
        validateRouteParams(this.props.match.params),
        !useNewPortfolioMethod
      );

      return (
        <Page title={`Portfolio for PIN ${this.props.match.params.pin}`}>
          <div className="AddressPage">
            <div className="AddressPage__info">
              <div>
                <h1 className="primary">
                  <Trans>
                    PORTFOLIO: Your search address is associated with{" "}
                    <Link
                      to={routes.portfolio}
                      tabIndex={this.props.currentTab === 1 ? -1 : 0}
                      onClick={() => {
                        logAmplitudeEvent("numAddrsClick");
                        window.gtag("event", "num-addrs-click");
                      }}
                    >
                      {assocAddrs.length}
                    </Link>{" "}
                    <Plural value={assocAddrs.length} one="parcel" other="parcels" />
                  </Trans>
                </h1>
                <ul className="tab tab-block">
                  <li className={`tab-item ${this.props.currentTab === 0 ? "active" : ""}`}>
                    <Link to={routes.overview} tabIndex={this.props.currentTab === 0 ? -1 : 0}>
                      <Trans>Overview</Trans>
                    </Link>
                  </li>
                  <li className={`tab-item ${this.props.currentTab === 1 ? "active" : ""}`}>
                    <Link
                      to={routes.portfolio}
                      tabIndex={this.props.currentTab === 1 ? -1 : 0}
                      onClick={() => {
                        logAmplitudeEvent("portfolioTab");
                        window.gtag("event", "portfolio-tab");
                      }}
                    >
                      <Trans>Portfolio</Trans>
                    </Link>
                  </li>
                  <li className={`tab-item ${this.props.currentTab === 2 ? "active" : ""}`}>
                    <Link
                      to={removeIndicatorSuffix(routes.timeline)}
                      tabIndex={this.props.currentTab === 2 ? -1 : 0}
                      onClick={() => {
                        logAmplitudeEvent("timelineTab");
                        window.gtag("event", "timeline-tab");
                      }}
                    >
                      <Trans>Timeline</Trans>
                    </Link>
                  </li>
                  <li className={`tab-item ${this.props.currentTab === 3 ? "active" : ""}`}>
                    <Link
                      to={routes.summary}
                      tabIndex={this.props.currentTab === 3 ? -1 : 0}
                      onClick={() => {
                        logAmplitudeEvent("summaryTab");
                        window.gtag("event", "summary-tab");
                      }}
                    >
                      <Trans>Summary</Trans>
                    </Link>
                  </li>
                </ul>
              </div>
              <AddressToolbar searchAddr={searchAddr} assocAddrs={assocAddrs} />
            </div>
            <div
              className={`AddressPage__content AddressPage__overview ${
                this.props.currentTab === 0 ? "AddressPage__content-active" : ""
              }`}
            >
              <PropertiesSummary state={state} send={send} />
              <div className="AddressPage__viz">
                <PropertiesMap
                  state={state}
                  send={send}
                  onAddrChange={(pin: string) => this.handleAddrChange(pin)}
                  isVisible={this.props.currentTab === 0}
                  addressPageRoutes={routes}
                  location="overview"
                />
                <DetailView
                  state={state}
                  send={send}
                  mobileShow={this.state.detailMobileSlide}
                  onClose={this.handleCloseDetail}
                  onAddrChange={(pin: string) => this.handleAddrChange(pin)}
                />
              </div>
            </div>
            <div
              className={`AddressPage__content AddressPage__portfolio ${
                this.props.currentTab === 1 ? "AddressPage__content-active" : ""
              }`}
            >
              <FilterContextProvider>
                <PropertiesList
                  state={state}
                  send={send}
                  onAddrChange={(pin: string) => this.handleAddrChange(pin)}
                  addressPageRoutes={routes}
                />
              </FilterContextProvider>
            </div>
            <div
              className={`AddressPage__content ${
                this.props.currentTab === 2 ? "AddressPage__content-active" : ""
              }`}
            >
              <Indicators state={state} send={send} isVisible={this.props.currentTab === 2} />
            </div>
            <div
              className={`AddressPage__content AddressPage__summary ${
                this.props.currentTab === 3 ? "AddressPage__content-active" : ""
              }`}
            >
              <div className="p-2">
                <div className="card p-2 mb-2">
                  <ComplaintsSummary state={state} send={send} />
                </div>
                <div className="card p-2 mb-2">
                  <ViolationsSummary state={state} send={send} />
                </div>
                <div className="card p-2 mb-2">
                  <EvictionsSummary state={state} send={send} />
                </div>
                <div className="card p-2 mb-2">
                  <RentstabSummary state={state} send={send} />
                </div>
              </div>
            </div>
          </div>
        </Page>
      );
    } else if (state.matches("networkErrorOccurred")) {
      return <NetworkErrorMessage />;
    }

    return <LoadingPage />;
  }
}
