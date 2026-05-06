import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { CSVDownloader } from "react-papaparse";
import { Button } from "@justfixnyc/component-library";

import Page from "components/Page";
import AddressSearch, { SearchAddress } from "components/AddressSearch";
import APIClient from "components/APIClient";
import {
  AddressRecord,
  OwnerAreaSearchOwner,
  OwnerAreaSearchParcel,
  OwnerAreaSearchResults,
} from "components/APIDataTypes";
import OwnerSearchMap from "components/OwnerSearchMap";
import ParcelPreviewModal from "components/ParcelPreviewModal";
import LegalFooter from "components/LegalFooter";
import {
  createRouteForAddressPage,
  createRouteForOwnerPage,
  createRouteForSavedListsPage,
} from "routes";
import { parseLocaleFromPath } from "i18n";
import { isLegacyPath } from "components/WowzaToggle";
import {
  isSavedNearbyItem,
  removeSavedNearbyItem,
  saveNearbyOwner,
} from "util/savedNearbyLists";

import "styles/FindOwnersPage.css";

type BuildingTypeOption = {
  value: string;
  label: string;
};

type PortfolioSizeOption = {
  value: string;
  label: string;
  min: number;
  max: number | null;
};

const BUILDING_TYPE_OPTIONS: BuildingTypeOption[] = [
  { value: "single_family", label: "Single-family" },
  { value: "two_flat", label: "Two-flat" },
  { value: "three_flat", label: "Three-flat" },
  { value: "multi_family", label: "Multi-family (4+)" },
  { value: "condo", label: "Condo / co-op" },
  { value: "commercial", label: "Commercial / mixed use" },
];

const PORTFOLIO_SIZE_OPTIONS: PortfolioSizeOption[] = [
  { value: "any", label: "Any portfolio size", min: 1, max: null },
  { value: "1", label: "1 parcel", min: 1, max: 1 },
  { value: "2_5", label: "2-5 parcels", min: 2, max: 5 },
  { value: "6_20", label: "6-20 parcels", min: 6, max: 20 },
  { value: "21_50", label: "21-50 parcels", min: 21, max: 50 },
  { value: "50_plus", label: "50+ parcels", min: 50, max: null },
];

const MIN_RADIUS_M = 5;
const MAX_RADIUS_M = 2000;
const RESULT_LIMIT = 100;

function formatAddress(address?: string | null, pin?: string) {
  return address || pin || "Unknown parcel";
}

function formatMailing(owner: OwnerAreaSearchOwner) {
  return [owner.mailing_address, owner.mailing_city, owner.mailing_state, owner.mailing_zip]
    .filter(Boolean)
    .join(owner.mailing_address ? ", " : " ");
}

function formatRadiusLabel(radiusM: number) {
  if (radiusM < 1000) return `${radiusM}m`;
  const kmValue = radiusM / 1000;
  return `${Number.isInteger(kmValue) ? kmValue : kmValue.toFixed(1)}km`;
}

const FindOwnersPage: React.FC = () => {
  const location = useLocation();
  const locale = parseLocaleFromPath(location.pathname) || undefined;
  const legacy = isLegacyPath(location.pathname);

  const [searchPin, setSearchPin] = React.useState<string>("");
  const [radiusM, setRadiusM] = React.useState<number>(600);
  const [buildingTypes, setBuildingTypes] = React.useState<string[]>(
    BUILDING_TYPE_OPTIONS.map((option) => option.value)
  );
  const [portfolioSize, setPortfolioSize] = React.useState<string>("any");
  const [data, setData] = React.useState<OwnerAreaSearchResults | null>(null);
  const [isLoading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = React.useState<OwnerAreaSearchParcel | null>(null);
  const [selectedOwner, setSelectedOwner] = React.useState<OwnerAreaSearchOwner | null>(null);
  const [selectedParcelDetail, setSelectedParcelDetail] = React.useState<AddressRecord | null>(null);
  const [isParcelDetailLoading, setParcelDetailLoading] = React.useState(false);
  const [, setSavedVersion] = React.useState(0);

  const selectedPortfolioSize =
    PORTFOLIO_SIZE_OPTIONS.find((option) => option.value === portfolioSize) || PORTFOLIO_SIZE_OPTIONS[0];

  React.useEffect(() => {
    if (!searchPin) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    APIClient.searchOwnersByArea({
      pin: searchPin,
      radiusM,
      buildingTypes,
      minParcels: selectedPortfolioSize.min,
      maxParcels: selectedPortfolioSize.max,
      limit: RESULT_LIMIT,
    })
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((searchError) => {
        if (!cancelled) {
          setData(null);
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchPin, radiusM, buildingTypes, selectedPortfolioSize.min, selectedPortfolioSize.max]);

  const handleAddressSubmit = React.useCallback((searchAddress: SearchAddress, searchError: any) => {
    if (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Address search failed.");
      return;
    }

    if (!searchAddress.pin) {
      return;
    }

    setSearchPin(searchAddress.pin);
  }, []);

  const toggleBuildingType = React.useCallback((value: string) => {
    setBuildingTypes((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : current.concat(value)
    );
  }, []);

  React.useEffect(() => {
    if (!selectedParcel?.pin) {
      setSelectedParcelDetail(null);
      setParcelDetailLoading(false);
      return;
    }

    let cancelled = false;
    setParcelDetailLoading(true);

    APIClient.searchForAddress({
      pin: selectedParcel.pin,
      housenumber: "",
      streetname: "",
      city: "",
      state: "",
      zip: "",
    })
      .then((result) => {
        if (!cancelled) {
          setSelectedParcelDetail(result.addrs[0] || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedParcelDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setParcelDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParcel?.pin]);

  const handleCloseParcelModal = React.useCallback(() => {
    setSelectedParcel(null);
    setSelectedOwner(null);
    setSelectedParcelDetail(null);
    setParcelDetailLoading(false);
  }, []);

  const ownerExportRows = React.useMemo(
    () =>
      (data?.result || []).map((owner) => ({
        owner_key: owner.owner_key,
        owner_id: owner.owner_id || "",
        owner_name: owner.owner_name || "",
        mailing_address: owner.mailing_address || "",
        mailing_city: owner.mailing_city || "",
        mailing_state: owner.mailing_state || "",
        mailing_zip: owner.mailing_zip || "",
        mailing_full: formatMailing(owner),
        parcel_count: owner.parcel_count || 0,
        nearest_distance_m: owner.nearest_distance_m ?? "",
        same_owner: owner.same_owner,
        building_types: owner.building_type_counts
          .map((entry) => `${entry.building_type_label} (${entry.parcel_count || 0})`)
          .join(" | "),
        parcel_pins: owner.parcels.map((parcel) => parcel.pin).join(", "),
        parcel_addresses: owner.parcels.map((parcel) => formatAddress(parcel.address, parcel.pin)).join(" | "),
      })),
    [data]
  );

  const toggleSavedOwner = React.useCallback(
    (owner: OwnerAreaSearchOwner) => {
      const ownerType = owner.owner_id ? "id" : "name";
      const ownerKey = owner.owner_id || owner.owner_name || owner.owner_key;
      const key = `owner:${ownerType}:${ownerKey}`;

      if (isSavedNearbyItem(key)) {
        removeSavedNearbyItem(key);
      } else {
        saveNearbyOwner({
          ownerType,
          ownerKey,
          ownerName: owner.owner_name || "Unknown owner",
          mailingAddress: formatMailing(owner),
          parcelCount: owner.parcel_count || 0,
          parcelPins: owner.parcels.map((parcel) => parcel.pin),
          sourcePin: searchPin,
          nearestDistanceM: owner.nearest_distance_m ?? null,
        });
      }

      setSavedVersion((value) => value + 1);
    },
    [searchPin]
  );

  return (
    <Page title="Find owners">
      <div className="FindOwnersPage Page">
        <section className="FindOwnersPage__intro card">
          <div>
            <p className="FindOwnersPage__eyebrow">
              <Trans>Nearby owner search</Trans>
            </p>
            <h1>
              <Trans>Search an address, then filter nearby owners by building type and portfolio size</Trans>
            </h1>
            <p>
              <Trans>
                Start with a Chicago address, choose a search radius, and narrow the nearby owner list
                to the kinds of buildings you want to research.
              </Trans>
            </p>
          </div>
          <div className="FindOwnersPage__actions">
            <Link to={createRouteForSavedListsPage(locale, legacy)}>
              <Trans>Open saved lists</Trans>
            </Link>
          </div>
        </section>

        <section className="FindOwnersPage__controls card">
          <div className="FindOwnersPage__searchBlock">
            <AddressSearch
              labelText={<Trans>Search a Chicago address</Trans>}
              labelClass="text-assistive"
              onFormSubmit={handleAddressSubmit}
              showSubmitButton
              submitButtonText={<Trans>Search area</Trans>}
            />
          </div>

            <div className="FindOwnersPage__filterGrid">
              <div className="FindOwnersPage__filterGroup">
                <label className="FindOwnersPage__filterLabel" htmlFor="radius-slider">
                  <Trans>Radius</Trans>
                </label>
                <div className="FindOwnersPage__sliderBlock">
                  <div className="FindOwnersPage__sliderValue">{formatRadiusLabel(radiusM)}</div>
                  <input
                    id="radius-slider"
                    className="FindOwnersPage__slider"
                    type="range"
                    min={MIN_RADIUS_M}
                    max={MAX_RADIUS_M}
                    step={5}
                    value={radiusM}
                    onChange={(event) => setRadiusM(Number(event.target.value))}
                  />
                  <div className="FindOwnersPage__sliderScale">
                    <span>5m</span>
                    <span>600m</span>
                    <span>2km</span>
                  </div>
                </div>
              </div>

            <div className="FindOwnersPage__filterGroup">
              <label className="FindOwnersPage__filterLabel" htmlFor="portfolio-size-select">
                <Trans>Portfolio size</Trans>
              </label>
              <select
                id="portfolio-size-select"
                className="form-select"
                value={portfolioSize}
                onChange={(event) => setPortfolioSize(event.target.value)}
              >
                {PORTFOLIO_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="FindOwnersPage__filterGroup FindOwnersPage__filterGroup--wide">
              <span className="FindOwnersPage__filterLabel">
                <Trans>Building types</Trans>
              </span>
              <div className="FindOwnersPage__checkboxGrid">
                {BUILDING_TYPE_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={buildingTypes.includes(option.value)}
                      onChange={() => toggleBuildingType(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {!searchPin ? (
          <section className="FindOwnersPage__empty card">
            <p>
              <Trans>Search an address to load nearby owners and parcels on the map.</Trans>
            </p>
          </section>
        ) : isLoading ? (
          <section className="FindOwnersPage__empty card">
            <p>
              <Trans>Loading nearby owners...</Trans>
            </p>
          </section>
        ) : error ? (
          <section className="FindOwnersPage__empty card">
            <p>{error}</p>
          </section>
        ) : data?.seed ? (
          <>
            <section className="FindOwnersPage__summary card">
              <div className="FindOwnersPage__summaryContent">
                <div>
                  <p className="FindOwnersPage__eyebrow">
                    <Trans>Search center</Trans>
                  </p>
                  <h2>{formatAddress(data.seed.address, data.seed.pin)}</h2>
                  <p>
                    {data.result.length} <Trans>owners found</Trans>
                    {data.result.length === RESULT_LIMIT ? " • result limit reached" : ""}
                  </p>
                </div>
                {ownerExportRows.length > 0 && (
                  <CSVDownloader data={ownerExportRows} filename={`find-owners-${data.seed.pin}-owners`}>
                    <Button labelText="Export owners CSV" variant="secondary" size="small" />
                  </CSVDownloader>
                )}
              </div>
            </section>

            <div className="FindOwnersPage__resultsLayout">
              <div className="FindOwnersPage__map card">
                <OwnerSearchMap
                  seed={data.seed}
                  owners={data.result}
                  radiusM={radiusM}
                  onParcelClick={(owner, parcel) => {
                    setSelectedOwner(owner);
                    setSelectedParcel(parcel);
                  }}
                />
              </div>

              <section className="FindOwnersPage__results card">
                <h2>
                  <Trans>Matching owners</Trans>
                </h2>
                {data.result.length === 0 ? (
                  <p>
                    <Trans>No owners matched the current filters in this search area.</Trans>
                  </p>
                ) : (
                  <div className="FindOwnersPage__ownerList">
                    {data.result.map((owner) => (
                      <article key={owner.owner_key} className="FindOwnersPage__ownerCard">
                        <div className="FindOwnersPage__ownerHeader">
                          <div>
                            <h3>
                              <Link
                                to={createRouteForOwnerPage(
                                  {
                                    ownerType: owner.owner_id ? "id" : "name",
                                    ownerKey: owner.owner_id || owner.owner_name || owner.owner_key,
                                    locale,
                                  },
                                  legacy
                                )}
                              >
                                {owner.owner_name || owner.owner_key}
                              </Link>
                            </h3>
                            <p>{formatMailing(owner) || "N/A"}</p>
                          </div>
                          <div className="FindOwnersPage__ownerMeta">
                            <span>{owner.parcel_count} parcels</span>
                            <span>{owner.nearest_distance_m ?? "?"}m</span>
                            {owner.same_owner && (
                              <span className="FindOwnersPage__sameOwnerBadge">
                                <Trans>Same owner</Trans>
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="FindOwnersPage__buildingTypes">
                          {owner.building_type_counts
                            .map((entry) => `${entry.building_type_label} (${entry.parcel_count || 0})`)
                            .join(" • ")}
                        </p>
                        <div className="FindOwnersPage__ownerActions">
                          <button type="button" onClick={() => toggleSavedOwner(owner)}>
                            {isSavedNearbyItem(
                              `owner:${owner.owner_id ? "id" : "name"}:${
                                owner.owner_id || owner.owner_name || owner.owner_key
                              }`
                            )
                              ? "Remove from saved"
                              : "Save owner"}
                          </button>
                        </div>
                        <div className="FindOwnersPage__parcelLinks">
                          {owner.parcels.slice(0, 6).map((parcel) => (
                            <Link
                              key={parcel.pin}
                              to={createRouteForAddressPage({ pin: parcel.pin, locale }, legacy)}
                            >
                              {formatAddress(parcel.address, parcel.pin)}
                            </Link>
                          ))}
                          {owner.parcels.length > 6 && (
                            <span>+{owner.parcels.length - 6} more parcels</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="FindOwnersPage__empty card">
            <p>
              <Trans>No mapped parcel was available for that address.</Trans>
            </p>
          </section>
        )}

        <ParcelPreviewModal
          showModal={Boolean(selectedParcel && selectedOwner)}
          parcel={selectedParcel}
          owner={selectedOwner}
          detailAddr={selectedParcelDetail}
          isLoading={isParcelDetailLoading}
          propertyHref={
            selectedParcel ? createRouteForAddressPage({ pin: selectedParcel.pin, locale }, legacy) : "#"
          }
          onClose={handleCloseParcelModal}
        />

        <LegalFooter />
      </div>
    </Page>
  );
};

export default FindOwnersPage;
