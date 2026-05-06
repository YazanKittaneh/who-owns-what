import React from "react";
import { Trans } from "@lingui/macro";
import { Link } from "react-router-dom";

import Modal from "./Modal";
import { AddressRecord, OwnerAreaSearchOwner, OwnerAreaSearchParcel } from "./APIDataTypes";
import "styles/ParcelPreviewModal.css";

type Props = {
  showModal: boolean;
  parcel: OwnerAreaSearchParcel | null;
  owner: OwnerAreaSearchOwner | null;
  detailAddr: AddressRecord | null;
  isLoading: boolean;
  propertyHref: string;
  onClose: () => void;
};

function formatAddress(address?: string | null, pin?: string) {
  return address || pin || "Unknown parcel";
}

function formatMailing(detailAddr: AddressRecord | null) {
  if (!detailAddr) return "";
  return [detailAddr.mailing_address, detailAddr.mailing_city, detailAddr.mailing_state, detailAddr.mailing_zip]
    .filter(Boolean)
    .join(detailAddr.mailing_address ? ", " : " ");
}

const ParcelPreviewModal: React.FC<Props> = ({
  showModal,
  parcel,
  owner,
  detailAddr,
  isLoading,
  propertyHref,
  onClose,
}) => {
  if (!parcel || !owner) {
    return <div />;
  }

  const displayAddress = formatAddress(detailAddr?.address || parcel.address, parcel.pin);
  const displayOwnerName = detailAddr?.owner_name || owner.owner_name || owner.owner_key;
  const mailing = formatMailing(detailAddr);

  return (
    <Modal showModal={showModal} onClose={onClose} width={44} className="ParcelPreviewModal">
      <div className="ParcelPreviewModal__content">
        <div className="ParcelPreviewModal__header">
          <div>
            <p className="ParcelPreviewModal__eyebrow">
              <Trans>Parcel preview</Trans>
            </p>
            <h2>{displayAddress}</h2>
            <p>
              <strong>{displayOwnerName}</strong>
            </p>
          </div>
          <div className="ParcelPreviewModal__stats">
            {parcel.distance_m != null && <span>{parcel.distance_m}m away</span>}
            {parcel.building_type_label && <span>{parcel.building_type_label}</span>}
            {parcel.same_owner && (
              <span className="ParcelPreviewModal__sameOwnerBadge">
                <Trans>Same owner</Trans>
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <p>
            <Trans>Loading parcel details...</Trans>
          </p>
        ) : (
          <div className="ParcelPreviewModal__grid">
            <div>
              <div className="ParcelPreviewModal__row">
                <span>
                  <Trans>PIN</Trans>
                </span>
                <strong>{parcel.pin}</strong>
              </div>
              {mailing && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>Mailing</Trans>
                  </span>
                  <strong>{mailing}</strong>
                </div>
              )}
              {detailAddr?.ward && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>Ward</Trans>
                  </span>
                  <strong>{detailAddr.ward}</strong>
                </div>
              )}
              {detailAddr?.community_area && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>Community area</Trans>
                  </span>
                  <strong>{detailAddr.community_area}</strong>
                </div>
              )}
            </div>

            <div>
              <div className="ParcelPreviewModal__row">
                <span>
                  <Trans>Nearby owner parcels</Trans>
                </span>
                <strong>{owner.parcel_count || 0}</strong>
              </div>
              {detailAddr?.permits_total != null && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>Permits</Trans>
                  </span>
                  <strong>{detailAddr.permits_total}</strong>
                </div>
              )}
              {detailAddr?.violations_open != null && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>Open violations</Trans>
                  </span>
                  <strong>{detailAddr.violations_open}</strong>
                </div>
              )}
              {detailAddr?.requests_311_total != null && (
                <div className="ParcelPreviewModal__row">
                  <span>
                    <Trans>311 requests</Trans>
                  </span>
                  <strong>{detailAddr.requests_311_total}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ParcelPreviewModal__actions">
          <Link to={propertyHref} className="btn btn-primary" onClick={onClose}>
            <Trans>Open full details</Trans>
          </Link>
        </div>
      </div>
    </Modal>
  );
};

export default ParcelPreviewModal;
