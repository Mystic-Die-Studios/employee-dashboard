from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as s
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.db import transaction
import os
import requests
from .auth_utils import *
from .models import *
from django.conf import settings

# Start GtiHub OAuth Config
# ------------------------------------------------------------------------------------------------

class GitHubLoginView(APIView):
    """Kick off the OAuth dance.

    The frontend just links here, so the client ID and scopes live in one place
    and the CSRF state can be minted server-side.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        client_id, client_secret = github_config()
        if not client_id or not client_secret:
            return validate_github_config()

        state = new_oauth_state()
        response = redirect(github_authorize_url(callback_url(request), state))
        return set_state_cookie(response, state)


class GitHubCallBackView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        client_id, client_secret = github_config()
        if not client_id or not client_secret:
            return validate_github_config()

        if request.GET.get('error'):
            # User clicked "Cancel" on GitHub's consent screen, or the app was denied.
            return login_failed('github_denied')

        expected_state = request.COOKIES.get(OAUTH_STATE_COOKIE)
        received_state = request.GET.get('state')
        if not expected_state or expected_state != received_state:
            return login_failed('invalid_state')

        code = request.GET.get('code')
        if not code:
            return login_failed('no_code')

        github_token = exchange_code_for_token(code, callback_url(request))
        if not github_token:
            return login_failed('token_exchange_failed')

        github_username = get_github_username(github_token)
        if not github_username:
            return login_failed('github_profile_failed')

        github_org = os.getenv('GITHUB_ORG', 'Mystic-Die-Studios')
        membership = check_github_org_membership(github_token, github_org)
        if membership == 'error':
            return login_failed('org_check_failed')
        if membership != 'member':
            return login_failed('not_org_member')

        github_email = get_github_email(github_token)
        if not github_email:
            return login_failed('no_verified_email')

        role = resolve_role(github_username)
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=github_email,
                defaults={
                    'username': github_email,
                    'github_username': github_username,
                    'role': role,
                })
            if created:
                user.set_unusable_password()
            user.github_username = github_username
            user.role = role
            user.save()

        access  = create_access_token(user)
        refresh = create_refresh_token(user)
        response = redirect(f'{frontend_url()}/dashboard')
        response.delete_cookie(OAUTH_STATE_COOKIE, samesite='Lax')
        return set_token_cookies(response, access, refresh)

# Start User Endpoints
# ------------------------------------------------------------------------------------------------

class LogoutView(APIView):
    """Clears the auth cookies for any signed-in user, admin or employee."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        return clear_token_cookies(Response({'message': 'Log out successful'}, status=s.HTTP_200_OK))

# Start Admin Endpoints
# ------------------------------------------------------------------------------------------------

class CreateAdminUserView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email    = request.data.get('email')
        password = request.data.get('password')
        username = request.data.get('username', email)
        github_username = request.data.get('github_username')

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    email=email, username=username,
                    password=password, role=User.Role.ADMIN,
                    github_username=github_username)

                access  = create_access_token(user)
                refresh = create_refresh_token(user)
                response = Response({'message': 'Admin created'}, status=s.HTTP_201_CREATED)
            return set_token_cookies(response, access, refresh)

        except Exception as e:
            return Response({'error': str(e)}, status=s.HTTP_400_BAD_REQUEST)

class AdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('email')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'username and password required'}, status=s.HTTP_400_BAD_REQUEST)

        try:
           user = User.objects.get(email=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=s.HTTP_404_NOT_FOUND)

        if not user.check_password(password):
            return Response({'error': 'Invalid password'}, status=s.HTTP_401_UNAUTHORIZED)

        if user.role != User.Role.ADMIN:
            return Response({'error': 'User is not an admin'}, status=s.HTTP_403_FORBIDDEN)

        access   = create_access_token(user)
        refresh  = create_refresh_token(user)
        response = Response({'message': 'Logged in as Admin'}, status=s.HTTP_200_OK)
        return set_token_cookies(response, access, refresh)

class AdminLogoutView(LogoutView):
    pass

# Start Employee Endpoints
# ------------------------------------------------------------------------------------------------

class CreateEmployeeUserView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []

    def post(self, request):
        pass


class EmployeeLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        pass


class EmployeeLogoutView(LogoutView):
    pass

class UserInfoView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'github_username': user.github_username,
            'role': user.role,
        })


# Refresh Access Token Endpoint
# ------------------------------------------------------------------------------------------------

class RefreshAccessToken(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)

        if not refresh_token:
            return Response({'error': 'No token provided'}, status=s.HTTP_401_UNAUTHORIZED)

        try:
            token = RefreshToken(refresh_token)
            new_access_token = str(token.access_token)
            new_refresh_token = str(token)

            response = Response({'access_token': new_access_token}, status=s.HTTP_200_OK)
            return set_token_cookies(response, new_access_token, new_refresh_token)
        except (TokenError, InvalidToken) as e:
            return Response(str(e), status=s.HTTP_401_UNAUTHORIZED)
