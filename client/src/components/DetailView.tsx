import React from "react";
import { Trans } from "@lingui/macro";
import { withMachineInStateProps } from "state-machine";
import "styles/DetailView.css";

type Props = withMachineInStateProps<"portfolioFound"> & {
  mobileShow: boolean;
  onClose: () => void;
  onAddrChange: (pin: string) => void;
};

const DetailView: React.FC<Props> = ({ state, mobileShow, onClose }) => {
  const { detailAddr } = state.context.portfolioData;
  const addressLine = detailAddr.address ||
    [detailAddr.housenumber, detailAddr.streetname].filter(Boolean).join(" ");

  return (
    <div className={`DetailView ${mobileShow ? "DetailView--open" : ""}`}>
      <div className="DetailView__header">
        <h2>{addressLine || detailAddr.pin}</h2>
        <button className="DetailView__close" onClick={onClose}>
          <Trans>Close</Trans>
        </button>
      </div>
      <div className="DetailView__content">
        <div className="DetailView__section">
          <h3><Trans>Owner</Trans></h3>
          <p>{detailAddr.owner_name || <Trans>Unknown owner</Trans>}</p>
          {detailAddr.mailing_address && (
            <p>
              {detailAddr.mailing_address}
              {detailAddr.mailing_city ? `, ${detailAddr.mailing_city}` : ""}
              {detailAddr.mailing_state ? `, ${detailAddr.mailing_state}` : ""}
              {detailAddr.mailing_zip ? ` ${detailAddr.mailing_zip}` : ""}
            </p>
          )}
        </div>
        <div className="DetailView__section">
          <h3><Trans>Parcel details</Trans></h3>
          <p>
            <Trans>PIN</Trans>: {detailAddr.pin}
          </p>
          {detailAddr.units_res !== null && (
            <p>
              <Trans>Residential units</Trans>: {detailAddr.units_res}
            </p>
          )}
          {detailAddr.land_class && (
            <p>
              <Trans>Land class</Trans>: {detailAddr.land_class}
            </p>
          )}
          {detailAddr.building_class && (
            <p>
              <Trans>Building class</Trans>: {detailAddr.building_class}
            </p>
          )}
        </div>
        <div className="DetailView__section">
          <h3><Trans>Indicators</Trans></h3>
          <p>
            <Trans>Permits</Trans>: {detailAddr.permits_total ?? 0}
          </p>
          <p>
            <Trans>Open violations</Trans>: {detailAddr.violations_open ?? 0}
          </p>
          <p>
            <Trans>Total violations</Trans>: {detailAddr.violations_total ?? 0}
          </p>
          <p>
            <Trans>311 service requests</Trans>: {detailAddr.requests_311_total ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DetailView;
