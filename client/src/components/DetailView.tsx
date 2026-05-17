import React from "react";
import { Trans } from "@lingui/macro";
import { withI18n, withI18nProps } from "@lingui/react";
import { CSSTransition } from "react-transition-group";
import _groupBy from "lodash/groupBy";
import { withMachineInStateProps } from "state-machine";
import Helpers, { longDateOptions } from "util/helpers";
import Browser from "util/browser";
import { getI18nLocale } from "util/i18n-compat";
import { SocialShareAddressPage } from "./SocialShare";
import BuildingStatsTable from "./BuildingStatsTable";
import { UsefulLinks } from "./UsefulLinks";
import EmailAlertSignup from "./EmailAlertSignup";
import GetRepairs from "./GetRepairs";
import { Accordion } from "./Accordion";
import APIClient from "./APIClient";
import { HpdFullContact } from "./APIDataTypes";
import "styles/DetailView.css";

type Props = withI18nProps &
  withMachineInStateProps<"portfolioFound"> & {
  mobileShow: boolean;
  onClose: () => void;
  onAddrChange: (pin: string) => void;
  timelineHref: string;
};

const NUM_COMPLAINT_TYPES_TO_SHOW = 3;
const PROPSTREAM_DISPLAY_FIELDS = [
  "Owner 1 First Name",
  "Owner 1 Last Name",
  "Owner 2 First Name",
  "Owner 2 Last Name",
  "Mailing Care of Name",
  "Mailing Address",
  "Mailing Unit #",
  "Mailing City",
  "Mailing State",
  "Mailing Zip",
  "Phone 1",
  "Phone 1 Type",
  "Phone 2",
  "Phone 2 Type",
  "Email 1",
  "Email 2",
  "Address",
  "Unit #",
  "City",
  "State",
  "Zip",
  "APN",
  "Property Type",
  "Last Sale Recording Date",
  "Last Sale Amount",
  "Est. Value",
  "Est. Equity",
  "MLS Status",
  "MLS Date",
  "MLS Amount",
];

type GroupedContact = [
  string, // contact name
  HpdFullContact[] // contact records
];

export const sortContactsByImportance = (contact: GroupedContact) =>
  contact[1].find((c) => c.title === "HeadOfficer" || c.title.includes("Owner")) ? -1 : 0;

const DetailView: React.FC<Props> = ({ state, mobileShow, onClose, i18n, timelineHref }) => {
  const isMobile = Browser.isMobile();
  const { detailAddr } = state.context.portfolioData;
  const [propstreamRecords, setPropstreamRecords] = React.useState(detailAddr.propstream_records || []);
  const [propstreamStatus, setPropstreamStatus] = React.useState<string | null>(null);
  const [isPropstreamUploading, setPropstreamUploading] = React.useState(false);
  const locale = getI18nLocale(i18n);
  const addressLine =
    detailAddr.address ||
    [detailAddr.housenumber, detailAddr.streetname].filter(Boolean).join(" ");
  const locality = detailAddr.boro || detailAddr.city || "";
  const formattedRegEndDate =
    detailAddr.registrationenddate &&
    Helpers.formatDate(detailAddr.registrationenddate, longDateOptions, locale);
  const groupedContacts: GroupedContact[] = detailAddr.allcontacts
    ? (Object.entries(_groupBy(detailAddr.allcontacts, "value")) as GroupedContact[]).sort(
        sortContactsByImportance
      )
    : [];
  const streetViewAddr = encodeURIComponent(
    detailAddr.address ||
      `${detailAddr.housenumber || ""} ${detailAddr.streetname || ""} ${detailAddr.city || ""} ${
        detailAddr.state || ""
      }`
  );

  React.useEffect(() => {
    setPropstreamRecords(detailAddr.propstream_records || []);
    setPropstreamStatus(null);
  }, [detailAddr.pin, detailAddr.propstream_records]);

  const handlePropstreamUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPropstreamUploading(true);
    setPropstreamStatus(null);
    try {
      const result = await APIClient.uploadPropstreamCsv(file);
      const refreshed = await APIClient.getBuildingInfo(detailAddr.pin);
      const current = refreshed.result.find((addr) => addr.pin === detailAddr.pin);
      setPropstreamRecords(current?.propstream_records || []);
      setPropstreamStatus(
        i18n._(
          `Imported ${result.imported_rows} PropStream row(s) for ${result.imported_parcels} parcel(s).`
        )
      );
    } catch (_error) {
      setPropstreamStatus(i18n._("Could not import that PropStream CSV."));
    } finally {
      setPropstreamUploading(false);
      event.target.value = "";
    }
  };

  return (
    <CSSTransition in={!isMobile || mobileShow} timeout={500} classNames="DetailView">
      <div className="DetailView">
        <div className="DetailView__wrapper">
          <div className="DetailView__card card">
            <div className="DetailView__mobilePortfolioView">
              <button onClick={onClose}>
                <Trans render="span">View portfolio map</Trans>
              </button>
            </div>
            <div className="columns main-content-columns">
              <div className="column col-lg-12 col-7 detail-column-left">
                <div className="card-header">
                  <h4 className="card-title">
                    <Trans>BUILDING:</Trans> {addressLine || detailAddr.pin}
                    {locality ? `, ${Helpers.titleCase(locality)}` : ""}
                  </h4>
                </div>
                <div className="card-body">
                  <BuildingStatsTable addr={detailAddr} timelineHref={timelineHref} />

                  <div className="card-body-complaints">
                    <div>
                      <b>
                        <Trans>Most Common 311 Complaints, Last 3 Years</Trans>
                      </b>
                      <ul>
                        {detailAddr.recentcomplaintsbytype &&
                        detailAddr.recentcomplaintsbytype.length > 0 ? (
                          detailAddr.recentcomplaintsbytype
                            .slice(0, NUM_COMPLAINT_TYPES_TO_SHOW)
                            .map((complaint, idx) => (
                              <li key={`${complaint.type}-${idx}`}>
                                {Helpers.translateComplaintType(complaint.type, i18n)} (
                                {complaint.count})
                              </li>
                            ))
                        ) : (
                          <li>
                            <Trans>None</Trans>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="card-body-landlord">
                    <div className="card-title-landlord">
                      <b>
                        <Trans>Who’s the landlord of this building?</Trans>
                      </b>
                    </div>
                    <div>
                      {groupedContacts.length > 0 ? (
                        groupedContacts.map(([contactName, info], idx) => (
                          <Accordion title={contactName} key={`${contactName}-${idx}`}>
                            {info.map((entry, entryIdx) => (
                              <div className="landlord-contact-info" key={`${entry.title}-${entryIdx}`}>
                                <span className="text-bold text-dark">
                                  {Helpers.translateContactTitleAndIncludeEnglish(entry.title, i18n)}
                                </span>
                                {entry.address && (
                                  <>
                                    <br />
                                    {Helpers.formatHpdContactAddress(entry.address).addressLine1}
                                    <br />
                                    {Helpers.formatHpdContactAddress(entry.address).addressLine2}
                                  </>
                                )}
                              </div>
                            ))}
                          </Accordion>
                        ))
                      ) : (
                        <div className="landlord-contact-info">
                          <span className="text-bold text-dark">
                            {detailAddr.owner_name || i18n._("Unknown owner")}
                          </span>
                          {detailAddr.mailing_address && (
                            <>
                              <br />
                              {detailAddr.mailing_address}
                              {detailAddr.mailing_city ? `, ${detailAddr.mailing_city}` : ""}
                              {detailAddr.mailing_state ? `, ${detailAddr.mailing_state}` : ""}
                              {detailAddr.mailing_zip ? ` ${detailAddr.mailing_zip}` : ""}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {(detailAddr.tax_sale_event_count || detailAddr.recorder_doc_count) && (
                    <div className="card-body-registration">
                      {detailAddr.tax_sale_event_count ? (
                        <p>
                          <b>
                            <Trans>Tax sale history:</Trans>
                          </b>{" "}
                          {detailAddr.tax_sale_event_count} <Trans>event(s)</Trans>
                          {detailAddr.latest_tax_sale_year ? `, latest ${detailAddr.latest_tax_sale_year}` : ""}
                          {detailAddr.latest_tax_sale_buyer_name
                            ? `, ${detailAddr.latest_tax_sale_buyer_name}`
                            : ""}
                        </p>
                      ) : null}
                      {detailAddr.recorder_doc_count ? (
                        <p>
                          <b>
                            <Trans>Recorder history:</Trans>
                          </b>{" "}
                          {detailAddr.recorder_doc_count} <Trans>document(s)</Trans>
                          {detailAddr.latest_mortgage_amount
                            ? `, latest mortgage $${Math.round(detailAddr.latest_mortgage_amount).toLocaleString()}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className="card-body-registration">
                    <p>
                      <b>
                        <Trans>PropStream enrichment:</Trans>
                      </b>{" "}
                      {propstreamRecords.length > 0 ? (
                        <span>
                          {propstreamRecords.length} <Trans>record(s) imported</Trans>
                        </span>
                      ) : (
                        <Trans>No PropStream records imported for this parcel yet.</Trans>
                      )}
                    </p>
                    <label className="btn btn-sm btn-primary" htmlFor="propstream-csv-upload">
                      {isPropstreamUploading ? (
                        <Trans>Uploading...</Trans>
                      ) : (
                        <Trans>Upload PropStream CSV</Trans>
                      )}
                    </label>
                    <input
                      id="propstream-csv-upload"
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={isPropstreamUploading}
                      onChange={handlePropstreamUpload}
                      style={{ display: "none" }}
                    />
                    {propstreamStatus && <p>{propstreamStatus}</p>}
                    {propstreamRecords.map((record, idx) => (
                      <div className="landlord-contact-info" key={`propstream-${idx}`}>
                        {PROPSTREAM_DISPLAY_FIELDS.filter((field) => record[field]).map((field) => (
                          <div key={field}>
                            <span className="text-bold text-dark">{field}: </span>
                            {record[field]}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {(detailAddr.lastregistrationdate || detailAddr.registrationenddate) && (
                    <div className="card-body-registration">
                      {detailAddr.lastregistrationdate && (
                        <p>
                          <b>
                            <Trans>Last registered:</Trans>
                          </b>{" "}
                          {Helpers.formatDate(
                            detailAddr.lastregistrationdate,
                            longDateOptions,
                            locale
                          )}{" "}
                          {detailAddr.registrationenddate && formattedRegEndDate && (
                            <>
                              {new Date() > new Date(detailAddr.registrationenddate) ? (
                                <span className="text-danger">
                                  <Trans>(expired {formattedRegEndDate})</Trans>
                                </span>
                              ) : (
                                <span>
                                  <Trans>(expires {formattedRegEndDate})</Trans>
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="column col-lg-12 col-5 detail-column-right">
                <EmailAlertSignup addr={detailAddr} />
                <GetRepairs />
                <div className="card-body-links column-right">
                  <UsefulLinks
                    addrForLinks={detailAddr}
                    location="overview-tab"
                    streetViewAddr={streetViewAddr}
                  />
                </div>
                <div className="card-body-social social-group">
                  <h6 className="DetailView__subtitle">
                    <Trans>Share with your neighbors</Trans>
                  </h6>
                  <SocialShareAddressPage location="overview-tab" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CSSTransition>
  );
};

export default withI18n()(DetailView);
