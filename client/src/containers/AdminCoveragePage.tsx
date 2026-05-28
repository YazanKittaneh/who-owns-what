import React from "react";
import { HTTPError } from "error-reporting";

import APIClient from "components/APIClient";
import Page from "components/Page";
import {
  AdminContactCoverageResults,
  AdminCoverageResults,
  AdminDataCoverageDataset,
} from "components/APIDataTypes";

import "styles/AdminCoveragePage.css";

const STORAGE_KEY = "wow-admin-api-token";

function formatNumber(value: number | null | undefined) {
  if (value == null) return "N/A";
  return value.toLocaleString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatYears(dataset: AdminDataCoverageDataset) {
  if (dataset.min_year == null && dataset.max_year == null) return "N/A";
  if (dataset.min_year === dataset.max_year) return String(dataset.min_year);
  return `${dataset.min_year || "?"}-${dataset.max_year || "?"}`;
}

function describeDataset(dataset: AdminDataCoverageDataset) {
  const details = [];
  if (dataset.reason) details.push(dataset.reason);
  if (dataset.pins_with_multi_year_pct != null) {
    details.push(`${dataset.pins_with_multi_year_pct}% pins multi-year`);
  }
  if (dataset.last_load_status) details.push(`last load ${dataset.last_load_status}`);
  return details.join(" | ") || "N/A";
}

const statusClassName = (status: string) =>
  `AdminCoveragePage__status AdminCoveragePage__status--${status}`;

const DataCoverageTable: React.FC<{ datasets: AdminDataCoverageDataset[] }> = ({ datasets }) => (
  <div className="AdminCoveragePage__tableWrap">
    <table className="AdminCoveragePage__table table">
      <thead>
        <tr>
          <th>Dataset</th>
          <th>Status</th>
          <th>Rows</th>
          <th>Years</th>
          <th>Last loaded</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr key={dataset.dataset}>
            <td>
              <code>{dataset.dataset}</code>
            </td>
            <td>
              <span className={statusClassName(dataset.status)}>{dataset.status}</span>
            </td>
            <td>{formatNumber(dataset.row_count)}</td>
            <td>{formatYears(dataset)}</td>
            <td>{formatDate(dataset.last_loaded_at)}</td>
            <td>{describeDataset(dataset)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ContactCoveragePanel: React.FC<{ contactCoverage: AdminContactCoverageResults }> = ({
  contactCoverage,
}) => {
  if (contactCoverage.status === "not_initialized") {
    return <p className="AdminCoveragePage__note">{contactCoverage.message}</p>;
  }

  const coverage = contactCoverage.coverage;
  if (!coverage) return <p className="AdminCoveragePage__note">No contact coverage returned.</p>;

  return (
    <>
      <div className="AdminCoveragePage__metrics">
        <div>
          <span>Entities</span>
          <strong>{formatNumber(coverage.entity_count)}</strong>
        </div>
        <div>
          <span>With phone</span>
          <strong>{formatNumber(coverage.entities_with_phone)}</strong>
        </div>
        <div>
          <span>With email</span>
          <strong>{formatNumber(coverage.entities_with_email)}</strong>
        </div>
        <div>
          <span>With address</span>
          <strong>{formatNumber(coverage.entities_with_address)}</strong>
        </div>
        <div>
          <span>Avg confidence</span>
          <strong>{coverage.avg_confidence}</strong>
        </div>
        <div>
          <span>High confidence</span>
          <strong>{formatNumber(coverage.high_confidence_entities)}</strong>
        </div>
      </div>

      {(contactCoverage.sources || []).length > 0 && (
        <div className="AdminCoveragePage__tableWrap">
          <table className="AdminCoveragePage__table table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Entities</th>
                <th>Contacts</th>
                <th>Avg confidence</th>
              </tr>
            </thead>
            <tbody>
              {(contactCoverage.sources || []).map((source) => (
                <tr key={source.source}>
                  <td>{source.source}</td>
                  <td>{formatNumber(source.entity_count)}</td>
                  <td>{formatNumber(source.contact_count)}</td>
                  <td>{source.avg_confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

function getErrorMessage(error: unknown) {
  if (error instanceof HTTPError && error.status === 401) return "Admin token was rejected.";
  if (error instanceof Error) return error.message;
  return "Coverage request failed.";
}

const AdminCoveragePage: React.FC = () => {
  const [token, setToken] = React.useState(() => window.sessionStorage.getItem(STORAGE_KEY) || "");
  const [coverage, setCoverage] = React.useState<AdminCoverageResults | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadCoverage = React.useCallback(async () => {
    if (!token.trim()) {
      setError("Enter an admin token first.");
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, token.trim());
    setLoading(true);
    setError(null);
    try {
      setCoverage(await APIClient.getAdminCoverage(token.trim()));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [token]);

  return (
    <Page title="Admin coverage">
      <main className="AdminCoveragePage Page">
        <header className="AdminCoveragePage__header">
          <div>
            <p className="AdminCoveragePage__eyebrow">Admin</p>
            <h1>Data and contact coverage</h1>
          </div>
          <form
            className="AdminCoveragePage__tokenForm"
            onSubmit={(event) => {
              event.preventDefault();
              loadCoverage();
            }}
          >
            <input
              aria-label="Admin token"
              className="form-input"
              type="password"
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
              placeholder="Admin token"
            />
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Loading" : "Refresh"}
            </button>
          </form>
        </header>

        {error && <div className="toast toast-error">{error}</div>}

        {coverage && (
          <>
            <section className="AdminCoveragePage__section">
              <div className="AdminCoveragePage__sectionHeader">
                <h2>Dataset coverage</h2>
                <span>Generated {formatDate(coverage.dataCoverage.generated_at)}</span>
              </div>
              <DataCoverageTable datasets={coverage.dataCoverage.datasets} />
            </section>

            <section className="AdminCoveragePage__section">
              <div className="AdminCoveragePage__sectionHeader">
                <h2>Contact coverage</h2>
                {coverage.contactCoverage.generated_at && (
                  <span>Generated {formatDate(coverage.contactCoverage.generated_at)}</span>
                )}
              </div>
              <ContactCoveragePanel contactCoverage={coverage.contactCoverage} />
            </section>
          </>
        )}
      </main>
    </Page>
  );
};

export default AdminCoveragePage;
