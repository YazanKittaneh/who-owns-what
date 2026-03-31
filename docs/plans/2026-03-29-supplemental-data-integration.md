# Supplemental Data Integration Plan

## Scope

Stage three additional data families for the Chicago WOW dashboard without changing live API behavior yet:

- property tax sale / delinquency signals
- recorder deeds / mortgages / foreclosure-adjacent document history
- entity / business linkage data

## Source files staged now

- `data/supplemental-20260329/tax/treasurer_annual_tax_sale.csv`
- `data/supplemental-20260329/tax/treasurer_scavenger_tax_sale.csv`
- `data/supplemental-20260329/recorder/recorder_foreclosures_mortgages_quitclaim_2013_2015.csv`
- `data/supplemental-20260329/corporate/chicago_business_owners.csv`
- `data/supplemental-20260329/corporate/chicago_business_licenses.csv`

## Join strategy

### 1. Tax sale data

Primary join:

- `wow_parcels.pin` to tax-sale `PIN`

Notes:

- Normalize both sides to a canonical PIN form with punctuation removed for stable joins.
- Annual and scavenger sale data should remain separate raw tables, then roll up into parcel-level summaries.

Recommended parcel-level derived fields:

- `tax_sale_annual_count`
- `tax_sale_scavenger_count`
- `tax_sale_latest_year`
- `tax_sale_sold_at_sale`
- `tax_sale_latest_buyer_name`
- `tax_sale_total_amount_paid`

### 2. Recorder data

Primary join:

- `wow_parcels.pin` to recorder `PIN`

Notes:

- The staged recorder dataset is historical and mixed across mortgages, quit claims, and foreclosure-related docs.
- Treat it as document history, not a definitive current title chain.

Recommended parcel-level derived fields:

- `recorder_doc_count`
- `latest_mortgage_date`
- `latest_mortgage_amount`
- `latest_quitclaim_date`
- `latest_quitclaim_amount`
- `foreclosure_doc_count`
- `latest_recorder_doc_date`

### 3. Corporate / entity linkage

Available now:

- Chicago business licenses
- Chicago business owners

Preferred future source:

- Illinois SOS bulk corporation / LLC files

Join strategy in stages:

1. Join `business_licenses` to `business_owners` by `ACCOUNT NUMBER`
2. Normalize `LEGAL NAME`, owner names, and address strings
3. Attempt soft linkage from `wow_parcels.owner_name` and mailing fields to business legal names and owner names
4. Once Illinois SOS bulk files are available, enrich matched business names with official entity master, agent, manager, and old-name records

Important caveat:

- Business license / owner linkage is not the same thing as legal property ownership.
- This should be exposed as supporting entity context, not as a replacement for the parcel owner record.

Recommended derived outputs:

- `wow_business_name_matches`
- `wow_business_owner_name_matches`
- `wow_registered_agent_matches` once Illinois SOS bulk is available
- `wow_entity_old_name_matches` once Illinois SOS bulk is available

## Illinois SOS bulk status

Official Illinois Secretary of State bulk ZIP URLs were identified from the DTA page, but direct automated downloads from this host returned `403`.

Observed behavior:

- host-side `curl` / `requests`: `403` or timeout
- `webfetch` path: able to reach the ZIP URL, but not usable for saving large binary files into the workspace

Conclusion:

- treat Illinois SOS bulk files as the preferred statewide source
- keep the Chicago business datasets as the practical staged fallback until we can fetch the SOS ZIPs from a browser session or another host

## Recommended implementation order

1. Load raw tax / recorder / Chicago business tables into Postgres
2. Build parcel-level summary views keyed by normalized `PIN`
3. Add soft business/entity linkage views keyed by normalized legal names and mailing addresses
4. Add API fields only after the match quality is reviewed on real landlord portfolios
5. Replace or augment the business-linkage layer with Illinois SOS bulk data when retrieval is available
