# Chicago Socrata Contact Candidate Datasets

Last updated: 2026-04-12

This note lists City of Chicago Socrata datasets that are plausible inputs for landlord-contact and contact-adjacent ingestion.

These findings are specific to `data.cityofchicago.org` and complement:

- `docs/public-landlord-contact-sources.md`
- `docs/public-landlord-contact-ingestion-backlog.md`

## Highest-Value Candidates

### 1. Foreclosed Rental Property

- Dataset ID: `yhcw-iu53`
- URL: `https://data.cityofchicago.org/d/yhcw-iu53`
- Why it matters: this is the strongest City Socrata source found for direct phone and email fields.
- Useful fields:
  - `property_address`
  - `owner_name`
  - `owner_address`, `owner_city`, `owner_state`, `owner_zip`
  - `owner_management_agent_name`
  - `owner_notices_agent_name`
  - `owner_notices_agent_phone`
  - `owner_notices_agent_email`
  - `owner_management_agent_address`, `owner_management_agent_city`, `owner_management_agent_state`, `owner_management_agent_zip`
- Observed coverage from token-backed queries:
  - `531` rows with non-null `owner_notices_agent_phone` or `owner_notices_agent_email`
  - `531` non-null phones
  - `531` non-null emails
  - `531` non-null management-agent names
- Best role fit:
  - `property_manager`
  - `direct_owner`
  - `manual_verified_phone` candidate
  - `manual_verified_email` candidate
- Join keys:
  - `property_address`
  - normalized address
  - normalized `owner_name`
- Caveat: this is a targeted foreclosure-related universe, not a citywide landlord registry.

### 2. Building Permits

- Dataset ID: `ydr8-5enu`
- URL: `https://data.cityofchicago.org/d/ydr8-5enu`
- Why it matters: current schema still includes many typed contact-name slots that can identify owners, contractors, architects, and permit actors.
- Useful fields:
  - `permit_`
  - `street_number`, `street_direction`, `street_name`
  - `pin_list`
  - `contact_1_type` through `contact_15_type`
  - `contact_1_name` through `contact_15_name`
  - contact city, state, and zip fields
- Observed coverage from token-backed queries:
  - `830,528` rows with at least one populated `contact_1_name`, `contact_2_name`, or `contact_3_name`
  - `428,170` rows with an owner-labeled contact type in one of the first three contact slots
- Observed contact types in sampled rows:
  - `OWNER`
  - `OWNER AS GENERAL CONTRACTOR`
  - `CONTRACTOR-GENERAL CONTRACTOR`
  - `ARCHITECT`
  - `SELF CERT ARCHITECT`
  - `MASONRY CONTRACTOR`
  - `EXPEDITOR`
- Top observed `contact_1_type` values:
  - `ELECTRICAL CONTRACTOR`: `261,786`
  - `OWNER`: `102,705`
  - `CONTRACTOR-GENERAL CONTRACTOR`: `87,682`
  - `OWNER AS GENERAL CONTRACTOR`: `59,420`
  - `SELF CERT ARCHITECT`: `47,154`
  - `OWNER OCCUPIED`: `41,393`
- Best role fit:
  - `property_manager`
  - `operator_business`
  - `entity_officer` candidate in some owner-labeled cases
- Join keys:
  - `pin_list`
  - normalized address
- Caveat: no direct phone or email fields were observed in the current schema.

### 3. Ordinance Violations (Buildings)

- Dataset ID: `awqx-tuwv`
- URL: `https://data.cityofchicago.org/d/awqx-tuwv`
- Why it matters: includes a `respondents` field that often carries named entities, trusts, banks, or `c/o` patterns.
- Useful fields:
  - `docket_number`
  - `nov_number`
  - `address`
  - `respondents`
  - `violation_description`
  - `issuing_department`
  - `hearing_date`
  - `case_disposition`
- Observed coverage from token-backed queries:
  - `830,257` rows with non-null `respondents`
  - `333,539` rows where `respondents` contains `C/O`
- Best role fit:
  - `attorney_tax_rep` or legal proxy candidate when `c/o` patterns appear
  - `operator_business`
  - `direct_owner` candidate only when corroborated elsewhere
- Join keys:
  - normalized address
  - normalized respondent name
  - docket or notice number for provenance
- Caveat: this is a proxy-contact source, not ownership proof.

### 4. Building Code Scofflaw List - Current Records

- Dataset ID: `rz4d-qp2m`
- URL: `https://data.cityofchicago.org/d/rz4d-qp2m`
- Why it matters: directly exposes `defendant_owner` plus address and court case number.
- Useful fields:
  - `defendant_owner`
  - `address`
  - `secondary_address`
  - `tertiary_address`
  - `circuit_court_case_number`
- Observed coverage from token-backed queries:
  - `44` rows with non-null `defendant_owner`
- Best role fit:
  - `direct_owner` candidate
  - litigation proxy evidence
- Join keys:
  - normalized address
  - normalized owner name
- Caveat: likely a narrow, high-risk subset rather than a baseline source.

### 5. Vacant and Abandoned Buildings - Violations

- Dataset ID: `kc9i-wq85`
- URL: `https://data.cityofchicago.org/d/kc9i-wq85`
- Why it matters: includes a named entity or person field tied to vacant-building enforcement.
- Useful fields:
  - `property_address`
  - `entity_or_person_s_`
  - `violation_type`
  - `docket_number`
  - `issued_date`
- Observed coverage from token-backed queries:
  - `5,012` rows with non-null `entity_or_person_s_`
- Best role fit:
  - `operator_business`
  - `direct_owner` candidate when corroborated
  - vacant-property management proxy
- Join keys:
  - normalized address
  - normalized `entity_or_person_s_`
- Caveat: most useful for vacant-building workflows, not general parcel coverage.

## Existing Core Business Sources

### 6. Business Licenses

- Dataset ID: `r5kz-chrr`
- URL: `https://data.cityofchicago.org/d/r5kz-chrr`
- Useful fields:
  - `account_number`
  - `legal_name`
  - `doing_business_as_name`
  - `address`, `city`, `state`, `zip_code`
  - `license_code`, `license_description`, `business_activity`
- Best role fit:
  - `operator_business`
  - business-address corroboration

### 7. Business Licenses - Current Active

- Dataset ID: `uupf-x98q`
- URL: `https://data.cityofchicago.org/d/uupf-x98q`
- Why it matters: same structure as the base license table, but a smaller current-active slice that may be useful for fresher prospecting workflows.

### 8. Business Owners

- Dataset ID: `ezma-pppn`
- URL: `https://data.cityofchicago.org/d/ezma-pppn`
- Useful fields:
  - `account_number`
  - `doing_business_as_name`
  - `owner_first_name`
  - `owner_middle_initial`
  - `owner_last_name`
  - `owner_name`
  - `owner_title`
- Best role fit:
  - `entity_officer`
  - person-name resolution for business entities

## Useful But Lower-Value Or Activity-Only

### 9. Building Violations

- Dataset ID: `22u3-xenr`
- URL: `https://data.cityofchicago.org/d/22u3-xenr`
- Useful fields:
  - `address`
  - `violation_description`
  - `inspection_number`
  - `inspection_status`
- Current assessment: keep this as an activity and distress signal unless a separate contact-bearing path is found.
- Caveat: current schema does not expose owner or respondent-style name fields.

## Recommended Ingestion Priority

1. `yhcw-iu53` Foreclosed Rental Property
2. `ydr8-5enu` Building Permits
3. `awqx-tuwv` Ordinance Violations (Buildings)
4. `rz4d-qp2m` Building Code Scofflaw List - Current Records
5. `kc9i-wq85` Vacant and Abandoned Buildings - Violations
6. keep `r5kz-chrr`, `uupf-x98q`, and `ezma-pppn` as the business linkage backbone already planned in the repo

## Suggested Role Mapping

| Dataset ID | Primary role(s) | Confidence stance |
|---|---|---|
| `yhcw-iu53` | `property_manager`, `direct_owner`, verified phone/email candidates | high for the foreclosure subset |
| `ydr8-5enu` | `property_manager`, `operator_business` | medium |
| `awqx-tuwv` | `operator_business`, legal/respondent proxy | medium |
| `rz4d-qp2m` | `direct_owner` candidate, litigation proxy | medium-high when address corroborates |
| `kc9i-wq85` | vacant-property proxy | medium |
| `r5kz-chrr` | `operator_business` | medium |
| `ezma-pppn` | `entity_officer` | medium |

## Recommended Next Repo Changes

- Add `yhcw-iu53` to the public-contact backlog as a targeted high-value source.
- Reclassify `ydr8-5enu` from activity-only to contact-adjacent, because current schema still carries typed contact names.
- Prefer `awqx-tuwv` over generic violations datasets when looking for named respondent fields.
- Treat `rz4d-qp2m` and `kc9i-wq85` as focused distress and litigation workflows rather than baseline citywide ingestion.
