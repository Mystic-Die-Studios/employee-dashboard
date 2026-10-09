import tempfile
from unittest.mock import Mock, patch

import requests
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from user_app.auth_utils import create_access_token
from .github_service import sync_review
from .models import ArtReview, Document, ReviewFeedback, Task


def art_file(name='concept.png', content=None):
    return SimpleUploadedFile(name, content if content is not None else b'\x89PNG\r\n\x1a\nconcept-art', content_type='image/png')


def github_response(payload, status=200):
    response = Mock(status_code=status)
    response.json.return_value = payload
    if status >= 400:
        response.raise_for_status.side_effect = requests.HTTPError('server-token must never be exposed')
    return response


@patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': '', 'REVIEW_GITHUB_TOKEN': ''})
class WorkspaceTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory(prefix='studio-review-tests-')
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name, REVIEW_UPLOAD_MAX_BYTES=50 * 1024 * 1024)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.artist = get_user_model().objects.create_user(username='artist', email='artist@example.com', github_username='artist')
        self.teammate = get_user_model().objects.create_user(username='teammate', email='teammate@example.com', github_username='teammate')
        self.admin = get_user_model().objects.create_user(username='lead', email='lead@example.com', github_username='lead', role='admin')
        self.client = APIClient()
        self.login(self.artist)

    def login(self, user):
        self.client.cookies['access_token'] = create_access_token(user)

    def upload(self, **overrides):
        return self.client.post(reverse('workspace_reviews'), {'title': 'Character concept', 'project': 'Mystic quest', 'description': 'Please review the silhouette.', 'file': art_file(), **overrides}, format='multipart')

    def review(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.data)
        return ArtReview.objects.get(pk=response.data['id'])

    def test_every_workspace_resource_requires_authentication(self):
        review = self.review()
        self.client.cookies.clear()
        urls = [reverse('workspace'), reverse('workspace_documents'), reverse('workspace_tasks'), reverse('workspace_reviews'), reverse('workspace_review', kwargs={'pk': review.id}), reverse('workspace_review_file', kwargs={'pk': review.id})]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.post(reverse('workspace_reviews'), {'title': 'No login'}, format='multipart').status_code, 401)

    def test_inactive_users_cannot_read_workspace(self):
        self.artist.is_active = False
        self.artist.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(reverse('workspace')).status_code, 401)

    def test_cookie_authenticated_workspace_writes_require_csrf(self):
        browser = APIClient(enforce_csrf_checks=True)
        browser.cookies['access_token'] = create_access_token(self.artist)
        url = reverse('workspace_documents')
        denied = browser.post(url, {'title': 'Cross-site write'}, format='json')
        self.assertEqual(denied.status_code, 403)
        csrf = browser.get(reverse('csrf_token'))
        allowed = browser.post(url, {'title': 'Employee wiki'}, format='json', HTTP_X_CSRFTOKEN=csrf.data['csrfToken'])
        self.assertEqual(allowed.status_code, 201)

    def test_workspace_starts_empty_and_members_exclude_email(self):
        response = self.client.get(reverse('workspace'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['documents'], [])
        self.assertEqual(response.data['tasks'], [])
        self.assertEqual(response.data['reviews'], [])
        self.assertEqual(set(response.data['members'][0]), {'id', 'github_username', 'role'})

    def test_markdown_document_is_persistent_and_shared(self):
        body = '# Art pipeline\n\n- Upload\n- Review\n'
        response = self.client.post(reverse('workspace_documents'), {'title': 'Art wiki', 'body': body}, format='json')
        self.assertEqual(response.status_code, 201)
        document = Document.objects.get(pk=response.data['id'])
        self.assertEqual(document.body, body)
        self.assertEqual(document.version, 1)
        self.login(self.teammate)
        response = self.client.get(reverse('workspace'))
        self.assertEqual(response.data['documents'][0]['body'], body)
        self.assertFalse(response.data['documents'][0]['can_delete'])

    def test_document_conflict_does_not_overwrite_saved_work(self):
        document = Document.objects.create(title='Wiki', body='Original', created_by=self.artist)
        url = reverse('workspace_document', kwargs={'pk': document.id})
        saved = self.client.patch(url, {'body': 'First editor', 'version': 1}, format='json')
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data['version'], 2)
        self.login(self.teammate)
        conflict = self.client.patch(url, {'body': 'Stale editor', 'version': 1}, format='json')
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.data['document']['body'], 'First editor')
        document.refresh_from_db()
        self.assertEqual(document.body, 'First editor')

    def test_non_api_document_edit_also_invalidates_browser_version(self):
        document = Document.objects.create(title='Wiki', body='Original', created_by=self.artist)
        document.body = 'Admin edit'
        document.save(update_fields=['body'])
        response = self.client.patch(reverse('workspace_document', kwargs={'pk': document.pk}), {'body': 'Outdated editor', 'version': 1}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['document']['version'], 2)

    def test_document_requires_version_and_owner_or_admin_for_deletion(self):
        document = Document.objects.create(title='Wiki', created_by=self.artist)
        url = reverse('workspace_document', kwargs={'pk': document.id})
        self.assertEqual(self.client.patch(url, {'body': 'Missing version'}, format='json').status_code, 400)
        self.login(self.teammate)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertTrue(Document.objects.filter(pk=document.id).exists())
        self.login(self.admin)
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_task_assignee_and_edit_permissions(self):
        response = self.client.post(reverse('workspace_tasks'), {'title': 'Paint character', 'priority': 'High'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['can_edit'])
        self.assertEqual(response.data['person'], 'You')
        task = Task.objects.get(pk=response.data['id'])
        url = reverse('workspace_task', kwargs={'pk': task.id})
        self.login(self.teammate)
        self.assertFalse(self.client.get(reverse('workspace')).data['tasks'][0]['can_edit'])
        self.assertEqual(self.client.patch(url, {'status': 'Done'}, format='json').status_code, 403)
        self.login(self.admin)
        assigned = self.client.patch(url, {'assignee': self.teammate.id}, format='json')
        self.assertEqual(assigned.status_code, 200)
        self.login(self.teammate)
        self.assertEqual(self.client.patch(url, {'status': 'Done'}, format='json').status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, 'Done')

    def test_employee_cannot_assign_others_and_invalid_task_values_are_rejected(self):
        url = reverse('workspace_tasks')
        self.assertEqual(self.client.post(url, {'title': 'Task', 'assignee': self.teammate.id}, format='json').status_code, 403)
        self.assertEqual(self.client.post(url, {'title': 'Task', 'status': 'made up'}, format='json').status_code, 400)
        self.assertFalse(Task.objects.exists())

    def test_upload_creates_private_ticket_with_random_storage_name(self):
        review = self.review()
        self.assertTrue(review.ticket.startswith('ART-'))
        self.assertEqual(review.file_name, 'concept.png')
        self.assertNotIn('concept', review.file.name)
        self.assertTrue(review.file.name.startswith(f'reviews/{review.id}/'))
        snapshot = self.client.get(reverse('workspace')).data['reviews'][0]
        self.assertEqual(snapshot['github_sync_status'], 'not_configured')
        self.assertIsNone(snapshot['github_issue_url'])
        self.assertNotIn('file', snapshot)
        self.assertTrue(snapshot['can_sync'])
        self.assertFalse(snapshot['can_review'])

    def test_download_is_authenticated_attachment_without_public_media_route(self):
        review = self.review()
        url = reverse('workspace_review_file', kwargs={'pk': review.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment;', response['Content-Disposition'])
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(b''.join(response.streaming_content), b'\x89PNG\r\n\x1a\nconcept-art')
        response.close()
        self.client.cookies.clear()
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_executable_html_svg_disguised_and_empty_uploads_are_rejected(self):
        for filename, content in [('payload.exe', b'MZ'), ('page.html', b'<html>'), ('vector.svg', b'<svg>'), ('payload.exe.png', b'\x89PNG\r\n\x1a\n'), ('fake.png', b'<script>'), ('empty.png', b'')]:
            with self.subTest(filename=filename):
                response = self.upload(file=art_file(filename, content))
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ArtReview.objects.exists())

    @override_settings(REVIEW_UPLOAD_MAX_BYTES=10)
    def test_oversize_upload_is_rejected_before_storage(self):
        self.assertEqual(self.upload().status_code, 400)
        self.assertFalse(ArtReview.objects.exists())

    def test_feedback_is_stored_and_only_admin_can_make_decisions(self):
        review = self.review()
        url = reverse('workspace_review_feedback', kwargs={'pk': review.id})
        self.login(self.teammate)
        comment = self.client.post(url, {'body': 'Great shape language.', 'decision': 'comment'}, format='json')
        self.assertEqual(comment.status_code, 201)
        self.assertEqual(comment.data['feedback'][0]['author']['id'], self.teammate.id)
        self.assertEqual(self.client.post(url, {'body': 'I approve.', 'decision': 'approved'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(url, {'body': '   '}, format='json').status_code, 400)
        self.login(self.admin)
        change = self.client.post(url, {'body': 'Increase shoulder contrast.', 'decision': 'changes_requested'}, format='json')
        self.assertEqual(change.status_code, 201)
        self.assertEqual(change.data['status'], 'changes_requested')
        self.assertTrue(change.data['can_review'])
        approved = self.client.post(url, {'body': 'Ready for production.', 'decision': 'approved'}, format='json')
        self.assertEqual(approved.data['status'], 'approved')
        self.assertEqual(len(approved.data['feedback']), 3)
        review.refresh_from_db()
        self.assertEqual(review.status, 'approved')

    def test_admin_cannot_approve_or_request_changes_for_own_upload(self):
        self.login(self.admin)
        review = self.review()
        url = reverse('workspace_review_feedback', kwargs={'pk': review.id})
        for decision in ('approved', 'changes_requested'):
            self.assertEqual(self.client.post(url, {'body': 'Own work', 'decision': decision}, format='json').status_code, 403)
        self.assertFalse(review.feedback.exists())

    def test_only_owner_or_admin_can_retry_github_sync(self):
        review = self.review()
        self.login(self.teammate)
        url = reverse('workspace_review_github', kwargs={'pk': review.id})
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 200)

    @patch('documentation_app.github_service.requests.get')
    @patch('documentation_app.github_service.requests.post')
    def test_missing_github_config_performs_no_network_calls(self, mock_post, mock_get):
        review = self.review()
        self.assertEqual(review.github_sync_status, 'not_configured')
        mock_post.assert_not_called()
        mock_get.assert_not_called()

    @patch('documentation_app.github_service.requests.patch')
    @patch('documentation_app.github_service.requests.post')
    @patch('documentation_app.github_service.requests.get')
    def test_configured_sync_creates_issue_and_preserves_server_only_token(self, mock_get, mock_post, mock_patch):
        review = self.review()
        mock_get.return_value = github_response([])
        mock_post.return_value = github_response({'number': 42, 'html_url': 'https://github.com/studio/reviews/issues/42'}, 201)
        mock_patch.return_value = github_response({'number': 42})
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': 'studio/reviews', 'REVIEW_GITHUB_TOKEN': 'server-token', 'FRONTEND_URL': 'https://studio.example'}):
            response = self.client.post(reverse('workspace_review_github', kwargs={'pk': review.id}), {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['github_sync_status'], 'synced')
        self.assertEqual(response.data['github_issue_url'], 'https://github.com/studio/reviews/issues/42')
        self.assertNotIn('server-token', str(response.data))
        self.assertIn(f'mysticdie-review:{review.id}', mock_post.call_args.kwargs['json']['body'])
        self.assertIn(f'[Open private studio review](https://studio.example/dashboard?view=Reviews&review={review.id})', mock_post.call_args.kwargs['json']['body'])
        self.assertEqual(mock_post.call_args.kwargs['timeout'], 10)
        self.assertFalse(mock_post.call_args.kwargs['allow_redirects'])

    @patch('documentation_app.github_service.requests.patch')
    @patch('documentation_app.github_service.requests.post')
    @patch('documentation_app.github_service.requests.get')
    def test_timeout_keeps_ticket_and_retry_recovers_existing_issue_without_duplicate(self, mock_get, mock_post, mock_patch):
        review = self.review()
        mock_get.return_value = github_response([])
        mock_post.side_effect = requests.Timeout('secret server-token')
        mock_patch.return_value = github_response({'number': 42})
        url = reverse('workspace_review_github', kwargs={'pk': review.id})
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': 'studio/reviews', 'REVIEW_GITHUB_TOKEN': 'server-token'}):
            failed = self.client.post(url, {}, format='json')
            self.assertEqual(failed.data['github_sync_status'], 'failed')
            self.assertNotIn('server-token', str(failed.data))
            self.assertTrue(ArtReview.objects.filter(pk=review.pk).exists())
            mock_get.return_value = github_response([{'number': 42, 'html_url': 'https://github.com/studio/reviews/issues/42', 'body': f'<!-- mysticdie-review:{review.id} -->'}])
            synced = self.client.post(url, {}, format='json')
        self.assertEqual(synced.data['github_sync_status'], 'synced')
        self.assertEqual(mock_post.call_count, 1)

    @patch('documentation_app.github_service.requests.patch')
    @patch('documentation_app.github_service.requests.post')
    @patch('documentation_app.github_service.requests.get')
    def test_feedback_mirror_failure_preserves_local_decision_and_retries_comment(self, mock_get, mock_post, mock_patch):
        review = self.review()
        ArtReview.objects.filter(pk=review.pk).update(github_repository='studio/reviews', github_issue_number=42, github_issue_url='https://github.com/studio/reviews/issues/42')
        self.login(self.admin)
        mock_get.return_value = github_response([])
        mock_post.side_effect = requests.Timeout('failed comment')
        mock_patch.return_value = github_response({'number': 42})
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': 'studio/reviews', 'REVIEW_GITHUB_TOKEN': 'server-token'}):
            response = self.client.post(reverse('workspace_review_feedback', kwargs={'pk': review.id}), {'body': 'Approved for release.', 'decision': 'approved'}, format='json')
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data['status'], 'approved')
            self.assertEqual(response.data['github_sync_status'], 'failed')
            feedback = ReviewFeedback.objects.get(review=review)
            mock_get.return_value = github_response([{'id': 1001, 'body': f'<!-- mysticdie-feedback:{feedback.id} -->'}])
            retried = self.client.post(reverse('workspace_review_github', kwargs={'pk': review.id}), {}, format='json')
        self.assertEqual(retried.data['github_sync_status'], 'synced')
        self.assertEqual(mock_post.call_count, 1)
        feedback.refresh_from_db()
        self.assertEqual(feedback.github_comment_id, 1001)
        self.assertEqual(mock_patch.call_args.kwargs['json']['state'], 'closed')

    @patch('documentation_app.github_service.requests.get')
    def test_invalid_repository_config_keeps_local_review_without_network(self, mock_get):
        review = self.review()
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': '../bad/path', 'REVIEW_GITHUB_TOKEN': 'server-token'}):
            sync_review(review)
        self.assertEqual(review.github_sync_status, 'failed')
        mock_get.assert_not_called()

    @patch('documentation_app.github_service.requests.patch')
    @patch('documentation_app.github_service.requests.post')
    @patch('documentation_app.github_service.requests.get')
    def test_failed_automatic_issue_creation_still_returns_created_private_review(self, mock_get, mock_post, mock_patch):
        mock_get.return_value = github_response([])
        mock_post.return_value = github_response({'message': 'Token secret'}, status=403)
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': 'studio/reviews', 'REVIEW_GITHUB_TOKEN': 'server-token'}):
            response = self.upload()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['github_sync_status'], 'failed')
        self.assertNotIn('server-token', str(response.data))
        self.assertEqual(ArtReview.objects.count(), 1)
        mock_patch.assert_not_called()

    @patch('documentation_app.github_service.requests.patch')
    @patch('documentation_app.github_service.requests.get')
    def test_activity_during_sync_is_not_reported_as_fully_synced(self, mock_get, mock_patch):
        review = self.review()
        ArtReview.objects.filter(pk=review.pk).update(github_repository='studio/reviews', github_issue_number=42, github_issue_url='https://github.com/studio/reviews/issues/42')

        def concurrent_decision(*args, **kwargs):
            ArtReview.objects.filter(pk=review.pk).update(revision=2, status='approved')
            return github_response({'number': 42})

        mock_patch.side_effect = concurrent_decision
        mock_get.return_value = github_response([])
        with patch.dict('os.environ', {'REVIEW_GITHUB_REPOSITORY': 'studio/reviews', 'REVIEW_GITHUB_TOKEN': 'server-token'}):
            sync_review(review)
        self.assertEqual(review.status, 'approved')
        self.assertEqual(review.github_sync_status, 'failed')
        self.assertIn('latest changes', review.github_sync_error)
