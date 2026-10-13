"""Optional server-side issue mirror. Local review history is always authoritative."""
import os
import re
import uuid
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

import requests
from django.db.models import Q
from django.utils import timezone

from .models import ArtReview


GITHUB_TIMEOUT = 10
MAX_PAGES = 20


class GitHubSyncError(Exception):
    pass


def _configuration():
    repository = os.getenv('REVIEW_GITHUB_REPOSITORY', '').strip()
    token = os.getenv('REVIEW_GITHUB_TOKEN', '').strip()
    if not repository or not token:
        return None
    if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}', repository):
        raise GitHubSyncError('The review repository configuration is invalid.')
    return repository, {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }


def _api(method, path, headers, **kwargs):
    try:
        response = getattr(requests, method)(
            f'https://api.github.com{path}', headers=headers, timeout=GITHUB_TIMEOUT,
            allow_redirects=False, **kwargs,
        )
        response.raise_for_status()
        if response.status_code >= 300:
            raise GitHubSyncError('GitHub returned an unexpected response.')
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        # Deliberately avoid forwarding exception text, URLs, response bodies or credentials.
        raise GitHubSyncError('GitHub sync failed. Your review is saved; you can retry.') from exc


def _find_marker(path, marker, headers, **params):
    """Read the repository directly: search indexing can lag after a timed-out POST."""
    for page in range(1, MAX_PAGES + 1):
        items = _api('get', path, headers, params={**params, 'per_page': 100, 'page': page})
        if not isinstance(items, list):
            raise GitHubSyncError('GitHub returned an unexpected response.')
        for item in items:
            if isinstance(item, dict) and isinstance(item.get('body'), str) and marker in item['body'] and not item.get('pull_request'):
                return item
        if len(items) < 100:
            return None
    # Never create a potential duplicate when the lookup did not finish.
    raise GitHubSyncError('GitHub lookup needs attention. Your review is saved.')


def _issue_url(repository, number, candidate):
    expected = f'https://github.com/{repository}/issues/{number}'
    if candidate and candidate.lower() != expected.lower():
        raise GitHubSyncError('GitHub returned an unexpected issue URL.')
    return expected


def _portal_url(review):
    frontend = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    parsed = urlsplit(frontend)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.password:
        raise GitHubSyncError('The frontend URL configuration is invalid.')
    return f'{frontend}/dashboard?{urlencode({"view": "Reviews", "review": str(review.id)})}'


def _sync(review, repository, headers):
    if review.github_repository and review.github_repository.lower() != repository.lower():
        raise GitHubSyncError('This ticket belongs to a different configured repository.')
    marker = f'<!-- mysticdie-review:{review.id} -->'
    number = review.github_issue_number
    if not number:
        issue = _find_marker(
            f'/repos/{repository}/issues', marker, headers, state='all',
            since=(review.created_at - timedelta(minutes=5)).isoformat(),
            sort='created', direction='desc',
        )
        if issue is None:
            issue = _api('post', f'/repos/{repository}/issues', headers, json={
                'title': f'[{review.ticket}] {review.title}',
                'body': '\n\n'.join([
                    marker,
                    f'**Project:** {review.project}',
                    f'**Artist:** {review.author.github_username or "Studio employee"}',
                    review.description,
                    f'**File:** {review.file_name} ({review.file_size} bytes)',
                    f'[Open private studio review]({_portal_url(review)})',
                    'The file and review history are stored in the authenticated employee dashboard.',
                ]),
            })
        if not isinstance(issue, dict) or not isinstance(issue.get('number'), int) or issue['number'] < 1:
            raise GitHubSyncError('GitHub returned an unexpected response.')
        number = issue['number']
        issue_url = _issue_url(repository, number, issue.get('html_url'))
        # Save the identity immediately, so a later comment failure never creates another issue.
        ArtReview.objects.filter(pk=review.pk).update(
            github_repository=repository, github_issue_number=number, github_issue_url=issue_url,
        )
        review.github_repository = repository
        review.github_issue_number = number
        review.github_issue_url = issue_url

    _api('patch', f'/repos/{repository}/issues/{number}', headers, json={
        'state': 'closed' if review.status == ArtReview.Status.APPROVED else 'open',
    })
    for feedback in review.feedback.filter(github_comment_id__isnull=True).select_related('author'):
        comment_marker = f'<!-- mysticdie-feedback:{feedback.id} -->'
        comment = _find_marker(f'/repos/{repository}/issues/{number}/comments', comment_marker, headers)
        if comment is None:
            comment = _api('post', f'/repos/{repository}/issues/{number}/comments', headers, json={
                'body': '\n\n'.join([
                    comment_marker,
                    f'**{feedback.author.github_username or "Studio employee"} — {feedback.get_decision_display()}**',
                    feedback.body,
                ]),
            })
        if not isinstance(comment, dict) or not isinstance(comment.get('id'), int):
            raise GitHubSyncError('GitHub returned an unexpected response.')
        feedback.github_comment_id = comment['id']
        feedback.save(update_fields=['github_comment_id'])


def sync_review(review):
    """Claim with one atomic UPDATE; all network traffic happens outside DB locks."""
    try:
        configuration = _configuration()
    except GitHubSyncError as exc:
        ArtReview.objects.filter(pk=review.pk).update(github_sync_status=ArtReview.SyncStatus.FAILED, github_sync_error=str(exc))
        review.refresh_from_db()
        return review
    if configuration is None:
        ArtReview.objects.filter(pk=review.pk).update(github_sync_status=ArtReview.SyncStatus.NOT_CONFIGURED, github_sync_error='')
        review.refresh_from_db()
        return review

    claim = uuid.uuid4()
    now = timezone.now()
    claimed = ArtReview.objects.filter(pk=review.pk).filter(
        Q(github_sync_claim__isnull=True) | Q(github_sync_started_at__lt=now - timedelta(minutes=10)),
    ).update(github_sync_claim=claim, github_sync_started_at=now)
    if not claimed:
        review.refresh_from_db()
        return review
    try:
        review.refresh_from_db()
        revision = review.revision
        _sync(review, *configuration)
        synced = ArtReview.objects.filter(pk=review.pk, github_sync_claim=claim, revision=revision).update(
            github_sync_status=ArtReview.SyncStatus.SYNCED, github_sync_error='',
        )
        if not synced:
            ArtReview.objects.filter(pk=review.pk, github_sync_claim=claim).update(
                github_sync_status=ArtReview.SyncStatus.FAILED,
                github_sync_error='New review activity arrived during sync. Retry to include the latest changes.',
            )
    except GitHubSyncError as exc:
        ArtReview.objects.filter(pk=review.pk, github_sync_claim=claim).update(
            github_sync_status=ArtReview.SyncStatus.FAILED, github_sync_error=str(exc),
        )
    finally:
        ArtReview.objects.filter(pk=review.pk, github_sync_claim=claim).update(github_sync_claim=None, github_sync_started_at=None)
    review.refresh_from_db()
    return review
