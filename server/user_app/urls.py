from django.urls import path
from .views import *

urlpatterns = [
    path('create/', CreateUserView.as_view(), name='create_user'),
    path('github/callback/', GitHubCallBackView.as_view(), name='github_callback'),
]