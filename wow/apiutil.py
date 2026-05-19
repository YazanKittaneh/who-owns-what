import re
from typing import Dict, Any
import functools
from django.http import JsonResponse
from django.conf import settings


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
        return apply_cors_policy(request, response)

    return wrapper


def authorize_with_token(request, keyword, token):

    if "Authorization" not in request.headers:
        raise AuthorizationError("No authorization header provided")

    auth = request.headers.get("Authorization").split()

    if not auth or auth[0].lower() != keyword.lower():
        raise AuthorizationError("Invalid authorization header. No token provided.")

    if len(auth) == 1:
        raise AuthorizationError("Invalid token header. No credentials provided.")

    elif len(auth) > 2:
        raise AuthorizationError(
            "Invalid token header. Token string should not contain spaces."
        )

    request_token = auth[1]

    if not (token == request_token):
        raise AuthorizationError("You do not have permission to access this resource")


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
