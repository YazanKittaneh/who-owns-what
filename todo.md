# Contact Data Stabilization Todo

## Best Improvements to Mitigate This

- Split deploy from backfill.
- Move business-license ingestion from Python loops to SQL on top of `chi_business_licenses`.
- Disable row-level audit logging for automated bulk loads.
- Add resumable chunking for large refreshes.
- Run targeted pilots before citywide backfills.
- Avoid rebuilding large Docker images on the live host for every code fix.
- Slim the API image and reduce Docker build churn.
- Clean Docker build cache before more rebuilds.
- Add pre-deploy SQL and endpoint smoke tests.
- Revisit confidence thresholds before treating low-confidence contact data as user-visible.

## Recommended Safer Path

1. Freeze further broad live deploys for this feature until the load path is cheaper.
2. Clean Docker build cache and recover disk headroom.
3. Re-implement business-license backfill as SQL-first from `chi_business_licenses`.
4. Keep `contact_audit_log` for manual/admin changes only.
5. Run a small pilot for a targeted area before citywide refresh.
6. Measure runtime, rows written, audit volume, and API impact.
7. Only then run citywide backfill.

## Implementation Tasks

- [ ] Convert business-license ingestion into pure SQL from `chi_business_licenses`.
- [ ] Remove automated-load writes from `contact_audit_log`.
- [ ] Run a pilot on the `3137 N Kimball Ave` radius or a business-heavy area.
- [ ] Clean Docker cache before any more rebuilds.
