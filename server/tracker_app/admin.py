from django.contrib import admin

from .models import ArtReview, Bug, ChangeRequest


@admin.register(Bug)
class BugAdmin(admin.ModelAdmin):
    list_display = ('title', 'severity', 'status', 'reporter', 'assignee', 'created_at')
    list_filter = ('severity', 'status')


@admin.register(ChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'priority', 'status', 'requester', 'created_at')
    list_filter = ('priority', 'status')


@admin.register(ArtReview)
class ArtReviewAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'submitter', 'reviewer', 'created_at')
    list_filter = ('status',)
