from django.urls import path

from . import views

urlpatterns = [
    path('kanban/status/', views.kanban_status, name='kanban_status'),
]
