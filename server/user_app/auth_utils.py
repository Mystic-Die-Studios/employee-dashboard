from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework import status as s
from django.conf import settings
from django.shortcuts import redirect
from urllib.parse import urlencode
import os
import secrets
import requests

GITHUB_TIMEOUT = 10
GITHUB_SCOPES = 'user:email read:org'
OAUTH_STATE_COOKIE = 'github_oauth_state'

# GitHub OAuth Helpers
# ------------------------------------------------------------------------------------------------

def github_config():
    """Return (client_id, client_secret), either of which may be None."""
    return os.getenv('GITHUB_CLIENT_ID'), os.getenv('GITHUB_CLIENT_SECRET')

def validate_github_config():
    return Response(
        {'error': 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'},
        status=s.HTTP_503_SERVICE_UNAVAILABLE,
    )

def frontend_url():
    return os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')

def callback_url(request):
    """The redirect_uri GitHub sends the user back to.

    Defaults to this server's own callback route so the value matches the host
    the browser actually reached, but can be pinned with GITHUB_REDIRECT_URI when
    the server sits behind a proxy or tunnel.
    """
    return os.getenv('GITHUB_REDIRECT_URI') or request.build_absolute_uri('/api/v1/user/github/callback/')

def github_authorize_url(redirect_uri, state):
    query = urlencode({
        'client_id': os.getenv('GITHUB_CLIENT_ID'),
        'redirect_uri': redirect_uri,
        'scope': GITHUB_SCOPES,
        'state': state,
        'allow_signup': 'false',
    })
    return f'https://github.com/login/oauth/authorize?{query}'

def new_oauth_state():
    return secrets.token_urlsafe(32)

def set_state_cookie(response, state):
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite='Lax',
    )
    return response

def login_failed(error_code):
    """Send the browser back to the frontend with a machine-readable reason.

    The callback is reached by a top-level redirect from GitHub, so a JSON error
    body would just be dumped in the user's browser.
    """
    response = redirect(f'{frontend_url()}/?error={error_code}')
    response.delete_cookie(OAUTH_STATE_COOKIE, samesite='Lax')
    return response

def exchange_code_for_token(code, redirect_uri):
    client_id, client_secret = github_config()
    try:
        response = requests.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'code': code,
                'redirect_uri': redirect_uri,
            },
            headers={'Accept': 'application/json'},
            timeout=GITHUB_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get('access_token')
    except (requests.RequestException, ValueError):
        return None

def github_api(access_token, path):
    """GET a GitHub API path. Returns (status_code, parsed_body), both None on a network error."""
    try:
        response = requests.get(
            f'https://api.github.com{path}',
            headers={
                'Accept': 'application/vnd.github+json',
                'Authorization': f'Bearer {access_token}',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            timeout=GITHUB_TIMEOUT,
        )
    except requests.RequestException:
        return None, None

    try:
        return response.status_code, response.json()
    except ValueError:
        return response.status_code, None

def get_github_email(access_token):
    status_code, email_list = github_api(access_token, '/user/emails')
    if status_code != 200 or not isinstance(email_list, list):
        return None

    for email_item in email_list:
        if email_item.get('primary') and email_item.get('verified'):
            return email_item.get('email')

    for email_item in email_list:
        if email_item.get('verified'):
            return email_item.get('email')

    return None

def get_github_username(access_token):
    status_code, body = github_api(access_token, '/user')
    if status_code != 200 or not isinstance(body, dict):
        return None
    return body.get('login') or None

def check_github_org_membership(access_token, org):
    """Return 'member', 'not_member', or 'error'.

    'error' stays distinct from 'not_member' so that an org which has not approved
    this OAuth app (which hides membership from the API) is not reported to a real
    employee as "you are not in the org".
    """
    status_code, body = github_api(access_token, f'/user/memberships/orgs/{org}')

    if status_code in (403, 404):
        return 'not_member'
    if status_code != 200 or not isinstance(body, dict):
        return 'error'
    return 'member' if body.get('state') == 'active' else 'not_member'

def resolve_role(github_username):
    admin_usernames = {
        u.strip().lower()
        for u in os.getenv('ADMIN_GITHUB_USERNAMES', '').split(',')
        if u.strip()
    }
    if github_username.lower() in admin_usernames:
        return 'admin'
    return 'employee'

# JWT Helpers
# ------------------------------------------------------------------------------------------------

class CookieAuthentication(JWTAuthentication):

    def get_auth_cookie(self, request):
        return request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])

    def authenticate(self, request):
        auth_cookie = self.get_auth_cookie(request)

        if not auth_cookie:
            raise exceptions.AuthenticationFailed('No authorization cookie found')

        try:
            validated_token = self.get_validated_token(auth_cookie)
            return self.get_user(validated_token), validated_token

        except TokenError as e:
            raise exceptions.AuthenticationFailed('Invalid authorization cookie') from e

def create_access_token(user):
    token = AccessToken.for_user(user)
    token['role'] = user.role
    return str(token)

def create_refresh_token(user):
    token = RefreshToken.for_user(user)
    return str(token)

def set_token_cookies(response, access_token, refresh_token):
    common = {
        'httponly': True,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'path': '/',
    }
    response.set_cookie(
        settings.SIMPLE_JWT['AUTH_COOKIE'],
        access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **common,
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        **common,
    )
    return response

def clear_token_cookies(response):
    common = {'path': '/', 'samesite': settings.AUTH_COOKIE_SAMESITE}
    response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'], **common)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, **common)
    return response
