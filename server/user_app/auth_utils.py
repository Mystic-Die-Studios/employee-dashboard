from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework import status as s
from django.conf import settings
import os
import requests

# GitHub OAuth Helpers
# ------------------------------------------------------------------------------------------------
def validate_github_config():
    return Response(
        {'error': 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'},
        status=s.HTTP_503_SERVICE_UNAVAILABLE,
    )

def exchange_code_for_token(code):
    response = requests.post(
        'https://github.com/login/oauth/access_token',
        data={
            'client_id': os.getenv('GITHUB_CLIENT_ID'),
            'client_secret': os.getenv('GITHUB_CLIENT_SECRET'),
            'code': code,
        },
        headers={
            'Accept': 'application/json',
        },
        
    )
    return response.json().get('access_token')

def get_github_email(access_token):
    email_response = requests.get(
        'https://api.github.com/user/emails',
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {access_token}',
        },
        timeout=5,
    )
    email_response.raise_for_status()

    email_list = email_response.json()
    if not isinstance(email_list, list):
        return None

    for email_item in email_list:
        if email_item.get('primary') and email_item.get('verified'):
            return email_item.get('email')

    for email_item in email_list:
        if email_item.get('verified'):
            return email_item.get('email')

    return None

def get_github_username(access_token):
    username_response = requests.get(
        'https://api.github.com/user',
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {access_token}',
        },
        timeout=5,
    )
    username_response.raise_for_status()
    username = username_response.json().get('login')
    if not username:
        return None
    return username

def is_github_org_member(access_token, org):
    membership_response = requests.get(
        f'https://api.github.com/user/memberships/orgs/{org}',
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {access_token}',
        },
        timeout=5,
    )
    if membership_response.status_code != 200:
        return False
    return membership_response.json().get('state') == 'active'

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
    response.set_cookie(
        settings.SIMPLE_JWT['AUTH_COOKIE'],
        access_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
    )
    return response

def clear_token_cookies(response):
    response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
    response.delete_cookie(settings.JWT_REFRESH_COOKIE)
    return response
