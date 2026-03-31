import { AddressRecord, SummaryStatsRecord } from "./APIDataTypes";
import _ from "lodash";

export const calculateAggDataFromAddressList = (addrs: AddressRecord[]): SummaryStatsRecord => {
  const parcels = addrs.length;
  const units_res = _.sumBy(addrs, (a) => a.units_res || 0);
  const permits_total = _.sumBy(addrs, (a) => a.permits_total || 0);
  const violations_open = _.sumBy(addrs, (a) => a.violations_open || 0);
  const violations_total = _.sumBy(addrs, (a) => a.violations_total || 0);
  const requests_311_total = _.sumBy(addrs, (a) => a.requests_311_total || 0);
  const annual_tax_sale_count = _.sumBy(addrs, (a) => a.annual_tax_sale_count || 0);
  const scavenger_tax_sale_count = _.sumBy(addrs, (a) => a.scavenger_tax_sale_count || 0);
  const tax_sale_event_count = _.sumBy(addrs, (a) => a.tax_sale_event_count || 0);
  const total_tax_sale_amount_paid = _.sumBy(addrs, (a) => a.total_tax_sale_amount_paid || 0);
  const parcels_with_tax_sale_history = addrs.filter((a) => (a.tax_sale_event_count || 0) > 0).length;
  const recorder_doc_count = _.sumBy(addrs, (a) => a.recorder_doc_count || 0);
  const mortgage_doc_count = _.sumBy(addrs, (a) => a.mortgage_doc_count || 0);
  const quitclaim_doc_count = _.sumBy(addrs, (a) => a.quitclaim_doc_count || 0);
  const foreclosure_doc_count = _.sumBy(addrs, (a) => a.foreclosure_doc_count || 0);
  const parcels_with_recorder_history = addrs.filter((a) => (a.recorder_doc_count || 0) > 0).length;

  return {
    parcels,
    units_res,
    permits_total,
    violations_open,
    violations_total,
    requests_311_total,
    parcels_with_tax_sale_history,
    tax_sale_event_count,
    annual_tax_sale_count,
    scavenger_tax_sale_count,
    total_tax_sale_amount_paid,
    parcels_with_recorder_history,
    recorder_doc_count,
    mortgage_doc_count,
    quitclaim_doc_count,
    foreclosure_doc_count,
    violations_open_per_parcel: parcels ? violations_open / parcels : 0,
    violations_open_per_unit: units_res ? violations_open / units_res : 0,
  };
};
