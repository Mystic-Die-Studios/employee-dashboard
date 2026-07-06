from rest_framework import viewsets

from .models import ArtReview, Bug, ChangeRequest
from .serializers import ArtReviewSerializer, BugSerializer, ChangeRequestSerializer

# All viewsets inherit the global default permission (IsAuthenticated) + session auth.


class BugViewSet(viewsets.ModelViewSet):
    queryset = Bug.objects.all()
    serializer_class = BugSerializer

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class ChangeRequestViewSet(viewsets.ModelViewSet):
    queryset = ChangeRequest.objects.all()
    serializer_class = ChangeRequestSerializer

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)


class ArtReviewViewSet(viewsets.ModelViewSet):
    queryset = ArtReview.objects.all()
    serializer_class = ArtReviewSerializer

    def perform_create(self, serializer):
        serializer.save(submitter=self.request.user)
