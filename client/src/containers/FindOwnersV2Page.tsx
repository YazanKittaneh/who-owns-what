import React, { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { CSVDownloader } from "react-papaparse";

import Page from "components/Page";
import APIClient from "components/APIClient";
import { FindOwnersV2SearchOwner, FindOwnersV2SearchResults } from "components/APIDataTypes";
import FindOwnersV2Map from "components/FindOwnersV2Map";
import LegalFooter from "components/LegalFooter";
import {
  createRouteForAddressPage,
  createRouteForOwnerPage,
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
  { value: "two_flat", label: "2-flat" },
  { value: "three_flat", label: "3-flat" },
  { value: "multi_family", label: "4+ unit multifamily" },
  { value: "condo", label: "Condo / co-op" },
  { value: "commercial", label: "Commercial / mixed-use" },
];

const PORTFOLIO_SIZE_OPTIONS: PortfolioSizeOption[] = [
  { value: "any", label: "Any holdings", min: 1, max: null },
  { value: "1", label: "1 property", min: 1, max: 1 },
  { value: "2_5", label: "2-5 properties", min: 2, max: 5 },
  { value: "6_20", label: "6-20 properties", min: 6, max: 20 },
  { value: "21_50", label: "21-50 properties", min: 21, max: 50 },
  { value: "50_plus", label: "50+ properties", min: 50, max: null },
];

const RESULT_LIMIT = 100;
const ANY_PROPERTY_TYPE = "any_property_type";

function formatAddress(address?: string | null, pin?: string) {
  return address || pin || "Unknown parcel";
}

function formatMailing(owner: FindOwnersV2SearchOwner) {
  return [owner.mailing_address, owner.mailing_city, owner.mailing_state, owner.mailing_zip]
    .filter(Boolean)
    .join(owner.mailing_address ? ", " : " ");
}

function getSavedOwnerLookupKey(owner: FindOwnersV2SearchOwner) {
  const ownerType = owner.owner_id ? "id" : "name";
  const ownerKey = owner.owner_id || owner.owner_name || owner.owner_key;
  return `owner:${ownerType}:${ownerKey}`;
}

const FindOwnersV2Page: React.FC = () => {
  const location = useLocation();
  const locale = parseLocaleFromPath(location.pathname) || undefined;
  const legacy = isLegacyPath(location.pathname);

  const [buildingTypes, setBuildingTypes] = useState<string[]>(
    []
  );
  const [portfolioSize, setPortfolioSize] = useState<string>("any");
  const [data, setData] = useState<FindOwnersV2SearchResults | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string | null>(null);
  const [, setSavedVersion] = useState(0);
  const [hasPolygon, setHasPolygon] = useState(false);

  const selectedPortfolioSize =
    PORTFOLIO_SIZE_OPTIONS.find((option) => option.value === portfolioSize) || PORTFOLIO_SIZE_OPTIONS[0];

  const handlePolygonDrawn = useCallback(
    async (geojson: string) => {
      setHasPolygon(true);
      setLoading(true);
      setError(null);

      try {
        const results = await APIClient.findOwnersV2Search({
          geojson,
          buildingTypes: buildingTypes.length > 0 ? buildingTypes : undefined,
          minParcels: selectedPortfolioSize.min,
          maxParcels: selectedPortfolioSize.max,
          limit: RESULT_LIMIT,
        });
        setData(results);
        setSelectedOwnerKey(results.result[0]?.owner_key || null);
      } catch (err: any) {
        setError(err.message || "Failed to search owners");
      } finally {
        setLoading(false);
      }
    },
    [buildingTypes, selectedPortfolioSize]
  );

  const handlePolygonDeleted = useCallback(() => {
    setHasPolygon(false);
    setData(null);
    setError(null);
    setSelectedOwnerKey(null);
    setSelectedPin(null);
  }, []);

  const toggleBuildingType = (value: string) => {
    if (value === ANY_PROPERTY_TYPE) {
      setBuildingTypes([]);
      return;
    }

    setBuildingTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      return next;
    });
  };

  const handlePortfolioSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPortfolioSize(e.target.value);
  };

  const focusOwnerOnMap = useCallback((owner: FindOwnersV2SearchOwner) => {
    setSelectedOwnerKey(owner.owner_key);
    setSelectedPin(owner.parcels?.[0]?.pin || null);
  }, []);

  const highlightedPins = React.useMemo(
    () => data?.result.find((owner) => owner.owner_key === selectedOwnerKey)?.parcels.map((parcel) => parcel.pin) || [],
    [data, selectedOwnerKey]
  );

  const propertyTypeSummary = React.useMemo(() => {
    if (buildingTypes.length === 0) {
      return "Any property type";
    }
    if (buildingTypes.length === 1) {
      return BUILDING_TYPE_OPTIONS.find((option) => option.value === buildingTypes[0])?.label || "1 type";
    }
    return `${buildingTypes.length} property types`;
  }, [buildingTypes]);

  const toggleSavedOwner = (owner: FindOwnersV2SearchOwner) => {
    const ownerType = owner.owner_id ? "id" : "name";
    const ownerKey = owner.owner_id || owner.owner_name || owner.owner_key;
    const key = getSavedOwnerLookupKey(owner);
    if (isSavedNearbyItem(key)) {
      removeSavedNearbyItem(key);
    } else {
      saveNearbyOwner({
        ownerType,
        ownerKey,
        ownerName: owner.owner_name || "Unknown Owner",
        mailingAddress: formatMailing(owner),
        parcelCount: owner.parcel_count || 0,
        parcelPins: (owner.parcels || []).map((p) => p.pin),
        sourcePin: owner.parcels?.[0]?.pin || "",
        nearestDistanceM: owner.nearest_distance_m || null,
      });
    }
    setSavedVersion((v) => v + 1);
  };

  const exportCSVData = React.useMemo(() => {
    if (!data) return [];
    return data.result.map((owner) => ({
      "Owner Name": owner.owner_name || "",
      "Mailing Address": formatMailing(owner),
      "Parcel Count": owner.parcel_count || 0,
      "Building Types": (owner.building_type_counts || [])
        .map((btc) => `${btc.building_type_label} (${btc.parcel_count})`)
        .join(", "),
      "Parcels": (owner.parcels || []).map((p) => p.address || p.pin).join("; "),
    }));
  }, [data]);

  return (
    <Page title="Find Owners" >
      <div className="FindOwnersPage FindOwnersPage--v2">
        <div className="FindOwnersPage__content">
          <div className="FindOwnersPage__search-section">
            <div className="FindOwnersPage__panel FindOwnersPage__panel--intro">
              <p className="FindOwnersPage__eyebrow"><Trans>Area Search</Trans></p>
              <h1><Trans>Find owners with a map-based area search</Trans></h1>
              <p className="FindOwnersPage__lead">
                <Trans>
                  Outline a search area on the map, then refine by property type and owner holdings.
                </Trans>
              </p>
            </div>
            
            <div className="FindOwnersPage__panel FindOwnersPage__panel--filters">
              <div className="FindOwnersPage__panelHeader">
                <h2><Trans>Refine Search</Trans></h2>
                <p><Trans>Set the property profile you want to review before drawing the area.</Trans></p>
              </div>
              <div className="FindOwnersPage__filters">
              <div className="FindOwnersPage__filter-group">
                <label><Trans>Property Type</Trans></label>
                <div className="FindOwnersPage__building-types">
                  <button
                    type="button"
                    className={`FindOwnersPage__chip ${buildingTypes.length === 0 ? "active" : ""}`}
                    onClick={() => toggleBuildingType(ANY_PROPERTY_TYPE)}
                  >
                    <Trans>Any</Trans>
                  </button>
                  {BUILDING_TYPE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={`FindOwnersPage__chip ${buildingTypes.includes(option.value) ? "active" : ""}`}
                      onClick={() => toggleBuildingType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="FindOwnersPage__filter-group">
                <label><Trans>Owner Holdings</Trans></label>
                <select className="FindOwnersPage__select" value={portfolioSize} onChange={handlePortfolioSizeChange}>
                  {PORTFOLIO_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="FindOwnersPage__helperText">
                  <Trans>Filter owners by how many properties they hold across the dataset.</Trans>
                </p>
              </div>
              </div>

              <div className="FindOwnersPage__summaryChips">
                <span className="FindOwnersPage__summaryChip">{propertyTypeSummary}</span>
                <span className="FindOwnersPage__summaryChip">{selectedPortfolioSize.label}</span>
              </div>
            </div>

            {!hasPolygon && !isLoading && !error && (
              <div className="FindOwnersPage__panel FindOwnersPage__panel--emptyState">
                <div className="FindOwnersPage__steps">
                  <span><Trans>1. Move the map</Trans></span>
                  <span><Trans>2. Draw an area</Trans></span>
                  <span><Trans>3. Review matching owners</Trans></span>
                </div>
                <div className="FindOwnersPage__loading">
                  <Trans>Zoom into Chicago and draw an area to load matching owners.</Trans>
                </div>
              </div>
            )}

            {error && (
              <div className="FindOwnersPage__panel">
                <div className="FindOwnersPage__error">{error}</div>
              </div>
            )}

            {isLoading && (
              <div className="FindOwnersPage__panel">
                <div className="FindOwnersPage__loading"><Trans>Searching owners...</Trans></div>
              </div>
            )}

            {data && !isLoading && (
              <div className="FindOwnersPage__panel FindOwnersPage__results">
                <div className="FindOwnersPage__results-header">
                  <div>
                    <h2>
                      <Trans>{data.result.length} owners match this area</Trans>
                    </h2>
                    <p className="FindOwnersPage__resultsSubhead">
                      <Trans>Use the map and cards together to review likely owners.</Trans>
                    </p>
                  </div>
                  <CSVDownloader
                    data={exportCSVData}
                    filename="find-owners-v2"
                    type="link"
                    style={{ color: "#0088ce", textDecoration: "underline" }}
                  >
                    <Trans>Export CSV</Trans>
                  </CSVDownloader>
                </div>

                <div className="FindOwnersPage__results-list">
                  {data.result.map((owner) => (
                    <div
                      key={owner.owner_key}
                      className={`FindOwnersPage__result-card ${selectedOwnerKey === owner.owner_key ? "FindOwnersPage__result-card--active" : ""}`}
                    >
                      <div className="FindOwnersPage__result-header">
                        <div className="FindOwnersPage__resultHeaderMain">
                          <Link
                            to={createRouteForOwnerPage({
                              locale,
                              ownerType: owner.owner_id ? "id" : "name",
                              ownerKey: owner.owner_id || owner.owner_name || owner.owner_key,
                            }, legacy)}
                            className="FindOwnersPage__owner-link"
                          >
                            {owner.owner_name || "Unknown Owner"}
                          </Link>
                          <div className="FindOwnersPage__resultActions">
                            <button
                              type="button"
                              className="FindOwnersPage__secondaryAction"
                              onClick={() => focusOwnerOnMap(owner)}
                            >
                              <Trans>Show on map</Trans>
                            </button>
                            <button
                              type="button"
                              className={`FindOwnersPage__save-btn ${isSavedNearbyItem(getSavedOwnerLookupKey(owner)) ? "saved" : ""}`}
                              onClick={() => toggleSavedOwner(owner)}
                              title={isSavedNearbyItem(getSavedOwnerLookupKey(owner)) ? "Remove from saved" : "Save owner"}
                            >
                              {isSavedNearbyItem(getSavedOwnerLookupKey(owner)) ? "★" : "☆"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="FindOwnersPage__result-details">
                        {formatMailing(owner) && (
                          <div className="FindOwnersPage__mailing">{formatMailing(owner)}</div>
                        )}
                        <div className="FindOwnersPage__stats">
                          <span>{owner.parcel_count} properties</span>
                          {owner.nearest_distance_m && (
                            <span>{Math.round(owner.nearest_distance_m)}m from drawn area</span>
                          )}
                        </div>

                        {owner.building_type_counts && owner.building_type_counts.length > 0 && (
                          <div className="FindOwnersPage__building-types">
                            {owner.building_type_counts.map((btc) => (
                              <span key={btc.building_type} className="FindOwnersPage__building-type-tag">
                                {btc.building_type_label} ({btc.parcel_count})
                              </span>
                            ))}
                          </div>
                        )}

                        {owner.parcels && owner.parcels.length > 0 && (
                          <div className="FindOwnersPage__parcels">
                            <strong><Trans>Parcels:</Trans></strong>
                            <ul>
                              {owner.parcels.slice(0, 6).map((parcel) => (
                                <li key={parcel.pin}>
                                  <button
                                    type="button"
                                    className="FindOwnersPage__parcelLocate"
                                    onClick={() => {
                                      setSelectedOwnerKey(owner.owner_key);
                                      setSelectedPin(parcel.pin);
                                    }}
                                  >
                                    <Trans>Locate</Trans>
                                  </button>
                                  <Link
                                    to={createRouteForAddressPage({
                                      locale,
                                      pin: parcel.pin,
                                    }, legacy)}
                                  >
                                    {formatAddress(parcel.address, parcel.pin)}
                                  </Link>
                                </li>
                              ))}
                              {owner.parcels.length > 6 && (
                                <li>+{owner.parcels.length - 6} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="FindOwnersPage__map-container">
            <FindOwnersV2Map
              onPolygonDrawn={handlePolygonDrawn}
              onPolygonDeleted={handlePolygonDeleted}
              selectedPin={selectedPin}
              highlightedPins={highlightedPins}
              onPinSelect={setSelectedPin}
            />
          </div>
        </div>

        <LegalFooter />
      </div>
    </Page>
  );
};

export default FindOwnersV2Page;
