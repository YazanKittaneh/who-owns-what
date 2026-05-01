# Individual Owner Contact Workflow

Last updated: 2026-04-13

This workflow is for parcels where the current owner appears to be a person rather than an LLC, corporation, trust, or institutional entity.

Companion docs:

- `docs/public-landlord-contact-sources.md`
- `docs/public-landlord-contact-ingestion-backlog.md`
- `docs/contact-data-strategies.md`

## Goal

Create a repeatable, compliant workflow for reaching an individual parcel owner using:

- public parcel-owner details
- public business or management contact channels
- public attorney or professional proxy channels

This workflow does not rely on private-person skip tracing or non-public personal contact data.

## Core Principle

For individual owners, the most reliable public contact is usually still the mailing address.

Public phone and email coverage is weak unless one of these is true:

- the owner self-lists a rental publicly
- the owner uses a visible management company
- the property has a public leasing or rental listing
- the owner or property is in a public legal or appeal process with a reachable business proxy

## What Counts As In Scope

Allowed targets:

- mailing addresses from public property records
- public business phone numbers
- leasing office phone numbers
- management company phone numbers
- law-firm office phone numbers
- public company websites and contact forms

Not recommended as a default workflow:

- private personal phone lookups
- consumer people-search sites as a core source of truth
- loading personal phone numbers into `entity_contacts` without a clear public business or property context

## Workflow Overview

1. Confirm the parcel is person-owned.
2. Capture the assessor owner and mailing address baseline.
3. Check for recorder evidence that improves the mailing target.
4. Look for visible rental or management activity at the property address.
5. Look for public business or professional proxy contacts tied to the owner or property.
6. Record outcomes with confidence and role labels.

## Step 1: Confirm The Owner Type

Indicators the parcel is probably person-owned:

- owner string looks like a person name rather than an entity
- no `LLC`, `INC`, `CO`, `TRUST`, `BANK`, or similar suffix
- mailing name and property owner name align to a person record

Escalate out of this workflow if:

- the name is actually a business or trust
- the mailing address clusters many parcels under a business-looking pattern
- a permit, deed, or listing clearly shows a management or operating entity

## Step 2: Establish The Baseline Public Contact

Primary source:

- Cook County Assessor owner dataset / property detail

Capture:

- `pin`
- parcel address
- owner name
- mailing name
- mailing address
- year of the owner row

This is the default direct contact even if no phone or email exists.

## Step 3: Improve The Mailing Target

Check:

- recorder / deed records for return or mailing address changes
- recent sale records for buyer name continuity
- tax bill mailing-address consistency if available

Use this step to answer:

- is the assessor mailing address still plausible?
- does the owner use a business mailbox or office?
- is there a more recent return address tied to the property?

If a recorder-derived address is clearly newer and more specific, store it as a contact-adjacent lead rather than overwriting the assessor baseline silently.

## Step 4: Search For Public Property-Level Contact Channels

Use the parcel address directly.

High-value non-government sources:

- `Apartments.com`
- `Zillow Rentals`
- `HotPads`
- `Realtor.com Rentals`
- `Redfin Rentals`
- management-company property pages

What to capture if found:

- leasing phone number
- property management company name
- property website or contact form
- property name if marketed differently from parcel address

How to interpret it:

- if the listing is self-managed, this may be the best reachable public phone
- if the listing is broker- or manager-mediated, treat it as a proxy contact, not direct owner contact

## Step 5: Search For Public Business Context Around The Owner Name

Use the owner name plus mailing address or parcel address.

Useful sources:

- Google Business Profile / Google Maps
- company website if a small business is discoverable
- `BBB`
- `Manta`
- local business directory pages

This step is most useful when:

- the owner is a sole proprietor
- the owner advertises rentals under a DBA or management brand
- the mailing address is a business office rather than a residence

Capture:

- business name
- business phone
- website
- office address
- evidence connecting the business to the parcel owner

## Step 6: Search For Legal Or Professional Proxies

If the property has distress, litigation, or appeal activity, look for public office contacts tied to a professional representative.

Useful source families:

- court case search for party and attorney names
- BOR or PTAB appeal records for attorney or representative names
- attorney directories such as `Martindale-Hubbell` or `Super Lawyers`

Best use:

- law-firm main office phone
- attorney profile contact page
- public office address for a representative tied to the property or owner

Treat these as:

- `attorney_tax_rep`
- legal proxy contact

not as direct owner contacts.

## Step 7: Decide Whether The Result Is Good Enough

Good enough for outreach preparation usually means one of:

- a strong public mailing address for the owner
- a property-level leasing or management phone clearly tied to the parcel
- a business office number tied to the owner’s public rental activity
- a law-firm office number tied to an active matter involving the parcel or owner

Not good enough:

- a generic name-only search result with no address corroboration
- a people-directory result without a clear parcel or business link
- an old listing with no evidence it is still active

## Contact Roles To Use

When recording findings, prefer these role labels:

- `direct_owner`
- `property_manager`
- `operator_business`
- `attorney_tax_rep`
- `manual_verified_phone`
- `manual_verified_email`

Recommended interpretation rules:

- assessor mailing address: `direct_owner`
- rental listing phone: usually `property_manager` unless clearly self-managed
- business listing phone tied to owner DBA: `operator_business`
- attorney office number: `attorney_tax_rep`

## Confidence Guide

- high: assessor mailing address, recorder-confirmed mailing address, clearly self-managed rental contact with exact address match
- medium: public property manager phone, public business office phone, attorney office number with direct parcel or owner linkage
- low: weakly matched directory listing, stale listing, name-only search result

## Fast Lookup Checklist

1. Copy the parcel `PIN`, address, owner name, and mailing address.
2. Confirm this is a person-owned parcel.
3. Check recorder for newer return or mailing address.
4. Search the parcel address on rental portals.
5. Search the owner name plus address on Google Maps and business directories.
6. Search for any legal or appeal representative if the parcel has distress signals.
7. Record only public mailing, business, management, or professional contacts with provenance.

## Bottom Line

For an individual parcel owner, the default public contact is still the mailing address.

The best public phone workflow is usually not "find the owner's personal number." It is:

1. find a public property-level contact
2. find a public business contact tied to the owner
3. find a public legal or management proxy when relevant

That keeps the workflow higher-confidence, more compliant, and easier to defend operationally.
