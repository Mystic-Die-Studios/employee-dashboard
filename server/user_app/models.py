from django.conf import settings
from django.db import models


class Profile(models.Model):
    """GitHub identity linked to a Django auth user.

    One row per GitHub account. `github_id` is the stable key we upsert on
    (a user can rename their login, but the numeric id never changes).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    github_id = models.BigIntegerField(unique=True)
    github_login = models.CharField(max_length=255)
    name = models.CharField(max_length=255, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.github_login
