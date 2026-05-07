# Find Owners V2 Implementation Plan

## Overview
Build a new version of the "Find Owners" page using MapLibre GL JS, @mapbox/mapbox-gl-draw, PostGIS spatial queries, and a vector tile-ready architecture.

## Stack
- **Map renderer:** MapLibre GL JS
- **Drawing:** @mapbox/mapbox-gl-draw (property selection polygons)
- **Backend:** Django + PostGIS (existing)
- **Data serving:** GeoJSON API first, vector tiles later (Martin/pg_tileserv)
- **Basemap:** CARTO dark or custom style

## P0: Setup & Spatial Foundation
- [ ] Add `REACT_APP_ENABLE_FIND_OWNERS_V2` flag to `client/.env.local.sample` and `.env.sample`
- [ ] Extend `sql/create_parcels_table.sql` to add `geom` point column + GIST index from `lat`/`lng`
- [ ] Ensure PostGIS extension is created in test and prod DBs
- [ ] Add `wow_parcels.geom` to test fixtures in `tests/factories/chi_parcels.py` and `test_owner_search_by_area_sql.py`

## P1: Backend — New API Endpoints
- [ ] Add `MapViewportWithGeometryForm` and `PolygonSearchForm` in `wow/forms.py`
- [ ] Create `wow/sql/find_owners_v2_viewport.sql` — bbox query returning parcel GeoJSON
- [ ] Create `wow/sql/find_owners_v2_polygon_search.sql` — PostGIS `ST_Within` query grouping owners by polygon
- [ ] Add `find_owners_v2_viewport` and `find_owners_v2_search` views in `wow/views.py`
- [ ] Wire new endpoints in `wow/urls.py` under `/api/find-owners/v2/viewport` and `/api/find-owners/v2/search`
- [ ] Add Django smoke tests in `wow/tests/test_milestone1.py` for new endpoints
- [ ] Add SQL tests in `tests/test_owner_search_by_area_sql.py` for polygon grouping logic

## P2: Frontend — MapLibre Page Shell
- [ ] Install `maplibre-gl` and `@mapbox/mapbox-gl-draw` in `client/package.json`
- [ ] Create `client/src/components/FindOwnersV2Map.tsx` — MapLibre wrapper with CARTO dark style
- [ ] Create `client/src/components/FindOwnersV2DrawControls.tsx` — draw/edit/delete polygon controls
- [ ] Create `client/src/containers/FindOwnersV2Page.tsx` — page shell with address search, map, and side panel
- [ ] Add new API client methods in `client/src/components/APIClient.ts` for viewport and polygon endpoints
- [ ] Add new data types in `client/src/components/APIDataTypes.ts` for V2 responses
- [ ] Add `/find-owners-v2` route in `client/src/routes.tsx`
- [ ] Conditionally mount route in `client/src/containers/App.tsx` behind `REACT_APP_ENABLE_FIND_OWNERS_V2 === "1"`

## P3: Frontend — Filters & Results Panel
- [ ] Port building-type filter chips from `FindOwnersPage.tsx` into V2 side panel
- [ ] Port portfolio-size dropdown into V2 side panel
- [ ] Render owner result cards with: name, mailing address, parcel count, nearest distance, same-owner badge
- [ ] Render linked parcel list per owner (first 6 + "more" link)
- [ ] Reuse `toggleSavedOwner` and `saveNearbyOwner` from existing saved-lists utilities
- [ ] Add CSV export button using existing `CSVDownloader` pattern

## P4: Integration & Polish
- [ ] Debounce viewport fetch on `moveend`/`zoomend`
- [ ] Enforce minimum zoom level before fetching parcels
- [ ] Add loading state and empty state to map and results panel
- [ ] Add map legend for search center / same owner / matching parcel
- [ ] Ensure mobile responsiveness for draw controls and side panel
- [ ] Preserve i18n patterns using `@lingui/macro` for new copy

## P5: Testing & Validation
- [ ] Run `pytest` for backend SQL and view tests
- [ ] Run `cd client && yarn test` for frontend route and API client tests
- [ ] Run `cd client && yarn typecheck` for TypeScript validation
- [ ] Manual QA: draw polygon, filter by building type, export CSV, save owner, click parcel to property page
- [ ] Performance check: load 1000+ parcel viewport, verify frame rate and payload size

## P6: Rollout & Tile Server Prep
- [ ] Keep GeoJSON endpoint contracts compatible with future vector tile source
- [ ] Document Martin/pg_tileserv migration path in `docs/technical-architecture.md`
- [ ] After validation, switch default `/find-owners` to V2 and retire Leaflet version

## Current Status
- **Phase:** P0 - Setup & Spatial Foundation (Not started)
- **Last Updated:** 2026-05-06
