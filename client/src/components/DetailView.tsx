import React from "react";
import { Trans } from "@lingui/macro";
import { withI18n, withI18nProps } from "@lingui/react";
import { CSSTransition } from "react-transition-group";
import _groupBy from "lodash/groupBy";
import { withMachineInStateProps } from "state-machine";
import Helpers, { longDateOptions } from "util/helpers";
import Browser from "util/browser";
import { SocialShareAddressPage } from "./SocialShare";
import BuildingStatsTable from "./BuildingStatsTable";
import { UsefulLinks } from "./UsefulLinks";
import EmailAlertSignup from "./EmailAlertSignup";
import GetRepairs from "./GetRepairs";
import { Accordion } from "./Accordion";
import { HpdFullContact } from "./APIDataTypes";
import "styles/DetailView.css";

type Props = withI18nProps &
  withMachineInStateProps<"portfolioFound"> & {
  mobileShow: boolean;
  onClose: () => void;
  onAddrChange: (pin: string) => void;
};

const NUM_COMPLAINT_TYPES_TO_SHOW = 3;

type GroupedContact = [
  string, // contact name
  HpdFullContact[] // contact records
];

export const sortContactsByImportance = (contact: GroupedContact) =>
  contact[1].find((c) => c.title === "HeadOfficer" || c.title.includes("Owner")) ? -1 : 0;

const DetailView: React.FC<Props> = ({ state, mobileShow, onClose, i18n }) => {
  const isMobile = Browser.isMobile();
  const { detailAddr } = state.context.portfolioData;
  const addressLine =
    detailAddr.address ||
    [detailAddr.housenumber, detailAddr.streetname].filter(Boolean).join(" ");
  const locality = detailAddr.boro || detailAddr.city || "";
  const formattedRegEndDate =
    detailAddr.registrationenddate &&
    Helpers.formatDate(detailAddr.registrationenddate, longDateOptions, i18n.language as "en" | "es");
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
                  <BuildingStatsTable addr={detailAddr} />

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
                            i18n.language as "en" | "es"
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
