# Supplemental Downloads

This folder stages additional source datasets requested for the Chicago WOW dashboard.

## Downloaded datasets

### 1. Tax delinquency / tax sale

- `tax/treasurer_annual_tax_sale.csv`
  - Source: Cook County Treasurer Annual Tax Sale
  - URL: `https://datacatalog.cookcountyil.gov/Property-Taxation/Treasurer-Annual-Tax-Sale/55ju-2fs9`
  - Join key: `PIN`
  - Source-reported rows at download time: `200915`

- `tax/treasurer_scavenger_tax_sale.csv`
  - Source: Cook County Treasurer Scavenger Tax Sale
  - URL: `https://datacatalog.cookcountyil.gov/Property-Taxation/Treasurer-Scavenger-Tax-Sale/ydgz-vkrp`
  - Join key: `PIN`
  - Source-reported rows at download time: `5609`

### 2. Deeds / mortgages / foreclosures

- `recorder/recorder_foreclosures_mortgages_quitclaim_2013_2015.csv`
  - Source: Cook County Recorder, Foreclosures / Mortgages / Quit Claim Deeds
  - URL: `https://datacatalog.cookcountyil.gov/Property-Taxation/Cook-County-Recorder-Foreclosures-Mortgages-and-Qu/4f2q-h3b7`
  - Join key: `PIN`, `document_number`, address fields
  - Source-reported rows at download time: `511173`

### 3. Corporate registry / LLC linkage

Downloaded practical fallback datasets:

- `corporate/chicago_business_owners.csv`
  - Source: Chicago Business Owners
  - URL: `https://data.cityofchicago.org/Community-Economic-Development/Business-Owners/ezma-pppn`
  - Join key: `account_number`, `legal_name`, address fields
  - Source-reported rows at download time: `327443`

- `corporate/chicago_business_licenses.csv`
  - Source: Chicago Business Licenses
  - URL: `https://data.cityofchicago.org/Community-Economic-Development/Business-Licenses/r5kz-chrr`
  - Join key: `account_number`, `legal_name`, address fields
  - Source-reported rows at download time: `1192014`

## Illinois SOS official bulk source

The official Illinois Secretary of State bulk corporation / LLC data source was identified, but the direct ZIP downloads returned `403` from this host during automated download attempts.

Observed retrieval behavior during this session:

- direct host-side `curl` / `requests`: `403` or timeout
- tool-side `webfetch`: able to reach the bulk ZIP URL, but not usable for saving the large binary into the workspace

Official bulk URL page:

- `https://www.ilsos.gov/data/bus-serv-home.html`

Important official ZIP links identified from that page include:

- Corporations master: `https://apps.ilsos.gov/data/bs/cdxallmst.zip`
- Corporations names: `https://apps.ilsos.gov/data/bs/cdxallnam.zip`
- Corporations agents: `https://apps.ilsos.gov/data/bs/cdxallagt.zip`
- LLC master: `https://apps.ilsos.gov/data/bs/llcallmst.zip`
- LLC names: `https://apps.ilsos.gov/data/bs/llcallnam.zip`
- LLC agents: `https://apps.ilsos.gov/data/bs/llcallagt.zip`
- LLC managers: `https://apps.ilsos.gov/data/bs/llcallmgr.zip`

Use those official Illinois SOS bulk files as the preferred statewide registry source if they can be downloaded from a browser session or another host not blocked by the current `403` behavior.
