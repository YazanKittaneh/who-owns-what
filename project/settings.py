import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from django.core.exceptions import ImproperlyConfigured
from corsheaders.defaults import default_headers
import dj_database_url

try:
    import dotenv

    dotenv.load_dotenv()
except ImportError:
    # We don't have development dependencies installed.
    pass

# Also try to load from .env file directly if dotenv is not available
import os
if not os.environ.get("SECRET_KEY"):
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ.setdefault(key, value)

MY_DIR = Path(__file__).parent.resolve()

BASE_DIR = MY_DIR.parent


def get_required_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise ImproperlyConfigured(
            f"The environment variable '{key}' "
            f"must be set to a non-empty value! Please see "
            f".env.sample for more documentation."
        )
    return value


def get_csv_env(key: str, default: Optional[List[str]] = None) -> List[str]:
    value = os.environ.get(key)
    if value is None:
        return list(default or [])
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = os.environ.get("DEBUG") == "true"

SECRET_KEY = get_required_env("SECRET_KEY")

ALERTS_API_TOKEN = get_required_env("ALERTS_API_TOKEN")

SIGNATURE_API_TOKEN = get_required_env("SIGNATURE_API_TOKEN")

ADMIN_API_TOKEN = os.environ.get("ADMIN_API_TOKEN") or ALERTS_API_TOKEN

ALLOWED_HOSTS: List[str] = get_csv_env("ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

ROOT_URLCONF = "project.urls"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "project.apps.DefaultConfig",
    "wow.apps.WowConfig",
    "corsheaders",
]

MIDDLEWARE: List[str] = [
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.gzip.GZipMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        # Django really wants us to define a default connection; we don't
        # need one right now so we'll just use a sqlite DB but not actually
        # use it for anything.
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(BASE_DIR / "db.sqlite3"),
    },
    "wow": dj_database_url.parse(get_required_env("DATABASE_URL")),
}
CORS_ALLOW_HEADERS = default_headers + ("Access-Control-Allow-Origin", "Set-Cookie")
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://192.168.1.159:8000",
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
    # Cloudflare frontend domains
    "https://who-owns-what.pages.dev",
    "https://*.who-owns-what.pages.dev",
    "https://who-owns-what.yazan-4a5.workers.dev",
]
CORS_ALLOWED_ORIGINS += get_csv_env("CORS_EXTRA_ALLOWED_ORIGINS")
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"https://deploy-preview-(?:\d{1,4})--wow-django-demo\.netlify\.app",
    r"https://deploy-preview-(?:\d{1,4})--signature-dashboard\.netlify\.app",
    r"https://deploy-preview-(?:\d{1,4})--wow-django\.netlify\.app",
    r"https://deploy-preview-(?:\d{1,4})--gce-screener\.netlify\.app",
    r"https://deploy-preview-(?:\d{1,4})--demo-gce-screener\.netlify\.app",
    r"https://([A-Za-z0-9\-\_]+)--wow-django\.netlify\.app",
    r"https://([A-Za-z0-9\-\_]+)--wow-django-demo\.netlify\.app",
    r"https://([A-Za-z0-9\-\_]+)--gce-screener\.netlify\.app",
    r"https://([A-Za-z0-9\-\_]+)--demo-gce-screener\.netlify\.app",
]

# Django 4.0+ requires CSRF_TRUSTED_ORIGINS to include the scheme (http:// or https://)
# This prevents CSRF verification failures on POST requests
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://192.168.1.159:8000",
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
    "https://who-owns-what.yazan-4a5.workers.dev",
]
CSRF_TRUSTED_ORIGINS += get_csv_env("CSRF_EXTRA_TRUSTED_ORIGINS")

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# This is based off the default Django logging configuration:
# https://github.com/django/django/blob/master/django/utils/log.py
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "rollbar": {
            # This will be replaced by a real handler if Rollbar is enabled.
            "level": "ERROR",
            "class": "logging.NullHandler",
        },
        "console": {
            "class": "logging.StreamHandler",
            "formatter": None,
        },
        "django.server": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "django.server",
        },
    },
    "formatters": {
        "debug": {
            "format": "{levelname}:{name} {message}",
            "style": "{",
        },
        "django.server": {
            "()": "django.utils.log.ServerFormatter",
            "format": "[{server_time}] {message}",
            "style": "{",
        },
    },
    "loggers": {
        "": {
            "handlers": ["console", "rollbar"],
            "level": "INFO",
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["django.server"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

ROLLBAR: Optional[Dict[str, Any]] = None

ROLLBAR_ACCESS_TOKEN = os.environ.get("ROLLBAR_ACCESS_TOKEN")

if ROLLBAR_ACCESS_TOKEN:
    ROLLBAR = {
        "access_token": ROLLBAR_ACCESS_TOKEN,
        "environment": "development" if DEBUG else "production",
        "root": str(BASE_DIR),
    }
    if "HEROKU_SLUG_COMMIT" in os.environ:
        # https://devcenter.heroku.com/articles/dyno-metadata
        ROLLBAR["code_version"] = os.environ["HEROKU_SLUG_COMMIT"]
    LOGGING["handlers"]["rollbar"].update(  # type: ignore
        {"class": "rollbar.logger.RollbarHandler"}
    )
    MIDDLEWARE.append(
        "rollbar.contrib.django.middleware.RollbarNotifierMiddlewareExcluding404"
    )

AUTHENTICATION_BACKENDS = ("django.contrib.auth.backends.ModelBackend",)
