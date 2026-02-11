import { SearchAddress } from "./AddressSearch";

export type Borough = string;
export type District = any;

export type HpdOwnerContact = {
  title: string;
  value: string;
};

export type HpdContactAddress = {
  housenumber: string | null;
  streetname: string;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type HpdFullContact = HpdOwnerContact & {
  address: HpdContactAddress | null;
};

export type HpdComplaintCount = {
  type: string;
  count: number;
};

export type SearchAddressWithoutPin = Omit<SearchAddress, "pin">;

export type GeoSearchData = {
  pin: string;
};

export type AddressRecord = {
  pin: string;
  housenumber: string | null;
  streetname: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  owner_id: string | null;
  owner_name: string | null;
  mailing_address: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  units_res: number | null;
  land_class: string | null;
  building_class: string | null;
  lat: number | null;
  lng: number | null;
  ward: string | null;
  community_area: string | null;
  census_tract: string | null;
  permits_total: number | null;
  violations_open: number | null;
  violations_total: number | null;
  requests_311_total: number | null;
  mapType?: "base" | "search";
  // Legacy NYC fields kept optional for compatibility with unused UI pieces.
  bbl?: string;
  boro?: Borough;
  ownernames?: HpdOwnerContact[] | null;
  allcontacts?: HpdFullContact[] | null;
  businessaddrs?: string[] | null;
  corpnames?: string[] | null;
  openviolations?: number;
  totalviolations?: number;
  totalcomplaints?: number;
  recentcomplaints?: number;
  recentcomplaintsbytype?: HpdComplaintCount[] | null;
  rsunitslatest?: number | null;
  rsunitslatestyear?: number | null;
  rsdiff?: number | null;
  evictions?: number | null;
  evictionfilings?: number | null;
  yearbuilt?: number | null;
  lastregistrationdate?: string;
  registrationenddate?: string;
};

export type SearchResults = {
  addrs: AddressRecord[];
  geosearch?: GeoSearchData;
};

export type SummaryStatsRecord = {
  parcels: number;
  units_res: number;
  permits_total: number;
  violations_open: number;
  violations_total: number;
  requests_311_total: number;
  violations_open_per_parcel: number;
  violations_open_per_unit: number;
};

export type BuildingInfoRecord = AddressRecord;

export type BuildingInfoResults = {
  result: BuildingInfoRecord[];
};
