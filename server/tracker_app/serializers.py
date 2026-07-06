from rest_framework import serializers

from .models import ArtReview, Bug, ChangeRequest


def display_name(user):
    """Human-readable name for a user (profile name, else username, else dash)."""
    if not user:
        return '—'
    try:
        profile = user.profile
    except Exception:
        profile = None
    if profile and profile.name:
        return profile.name
    return user.username


class BugSerializer(serializers.ModelSerializer):
    reporter = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()

    class Meta:
        model = Bug
        fields = ['id', 'title', 'description', 'severity', 'status', 'reporter', 'assignee', 'created_at', 'updated_at']

    def get_reporter(self, obj):
        return display_name(obj.reporter)

    def get_assignee(self, obj):
        return display_name(obj.assignee)


class ChangeRequestSerializer(serializers.ModelSerializer):
    requester = serializers.SerializerMethodField()

    class Meta:
        model = ChangeRequest
        fields = ['id', 'title', 'description', 'status', 'priority', 'requester', 'created_at', 'updated_at']

    def get_requester(self, obj):
        return display_name(obj.requester)


class ArtReviewSerializer(serializers.ModelSerializer):
    submitter = serializers.SerializerMethodField()
    reviewer = serializers.SerializerMethodField()

    class Meta:
        model = ArtReview
        fields = ['id', 'title', 'note', 'asset_url', 'status', 'submitter', 'reviewer', 'created_at', 'updated_at']

    def get_submitter(self, obj):
        return display_name(obj.submitter)

    def get_reviewer(self, obj):
        return display_name(obj.reviewer)
