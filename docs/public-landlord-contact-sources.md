# Public Landlord Contact Sources (Chicago)

Last updated: 2026-04-12

Companion backlog:

- `docs/public-landlord-contact-ingestion-backlog.md`
- `docs/chicago-socrata-contact-candidates.md`
- `docs/individual-owner-contact-workflow.md`

## Goal

Identify public-data sources and contact-adjacent signals that can help reach parcel owners and landlords after parcel-to-owner linkage is already established.

The practical Chicago strategy is:

1. Get the best direct owner mailing contact.
2. Resolve LLC and corporate owners to officers, managers, or registered agents.
3. Add proxy or business contacts like operators, attorneys, permit applicants, and tax reps.
4. Label every contact by confidence tier.

## Repo-grounded context

- `docs/contact-data-strategies.md` already notes that current public sources are strongest for mailing addresses, not direct phone or email.
- `data/exports/nearby-owner-outreach/3137-n-kimball-ave-nearby-owner-contacts.csv` already mixes parcel-owner mailing addresses with lower-confidence business-license-derived signals.
- `sql/create_business_linkage_tables.sql` and `TODO.md` show that Illinois Secretary of State ingestion is the biggest current gap for public LLC and corporate contact resolution.

## Recommended Contact Model

Use both direct and proxy contacts, with confidence tiers.

Suggested contact roles:

- `direct_owner`
- `entity_officer`
- `registered_agent`
- `principal_office`
- `property_manager`
- `attorney_tax_rep`
- `operator_business`
- `manual_verified_phone`
- `manual_verified_email`

## Best Sources

| Tier | Source | Geography | Likely fields | Contact yield | Best join keys | Caveats |
|---|---|---|---|---|---|---|
| High | Cook County Assessor / Property Tax Portal | Cook County | owner name, mailing address, PIN, property class, tax history | Direct owner mailing contact | PIN, property address, owner name | Best baseline source, but usually no phone or email |
| High | Cook County Recorder / Clerk recordings | Cook County | deeds, grantor, grantee, document number, return or mailing address | Direct or close proxy | PIN, address, document number, party names | Often exposes attorney or return address instead of the true operating contact |
| High | Illinois Secretary of State business entity records | Illinois | principal office, registered agent, file number, managers, officers, status | Best public LLC or corporate proxy contact | entity name, file number, owner name | Strongest public LLC path; current repo ingest is still incomplete |
| Medium | Chicago Business Licenses | Chicago | legal name, DBA, account number, address, license type and status | Business or operator contact | legal name, address, account number | Useful support signal, not proof of legal property ownership |
| Medium | Chicago Business Owners | Chicago | owner first and last name, legal entity owner, title, account number | Officer or owner name resolution | account number, legal name | Best when joined to business licenses |
| Medium | Cook County Board of Review / PTAB appeals | Cook County / Illinois | appellant name, attorney name, complaint number, PIN, address | Tax-rep or attorney proxy contact | PIN, appellant name, address | Strong for active investment owners, sparse for non-appealed parcels |
| Medium | Cook County court systems | Cook County | party names, attorneys, case number, filing history | Litigation proxy contact | party name, address, case number | Good for eviction, foreclosure, chancery, and building cases |
| Medium | Chicago building permits / violations / VBR | Chicago | respondents, registrants, applicants, DOB case references, permit records | Property manager or operator signal | address, respondent name, case number | Better as contact-adjacent evidence than as a primary contact source |
| Low-Medium | OpenCorporates | Illinois and multi-state | entity names, filings, officers or agents where available | Secondary business proxy | entity name, file number | Good corroboration, but not a primary truth source |
| Low-Medium | Bizapedia | Illinois and multi-state | entity names, addresses, officers or agents where available | Secondary business proxy | entity name, file number | Useful for manual research, but quality can vary |
| Low | Company site / Google Business Profile / LinkedIn | Varies | phone, email, contact form, staff names | Manual verification layer | business name, address, website | Best used only after entity resolution |

## Official Source Notes

### 1. Cook County Assessor / Property Tax Portal

This should remain the primary direct public contact layer for parcel-linked ownership because it ties owner names and mailing addresses directly to the parcel `PIN`.

Best use:

- direct owner mailing address
- ownership normalization
- portfolio clustering by repeated mailing address

### 2. Cook County Recorder / Clerk recordings

This is especially useful for LLC or trust-owned properties because deeds, mortgages, and related filings often expose a return address, attorney address, or business mailing address that is more operational than the raw assessor owner string.

Best use:

- deed-chain analysis
- return-address extraction
- attorney and firm linkage

### 3. Illinois Secretary of State

This is the highest-value missing public source for LLC and corporation owners.

Best use:

- registered agent extraction
- principal office extraction
- manager and officer linkage
- entity-name normalization using official file numbers

This should be the top public-data enrichment priority for business-owned parcels.

### 4. Chicago Business Licenses + Business Owners

These are useful as supporting entity-context sources, especially when the same normalized legal name or business address appears across many parcels, licenses, and mail destinations.

Best use:

- account-number-based joins
- officer or owner-name resolution
- operator-business discovery
- confidence boosts when the business address matches the parcel mailing address

### 5. BOR / PTAB / courts / building systems

These are strong proxy-contact sources when the goal is to identify a reachable business actor tied to the property, even if the source does not represent legal ownership directly.

Best use:

- attorney or tax-rep discovery
- recent activity signals
- identifying active management or operating contacts

## Confidence-Tier Strategy

Suggested practical tiers:

- `high`: parcel-linked mailing address, exact SOS entity match, official registered agent, principal office with corroborating address signal
- `medium`: business-license match, business-owner account match, BOR appellant or attorney, permit applicant, VBR registrant, violation respondent
- `low`: aggregator-only matches, web-discovered contact points without corroborating official records

Important rule:

- keep direct owner contacts and proxy contacts separate in the model and UI
- do not present business-license or court-linked actors as if they were proven owners unless ownership is corroborated elsewhere

## Out-of-the-Box Ideas

### Reverse-address graph

If many parcels, business licenses, and entity records point to the same suite, PO box, or mailing address, that address is likely a management hub.

### Repeated suite and PO box clustering

Repeated use of the same non-residential mailing address is a strong signal for small landlord portfolios and can help identify the real operating entity behind several owner-name variants.

### Attorney graph

Tax appeal attorneys, foreclosure attorneys, and deed return addresses can reveal the active business entity or representative behind trust and LLC ownership structures.

### Recency-weighted operations graph

Recent permit applicants, respondents in building cases, and recent appeal representatives may be more actionable than stale deed or registration contacts.

### Cross-parcel propagation

Once one parcel in a verified portfolio gets a manually confirmed phone or email, that contact can be propagated only to the same canonical entity, not just to records sharing a similar address.

## Main Constraint

Chicago public data is strong for:

- mailing addresses
- registered agents
- principal offices
- officers and managers
- attorneys and representatives
- business operator addresses

Chicago public data is weak for:

- reliable landlord phone coverage at scale
- reliable landlord email coverage at scale

That means the winning public-data model is:

1. direct public owner contact
2. public proxy or business contact
3. manually verified phone or email

## Recommended Next Build Order

1. Complete Illinois SOS ingestion as the main public LLC and corporation source.
2. Keep assessor or treasurer mailing address as the primary direct owner contact.
3. Add recorder-derived return and mailing address extraction.
4. Add proxy pipelines for BOR, PTAB, courts, permits, VBR, and building violations.
5. Use OpenCorporates and Bizapedia as secondary corroboration, not primary truth.
6. Preserve provenance and confidence on every contact record.

## Practical Workflow By Owner Type

### Person-owned parcel

1. Start with assessor mailing address.
2. Check recorder documents for better return or mailing address.
3. Check business-license or permit signals only if there is evidence the owner operates through a business.
4. Use manual verification for phone and email.

### LLC or corp-owned parcel

1. Start with assessor mailing address.
2. Resolve owner name to SOS entity.
3. Pull registered agent, principal office, and manager or officer names.
4. Join to Chicago business licenses and business owners for account-number and address corroboration.
5. Add recorder, appeal, court, permit, and violation proxies.
6. Use manual verification for phone and email.

## Bottom Line

There is probably no broad Chicago public dataset that gives reliable landlord phone and email at scale.

The best public strategy is to combine:

- parcel-linked mailing contacts
- official business-entity contacts
- public proxy contacts from operational and legal systems
- a manual verification layer for real phone and email capture
