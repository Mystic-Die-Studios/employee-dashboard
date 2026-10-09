from django.middleware.csrf import CsrfViewMiddleware


def _protected_api_view(request):
    """A non-exempt callback used to enforce CSRF on cookie-authenticated APIs."""


class CookieApiCsrfMiddleware(CsrfViewMiddleware):
    """DRF exempts APIView from CSRF; our JWT cookies still require protection.

    Check all unsafe API requests, including login, refresh and logout. Django's
    origin/referer checks and normal CSRF token validation remain unchanged.
    """

    def process_view(self, request, callback, callback_args, callback_kwargs):
        if request.path.startswith('/api/'):
            callback = _protected_api_view
        return super().process_view(request, callback, callback_args, callback_kwargs)
