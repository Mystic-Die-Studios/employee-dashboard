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

class GitHubCallBackView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        client_id = os.getenv('GITHUB_CLIENT_ID')
        client_secret = os.getenv('GITHUB_CLIENT_SECRET')
        if not client_id or not client_secret:
            return validate_github_config()
        
        code = request.GET.get('code')
        if not code:
            return Response({'error': 'No code provided'}, status=400)
        
        github_token = exchange_code_for_token(code)
        if not github_token:
            return Response({'error': 'Failed to exchange code for token'}, status=s.HTTP_400_BAD_REQUEST)
        
        github_email = get_github_email(github_token)
        if not github_email:
            return Response({'error': 'Failed to get GitHub email'}, status=s.HTTP_400_BAD_REQUEST)
        
        github_username = get_github_username(github_token)
        if not github_username:
            return Response({'error': 'Failed to get GitHub username'}, status=s.HTTP_400_BAD_REQUEST)
        
        # TODO: Insert org membership check here before creating the user and issuing JWT tokens
        user, created = User.objects.get_or_create(
            email=github_email,
            defaults={
                'username': github_email,
                'github_username': github_username,
                'role': User.Role.ADMIN
            })
        if created:
            user.set_unusable_password()
            user.save()
        access  = create_access_token(user)
        refresh = create_refresh_token(user)
        response = Response({'message': 'Logged in as Admin'}, status=s.HTTP_200_OK)
        return set_token_cookies(response, access, refresh)

# Start User Endpoints
# ------------------------------------------------------------------------------------------------

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
           
class AdminLogoutView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        return clear_token_cookies(Response({'message': 'Log out successful'}, status=s.HTTP_200_OK))

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


class EmployeeLogoutView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        pass
    
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