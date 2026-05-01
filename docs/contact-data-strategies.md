# Owner/Company Contact Data Strategies (Chicago)

Last validated: 2026-04-10
Status: **IMPLEMENTED**

## Implementation Summary

This document outlines the contact data strategies implemented for enriching owner and company records with phone and email data. The system is now live and operational.

## Quick Start

### Ingest Contact Data

```bash
# Run the complete contact ingestion workflow
python scripts/run_contact_ingestion.py --link-parcels --recalculate-confidence

# Or run individual extractors
python scripts/extract_business_license_contacts.py --link-parcels
python scripts/extract_building_permit_contacts.py --link-parcels
python scripts/extract_foreclosed_rental_contacts.py --link-parcels
python scripts/extract_sos_contacts.py --link-existing

# Or import manually verified / commercial phone+email enrichment
python scripts/import_contact_enrichment.py docs/contact-enrichment-template.csv --dry-run
```

### API Endpoints

- `GET /api/entity/search?q=example` - Search entities by name
- `GET /api/entity/contacts?entity_id=123` - Get contacts for an entity
- `GET /api/parcel/entities?pin=12345678901234` - Get entities for a parcel
- `GET /api/admin/contact-coverage` - Admin dashboard for contact stats

### Frontend Component

```tsx
import { EntityContacts } from "components/EntityContacts";

// Display contacts for a specific entity
<EntityContacts entityId={123} minConfidence={70} />

// Display contacts for a parcel
<EntityContacts pin="12345678901234" />
```

### Landlord Phone/Email Enrichment

The currently loaded public sources provide mailing addresses, not phone/email fields. To load real landlord phone/email coverage from manual verification or a commercial vendor export:

```bash
python scripts/import_contact_enrichment.py path/to/landlord-contacts.csv
```

Template columns are documented in `docs/contact-enrichment-template.csv`.

## Current Implementation

### Database Schema

Core tables created in `sql/create_contact_tables.sql`:

- `canonical_entities` - Master entity identities (business/individual)
- `entity_aliases` - Name variations mapping to canonical entities
- `entity_contacts` - Phone/email/address with provenance and confidence
- `entity_parcel_mappings` - Many-to-many entity-parcel relationships
- `contact_audit_log` - Change tracking for compliance

Functions created in `sql/create_contact_functions.sql`:

- `normalize_name()`, `normalize_phone()`, `normalize_email()` - Text normalization
- `resolve_canonical_entity()` - Entity resolution with fuzzy matching
- `link_contact_to_entity()` - Contact linking with deduplication
- `map_entity_to_parcel()` - Parcel-entity mapping
- `calculate_contact_confidence()` - Dynamic confidence scoring
- `get_entity_primary_contacts()`, `get_parcel_entities()` - Retrieval functions

Derived views created in `sql/create_contact_integration.sql`:

- `v_entity_contact_summary` - Aggregated entity contact info
- `v_parcel_entity_summary` - Parcels enriched with entity contacts
- `v_contact_quality_by_source` - Source quality metrics
- `v_stale_contacts` - Contacts requiring review

### Data Sources Implemented

**Option 1: Chicago Business Licenses (PUBLIC)**
- Status: ✅ IMPLEMENTED
- Script: `scripts/extract_business_license_contacts.py`
- Source: `chi_business_licenses` table
- Data: Addresses, DBA names
- Base Confidence: 35 points
- Parcel Linking: Via address matching

**Option 2: Illinois Secretary of State Records (PUBLIC)**
- Status: ✅ IMPLEMENTED
- Script: `scripts/extract_sos_contacts.py`
- Source: IL SOS corp/LLC bulk files
- Data: Principal addresses, registered agent info
- Base Confidence: 40 points
- Entity Linking: Via name fuzzy matching

**Option 3: Foreclosed Rental Property Registrations (PUBLIC, TARGETED)**
- Status: ✅ IMPLEMENTED
- Script: `scripts/extract_foreclosed_rental_contacts.py`
- Source: `chi_foreclosed_rental_properties` (`yhcw-iu53`)
- Data: Owner mailing address, management-agent address, notices-agent phone, notices-agent email
- Base Confidence: 45 points
- Parcel Linking: Exact normalized property-address match to `wow_parcels`

**Option 4: Building Permits Contact Roles (PUBLIC, CONTACT-ADJACENT)**
- Status: ✅ IMPLEMENTED
- Script: `scripts/extract_building_permit_contacts.py`
- Source: `chi_permits` (`ydr8-5enu`)
- Data: Typed permit contact names, parcel-linked contact roles, low-confidence owner-site address for owner-labeled contacts
- Base Confidence: 25 points
- Parcel Linking: Permit `pin_list` exploded against `wow_parcels.pin10`

### Confidence Scoring System

Base scores by source:
- SOS identity linkage: 40 points
- Business license exact match: 35 points
- Manual verified: 50 point override

Adjustments:
- Exact normalized name match: +10
- Address co-match: +15
- Stale (>24 months): -15
- Fuzzy-only name match: -20

Display thresholds:
- Public display: ≥ 70
- Internal review queue: 50-69
- Suppress: < 50

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Data Sources   │────▶│  Ingest Scripts  │────▶│  Contact Tables │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                          ┌──────────────────┐
│ Business        │                          │ API Endpoints    │
│ Licenses CSV    │                          │ - /entity/search │
│ SOS Corp CSV    │                          │ - /entity/contacts│
│ SOS LLC CSV     │                          │ - /parcel/entities│
└─────────────────┘                          └──────────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────────┐
                                               │ React Component  │
                                               │ EntityContacts   │
                                               └──────────────────┘
```

## Files Created/Modified

### SQL Files
- `sql/create_contact_tables.sql` - Core schema
- `sql/create_contact_functions.sql` - Functions and logic
- `sql/create_contact_integration.sql` - Views and indexes

### Python Scripts
- `scripts/extract_business_license_contacts.py` - Business license ingestion
- `scripts/extract_building_permit_contacts.py` - Building permit contact-adjacent ingestion
- `scripts/extract_foreclosed_rental_contacts.py` - Foreclosed rental contact ingestion
- `scripts/extract_sos_contacts.py` - SOS records ingestion
- `scripts/run_contact_ingestion.py` - Master workflow script

### API (Backend)
- `wow/views.py` - Added 4 new endpoints
- `wow/urls.py` - Added URL routes
- `wow/forms.py` - Added validation forms

### Frontend
- `client/src/components/EntityContacts.tsx` - Contact display component
- `client/src/components/EntityContacts.scss` - Component styles
- `client/src/components/APIClient.ts` - Added contact API methods

## Production Deployment Checklist

- [ ] Run SQL schema scripts on production database
- [ ] Ingest business license data: `python scripts/extract_business_license_contacts.py --link-parcels`
- [ ] Ingest building permit contact-adjacent data: `python scripts/extract_building_permit_contacts.py --link-parcels`
- [ ] Ingest foreclosed rental contact data: `python scripts/extract_foreclosed_rental_contacts.py --link-parcels`
- [ ] Ingest SOS data (if available): `python scripts/extract_sos_contacts.py`
- [ ] Run confidence recalculation: `SELECT recalculate_all_confidence_scores()`
- [ ] Run auto-assignment of primary contacts: `SELECT auto_assign_primary_contacts()`
- [ ] Verify API endpoints: `curl /api/admin/contact-coverage`
- [ ] Set up scheduled refresh (monthly recommended)
- [ ] Monitor `v_stale_contacts` for data quality

## Data Quality Metrics

Track via `/api/admin/contact-coverage`:
- Total entities with contacts
- % with high-confidence phone/email
- Average confidence by source
- Stale contact rate
- False positive complaints (manual review)

## Maintenance

Monthly tasks:
1. Re-run ingestion scripts for fresh data
2. Review stale contacts in `v_stale_contacts`
3. Check confidence distribution in `v_contact_quality_by_source`
4. Review audit log for manual changes

## Legal/Compliance Notes

- All data sourced from public records (business licenses, SOS filings)
- No private personal phone numbers collected
- Source attribution maintained in all contact records
- Audit log captures all manual changes
- Stale data automatically flagged after 24 months

## Original Strategy Document

The remainder of this document preserves the original planning content:

---

## Goal (Original)

Enrich owner and company records with phone and email data while preserving provenance, minimizing false matches, and keeping legal/ops risk manageable.

## Current baseline (Original)

Strong today:
- parcel ownership and mailing-address linkage
- portfolio/entity grouping from ownership + address signals

Weak today:
- direct owner/company phone coverage
- direct owner/company email coverage

## Option 5: Recorder/Assessor/Treasurer contact-adjacent public records

Status: 📋 PLANNED (Future implementation)
- Can provide mailing addresses tied to owners/documents
- Good for ownership continuity
- Weak for direct phone/email

## Option 6: Commercial enrichment APIs (paid)

Status: 📋 PLANNED (Phase 3)
- Best coverage for phone/email
- Requires budget/procurement/legal review
- API integration framework ready

## Option 7: Manual research workflow (targeted)

Status: 📋 PLANNED (Phase 3)
- Highest precision per record
- Requires reviewer workflow and QA rubric
- Individual-owner lookup playbook: `docs/individual-owner-contact-workflow.md`

## Suggested Implementation Phases (Completed)

Phase 1: ✅ COMPLETE
- Business license ingestion and matching
- `entity_contacts` table + provenance fields
- Confidence scoring system
- API endpoints
- Frontend components

Phase 2: ✅ COMPLETE
- SOS canonical entity layer + alias backfill
- Re-scoring contacts with stronger entity identity

Phase 3: 📋 PLANNED
- Optional paid enrichment for unresolved priority entities
- Review queue for manual verification

Phase 4: 📋 PLANNED
- Enhanced admin QA dashboard
- Automated confidence recalculation
