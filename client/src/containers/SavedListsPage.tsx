import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CSVDownloader } from "react-papaparse";
import { Button } from "@justfixnyc/component-library";
import { Trans } from "@lingui/macro";

import Page from "components/Page";
import {
  loadSavedNearbyItems,
  removeSavedNearbyItem,
  SAVED_NEARBY_LISTS_EVENT,
  SavedNearbyOwner,
  SavedNearbyParcel,
  SavedNearbyListItem,
} from "util/savedNearbyLists";
import { createRouteForAddressPage, createRouteForOwnerPage } from "routes";
import { parseLocaleFromPath } from "i18n";
import { isLegacyPath } from "components/WowzaToggle";

import "styles/SavedListsPage.css";

function useSavedItems() {
  const [items, setItems] = React.useState<SavedNearbyListItem[]>(loadSavedNearbyItems());

  React.useEffect(() => {
    const handleUpdate = () => setItems(loadSavedNearbyItems());
    window.addEventListener(SAVED_NEARBY_LISTS_EVENT, handleUpdate as EventListener);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(SAVED_NEARBY_LISTS_EVENT, handleUpdate as EventListener);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return items;
}

function isSavedOwner(item: SavedNearbyListItem): item is SavedNearbyOwner {
  return item.kind === "owner";
}

function isSavedParcel(item: SavedNearbyListItem): item is SavedNearbyParcel {
  return item.kind === "parcel";
}

const SavedListsPage: React.FC = () => {
  const location = useLocation();
  const locale = parseLocaleFromPath(location.pathname) || undefined;
  const legacy = isLegacyPath(location.pathname);
  const items = useSavedItems();
  const owners = items.filter(isSavedOwner);
  const parcels = items.filter(isSavedParcel);

  return (
    <Page title="Saved lists">
      <div className="SavedListsPage Page">
        <div className="SavedListsPage__header card">
          <div>
            <p className="SavedListsPage__eyebrow">
              <Trans>Saved nearby lists</Trans>
            </p>
            <h1>
              <Trans>Saved owners and parcels</Trans>
            </h1>
            <p>
              <Trans>These lists are stored in this browser only for now.</Trans>
            </p>
          </div>
          <CSVDownloader data={items} filename="who-owns-what-saved-lists">
            <Button labelText="Export all saved lists" variant="secondary" size="small" />
          </CSVDownloader>
        </div>

        <section className="SavedListsPage__section card">
          <h2>
            <Trans>Saved owners</Trans>
          </h2>
          {owners.length === 0 ? (
            <p>
              <Trans>No saved owners yet.</Trans>
            </p>
          ) : (
            <div className="SavedListsPage__list">
              {owners.map((item) => (
                <article key={item.key} className="SavedListsPage__item">
                  <div>
                    <h3>{item.ownerName}</h3>
                    <p>{item.mailingAddress || "N/A"}</p>
                    <p>
                      {item.parcelCount} parcels • source pin {item.sourcePin}
                    </p>
                    <Link
                      to={createRouteForOwnerPage(
                        {
                          ownerType: item.ownerType,
                          ownerKey: item.ownerKey,
                          locale,
                        },
                        legacy
                      )}
                    >
                      <Trans>Open owner profile</Trans> &rarr;
                    </Link>
                  </div>
                  <button type="button" onClick={() => removeSavedNearbyItem(item.key)}>
                    <Trans>Remove</Trans>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="SavedListsPage__section card">
          <h2>
            <Trans>Saved parcels</Trans>
          </h2>
          {parcels.length === 0 ? (
            <p>
              <Trans>No saved parcels yet.</Trans>
            </p>
          ) : (
            <div className="SavedListsPage__list">
              {parcels.map((item) => (
                <article key={item.key} className="SavedListsPage__item">
                  <div>
                    <h3>{item.address}</h3>
                    <p>{item.ownerName}</p>
                    <p>{item.mailingAddress || "N/A"}</p>
                    <Link to={createRouteForAddressPage({ pin: item.pin, locale }, legacy)}>
                      <Trans>Open property</Trans> &rarr;
                    </Link>
                  </div>
                  <button type="button" onClick={() => removeSavedNearbyItem(item.key)}>
                    <Trans>Remove</Trans>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
};

export default SavedListsPage;
