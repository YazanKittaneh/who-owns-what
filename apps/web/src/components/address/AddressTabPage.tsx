import Link from "next/link";
import { notFound } from "next/navigation";
import AddressTabs from "@/components/address/AddressTabs";
import PropertySummary from "@/components/property/PropertySummary";
import {
  DataSourceUnavailableError,
  getAddressByPin,
  getPortfolioById,
  getPortfolioSummary,
} from "@/lib/dataSource";
import type { AddressRecord, PortfolioSummary } from "@/lib/mvpData";
import type { AddressRouteStyle, AddressTabKey, SupportedLocale } from "@/lib/routes";

type Props = {
  pin: string;
  tab: AddressTabKey;
  style: AddressRouteStyle;
  locale?: SupportedLocale;
  timelineIndicator?: string;
};

export default async function AddressTabPage({
  pin,
  tab,
  style,
  locale,
  timelineIndicator,
}: Props) {
  let record: AddressRecord | null = null;
  let portfolioRows: AddressRecord[] = [];
  let portfolioSummary: PortfolioSummary | null = null;
  let dataError = "";

  try {
    record = await getAddressByPin(pin);
    if (!record) {
      notFound();
    }

    if (tab === "portfolio" || tab === "summary") {
      [portfolioRows, portfolioSummary] = await Promise.all([
        getPortfolioById(record.portfolioId),
        getPortfolioSummary(record.portfolioId),
      ]);
    }
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      dataError = error.message;
    } else {
      throw error;
    }
  }

  if (dataError) {
    return (
      <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
        <h1>Property Details</h1>
        <p>{dataError}</p>
      </main>
    );
  }

  if (!record) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <AddressTabs pin={record.pin} currentTab={tab} style={style} locale={locale} />

      {tab === "overview" ? <PropertySummary record={record} /> : null}

      {tab === "portfolio" ? (
        <section style={{ display: "grid", gap: "0.6rem" }}>
          <h1>Portfolio</h1>
          <p>
            Associated portfolio: <strong>{record.portfolioId}</strong>
          </p>
          <p>
            <Link href={`/portfolio/${record.portfolioId}`}>Open full portfolio page</Link>
          </p>
          {portfolioSummary ? (
            <div style={{ border: "1px solid #ddd", padding: "0.75rem", display: "grid", gap: "0.25rem" }}>
              <p>
                <strong>Owner:</strong> {portfolioSummary.ownerName}
              </p>
              <p>
                <strong>Total properties:</strong> {portfolioSummary.pinCount}
              </p>
              <p>
                <strong>Total open violations:</strong> {portfolioSummary.totalViolationsOpen}
              </p>
              <p>
                <strong>Total permits:</strong> {portfolioSummary.totalPermits}
              </p>
            </div>
          ) : null}
          <p>Known properties in this portfolio: {portfolioRows.length}</p>
        </section>
      ) : null}

      {tab === "timeline" ? (
        <section style={{ display: "grid", gap: "0.6rem" }}>
          <h1>Timeline</h1>
          <p>Indicator history view is being migrated for full parity.</p>
          <p>
            Current indicator: <strong>{timelineIndicator ?? "all"}</strong>
          </p>
          <p>Open violations: {record.violationsOpen}</p>
          <p>Total permits: {record.permitsTotal}</p>
        </section>
      ) : null}

      {tab === "summary" ? (
        <section style={{ display: "grid", gap: "0.6rem" }}>
          <h1>Summary</h1>
          <div style={{ border: "1px solid #ddd", padding: "0.75rem", display: "grid", gap: "0.25rem" }}>
            <p>
              <strong>Address:</strong> {record.address}
            </p>
            <p>
              <strong>Owner:</strong> {record.ownerName}
            </p>
            <p>
              <strong>PIN:</strong> {record.pin}
            </p>
            <p>
              <strong>Open violations:</strong> {record.violationsOpen}
            </p>
            <p>
              <strong>Total permits:</strong> {record.permitsTotal}
            </p>
            <p>
              <strong>Portfolio ID:</strong> {record.portfolioId}
            </p>
          </div>
          {portfolioSummary ? (
            <p>
              Portfolio totals: {portfolioSummary.pinCount} properties, {portfolioSummary.totalViolationsOpen} open
              violations, {portfolioSummary.totalPermits} permits.
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
