from django.urls import path
from .views import *

urlpatterns = [
    path('create/admin/', CreateAdminUserView.as_view(), name='create_admin_user'),
    path('github/login/', GitHubLoginView.as_view(), name='github_login'),
    path('github/callback/', GitHubCallBackView.as_view(), name='github_callback'),
    path('admin/login/', AdminLoginView.as_view(), name='admin_login'),
    path('admin/logout/', AdminLogoutView.as_view(), name='admin_logout'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('info/', UserInfoView.as_view(), name='user_info'),
    path('token/refresh/', RefreshAccessToken.as_view(), name='refresh_token'),
]
