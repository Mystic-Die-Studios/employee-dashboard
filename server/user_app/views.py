from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as s
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
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
        response = requests.post(f'https://github.com/login/oauth/access_token', data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code
        })
        return Response(response.json())

# Start User Endpoints
# ------------------------------------------------------------------------------------------------
    
class CreateAdminUserView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        email    = request.data.get('email')
        password = request.data.get('password')
        username = request.data.get('username', email)

        if not email or not password:
            return Response({'error': 'email and password required'}, status=s.HTTP_400_BAD_REQUEST)
    # TODO: Insert org membership check here before creating the user and issuing JWT tokens
        user = User.objects.create_user(
            email=email, username=username,
            password=password, role=User.Role.ADMIN,
        )
        access  = create_access_token(user)
        refresh = create_refresh_token(user)
        return set_token_cookies(
            Response({'message': 'Admin created'}, status=s.HTTP_201_CREATED),
            access, refresh,
        )

class CreateEmployeeUserView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        pass

class AdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        pass

class EmployeeLoginView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        pass

class AdminLogoutView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        pass

class EmployeeLogoutView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = []
    
    def post(self, request):
        pass
    

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