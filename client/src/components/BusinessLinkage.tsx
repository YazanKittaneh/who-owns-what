import React from "react";
import { Trans } from "@lingui/macro";

import APIClient from "./APIClient";
import { BusinessLinkageResults } from "./APIDataTypes";

type BusinessLinkageProps = {
  pin: string;
};

const MATCH_LABELS: Record<string, string> = {
  business_name_exact: "Name match",
  business_name_core: "Name match",
  business_owner_legal_name: "Owner match",
  business_address_exact: "Address match",
  business_address_no_unit: "Address match",
  business_owner_person_corroborated: "Corroborated owner",
  business_owner_entity_owner_corroborated: "Corroborated entity",
};

const matchLabel = (matchType: string) => MATCH_LABELS[matchType] || matchType.replace(/_/g, " ");

const BusinessLinkage: React.FC<BusinessLinkageProps> = ({ pin }) => {
  const [data, setData] = React.useState<BusinessLinkageResults | null>(null);
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");

  React.useEffect(() => {
    let isCurrent = true;
    setStatus("loading");
    APIClient.getBusinessLinkage(pin)
      .then((result) => {
        if (!isCurrent) return;
        setData(result);
        setStatus("loaded");
      })
      .catch(() => {
        if (!isCurrent) return;
        setStatus("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [pin]);

  if (status === "loading") {
    return (
      <section className="PropertyPage__section card">
        <div className="PropertyPage__sectionHeader">
          <h2>
            <Trans>Business linkages</Trans>
          </h2>
        </div>
        <p>
          <Trans>Loading business linkage records.</Trans>
        </p>
      </section>
    );
  }

  if (status === "error" || !data || data.degraded) {
    return (
      <section className="PropertyPage__section card">
        <div className="PropertyPage__sectionHeader">
          <h2>
            <Trans>Business linkages</Trans>
          </h2>
        </div>
        <p>
          <Trans>Business linkage data is not available for this property.</Trans>
        </p>
      </section>
    );
  }

  const summary = data.summary;
  const matches = data.matches.slice(0, 8);

  return (
    <section className="PropertyPage__section card">
      <div className="PropertyPage__sectionHeader">
        <h2>
          <Trans>Business linkages</Trans>
        </h2>
        {summary && (
          <p>
            <Trans>
              Best match score: {summary.business_best_match_score || "n/a"}. Ambiguous matches:{" "}
              {summary.business_ambiguous_match_count}.
            </Trans>
          </p>
        )}
      </div>
      {matches.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>
                <Trans>Business</Trans>
              </th>
              <th>
                <Trans>Evidence</Trans>
              </th>
              <th>
                <Trans>Score</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, index) => (
              <tr key={`${match.account_number}-${match.match_type}-${index}`}>
                <td>{match.matched_name || match.account_number || "Unknown"}</td>
                <td>
                  {matchLabel(match.match_type)}
                  {match.is_ambiguous && (
                    <>
                      {" "}
                      <Trans>(ambiguous)</Trans>
                    </>
                  )}
                </td>
                <td>{match.match_score ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>
          <Trans>No business linkage matches were found for this property.</Trans>
        </p>
      )}
    </section>
  );
};

export default BusinessLinkage;
