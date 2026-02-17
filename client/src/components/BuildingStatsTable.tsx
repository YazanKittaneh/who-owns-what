import React from "react";
import { AddressRecord } from "./APIDataTypes";
import { Icon } from "@justfixnyc/component-library";
import { Trans } from "@lingui/macro";
import { i18n } from "@lingui/core";
import Modal from "./Modal";

import "styles/BuildingStatsTable.css";

type BuildingStatsTableProps = {
  addr: AddressRecord;
};

type StatRow = {
  label: string;
  value: string;
  info: string;
};

const formatValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "N/A" : String(value);

const BuildingStatsTable: React.FC<BuildingStatsTableProps> = ({ addr }) => {
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [infoModalTitle, setInfoModalTitle] = React.useState("");
  const [infoModalContent, setInfoModalContent] = React.useState("");

  const rows: StatRow[] = [
    {
      label: i18n._("PIN"),
      value: formatValue(addr.pin),
      info: i18n._("Permanent Index Number used by Cook County to identify parcels."),
    },
    {
      label: i18n._("Residential units"),
      value: formatValue(addr.units_res),
      info: i18n._("Residential unit count from parcel data."),
    },
    {
      label: i18n._("Land class"),
      value: formatValue(addr.land_class),
      info: i18n._("Land-use class from assessment records."),
    },
    {
      label: i18n._("Building class"),
      value: formatValue(addr.building_class),
      info: i18n._("Building class from assessment records."),
    },
    {
      label: i18n._("Open violations"),
      value: formatValue(addr.violations_open ?? addr.openviolations),
      info: i18n._("Open code violations associated with this property."),
    },
    {
      label: i18n._("Total violations"),
      value: formatValue(addr.violations_total ?? addr.totalviolations),
      info: i18n._("All recorded code violations (open and closed)."),
    },
    {
      label: i18n._("311 service requests"),
      value: formatValue(addr.requests_311_total ?? addr.totalcomplaints),
      info: i18n._("311 complaints associated with this property."),
    },
  ];

  return (
    <>
      <Modal showModal={showInfoModal} width={40} onClose={() => setShowInfoModal(false)}>
        <h4>{infoModalTitle}</h4>
        <p>{infoModalContent}</p>
      </Modal>
      <div className="BuildingStatsTable card-body-table">
        <table>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th>
                  {row.label}
                  <button
                    type="button"
                    className="results-info"
                    onClick={() => {
                      setInfoModalTitle(row.label);
                      setInfoModalContent(row.info);
                      setShowInfoModal(true);
                    }}
                    aria-label={row.info}
                  >
                    <Icon icon="circleInfo" className="info-icon" />
                  </button>
                </th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-row">
          <div className="timeline-link">
            <Trans>View trends over time</Trans> &rarr;
          </div>
        </div>
      </div>
    </>
  );
};

export default BuildingStatsTable;
