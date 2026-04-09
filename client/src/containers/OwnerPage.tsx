import React from "react";
import { Link, RouteComponentProps, useHistory, useLocation } from "react-router-dom";
import { Trans, Plural } from "@lingui/macro";

import Page from "components/Page";
import APIClient from "components/APIClient";
import OverviewMap from "components/OverviewMap";
import { AddressRecord, OwnerProfileResults } from "components/APIDataTypes";
import ExportDataButton from "components/ExportData";
import { createRouteForAddressPage, createRouteForSavedListsPage } from "routes";
import { parseLocaleFromPath } from "i18n";
import { isLegacyPath } from "components/WowzaToggle";

import "styles/OwnerPage.css";

type RouteParams = {
  locale?: string;
  ownerType?: "id" | "name";
  ownerKey?: string;
};

function formatAddress(addr: AddressRecord) {
  return addr.address || [addr.housenumber, addr.streetname].filter(Boolean).join(" ") || addr.pin;
}

function formatMailing(owner: OwnerProfileResults["owner"]) {
  return [owner.mailing_address, owner.mailing_city, owner.mailing_state, owner.mailing_zip]
    .filter(Boolean)
    .join(owner.mailing_address ? ", " : " ");
}

const OwnerPage: React.FC<RouteComponentProps<RouteParams>> = ({ match }) => {
  const history = useHistory();
  const location = useLocation();
  const locale = parseLocaleFromPath(location.pathname) || undefined;
  const legacy = isLegacyPath(location.pathname);
  const ownerType = match.params.ownerType || "name";
  const ownerKey = match.params.ownerKey || "";
  const [data, setData] = React.useState<OwnerProfileResults | null>(null);
  const [isLoading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    APIClient.getCurrentOwnerProfile(ownerType, ownerKey)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
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
  }, [ownerKey, ownerType]);

  const owner = data?.owner;
  const parcels = data?.result || [];

  return (
    <Page title={owner?.owner_name || ownerKey}>
      <div className="OwnerPage Page">
        <div className="OwnerPage__header card">
          <div>
            <p className="OwnerPage__eyebrow">
              <Trans>Current owner profile</Trans>
            </p>
            <h1>{owner?.owner_name || ownerKey}</h1>
            {owner && (
              <p className="OwnerPage__summary">
                <strong>{owner.parcel_count}</strong>{" "}
                <Plural value={owner.parcel_count} one="parcel" other="parcels" />
                {formatMailing(owner) ? ` • ${formatMailing(owner)}` : ""}
              </p>
            )}
          </div>
          <div className="OwnerPage__actions">
            {parcels.length > 0 && <ExportDataButton data={parcels} />}
            <Link to={createRouteForSavedListsPage(locale, legacy)}>
              <Trans>Open saved lists</Trans>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <section className="OwnerPage__section card">
            <p>
              <Trans>Loading owner profile...</Trans>
            </p>
          </section>
        ) : parcels.length === 0 ? (
          <section className="OwnerPage__section card">
            <p>
              <Trans>No current parcel records found for this owner key.</Trans>
            </p>
          </section>
        ) : (
          <>
            <div className="OwnerPage__hero">
              <div className="OwnerPage__map card">
                <OverviewMap
                  properties={[]}
                  highlightedAddrs={parcels}
                  selectedPin={null}
                  isLoading={false}
                  truncated={false}
                  onMarkerClick={(pin) =>
                    history.push(createRouteForAddressPage({ pin, locale }, legacy))
                  }
                  onViewportChange={() => undefined}
                />
              </div>
              <div className="OwnerPage__section card">
                <h2>
                  <Trans>Current parcels</Trans>
                </h2>
                <div className="OwnerPage__parcelList">
                  {parcels.map((addr) => (
                    <article key={addr.pin} className="OwnerPage__parcelCard">
                      <h3>{formatAddress(addr)}</h3>
                      <p>{addr.pin}</p>
                      <Link to={createRouteForAddressPage({ pin: addr.pin, locale }, legacy)}>
                        <Trans>Open property</Trans> &rarr;
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Page>
  );
};

export default OwnerPage;
