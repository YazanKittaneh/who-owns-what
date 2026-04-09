import React from "react";

import LegalFooter from "../components/LegalFooter";
import "styles/HomePage.css";

import AddressSearch, { SearchAddress } from "../components/AddressSearch";
import { Trans } from "@lingui/macro";
import Page from "../components/Page";
import {
  createAddressPageRoutes,
  createRouteForAddressPage,
  removeIndicatorSuffix,
} from "../routes";
import { withMachineProps } from "state-machine";
import { parseLocaleFromPath } from "i18n";
import { useHistory, useLocation } from "react-router-dom";
import { logAmplitudeEvent } from "components/Amplitude";
import APIClient from "components/APIClient";
import OverviewMap, { OverviewBounds } from "components/OverviewMap";
import PropertyOverviewModal from "components/PropertyOverviewModal";
import { AddressRecord, OverviewMapProperty } from "components/APIDataTypes";

type HomePageProps = {
  useNewPortfolioMethod?: boolean;
} & withMachineProps;

const HomePage: React.FC<HomePageProps> = () => {
  const { pathname } = useLocation();
  const locale = parseLocaleFromPath(pathname) || undefined;
  const history = useHistory();
  const [bounds, setBounds] = React.useState<OverviewBounds | null>(null);
  const [mapProperties, setMapProperties] = React.useState<OverviewMapProperty[]>([]);
  const [isMapLoading, setMapLoading] = React.useState(false);
  const [isPropertyLoading, setPropertyLoading] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);
  const [selectedPin, setSelectedPin] = React.useState<string | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = React.useState<{
    assocAddrs: AddressRecord[];
    detailAddr: AddressRecord;
  } | null>(null);
  const requestIdRef = React.useRef(0);

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

  React.useEffect(() => {
    if (!bounds) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setMapLoading(true);

    APIClient.getOverviewMapProperties({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      limit: bounds.zoom >= 15 ? 1200 : bounds.zoom >= 13 ? 900 : 600,
    })
      .then((results) => {
        if (requestId !== requestIdRef.current) return;
        setMapProperties(results.result || []);
        setTruncated(Boolean(results.truncated));
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setMapProperties([]);
        setTruncated(false);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setMapLoading(false);
        }
      });
  }, [bounds]);

  const handleMarkerClick = React.useCallback(
    async (pin: string) => {
      setSelectedPin(pin);
      setSelectedPortfolio(null);
      setPropertyLoading(true);

      try {
        const results = await APIClient.getPortfolioByPin(pin);
        const assocAddrs = results.addrs || [];
        const detailAddr = assocAddrs.find((addr) => addr.pin === pin) || assocAddrs[0] || null;
        if (!detailAddr) {
          setSelectedPin(null);
          return;
        }
        setSelectedPortfolio({ assocAddrs, detailAddr });
      } catch (_error) {
        setSelectedPin(null);
        setSelectedPortfolio(null);
      } finally {
        setPropertyLoading(false);
      }
    },
    [setSelectedPin, setSelectedPortfolio]
  );

  const handleCloseModal = React.useCallback(() => {
    setSelectedPin(null);
    setSelectedPortfolio(null);
  }, []);

  const propertyHref = selectedPin
    ? createRouteForAddressPage({ pin: selectedPin, locale }, false)
    : "#";
  const propertyRoutes = selectedPin
    ? createAddressPageRoutes({ pin: selectedPin, locale }, false)
    : null;

  return (
    <Page>
      <div className="HomePage HomePage--map Page">
        <div className="HomePage__content">
          <div className="HomePage__search HomePage__search--map">
            <div>
              <h1>
                <Trans>Browse Chicago parcels on the map, then open a full property page</Trans>
              </h1>
              <p>
                <Trans>
                  Pan and zoom to load parcels, click any parcel to inspect it, and highlight its
                  portfolio directly on the map.
                </Trans>
              </p>
            </div>
            <AddressSearch
              labelText={labelText}
              labelClass="text-assistive"
              onFormSubmit={handleFormSubmit}
            />
          </div>

          <OverviewMap
            properties={mapProperties}
            highlightedAddrs={selectedPortfolio?.assocAddrs || []}
            selectedPin={selectedPin}
            isLoading={isMapLoading}
            truncated={truncated}
            onMarkerClick={handleMarkerClick}
            onViewportChange={setBounds}
          />

          <PropertyOverviewModal
            showModal={Boolean(selectedPin)}
            isLoading={isPropertyLoading}
            detailAddr={selectedPortfolio?.detailAddr || null}
            portfolioSize={selectedPortfolio?.assocAddrs.length || 0}
            propertyHref={propertyHref}
            timelineHref={propertyRoutes ? removeIndicatorSuffix(propertyRoutes.timeline) : "#"}
            onClose={handleCloseModal}
          />

          <LegalFooter />
        </div>
      </div>
    </Page>
  );
};

export default HomePage;
