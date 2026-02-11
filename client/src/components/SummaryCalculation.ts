import { AddressRecord, SummaryStatsRecord } from "./APIDataTypes";
import _ from "lodash";

export const calculateAggDataFromAddressList = (addrs: AddressRecord[]): SummaryStatsRecord => {
  const parcels = addrs.length;
  const units_res = _.sumBy(addrs, (a) => a.units_res || 0);
  const permits_total = _.sumBy(addrs, (a) => a.permits_total || 0);
  const violations_open = _.sumBy(addrs, (a) => a.violations_open || 0);
  const violations_total = _.sumBy(addrs, (a) => a.violations_total || 0);
  const requests_311_total = _.sumBy(addrs, (a) => a.requests_311_total || 0);

  return {
    parcels,
    units_res,
    permits_total,
    violations_open,
    violations_total,
    requests_311_total,
    violations_open_per_parcel: parcels ? violations_open / parcels : 0,
    violations_open_per_unit: units_res ? violations_open / units_res : 0,
  };
};
