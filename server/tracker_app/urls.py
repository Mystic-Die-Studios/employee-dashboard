from rest_framework.routers import DefaultRouter

from .views import ArtReviewViewSet, BugViewSet, ChangeRequestViewSet

router = DefaultRouter()
router.register('bugs', BugViewSet)
router.register('change-requests', ChangeRequestViewSet)
router.register('art-reviews', ArtReviewViewSet)

urlpatterns = router.urls
