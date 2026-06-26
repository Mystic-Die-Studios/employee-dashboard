from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as s
import os
import requests


class CreateUserView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        pass

# Start GtiHub OAuth Config
# ------------------------------------------------------------------------------------------------

class GitHubCallBackView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        client_id = os.getenv('GITHUB_CLIENT_ID')
        client_secret = os.getenv('GITHUB_CLIENT_SECRET')
        if not client_id or not client_secret:
            return github_config_error()
        
        code = request.GET.get('code')
        if not code:
            return Response({'error': 'No code provided'}, status=400)
        response = requests.post(f'https://github.com/login/oauth/access_token', data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code
        })
        return Response(response.json())