import re
from pathlib import PurePosixPath

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import ArtReview, Document, ReviewFeedback, Task


def is_reviewer(user):
    return bool(user.is_superuser or user.role == 'admin')


class MemberSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ['id', 'github_username', 'role']

    def get_role(self, obj):
        return 'admin' if is_reviewer(obj) else 'employee'


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'github_username']


class DocumentSerializer(serializers.ModelSerializer):
    updated = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    body = serializers.CharField(required=False, allow_blank=True, max_length=1_000_000, trim_whitespace=False)

    class Meta:
        model = Document
        fields = ['id', 'title', 'category', 'icon', 'body', 'updated', 'updated_at', 'version', 'created_by', 'can_delete']
        read_only_fields = ['id', 'updated_at', 'created_by']
        extra_kwargs = {'version': {'min_value': 1}}

    def get_updated(self, obj):
        minutes = max(0, int((timezone.now() - obj.updated_at).total_seconds() // 60))
        if minutes < 1:
            return 'Just now'
        if minutes < 60:
            return f'{minutes}m ago'
        if minutes < 1440:
            return f'{minutes // 60}h ago'
        return f'{minutes // 1440}d ago'

    def get_can_delete(self, obj):
        user = self.context['request'].user
        return obj.created_by_id == user.id or is_reviewer(user)


class TaskSerializer(serializers.ModelSerializer):
    person = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    assignee = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.filter(is_active=True), required=False, allow_null=True)

    class Meta:
        model = Task
        fields = ['id', 'title', 'project', 'status', 'priority', 'person', 'assignee', 'can_edit']
        read_only_fields = ['id']

    def get_person(self, obj):
        return 'You' if obj.assignee_id == self.context['request'].user.id else 'Team'

    def get_can_edit(self, obj):
        user = self.context['request'].user
        return user.id in (obj.created_by_id, obj.assignee_id) or is_reviewer(user)


ALLOWED_UPLOAD_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'blend', 'fbx', 'obj', 'psd', 'kra', 'zip', 'mp4', 'wav'}
UNSAFE_NAME_PARTS = {'exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'ps1', 'sh', 'js', 'mjs', 'html', 'htm', 'svg', 'php', 'py', 'rb', 'jar', 'lnk', 'dll'}


def validate_art_file(upload):
    filename = PurePosixPath(upload.name.replace('\\', '/')).name
    if len(filename) > 200 or not filename or re.search(r'[\x00-\x1f\x7f]', filename):
        raise serializers.ValidationError('Use a filename of at most 200 characters without control characters.')
    parts = filename.lower().split('.')
    extension = parts[-1] if len(parts) > 1 else ''
    if extension not in ALLOWED_UPLOAD_EXTENSIONS or any(part in UNSAFE_NAME_PARTS for part in parts[1:]):
        raise serializers.ValidationError('Upload a supported art file: PNG, JPEG, WebP, GIF, PDF, Blender, FBX, OBJ, PSD, Krita, ZIP, MP4, or WAV.')
    if not upload.size:
        raise serializers.ValidationError('The file is empty.')
    if upload.size > settings.REVIEW_UPLOAD_MAX_BYTES:
        raise serializers.ValidationError(f'The file exceeds the {settings.REVIEW_UPLOAD_MAX_BYTES // (1024 * 1024)} MB upload limit.')
    header = upload.read(16)
    upload.seek(0)
    valid_header = {
        'png': header.startswith(b'\x89PNG\r\n\x1a\n'),
        'jpg': header.startswith(b'\xff\xd8\xff'),
        'jpeg': header.startswith(b'\xff\xd8\xff'),
        'gif': header.startswith((b'GIF87a', b'GIF89a')),
        'webp': header.startswith(b'RIFF') and header[8:12] == b'WEBP',
        'pdf': header.startswith(b'%PDF-'),
        'zip': header.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08')),
        'kra': header.startswith(b'PK\x03\x04'),
        'psd': header.startswith(b'8BPS'),
        'blend': header.startswith((b'BLENDER', b'\x1f\x8b')),
        'wav': header.startswith(b'RIFF') and header[8:12] == b'WAVE',
        'mp4': header[4:8] == b'ftyp',
    }
    if extension in valid_header and not valid_header[extension]:
        raise serializers.ValidationError('The file content does not match its extension.')
    # Neutralize names from either desktop path convention; private storage uses a UUID.
    upload.name = filename
    return upload


class ReviewUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(validators=[validate_art_file])
    description = serializers.CharField(required=False, allow_blank=True, max_length=20_000, trim_whitespace=False)

    class Meta:
        model = ArtReview
        fields = ['title', 'project', 'description', 'file']


class ReviewFeedbackSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    body = serializers.CharField(max_length=20_000)

    class Meta:
        model = ReviewFeedback
        fields = ['id', 'body', 'decision', 'author', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class ReviewSerializer(serializers.ModelSerializer):
    ticket = serializers.CharField(read_only=True)
    author = AuthorSerializer(read_only=True)
    feedback = ReviewFeedbackSerializer(many=True, read_only=True)
    download_url = serializers.SerializerMethodField()
    github_issue_url = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    can_sync = serializers.SerializerMethodField()

    class Meta:
        model = ArtReview
        fields = ['id', 'ticket', 'title', 'project', 'description', 'author', 'file_name', 'file_size', 'download_url', 'status', 'github_sync_status', 'github_issue_url', 'created_at', 'feedback', 'can_review', 'can_sync']

    def get_download_url(self, obj):
        return f'/api/v1/workspace/reviews/{obj.id}/file/'

    def get_github_issue_url(self, obj):
        return obj.github_issue_url or None

    def get_can_review(self, obj):
        user = self.context['request'].user
        return is_reviewer(user) and obj.author_id != user.id

    def get_can_sync(self, obj):
        user = self.context['request'].user
        return obj.author_id == user.id or is_reviewer(user)
