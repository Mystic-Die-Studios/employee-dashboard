from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('github_login', 'name', 'github_id', 'user', 'updated_at')
    search_fields = ('github_login', 'name', 'user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
