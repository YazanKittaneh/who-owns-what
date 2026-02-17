import React from "react";
import { Trans } from "@lingui/macro";
import { AddressRecord } from "./APIDataTypes";
import { Link } from "@justfixnyc/component-library";
import { AmplitudeEvent, logAmplitudeEvent } from "components/Amplitude";

type UsefulLinksProps = {
  addrForLinks: Pick<AddressRecord, "pin" | "bbl" | "address" | "housenumber" | "streetname">;
  location: "overview-tab" | "timeline-tab" | "not-registered-page";
  streetViewAddr?: string;
};

const splitBbl = (bbl?: string) => {
  if (!bbl) return null;
  const cleaned = bbl.replace(/\D/g, "");
  if (cleaned.length !== 10) return null;
  return {
    boro: cleaned.slice(0, 1),
    block: cleaned.slice(1, 6),
    lot: cleaned.slice(6, 10),
  };
};

export const UsefulLinks: React.FC<UsefulLinksProps> = ({ addrForLinks, location, streetViewAddr }) => {
  const bblParts = splitBbl(addrForLinks.bbl);
  const fallbackMapAddress =
    streetViewAddr ||
    encodeURIComponent(
      addrForLinks.address ||
        [addrForLinks.housenumber, addrForLinks.streetname].filter(Boolean).join(" ")
    );

  const trackClick = (event: string) => {
    logAmplitudeEvent(`${event}-${location}` as AmplitudeEvent);
    window.gtag("event", `${event}-${location}`);
  };

  return (
    <div className="card-body-links">
      <Trans render={location === "not-registered-page" ? "p" : "b"}>Useful links</Trans>
      <ul>
        {bblParts && (
          <>
            <li>
              <Link
                onClick={() => trackClick("acris")}
                href={`http://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${bblParts.boro}&block=${bblParts.block}&lot=${bblParts.lot}`}
                target="_blank"
                rel="noopener noreferrer"
                icon="external"
              >
                <Trans>View documents on ACRIS</Trans>
              </Link>
            </li>
            <li>
              <Link
                onClick={() => trackClick("hpd")}
                href={`https://hpdonline.nyc.gov/hpdonline/building/search-results?boroId=${bblParts.boro}&block=${bblParts.block}&lot=${bblParts.lot}`}
                target="_blank"
                rel="noopener noreferrer"
                icon="external"
              >
                <Trans>HPD Building Profile</Trans>
              </Link>
            </li>
            <li>
              <Link
                onClick={() => trackClick("dob")}
                href={`http://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${bblParts.boro}&block=${bblParts.block}&lot=${bblParts.lot}`}
                target="_blank"
                rel="noopener noreferrer"
                icon="external"
              >
                <Trans>DOB Building Profile</Trans>
              </Link>
            </li>
            <li>
              <Link
                onClick={() => trackClick("dof")}
                href="https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop"
                target="_blank"
                rel="noopener noreferrer"
                icon="external"
              >
                <Trans>DOF Property Tax Bills</Trans>
              </Link>
            </li>
            <li>
              <Link
                onClick={() => trackClick("dap")}
                href={`https://portal.displacementalert.org/property/${bblParts.boro}${bblParts.block}${bblParts.lot}`}
                target="_blank"
                rel="noopener noreferrer"
                icon="external"
              >
                <Trans>ANHD DAP Portal</Trans>
              </Link>
            </li>
          </>
        )}
        {fallbackMapAddress && (
          <li>
            <Link
              onClick={() => trackClick("google-maps")}
              href={`https://www.google.com/maps/place/${fallbackMapAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              icon="external"
            >
              <Trans>View on Google Maps</Trans>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
};
