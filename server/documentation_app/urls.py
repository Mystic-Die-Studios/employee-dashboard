from django.urls import path

from . import views


urlpatterns = [
    path('', views.WorkspaceView.as_view(), name='workspace'),
    path('documents/', views.DocumentsView.as_view(), name='workspace_documents'),
    path('documents/<uuid:pk>/', views.DocumentView.as_view(), name='workspace_document'),
    path('tasks/', views.TasksView.as_view(), name='workspace_tasks'),
    path('tasks/<uuid:pk>/', views.TaskView.as_view(), name='workspace_task'),
    path('reviews/', views.ReviewsView.as_view(), name='workspace_reviews'),
    path('reviews/<uuid:pk>/', views.ReviewView.as_view(), name='workspace_review'),
    path('reviews/<uuid:pk>/file/', views.ReviewDownloadView.as_view(), name='workspace_review_file'),
    path('reviews/<uuid:pk>/feedback/', views.ReviewFeedbackView.as_view(), name='workspace_review_feedback'),
    path('reviews/<uuid:pk>/github/', views.ReviewGitHubView.as_view(), name='workspace_review_github'),
]
