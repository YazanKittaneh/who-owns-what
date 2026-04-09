# Entity Resolution

Last validated: 2026-04-09

## Current State

- Parcel grouping in `wow_portfolios` is based on `coalesce(mail_address_name, row_id, pin)` from `portfoliograph/table.py`.
- `wow_portfolios.graph` is not populated with entity relationships.
- `wow_business_linkage_matches` and `wow_business_linkage_summary` provide useful evidence, but they are supplemental and not integrated into a broader owner-entity model.
- Mailing addresses and owner names are normalized ad hoc inside SQL rather than stored as reusable dimensions.

## Desired State

- Distinguish raw owner rows from normalized owner entities.
- Preserve every raw source row while producing reviewable, confidence-scored entity links.
- Use business-linkage evidence as supportive context, not legal proof of ownership.

## Required Changes

### Owner normalization rules

- Uppercase and collapse whitespace.
- Strip common entity suffixes for core-name comparison while preserving the original raw form.
- Preserve both `display_name` and `core_name_norm`.
- Keep source-specific identifiers such as `row_id`, business `account_number`, and source file provenance.

### Alias handling

- Store exact raw names as aliases.
- Store normalized core-name aliases.
- Track alias source and first-seen/last-seen timestamps or years.
- Do not merge entities on name similarity alone when ambiguity is high.

### Mailing-address normalization

- Normalize case, punctuation, whitespace, and unit designators.
- Store both full-address and no-unit variants.
- Normalize ZIP/postal digits separately.
- Preserve raw address text for auditing and export.

### Business linkage strategy

- Reuse the match patterns already encoded in `sql/create_business_linkage_summary.sql`:
  - exact business name
  - core business name
  - exact mailing/business address
  - no-unit mailing/business address
  - corroborated owner-person and legal-entity-owner matches
- Surface ambiguity flags and match types directly in the normalized evidence layer.

### Confidence scoring

- Exact owner/business name: highest confidence.
- Exact mailing/business address with ZIP match: high confidence but still supportive.
- Core-name and corroborated-owner matches: medium confidence.
- Nearby-owner or geography-based similarity without corroboration: low confidence.

### Conflict resolution

- Never discard conflicting raw evidence.
- Allow one parcel to have multiple candidate owner entities with ranked scores.
- Promote only the top confidence-scored link into the default owner profile when it meets threshold and has no unresolved tie.
- Route ties or ambiguous clusters into a review/debug workflow.

### Raw vs normalized storage strategy

- Raw source rows remain authoritative for provenance.
- Normalized entity and address tables are derived and reproducible.
- Serving tables should expose both the selected best match and the underlying evidence set.

### Review and debug workflow

Operators should be able to inspect, for a given `pin` or `owner_entity_id`:

- raw owner rows from `chi_owners`
- normalized parcel and mailing address forms
- business-linkage evidence rows and scores
- the winning entity-resolution decision and why it won
- any ambiguous competing candidates

## Acceptance Criteria For The First Entity-Resolution Release

- A parcel can be mapped to a normalized owner entity with a score and evidence list.
- Business-linkage evidence remains queryable as supporting context.
- Ambiguous matches are flagged rather than silently merged.
- Owner-profile APIs can explain the provenance of each linked parcel.
