from django.contrib import admin

from .models import ArtReview, Document, ReviewFeedback, Task


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'created_by', 'updated_at']
    search_fields = ['title', 'body']
    readonly_fields = ['id', 'created_at', 'updated_at', 'version']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'status', 'priority', 'assignee']
    list_filter = ['status', 'priority']


class ReviewFeedbackInline(admin.TabularInline):
    model = ReviewFeedback
    extra = 0
    can_delete = False
    readonly_fields = ['body', 'decision', 'author', 'created_at', 'github_comment_id']

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ArtReview)
class ArtReviewAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'title', 'author', 'status', 'github_sync_status', 'created_at']
    list_filter = ['status', 'github_sync_status']
    # Decisions must use the review API to preserve feedback and prevent self-approval.
    readonly_fields = [field.name for field in ArtReview._meta.fields]
    inlines = [ReviewFeedbackInline]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
