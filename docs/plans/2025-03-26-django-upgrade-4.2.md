# Django 3.2 to 4.2 LTS Upgrade Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Django from 3.2.20 (EOL) to 4.2 LTS (supported until April 2026) while maintaining full compatibility and functionality.

**Architecture:** Incremental upgrade approach - update Django core, then verify/fix any breaking changes in dependencies, then update related packages for compatibility.

**Tech Stack:** Django 4.2 LTS, Python 3.11+, psycopg2, django-cors-headers, pytest-django, rollbar

---

## Pre-Upgrade Analysis

### Current State
- Django: 3.2.20 (EOL as of April 2024)
- Python: 3.11+ (confirmed compatible with Django 4.2)
- Database: PostgreSQL via psycopg2
- Key dependencies: django-cors-headers, rollbar, dj-database-url

### Breaking Changes in Django 4.0-4.2 (Relevant to this project)

**Django 4.0:**
- `django.conf.urls.url()` deprecated → already using `path()` ✅
- `django.utils.http.is_safe_url()` deprecated → not used in project code ✅
- `django.utils.translation.ugettext*()` deprecated → not used in project code ✅
- `CSRF_TRUSTED_ORIGINS` requires scheme (http:// or https://)
- Form rendering changes (already using explicit rendering) ✅

**Django 4.1:**
- CSRF cookie changes (Samesite=Lax by default)
- Minor middleware ordering changes (none expected to affect us)

**Django 4.2:**
- PostgreSQL 12+ required (verify in production)
- `CSRF_TRUSTED_ORIGINS` must include scheme
- Database connection persistence changes (using connections directly, minimal impact)

### Compatibility Matrix Check
- **psycopg2 2.8.6**: Compatible with Django 4.2
- **django-cors-headers 4.3.0**: Compatible (may need 4.3.0+)
- **dj-database-url 0.5.0**: Compatible
- **rollbar 0.16.3**: Need to verify (may need update)
- **pytest-django 4.2.0**: Compatible, but recommend 4.5.0+ for Django 4.2

---

## Task 1: Update Django and Core Dependencies

**Files:**
- Modify: `requirements.txt`

**Step 1: Update requirements.txt**

```diff
--- a/requirements.txt
+++ b/requirements.txt
@@ -1,8 +1,8 @@
 # This only contains dependencies for running the API
 # server. For all other dependencies, see requirements-dev.txt.
 psycopg2==2.8.6
-django==3.2.20
+django==4.2.20
 rollbar==0.16.3
 dj-database-url==0.5.0
 gunicorn==19.9.0
 numpy==2.0.1
 algoliasearch==2.6.1
 boto3==1.28.44
 requests==2.25.1
 types-requests==2.25.1
-django-cors-headers==4.3.0
+django-cors-headers==4.4.0
```

**Step 2: Install updated dependencies**

Run: `pip install -r requirements.txt`
Expected: Successful installation of Django 4.2.20

**Step 3: Verify installation**

Run: `python -c "import django; print(django.VERSION)"`
Expected: `(4, 2, 20, 'final', 0)`

**Step 4: Commit**

```bash
git add requirements.txt
git commit -m "chore(deps): upgrade Django 3.2.20 → 4.2.20 LTS"
```

---

## Task 2: Update CSRF Configuration (Django 4.0 Breaking Change)

**Files:**
- Modify: `project/settings.py`

**Step 1: Add CSRF_TRUSTED_ORIGINS with schemes**

Django 4.0+ requires CSRF_TRUSTED_ORIGINS to include the scheme (http:// or https://). Add this to settings.py after CORS configuration.

```python
# Add after CORS_ALLOWED_ORIGIN_REGEXES (around line 125)
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://wowserver.justfix.org",
    "https://demo-wowserver.justfix.org",
    "https://wow-django.herokuapp.com",
    "https://wow-django-demo-ce7b326fc987.herokuapp.com",
    "https://whoownswhat.justfix.org",
    "https://demo-whoownswhat.justfix.org",
    "https://signature-dashboard.netlify.app",
    "https://signatureportfolio.org",
    "https://gce-screener.netlify.app",
    "https://demo-gce-screener.netlify.app",
    "https://goodcausenyc.org",
    "https://goodcauseny.org",
    "https://who-owns-what.pages.dev",
]
```

**Step 2: Verify syntax**

Run: `python -c "from project import settings; print('OK')"`
Expected: `OK` (no import errors)

**Step 3: Commit**

```bash
git add project/settings.py
git commit -m "fix(settings): add CSRF_TRUSTED_ORIGINS for Django 4.2 compatibility

Django 4.0+ requires CSRF_TRUSTED_ORIGINS to include scheme (http/https).
This prevents CSRF verification failures on POST requests."
```

---

## Task 3: Update Test Dependencies

**Files:**
- Modify: `requirements-dev.txt`

**Step 1: Update pytest-django for Django 4.2 compatibility**

```diff
--- a/requirements-dev.txt
+++ b/requirements-dev.txt
@@ -3,7 +3,7 @@ mypy==0.981
 PyYAML>=5.1
 types-PyYAML>=5.1
 pytest==6.2.5
-pytest-django==4.2.0
+pytest-django==4.8.0
 python-dotenv==0.9.1
 flake8==3.8.3
 networkx==3.3
```

**Step 2: Install dev dependencies**

Run: `pip install -r requirements-dev.txt`
Expected: Successful installation

**Step 3: Commit**

```bash
git add requirements-dev.txt
git commit -m "chore(deps): update pytest-django to 4.8.0 for Django 4.2 compatibility"
```

---

## Task 4: Run Tests and Verify

**Files:**
- Test all existing tests

**Step 1: Run the test suite**

Run: `pytest -v`
Expected: All tests pass (or same failures as before upgrade)

**Step 2: Check for deprecation warnings**

Run: `python -Wd -c "from project import settings" 2>&1 | head -20`
Expected: No Django-related deprecation warnings from project code

**Step 3: Verify admin interface loads**

Run: `python manage.py check --deploy`
Expected: System check identifies no issues (or only expected warnings)

**Step 4: Test runserver**

Run: `timeout 5 python manage.py runserver 0.0.0.0:8000 2>&1 || true`
Expected: Server starts without errors

**Step 5: Commit any fixes**

If tests reveal issues, fix and commit before proceeding.

---

## Task 5: Update Rollbar Integration (If Needed)

**Files:**
- Check: `project/settings.py` (Rollbar configuration)
- Check: All view files using rollbar

**Step 1: Verify rollbar works with Django 4.2**

Run: `python -c "import rollbar; from django.conf import settings; print('Rollbar OK')"`
Expected: `Rollbar OK` (no import errors)

**Step 2: Check rollbar middleware compatibility**

The middleware class `rollbar.contrib.django.middleware.RollbarNotifierMiddlewareExcluding404` should still work, but verify:

Run: `python -c "
from django.conf import settings
settings.configure(DEBUG=True, ROLLBAR={'access_token': 'test', 'environment': 'test'})
from rollbar.contrib.django.middleware import RollbarNotifierMiddlewareExcluding404
print('Middleware OK')
"`
Expected: `Middleware OK`

If issues arise, update rollbar:
```diff
-rollbar==0.16.3
+rollbar==0.16.4
```

**Step 3: Commit if updated**

```bash
git add requirements.txt
git commit -m "chore(deps): update rollbar for Django 4.2 compatibility"
```

---

## Task 6: Final Verification and Documentation

**Files:**
- Create: `docs/django-upgrade-4.2.md`

**Step 1: Document the upgrade**

Create summary document:

```markdown
# Django 3.2 to 4.2 LTS Upgrade

**Completed:** [DATE]
**Previous Version:** Django 3.2.20 (EOL April 2024)
**New Version:** Django 4.2.20 LTS (Supported until April 2026)

## Changes Made

### Dependencies Updated
- django: 3.2.20 → 4.2.20
- django-cors-headers: 4.3.0 → 4.4.0
- pytest-django: 4.2.0 → 4.8.0
- rollbar: 0.16.3 → 0.16.4 (if needed)

### Code Changes
- Added `CSRF_TRUSTED_ORIGINS` to `project/settings.py` with proper schemes

### Breaking Changes Addressed
1. **CSRF_TRUSTED_ORIGINS requires scheme** (Django 4.0)
   - Added full URLs with http:// and https:// schemes
   
2. **No deprecated features used**
   - Project already uses `path()` instead of deprecated `url()`
   - No deprecated translation functions in use
   - No deprecated `is_safe_url()` usage

## Testing
- All existing tests pass
- Admin interface functional
- No deprecation warnings from project code

## Notes
- Python 3.11+ remains supported
- PostgreSQL 12+ required (verify production database version)
```

**Step 2: Run final test suite**

Run: `pytest --tb=short`
Expected: All tests pass

**Step 3: Final commit**

```bash
git add docs/django-upgrade-4.2.md
git commit -m "docs: add Django 4.2 upgrade documentation

Document the upgrade from Django 3.2.20 to 4.2.20 LTS,
including all dependency updates and configuration changes."
```

---

## Rollback Plan

If issues arise:

1. **Immediate rollback:**
   ```bash
   git checkout requirements.txt requirements-dev.txt project/settings.py
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

2. **Database migrations:**
   - Django 3.2 → 4.2 has no required schema changes for this project
   - No database rollback needed

3. **Verify rollback:**
   ```bash
   python -c "import django; print(django.VERSION)"
   pytest
   ```

---

## Post-Upgrade Recommendations

1. **Monitor production logs** for 48 hours after deployment
2. **Check CSRF failures** - look for any POST request failures
3. **Verify Rollbar error reporting** still functions
4. **Schedule Django 5.2 LTS upgrade** for Q2 2025 (when 4.2 support ends)

## Success Criteria

- [ ] Django 4.2.20 installed and version verified
- [ ] All tests pass
- [ ] No deprecation warnings from project code
- [ ] Admin interface accessible
- [ ] API endpoints functional
- [ ] CSRF protection works correctly
- [ ] Rollbar error reporting functional
