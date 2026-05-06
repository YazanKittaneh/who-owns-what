import React, { useState, useCallback } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { CSVDownloader } from "react-papaparse";
import { Button } from "@justfixnyc/component-library";

import Page from "components/Page";
import AddressSearch, { SearchAddress } from "components/AddressSearch";
import APIClient from "components/APIClient";
import { FindOwnersV2SearchOwner, FindOwnersV2SearchResults } from "components/APIDataTypes";
import FindOwnersV2Map from "components/FindOwnersV2Map";
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

const RESULT_LIMIT = 100;

function formatAddress(address?: string | null, pin?: string) {
  return address || pin || "Unknown parcel";
}

function formatMailing(owner: FindOwnersV2SearchOwner) {
  return [owner.mailing_address, owner.mailing_city, owner.mailing_state, owner.mailing_zip]
    .filter(Boolean)
    .join(owner.mailing_address ? ", " : " ");
}

const FindOwnersV2Page: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const locale = parseLocaleFromPath(location.pathname) || undefined;
  const legacy = isLegacyPath(location.pathname);

  const [buildingTypes, setBuildingTypes] = useState<string[]>(
    BUILDING_TYPE_OPTIONS.map((option) => option.value)
  );
  const [portfolioSize, setPortfolioSize] = useState<string>("any");
  const [data, setData] = useState<FindOwnersV2SearchResults | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
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
  }, []);

  const toggleBuildingType = (value: string) => {
    setBuildingTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      return next;
    });
  };

  const handlePortfolioSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPortfolioSize(e.target.value);
  };

  const toggleSavedOwner = (owner: FindOwnersV2SearchOwner) => {
    const ownerType = owner.owner_id ? "id" : "name";
    const ownerKey = owner.owner_id || owner.owner_name || owner.owner_key;
    const key = `owner:${ownerType}:${ownerKey}`;
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
      <div className="FindOwnersPage">
        <div className="FindOwnersPage__content">
          <div className="FindOwnersPage__search-section">
            <h1><Trans>Find Owners</Trans></h1>
            <p><Trans>Draw a polygon on the map to find property owners in that area.</Trans></p>
            
            <div className="FindOwnersPage__filters">
              <div className="FindOwnersPage__filter-group">
                <label><Trans>Building Types</Trans></label>
                <div className="FindOwnersPage__building-types">
                  {BUILDING_TYPE_OPTIONS.map((option) => (
                    <button
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
                <label><Trans>Portfolio Size</Trans></label>
                <select value={portfolioSize} onChange={handlePortfolioSizeChange}>
                  {PORTFOLIO_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="FindOwnersPage__error">{error}</div>
            )}

            {isLoading && (
              <div className="FindOwnersPage__loading"><Trans>Searching owners...</Trans></div>
            )}

            {data && !isLoading && (
              <div className="FindOwnersPage__results">
                <div className="FindOwnersPage__results-header">
                  <h2>
                    <Trans>{data.result.length} owners found</Trans>
                  </h2>
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
                    <div key={owner.owner_key} className="FindOwnersPage__result-card">
                      <div className="FindOwnersPage__result-header">
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
                        <button
                          className={`FindOwnersPage__save-btn ${isSavedNearbyItem(owner.owner_key) ? "saved" : ""}`}
                          onClick={() => toggleSavedOwner(owner)}
                          title={isSavedNearbyItem(owner.owner_key) ? "Remove from saved" : "Save owner"}
                        >
                          {isSavedNearbyItem(owner.owner_key) ? "★" : "☆"}
                        </button>
                      </div>

                      <div className="FindOwnersPage__result-details">
                        {formatMailing(owner) && (
                          <div className="FindOwnersPage__mailing">{formatMailing(owner)}</div>
                        )}
                        <div className="FindOwnersPage__stats">
                          <span>{owner.parcel_count} parcels</span>
                          {owner.nearest_distance_m && (
                            <span>Nearest: {Math.round(owner.nearest_distance_m)}m</span>
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
