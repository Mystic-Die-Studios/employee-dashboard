from django.conf import settings
from django.db import models


class Bug(models.Model):
    """A tracked bug/defect."""

    SEVERITY = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')]
    STATUS = [('open', 'Open'), ('in_progress', 'In progress'), ('fixed', 'Fixed'), ('wontfix', "Won't fix")]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    severity = models.CharField(max_length=12, choices=SEVERITY, default='medium')
    status = models.CharField(max_length=12, choices=STATUS, default='open')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reported_bugs',
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_bugs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ChangeRequest(models.Model):
    """A proposed change to the game or process."""

    STATUS = [('open', 'Open'), ('in_review', 'In review'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    PRIORITY = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High')]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS, default='open')
    priority = models.CharField(max_length=8, choices=PRIORITY, default='medium')
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='change_requests',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ArtReview(models.Model):
    """An art asset submitted for review/sign-off."""

    STATUS = [('pending', 'Pending'), ('approved', 'Approved'), ('changes_requested', 'Changes requested')]

    title = models.CharField(max_length=255)
    note = models.TextField(blank=True)
    asset_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='submitted_art',
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='art_to_review',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
