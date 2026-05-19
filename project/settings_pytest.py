import os
import copy
import dj_database_url

os.environ["DEBUG"] = ""
os.environ["SECRET_KEY"] = "for testing only!"

from .settings import *  # noqa

DATABASES = copy.deepcopy(DATABASES)  # noqa

if "TEST_DATABASE_URL" in os.environ:
    DATABASES["wow"] = dj_database_url.parse(os.environ["TEST_DATABASE_URL"])

# We want the test database Django uses to be separate from the one used
# by our non-Django tests, because (at the time of this writing) we want to
# be able to load fixture data into it that's scoped to the whole testing
# session.
DATABASES["wow"]["TEST"] = {"NAME": DATABASES["wow"]["NAME"] + "_djangotest"}

# Rate limiting is off by default in tests so per-IP counters don't accumulate
# across unrelated test cases. The dedicated rate-limit tests opt back in with
# override_settings(RATELIMIT_ENABLE=True).
RATELIMIT_ENABLE = False
