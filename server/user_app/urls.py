from django.urls import path

from . import views

urlpatterns = [
    path('auth/github/login/', views.github_login, name='github_login'),
    path('auth/github/callback/', views.github_callback, name='github_callback'),
    path('auth/me/', views.me, name='me'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/csrf/', views.csrf, name='csrf'),
]
