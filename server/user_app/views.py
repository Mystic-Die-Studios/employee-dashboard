import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.http import HttpResponseRedirect
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Profile

User = get_user_model()

GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_API_URL = 'https://api.github.com'
OAUTH_SCOPES = 'read:user user:email read:org'
HTTP_TIMEOUT = 10


def _frontend_redirect(path='', **query):
    url = f"{settings.FRONTEND_URL.rstrip('/')}{path}"
    if query:
        url = f'{url}?{urlencode(query)}'
    return HttpResponseRedirect(url)


def _user_payload(user):
    profile = getattr(user, 'profile', None)
    return {
        'id': user.id,
        'login': profile.github_login if profile else user.username,
        'name': profile.name if profile else (user.get_full_name() or ''),
        'avatar_url': profile.avatar_url if profile else '',
        'email': user.email or '',
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def github_login(request):
    """Step 1: send the browser to GitHub's authorize page."""
    state = secrets.token_urlsafe(32)
    request.session['oauth_state'] = state
    params = {
        'client_id': settings.GITHUB_CLIENT_ID,
        'redirect_uri': settings.GITHUB_REDIRECT_URI,
        'scope': OAUTH_SCOPES,
        'state': state,
        'allow_signup': 'false',
    }
    return HttpResponseRedirect(f'{GITHUB_AUTHORIZE_URL}?{urlencode(params)}')


@api_view(['GET'])
@permission_classes([AllowAny])
def github_callback(request):
    """Step 2: GitHub redirects here with ?code&state. Exchange, verify org,
    upsert the user, open a session, then bounce to the frontend."""
    if request.GET.get('error'):
        return _frontend_redirect('/', error=request.GET['error'])

    code = request.GET.get('code')
    state = request.GET.get('state')
    expected_state = request.session.pop('oauth_state', None)
    if not code or not state or state != expected_state:
        return _frontend_redirect('/', error='invalid_state')

    # Exchange the code for an access token.
    token_resp = requests.post(
        GITHUB_TOKEN_URL,
        headers={'Accept': 'application/json'},
        data={
            'client_id': settings.GITHUB_CLIENT_ID,
            'client_secret': settings.GITHUB_CLIENT_SECRET,
            'code': code,
            'redirect_uri': settings.GITHUB_REDIRECT_URI,
        },
        timeout=HTTP_TIMEOUT,
    )
    access_token = token_resp.json().get('access_token') if token_resp.ok else None
    if not access_token:
        return _frontend_redirect('/', error='token_exchange_failed')

    gh_headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/vnd.github+json',
    }

    # Enforce org membership before we trust the identity at all.
    required_org = settings.GITHUB_REQUIRED_ORG
    if required_org:
        membership = requests.get(
            f'{GITHUB_API_URL}/user/memberships/orgs/{required_org}',
            headers=gh_headers,
            timeout=HTTP_TIMEOUT,
        )
        if membership.status_code != 200 or membership.json().get('state') != 'active':
            return _frontend_redirect('/', error='not_org_member')

    gh_user = requests.get(f'{GITHUB_API_URL}/user', headers=gh_headers, timeout=HTTP_TIMEOUT)
    if not gh_user.ok:
        return _frontend_redirect('/', error='profile_fetch_failed')
    gh_user = gh_user.json()

    email = gh_user.get('email') or _primary_email(gh_headers)

    _upsert_user(gh_user, email, request)
    return _frontend_redirect('/dashboard')


def _primary_email(gh_headers):
    """GitHub omits the email from /user when it's private; fetch it separately."""
    resp = requests.get(f'{GITHUB_API_URL}/user/emails', headers=gh_headers, timeout=HTTP_TIMEOUT)
    if not resp.ok:
        return ''
    emails = resp.json()
    if not isinstance(emails, list):
        return ''
    primary = next((e for e in emails if e.get('primary') and e.get('verified')), None)
    return primary['email'] if primary else ''


def _upsert_user(gh_user, email, request):
    github_id = gh_user['id']
    login_name = gh_user['login']

    profile = Profile.objects.filter(github_id=github_id).select_related('user').first()
    if profile:
        user = profile.user
    else:
        user, _ = User.objects.get_or_create(username=login_name)
        profile = Profile(user=user, github_id=github_id)

    user.email = email
    user.save()

    profile.github_login = login_name
    profile.name = gh_user.get('name') or ''
    profile.avatar_url = gh_user.get('avatar_url') or ''
    profile.save()

    login(request, user)
    return user


@api_view(['GET'])
@permission_classes([AllowAny])
def me(request):
    """Current session's user, or 401 if not signed in."""
    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(_user_payload(request.user))


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def csrf(request):
    """Sets the CSRF cookie and returns the token for the logout POST."""
    return Response({'csrfToken': get_token(request)})
