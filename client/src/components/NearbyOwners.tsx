import React from "react";
import { Trans } from "@lingui/macro";
import { Link } from "react-router-dom";
import { CSVDownloader } from "react-papaparse";
import { Button } from "@justfixnyc/component-library";
import APIClient from "./APIClient";
import { NearbyPropertyRecord } from "./APIDataTypes";
import {
  createRouteForAddressPage,
  createRouteForOwnerPage,
  createRouteForSavedListsPage,
} from "routes";
import { logAmplitudeEvent } from "./Amplitude";
import {
  isSavedNearbyItem,
  saveNearbyOwner,
  saveNearbyParcel,
  removeSavedNearbyItem,
} from "util/savedNearbyLists";

import "styles/NearbyOwners.css";

type Props = {
  pin: string;
  locale?: string;
  isLegacyRoute?: boolean;
};

const RADIUS_OPTIONS = [150, 300, 600];
type NearbyViewMode = "owners" | "parcels";

type OwnerGroup = {
  ownerKey: string;
  owner_id?: string | null;
  owner_name?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  parcel_count: number;
  nearest_distance_m: number | null;
  same_owner: boolean;
  parcels: NearbyPropertyRecord[];
};

function formatAddress(record: NearbyPropertyRecord): string {
  return (
    record.address ||
    [record.housenumber, record.streetname].filter(Boolean).join(" ") ||
    record.pin
  );
}

function formatMailing(record: NearbyPropertyRecord): string {
  return [record.mailing_address, record.mailing_city, record.mailing_state, record.mailing_zip]
    .filter(Boolean)
    .join(record.mailing_address ? ", " : " ");
}

function formatGroupMailing(group: OwnerGroup): string {
  const firstParcel = group.parcels[0];
  return firstParcel ? formatMailing(firstParcel) : "";
}

function getOwnerKey(record: NearbyPropertyRecord): string {
  return record.owner_id || record.owner_name || record.pin;
}

function groupByOwner(records: NearbyPropertyRecord[]): OwnerGroup[] {
  const grouped = new Map<string, OwnerGroup>();

  records.forEach((record) => {
    const ownerKey = getOwnerKey(record);
    const existing = grouped.get(ownerKey);
    if (existing) {
      existing.parcels.push(record);
      existing.parcel_count += 1;
      existing.same_owner = existing.same_owner || Boolean(record.same_owner);
      if (
        record.distance_m != null &&
        (existing.nearest_distance_m == null || record.distance_m < existing.nearest_distance_m)
      ) {
        existing.nearest_distance_m = record.distance_m;
      }
      return;
    }

    grouped.set(ownerKey, {
      ownerKey,
      owner_id: record.owner_id,
      owner_name: record.owner_name,
      mailing_address: record.mailing_address,
      mailing_city: record.mailing_city,
      mailing_state: record.mailing_state,
      mailing_zip: record.mailing_zip,
      parcel_count: 1,
      nearest_distance_m: record.distance_m ?? null,
      same_owner: Boolean(record.same_owner),
      parcels: [record],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.same_owner !== b.same_owner) return a.same_owner ? -1 : 1;
    if ((a.nearest_distance_m ?? Infinity) !== (b.nearest_distance_m ?? Infinity)) {
      return (a.nearest_distance_m ?? Infinity) - (b.nearest_distance_m ?? Infinity);
    }
    return (b.parcel_count || 0) - (a.parcel_count || 0);
  });
}

const NearbyOwners: React.FC<Props> = ({ pin, locale, isLegacyRoute }) => {
  const [radiusM, setRadiusM] = React.useState(150);
  const [viewMode, setViewMode] = React.useState<NearbyViewMode>("owners");
  const [isLoading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<NearbyPropertyRecord[]>([]);
  const [, setSavedVersion] = React.useState(0);

  const ownerGroups = React.useMemo(() => groupByOwner(results), [results]);

  const exportRows = React.useMemo(() => {
    if (viewMode === "owners") {
      return ownerGroups.map((group) => ({
        owner_key: group.ownerKey,
        owner_id: group.owner_id || "",
        owner_name: group.owner_name || "",
        mailing_address: formatGroupMailing(group),
        parcel_count: group.parcel_count,
        nearest_distance_m: group.nearest_distance_m ?? "",
        same_owner: group.same_owner,
        parcel_pins: group.parcels.map((parcel) => parcel.pin).join(", "),
      }));
    }

    return results.map((record) => ({
      pin: record.pin,
      address: formatAddress(record),
      owner_id: record.owner_id || "",
      owner_name: record.owner_name || "",
      mailing_address: formatMailing(record),
      distance_m: record.distance_m ?? "",
      same_owner: Boolean(record.same_owner),
    }));
  }, [ownerGroups, results, viewMode]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    APIClient.getNearbyProperties(pin, radiusM, 12)
      .then((data) => {
        if (!cancelled) {
          setResults(data.result || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
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
  }, [pin, radiusM]);

  const toggleSavedParcel = React.useCallback(
    (record: NearbyPropertyRecord) => {
      const key = `parcel:${record.pin}`;
      if (isSavedNearbyItem(key)) {
        removeSavedNearbyItem(key);
      } else {
        saveNearbyParcel({
          record,
          sourcePin: pin,
          address: formatAddress(record),
          ownerName: record.owner_name || "Unknown owner",
          mailingAddress: formatMailing(record),
        });
      }
      setSavedVersion((value) => value + 1);
    },
    [pin]
  );

  const toggleSavedOwner = React.useCallback(
    (group: OwnerGroup) => {
      const ownerType = group.owner_id ? "id" : "name";
      const ownerKey = group.owner_id || group.owner_name || group.ownerKey;
      const key = `owner:${ownerType}:${ownerKey}`;
      if (isSavedNearbyItem(key)) {
        removeSavedNearbyItem(key);
      } else {
        saveNearbyOwner({
          ownerType,
          ownerKey,
          ownerName: group.owner_name || "Unknown owner",
          mailingAddress: formatGroupMailing(group),
          parcelCount: group.parcel_count,
          parcelPins: group.parcels.map((parcel) => parcel.pin),
          sourcePin: pin,
          nearestDistanceM: group.nearest_distance_m,
        });
      }
      setSavedVersion((value) => value + 1);
    },
    [pin]
  );

  return (
    <section className="NearbyOwners card">
      <div className="NearbyOwners__header">
        <div>
          <h3>
            <Trans>Nearby properties and owners</Trans>
          </h3>
          <p>
            <Trans>
              Current parcel-owner and mail-to records around this property. This is a first-pass
              nearby-owner view, not a full owner-entity workflow.
            </Trans>
          </p>
        </div>
        <div className="NearbyOwners__controls">
          <div className="NearbyOwners__toggleGroup">
            <div className="NearbyOwners__radius">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === radiusM ? "active" : ""}
                  onClick={() => setRadiusM(option)}
                >
                  {option}m
                </button>
              ))}
            </div>
            <div className="NearbyOwners__viewMode">
              <button
                type="button"
                className={viewMode === "owners" ? "active" : ""}
                onClick={() => setViewMode("owners")}
              >
                <Trans>Owners</Trans>
              </button>
              <button
                type="button"
                className={viewMode === "parcels" ? "active" : ""}
                onClick={() => setViewMode("parcels")}
              >
                <Trans>Parcels</Trans>
              </button>
            </div>
          </div>
          <CSVDownloader
            data={exportRows}
            filename={`nearby-owner-${pin}-${viewMode}-${radiusM}m`}
            className="NearbyOwners__export"
          >
            <Button
              labelText={viewMode === "owners" ? "Export owner groups" : "Export nearby parcels"}
              variant="secondary"
              size="small"
              onClick={() => {
                logAmplitudeEvent("downloadPortfolioData", {
                  exportType: viewMode === "owners" ? "nearby-owner-groups" : "nearby-parcels",
                  radiusM,
                });
                window.gtag("event", "download-nearby-owner-data", {
                  exportType: viewMode === "owners" ? "nearby-owner-groups" : "nearby-parcels",
                  radiusM,
                });
              }}
            />
          </CSVDownloader>
          <Link
            className="NearbyOwners__savedLink"
            to={createRouteForSavedListsPage(locale, isLegacyRoute)}
          >
            <Trans>Open saved lists</Trans>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="NearbyOwners__status">
          <Trans>Loading nearby records...</Trans>
        </p>
      ) : results.length === 0 ? (
        <p className="NearbyOwners__status">
          <Trans>No nearby owner records found for this radius.</Trans>
        </p>
      ) : viewMode === "owners" ? (
        <div className="NearbyOwners__list NearbyOwners__list--owners">
          {ownerGroups.map((group) => (
            <article key={group.ownerKey} className="NearbyOwners__item NearbyOwners__item--owner">
              <div className="NearbyOwners__itemHeader">
                <div>
                  <h4>
                    <Link
                      to={createRouteForOwnerPage(
                        {
                          ownerType: group.owner_id ? "id" : "name",
                          ownerKey: group.owner_id || group.owner_name || group.ownerKey,
                          locale,
                        },
                        isLegacyRoute
                      )}
                    >
                      {group.owner_name || "Unknown owner"}
                    </Link>
                  </h4>
                  <p>{formatGroupMailing(group) || "N/A"}</p>
                </div>
                <div className="NearbyOwners__meta">
                  <span>
                    {group.parcel_count} {group.parcel_count === 1 ? "parcel" : "parcels"}
                  </span>
                  <span>{group.nearest_distance_m ?? "?"}m</span>
                  {group.same_owner && (
                    <span className="NearbyOwners__sameOwner">
                      <Trans>Same owner</Trans>
                    </span>
                  )}
                </div>
              </div>
              <div className="NearbyOwners__actions">
                <button type="button" onClick={() => toggleSavedOwner(group)}>
                  {isSavedNearbyItem(
                    `owner:${group.owner_id ? "id" : "name"}:${
                      group.owner_id || group.owner_name || group.ownerKey
                    }`
                  )
                    ? "Remove from saved"
                    : "Save owner"}
                </button>
              </div>
              <div className="NearbyOwners__parcelLinks">
                {group.parcels.slice(0, 4).map((parcel) => (
                  <Link
                    key={parcel.pin}
                    to={createRouteForAddressPage({ pin: parcel.pin, locale }, isLegacyRoute)}
                  >
                    {formatAddress(parcel)}
                  </Link>
                ))}
                {group.parcels.length > 4 && (
                  <span className="NearbyOwners__moreParcels">
                    +{group.parcels.length - 4} more
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="NearbyOwners__list">
          {results.map((record) => (
            <article key={record.pin} className="NearbyOwners__item">
              <div className="NearbyOwners__itemHeader">
                <div>
                  <h4>{formatAddress(record)}</h4>
                  <p>{record.owner_name || "Unknown owner"}</p>
                </div>
                <div className="NearbyOwners__meta">
                  <span>{record.distance_m ?? "?"}m</span>
                  {record.same_owner && (
                    <span className="NearbyOwners__sameOwner">
                      <Trans>Same owner</Trans>
                    </span>
                  )}
                </div>
              </div>
              <div className="NearbyOwners__actions">
                <button type="button" onClick={() => toggleSavedParcel(record)}>
                  {isSavedNearbyItem(`parcel:${record.pin}`) ? "Remove from saved" : "Save parcel"}
                </button>
              </div>
              <p className="NearbyOwners__mailing">
                <Trans>Mail-to:</Trans> {formatMailing(record) || "N/A"}
              </p>
              <Link to={createRouteForAddressPage({ pin: record.pin, locale }, isLegacyRoute)}>
                <Trans>Open property</Trans> &rarr;
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default NearbyOwners;
