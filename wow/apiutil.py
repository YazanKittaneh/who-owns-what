import hmac
import re
from typing import Dict, Any
import functools
from django.http import JsonResponse
from django.conf import settings
from django_ratelimit.exceptions import Ratelimited


class InvalidFormError(Exception):
    def __init__(self, form):
        self.form_errors = form.errors.get_json_data()

    def as_json_response(self):
        return JsonResponse(
            {
                "error": "Bad request",
                "validationErrors": self.form_errors,
            },
            status=400,
        )


class AuthorizationError(Exception):
    def __init__(self, msg):
        self.msg = msg

    def as_json_response(self):
        return JsonResponse(
            {
                "error": "Unauthorized request",
                "details": self.msg,
            },
            status=401,
        )


def client_ip(group, request):
    """Key function for django-ratelimit that resolves the real client IP.

    X-Forwarded-For is client-controlled: trusting its left-most entry lets
    any caller mint a fresh throttle bucket per request. We only consult it
    when RATELIMIT_TRUSTED_PROXY_COUNT says how many trailing hops belong to
    proxies we operate, and then take the right-most untrusted entry. The
    Cloudflare-appended CF-Connecting-IP header is preferred when present,
    since production ingress is a Cloudflare Tunnel and direct origin access
    is not exposed.
    """
    cf_ip = request.META.get("HTTP_CF_CONNECTING_IP")
    if cf_ip:
        return cf_ip.strip()
    trusted_hops = getattr(settings, "RATELIMIT_TRUSTED_PROXY_COUNT", 0)
    if trusted_hops > 0:
        forwarded = [
            part.strip()
            for part in (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")
            if part.strip()
        ]
        if forwarded:
            # Right-most entry is appended by the closest proxy; step left
            # past our own hops, but never past the start of the list.
            index = max(len(forwarded) - trusted_hops, 0)
            return forwarded[index]
    return request.META.get("REMOTE_ADDR") or "unknown"


def _origin_is_allowed(origin: str) -> bool:
    if origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        return True
    for pattern in getattr(settings, "CORS_ALLOWED_ORIGIN_REGEXES", []):
        if re.fullmatch(pattern, origin):
            return True
    return False


def apply_cors_policy(request, response):
    # Echo the request Origin only when it matches the configured allowlist.
    # Using "*" together with CORS_ALLOW_CREDENTIALS=True is rejected by browsers
    # and would defeat the explicit CORS_ALLOWED_ORIGINS in settings.
    response.setdefault("Vary", "Origin")
    if "Vary" in response and "Origin" not in response["Vary"]:
        response["Vary"] = response["Vary"] + ", Origin"

    origin = request.headers.get("Origin")
    if origin and _origin_is_allowed(origin):
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Credentials"] = "true"
    return response


def api(fn):
    """
    Decorator for an API endpoint.
    """

    @functools.wraps(fn)
    def wrapper(request, *args, **kwargs):
        request.is_api_request = True
        try:
            response = fn(request, *args, **kwargs)
        except (InvalidFormError, AuthorizationError) as e:
            response = e.as_json_response()
        except Ratelimited:
            response = JsonResponse(
                {"error": "Too many requests. Please slow down and try again."},
                status=429,
            )
        return apply_cors_policy(request, response)

    return wrapper


GENERIC_AUTH_ERROR = "Invalid or missing authorization credentials."


def authorize_with_token(request, keyword, token):
    # A single generic message for every failure mode so callers can't
    # learn how far their guess got.
    if not token:
        # Endpoint's token is not configured server-side: fail closed
        # rather than comparing against an empty secret.
        raise AuthorizationError(GENERIC_AUTH_ERROR)

    if "Authorization" not in request.headers:
        raise AuthorizationError(GENERIC_AUTH_ERROR)

    auth = request.headers.get("Authorization").split()

    if len(auth) != 2 or auth[0].lower() != keyword.lower():
        raise AuthorizationError(GENERIC_AUTH_ERROR)

    request_token = auth[1]

    if not hmac.compare_digest(token.encode("utf-8"), request_token.encode("utf-8")):
        raise AuthorizationError(GENERIC_AUTH_ERROR)


def authorize_for_alerts(request):
    authorize_with_token(request, "token", settings.ALERTS_API_TOKEN)


def authorize_for_signature(request):
    authorize_with_token(request, "bearer", settings.SIGNATURE_API_TOKEN)


def authorize_for_admin(request):
    authorize_with_token(request, "token", settings.ADMIN_API_TOKEN)


def authorize_for_gce(request):
    authorize_with_token(request, "bearer", settings.GCE_API_TOKEN)


def get_validated_form_data(form_class, data) -> Dict[str, Any]:
    form = form_class(data)
    if not form.is_valid():
        raise InvalidFormError(form)
    return form.cleaned_data


def is_api_request(request) -> bool:
    return getattr(request, "is_api_request", False)
