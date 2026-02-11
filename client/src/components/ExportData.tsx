import React from "react";
import { CSVDownloader } from "react-papaparse";
import { AddressRecord } from "./APIDataTypes";
import { logAmplitudeEvent } from "./Amplitude";
import { Button } from "@justfixnyc/component-library";
import { i18n } from "@lingui/core";

const ExportDataButton: React.FC<{ data: AddressRecord[] }> = ({ data }) => {
  const fieldsWeWant = data.map(({ mapType, ...fields }) => fields);

  return (
    <CSVDownloader
      data={fieldsWeWant}
      filename="who_owns_what_export"
      className="flex-centered download-btn-link"
    >
      <Button
        onClick={() => {
          logAmplitudeEvent("downloadPortfolioData");
          window.gtag("event", "download-portfolio-data");
        }}
        labelText={i18n._("Download")}
        variant="secondary"
        size="small"
      />
    </CSVDownloader>
  );
};

export default ExportDataButton;
