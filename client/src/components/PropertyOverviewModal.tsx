import React from "react";
import { Trans } from "@lingui/macro";
import { Link } from "react-router-dom";
import { AddressRecord } from "./APIDataTypes";
import Modal from "./Modal";
import BuildingStatsTable from "./BuildingStatsTable";
import { UsefulLinks } from "./UsefulLinks";
import "styles/PropertyOverviewModal.css";

type Props = {
  showModal: boolean;
  isLoading: boolean;
  detailAddr: AddressRecord | null;
  portfolioSize: number;
  propertyHref: string;
  timelineHref: string;
  onClose: () => void;
};

function formatAddress(addr: AddressRecord | null): string {
  if (!addr) return "";
  return addr.address || [addr.housenumber, addr.streetname].filter(Boolean).join(" ") || addr.pin;
}

const PropertyOverviewModal: React.FC<Props> = ({
  showModal,
  isLoading,
  detailAddr,
  portfolioSize,
  propertyHref,
  timelineHref,
  onClose,
}) => {
  return (
    <Modal showModal={showModal} onClose={onClose} width={72} className="PropertyOverviewModal">
      <div className="PropertyOverviewModal__content">
        {isLoading || !detailAddr ? (
          <div className="PropertyOverviewModal__loading">
            <h3>
              <Trans>Loading property details...</Trans>
            </h3>
          </div>
        ) : (
          <>
            <div className="PropertyOverviewModal__header">
              <div>
                <h2>{formatAddress(detailAddr)}</h2>
                <p>
                  <strong>{detailAddr.owner_name || "Unknown owner"}</strong>
                </p>
                {detailAddr.mailing_address && (
                  <p>
                    <Trans>Mailing address:</Trans> {detailAddr.mailing_address}
                    {detailAddr.mailing_city ? `, ${detailAddr.mailing_city}` : ""}
                    {detailAddr.mailing_state ? `, ${detailAddr.mailing_state}` : ""}
                    {detailAddr.mailing_zip ? ` ${detailAddr.mailing_zip}` : ""}
                  </p>
                )}
              </div>
              <div className="PropertyOverviewModal__meta">
                <div>
                  <span className="PropertyOverviewModal__metaValue">{portfolioSize}</span>
                  <span className="PropertyOverviewModal__metaLabel">
                    <Trans>Portfolio parcels</Trans>
                  </span>
                </div>
              </div>
            </div>

            <div className="PropertyOverviewModal__grid">
              <div>
                <BuildingStatsTable addr={detailAddr} timelineHref={timelineHref} />
              </div>
              <div className="PropertyOverviewModal__sidebar">
                <div className="PropertyOverviewModal__actions">
                  <Link to={propertyHref} className="btn btn-primary" onClick={onClose}>
                    <Trans>Open full property page</Trans>
                  </Link>
                </div>
                <UsefulLinks addrForLinks={detailAddr} location="overview-map-modal" />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default PropertyOverviewModal;
