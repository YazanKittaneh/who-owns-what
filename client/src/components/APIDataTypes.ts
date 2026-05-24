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
  annual_tax_sale_count?: number | null;
  scavenger_tax_sale_count?: number | null;
  tax_sale_event_count?: number | null;
  latest_tax_sale_year?: number | null;
  latest_tax_sale_buyer_name?: string | null;
  latest_tax_sale_sold_at_sale?: boolean | null;
  total_tax_sale_amount_paid?: number | null;
  recorder_doc_count?: number | null;
  mortgage_doc_count?: number | null;
  quitclaim_doc_count?: number | null;
  foreclosure_doc_count?: number | null;
  latest_recorder_doc_date?: string | null;
  latest_mortgage_date?: string | null;
  latest_mortgage_amount?: number | null;
  latest_quitclaim_date?: string | null;
  latest_quitclaim_amount?: number | null;
  propstream_records?: Record<string, string>[];
  mapType?: "base" | "search";
  // Legacy NYC fields kept optional for compatibility with unused UI pieces.
  bbl?: string;
  boro?: Borough;
  council?: string | null;
  unitsres?: number | null;
  rsunits2007?: number | null;
  yearstartedj51?: number | null;
  yearstarted421a?: number | null;
  lastsaledate?: string | null;
  lastsaleamount?: number | null;
  lastsaleacrisid?: string | null;
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
  parcels_with_tax_sale_history: number;
  tax_sale_event_count: number;
  annual_tax_sale_count: number;
  scavenger_tax_sale_count: number;
  total_tax_sale_amount_paid: number;
  parcels_with_recorder_history: number;
  recorder_doc_count: number;
  mortgage_doc_count: number;
  quitclaim_doc_count: number;
  foreclosure_doc_count: number;
  violations_open_per_parcel: number;
  violations_open_per_unit: number;
};

export type BuildingInfoRecord = AddressRecord;

export type BuildingInfoResults = {
  result: BuildingInfoRecord[];
};

export type OverviewMapProperty = {
  pin: string;
  housenumber?: string | null;
  streetname?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  owner_name?: string | null;
  lat: number | null;
  lng: number | null;
};

export type OverviewMapResults = {
  result: OverviewMapProperty[];
  total_count: number;
  truncated: boolean;
};

export type NearbyPropertyRecord = {
  pin: string;
  housenumber?: string | null;
  streetname?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
  same_owner?: boolean;
  contacts?: NearbyOwnerContact[];
};

export type NearbyOwnerContact = {
  type: string;
  value: string;
  confidence: number;
  source: string;
  is_verified?: boolean;
};

export type NearbyPropertiesResults = {
  seed: {
    pin: string;
    radius_m: number;
  };
  result: NearbyPropertyRecord[];
};

export type OwnerProfileSummary = {
  owner_id?: string | null;
  owner_name?: string | null;
  parcel_count: number;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
};

export type OwnerProfileResults = {
  owner: OwnerProfileSummary;
  result: AddressRecord[];
};

export type OwnerAreaSearchSeed = {
  pin: string;
  address?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  land_class?: string | null;
  lat: number | null;
  lng: number | null;
};

export type OwnerAreaSearchParcel = {
  pin: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
  land_class?: string | null;
  building_type?: string | null;
  building_type_label?: string | null;
  same_owner?: boolean;
};

export type OwnerAreaSearchBuildingTypeCount = {
  building_type: string;
  building_type_label: string;
  parcel_count: number | null;
};

export type OwnerAreaSearchOwner = {
  owner_key: string;
  owner_id?: string | null;
  owner_name?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  parcel_count: number | null;
  nearest_distance_m?: number | null;
  same_owner: boolean;
  building_type_counts: OwnerAreaSearchBuildingTypeCount[];
  parcels: OwnerAreaSearchParcel[];
};

export type OwnerAreaSearchResults = {
  seed: OwnerAreaSearchSeed | null;
  filters: {
    pin: string;
    radius_m: number;
    building_types: string[];
    min_parcels: number;
    max_parcels?: number | null;
    limit: number;
  };
  result: OwnerAreaSearchOwner[];
};

export type IndicatorsHistoryRecord = {
  month: string;
  permits_total?: number;
  violations_total?: number;
  violations_open?: number;
  service_requests_total?: number;
  hpdviolations_class_a?: number;
  hpdviolations_class_b?: number;
  hpdviolations_class_c?: number;
  hpdviolations_class_i?: number;
  hpdviolations_total?: number;
  hpdcomplaints_emergency?: number;
  hpdcomplaints_nonemergency?: number;
  hpdcomplaints_total?: number;
  dobpermits_total?: number;
  dobviolations_regular?: number;
  dobviolations_ecb?: number;
  dobviolations_total?: number;
  evictionfilings_total?: number | null;
  rentstabilizedunits_total?: number;
};

export type IndicatorsHistoryResults = {
  schema?: "nyc" | "standard";
  result: IndicatorsHistoryRecord[];
};
