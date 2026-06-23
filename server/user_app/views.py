from django.shortcuts import render
from rest_framework.views import APIView


class CreateUserView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        pass
