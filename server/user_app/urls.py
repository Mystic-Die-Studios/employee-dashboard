from django.urls import path
from .views import *

urlpatterns = [
    path('create/admin/', CreateAdminUserView.as_view(), name='create_admin_user'),
    path('github/callback/', GitHubCallBackView.as_view(), name='github_callback'),
    path('admin/login/', AdminLoginView.as_view(), name='admin_login'),
    path('admin/logout/', AdminLogoutView.as_view(), name='admin_logout'),
]