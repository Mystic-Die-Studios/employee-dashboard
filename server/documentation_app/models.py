import uuid
from pathlib import PurePath

from django.conf import settings
from django.db import models


def review_upload_path(instance, filename):
    extension = PurePath(filename).suffix.lower()
    return f'reviews/{instance.id}/{uuid.uuid4().hex}{extension}'


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=80, default='Studio wiki')
    icon = models.CharField(max_length=32, default='file-text')
    body = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            # Edits through Django admin also invalidate browser versions.
            self.version += 1
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'version'}
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = 'To do', 'To do'
        IN_PROGRESS = 'In progress', 'In progress'
        DONE = 'Done', 'Done'

    class Priority(models.TextChoices):
        HIGH = 'High', 'High'
        MEDIUM = 'Medium', 'Medium'
        LOW = 'Low', 'Low'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    project = models.CharField(max_length=120, default='Studio')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_tasks')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ArtReview(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        CHANGES_REQUESTED = 'changes_requested', 'Changes requested'
        APPROVED = 'approved', 'Approved'

    class SyncStatus(models.TextChoices):
        NOT_CONFIGURED = 'not_configured', 'Not configured'
        FAILED = 'failed', 'Failed'
        SYNCED = 'synced', 'Synced'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    project = models.CharField(max_length=120, default='Studio')
    description = models.TextField(blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    file = models.FileField(upload_to=review_upload_path, max_length=255)
    file_name = models.CharField(max_length=200)
    file_size = models.PositiveBigIntegerField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SUBMITTED)
    revision = models.PositiveIntegerField(default=1, editable=False)
    github_sync_status = models.CharField(max_length=20, choices=SyncStatus.choices, default=SyncStatus.NOT_CONFIGURED)
    github_repository = models.CharField(max_length=200, blank=True)
    github_issue_number = models.PositiveIntegerField(null=True, blank=True)
    github_issue_url = models.URLField(blank=True)
    github_sync_error = models.CharField(max_length=200, blank=True)
    github_sync_claim = models.UUIDField(null=True, blank=True, editable=False)
    github_sync_started_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def ticket(self):
        return f'ART-{self.id.hex[:12].upper()}'

    def __str__(self):
        return f'{self.ticket}: {self.title}'


class ReviewFeedback(models.Model):
    class Decision(models.TextChoices):
        COMMENT = 'comment', 'Comment'
        CHANGES_REQUESTED = 'changes_requested', 'Changes requested'
        APPROVED = 'approved', 'Approved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.ForeignKey(ArtReview, on_delete=models.CASCADE, related_name='feedback')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField()
    decision = models.CharField(max_length=30, choices=Decision.choices, default=Decision.COMMENT)
    github_comment_id = models.PositiveBigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
