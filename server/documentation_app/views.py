from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Prefetch
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_app.auth_utils import CookieAuthentication
from .github_service import sync_review
from .models import ArtReview, Document, ReviewFeedback, Task
from .serializers import (
    DocumentSerializer, MemberSerializer, ReviewFeedbackSerializer,
    ReviewSerializer, ReviewUploadSerializer, TaskSerializer, is_reviewer,
)


def review_queryset():
    return ArtReview.objects.select_related('author').prefetch_related(
        Prefetch('feedback', queryset=ReviewFeedback.objects.select_related('author')),
    )


class WorkspaceAPIView(APIView):
    authentication_classes = [CookieAuthentication]
    permission_classes = [IsAuthenticated]

    def serialize(self, serializer, obj, **kwargs):
        return serializer(obj, context={'request': self.request}, **kwargs).data

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class WorkspaceView(WorkspaceAPIView):
    def get(self, request):
        response = Response({
            'documents': self.serialize(DocumentSerializer, Document.objects.all(), many=True),
            'tasks': self.serialize(TaskSerializer, Task.objects.all(), many=True),
            'reviews': self.serialize(ReviewSerializer, review_queryset(), many=True),
            'members': MemberSerializer(get_user_model().objects.filter(is_active=True).order_by('github_username'), many=True).data,
        })
        response['Cache-Control'] = 'private, no-store'
        return response


class DocumentsView(WorkspaceAPIView):
    def get(self, request):
        return Response(self.serialize(DocumentSerializer, Document.objects.all(), many=True))

    def post(self, request):
        serializer = DocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        # A client cannot set its own initial version.
        serializer.validated_data.pop('version', None)
        document = serializer.save(created_by=request.user)
        return Response(self.serialize(DocumentSerializer, document), status=status.HTTP_201_CREATED)


class DocumentView(WorkspaceAPIView):
    def get(self, request, pk):
        return Response(self.serialize(DocumentSerializer, get_object_or_404(Document, pk=pk)))

    def patch(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if 'version' not in request.data:
            raise ValidationError({'version': 'Include the current document version to prevent overwriting another edit.'})
        serializer = DocumentSerializer(document, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        expected_version = values.pop('version')
        updated = Document.objects.filter(pk=pk, version=expected_version).update(
            **values, version=F('version') + 1, updated_at=timezone.now(),
        )
        document = get_object_or_404(Document, pk=pk)
        if not updated:
            return Response({
                'detail': 'This page changed. Reload the latest version before saving your edits.',
                'document': self.serialize(DocumentSerializer, document),
            }, status=status.HTTP_409_CONFLICT)
        return Response(self.serialize(DocumentSerializer, document))

    def delete(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if document.created_by_id != request.user.id and not is_reviewer(request.user):
            raise PermissionDenied('Only the page creator or an admin can delete it.')
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TasksView(WorkspaceAPIView):
    def get(self, request):
        return Response(self.serialize(TaskSerializer, Task.objects.all(), many=True))

    def post(self, request):
        serializer = TaskSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        assignee = serializer.validated_data.get('assignee', request.user)
        if assignee and assignee != request.user and not is_reviewer(request.user):
            raise PermissionDenied('Only an admin can assign another employee.')
        task = serializer.save(created_by=request.user, assignee=assignee)
        return Response(self.serialize(TaskSerializer, task), status=status.HTTP_201_CREATED)


class TaskView(WorkspaceAPIView):
    def patch(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        if request.user.id not in (task.created_by_id, task.assignee_id) and not is_reviewer(request.user):
            raise PermissionDenied('Only the task creator, assignee or an admin can edit it.')
        serializer = TaskSerializer(task, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        if 'assignee' in serializer.validated_data and not is_reviewer(request.user):
            if serializer.validated_data['assignee'] != task.assignee:
                raise PermissionDenied('Only an admin can reassign a task.')
        task = serializer.save()
        return Response(self.serialize(TaskSerializer, task))


class ReviewsView(WorkspaceAPIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(self.serialize(ReviewSerializer, review_queryset(), many=True))

    def post(self, request):
        serializer = ReviewUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data['file']
        review = serializer.save(author=request.user, file_name=upload.name, file_size=upload.size)
        sync_review(review)
        return Response(self.serialize(ReviewSerializer, get_object_or_404(review_queryset(), pk=review.pk)), status=status.HTTP_201_CREATED)


class ReviewView(WorkspaceAPIView):
    def get(self, request, pk):
        return Response(self.serialize(ReviewSerializer, get_object_or_404(review_queryset(), pk=pk)))


class ReviewDownloadView(WorkspaceAPIView):
    def get(self, request, pk):
        review = get_object_or_404(ArtReview, pk=pk)
        try:
            response = FileResponse(review.file.open('rb'), as_attachment=True, filename=review.file_name, content_type='application/octet-stream')
        except (FileNotFoundError, OSError):
            raise Http404('The review file is unavailable.')
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        return response


class ReviewFeedbackView(WorkspaceAPIView):
    def post(self, request, pk):
        serializer = ReviewFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data.get('decision', ReviewFeedback.Decision.COMMENT)
        with transaction.atomic():
            review = get_object_or_404(ArtReview.objects.select_for_update(), pk=pk)
            if decision != ReviewFeedback.Decision.COMMENT:
                if not is_reviewer(request.user):
                    raise PermissionDenied('Only an admin can approve work or request changes.')
                if review.author_id == request.user.id:
                    raise PermissionDenied('A reviewer cannot decide on their own upload.')
            serializer.save(review=review, author=request.user)
            review.revision += 1
            if decision != ReviewFeedback.Decision.COMMENT:
                review.status = decision
            review.save(update_fields=['status', 'revision', 'updated_at'])
        sync_review(review)
        return Response(self.serialize(ReviewSerializer, get_object_or_404(review_queryset(), pk=pk)), status=status.HTTP_201_CREATED)


class ReviewGitHubView(WorkspaceAPIView):
    def post(self, request, pk):
        review = get_object_or_404(ArtReview, pk=pk)
        if review.author_id != request.user.id and not is_reviewer(request.user):
            raise PermissionDenied('Only the artist or an admin can retry GitHub sync.')
        sync_review(review)
        return Response(self.serialize(ReviewSerializer, get_object_or_404(review_queryset(), pk=pk)))
