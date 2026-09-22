from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse

from .auth_utils import OAUTH_STATE_COOKIE
from .models import User


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(f'status {self.status_code}')


GITHUB_ENV = {
    'GITHUB_CLIENT_ID': 'test-client-id',
    'GITHUB_CLIENT_SECRET': 'test-client-secret',
    'GITHUB_ORG': 'Mystic-Die-Studios',
    'ADMIN_GITHUB_USERNAMES': 'org-owner',
    'FRONTEND_URL': 'http://localhost:5173',
    'GITHUB_REDIRECT_URI': 'http://localhost:8000/api/v1/user/github/callback/',
}


@patch.dict('os.environ', GITHUB_ENV)
class GitHubLoginViewTests(TestCase):
    def test_redirects_to_github_and_sets_state_cookie(self):
        response = self.client.get(reverse('github_login'))

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response['Location'].startswith('https://github.com/login/oauth/authorize?'))
        self.assertIn('scope=user%3Aemail+read%3Aorg', response['Location'])

        state = response.cookies[OAUTH_STATE_COOKIE].value
        self.assertTrue(state)
        self.assertIn(f'state={state}', response['Location'])

    def test_returns_503_when_oauth_is_unconfigured(self):
        with patch.dict('os.environ', {'GITHUB_CLIENT_ID': '', 'GITHUB_CLIENT_SECRET': ''}):
            response = self.client.get(reverse('github_login'))
        self.assertEqual(response.status_code, 503)


@patch.dict('os.environ', GITHUB_ENV)
class GitHubCallbackViewTests(TestCase):
    STATE = 'a-known-state-value'

    def setUp(self):
        self.client.cookies[OAUTH_STATE_COOKIE] = self.STATE

    def github_responses(self, membership_status=200, membership_state='active', username='dev-user'):
        """Map GitHub API paths onto canned responses."""
        def fake_get(url, **kwargs):
            if url.endswith('/user/emails'):
                return FakeResponse(200, [{'email': f'{username}@example.com',
                                           'primary': True, 'verified': True}])
            if url.endswith('/user'):
                return FakeResponse(200, {'login': username})
            if '/user/memberships/orgs/' in url:
                return FakeResponse(membership_status, {'state': membership_state})
            raise AssertionError(f'unexpected GitHub call: {url}')
        return fake_get

    def callback(self, **params):
        query = {'code': 'the-code', 'state': self.STATE, **params}
        return self.client.get(reverse('github_callback'), query)

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_org_member_gets_tokens_and_lands_on_dashboard(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses()

        response = self.callback()

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], 'http://localhost:5173/dashboard')
        self.assertTrue(response.cookies['access_token'].value)
        self.assertTrue(response.cookies['refresh_token'].value)
        self.assertTrue(response.cookies['access_token']['httponly'])

        user = User.objects.get(github_username='dev-user')
        self.assertEqual(user.email, 'dev-user@example.com')
        self.assertEqual(user.role, User.Role.EMPLOYEE)
        self.assertFalse(user.has_usable_password())

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_listed_admin_username_gets_the_admin_role(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses(username='org-owner')

        self.callback()

        self.assertEqual(User.objects.get(github_username='org-owner').role, User.Role.ADMIN)

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_non_member_is_rejected_and_no_user_is_created(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses(membership_status=404)

        response = self.callback()

        self.assertEqual(response['Location'], 'http://localhost:5173/?error=not_org_member')
        self.assertFalse(User.objects.exists())

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_pending_invite_is_not_treated_as_membership(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses(membership_state='pending')

        response = self.callback()

        self.assertEqual(response['Location'], 'http://localhost:5173/?error=not_org_member')
        self.assertFalse(User.objects.exists())

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_unreadable_membership_is_reported_separately(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses(membership_status=500)

        response = self.callback()

        self.assertEqual(response['Location'], 'http://localhost:5173/?error=org_check_failed')
        self.assertFalse(User.objects.exists())

    def test_state_mismatch_is_rejected_before_any_github_call(self):
        with patch('user_app.auth_utils.requests.post') as mock_post:
            response = self.callback(state='attacker-supplied-state')
        mock_post.assert_not_called()
        self.assertEqual(response['Location'], 'http://localhost:5173/?error=invalid_state')

    def test_missing_state_cookie_is_rejected(self):
        del self.client.cookies[OAUTH_STATE_COOKIE]
        response = self.callback()
        self.assertEqual(response['Location'], 'http://localhost:5173/?error=invalid_state')

    def test_user_denial_on_github_redirects_home(self):
        response = self.callback(error='access_denied')
        self.assertEqual(response['Location'], 'http://localhost:5173/?error=github_denied')

    @patch('user_app.auth_utils.requests.post')
    def test_failed_token_exchange_redirects_instead_of_returning_json(self, mock_post):
        mock_post.return_value = FakeResponse(200, {'error': 'bad_verification_code'})
        response = self.callback()
        self.assertEqual(response['Location'], 'http://localhost:5173/?error=token_exchange_failed')

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_repeat_login_updates_the_existing_user(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})
        mock_get.side_effect = self.github_responses()
        self.callback()

        self.client.cookies[OAUTH_STATE_COOKIE] = self.STATE
        mock_get.side_effect = self.github_responses()
        self.callback()

        self.assertEqual(User.objects.count(), 1)


@patch.dict('os.environ', GITHUB_ENV)
class SessionEndpointTests(TestCase):
    def test_user_info_requires_an_auth_cookie(self):
        self.assertEqual(self.client.get(reverse('user_info')).status_code, 401)

    @patch('user_app.auth_utils.requests.get')
    @patch('user_app.auth_utils.requests.post')
    def test_user_info_then_logout_clears_the_session(self, mock_post, mock_get):
        mock_post.return_value = FakeResponse(200, {'access_token': 'gh-token'})

        def fake_get(url, **kwargs):
            if url.endswith('/user/emails'):
                return FakeResponse(200, [{'email': 'dev-user@example.com',
                                           'primary': True, 'verified': True}])
            if url.endswith('/user'):
                return FakeResponse(200, {'login': 'dev-user'})
            return FakeResponse(200, {'state': 'active'})
        mock_get.side_effect = fake_get

        self.client.cookies[OAUTH_STATE_COOKIE] = 'state'
        self.client.get(reverse('github_callback'), {'code': 'c', 'state': 'state'})

        info = self.client.get(reverse('user_info'))
        self.assertEqual(info.status_code, 200)
        self.assertEqual(info.json()['github_username'], 'dev-user')
        self.assertEqual(info.json()['role'], 'employee')

        logout = self.client.post(reverse('logout'))
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(logout.cookies['access_token'].value, '')
        self.assertEqual(self.client.get(reverse('user_info')).status_code, 401)


class SettingsParsingTests(TestCase):
    def test_debug_false_string_is_not_truthy(self):
        from employeedash_server.settings import env_bool
        with patch.dict('os.environ', {'DEBUG': 'False'}):
            self.assertFalse(env_bool('DEBUG', True))
        with patch.dict('os.environ', {'DEBUG': 'True'}):
            self.assertTrue(env_bool('DEBUG', False))

    def test_blank_origin_list_does_not_yield_an_empty_entry(self):
        from employeedash_server.settings import env_list
        with patch.dict('os.environ', {'CORS_ALLOWED_ORIGINS': ''}):
            self.assertEqual(env_list('CORS_ALLOWED_ORIGINS'), [])


class SpaRoutingTests(TestCase):
    """The API and the React app share one origin, so routing must not collide."""

    def setUp(self):
        import tempfile
        from pathlib import Path
        self.dist = Path(tempfile.mkdtemp())
        (self.dist / 'index.html').write_text('<!doctype html><title>shell</title>')

    def test_client_side_route_gets_the_spa_shell(self):
        with override_settings(FRONTEND_DIST_DIR=self.dist):
            response = self.client.get('/dashboard')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'<!doctype html>', response.content)
        self.assertEqual(response['Cache-Control'], 'no-cache')

    def test_unknown_deep_link_gets_the_spa_shell(self):
        with override_settings(FRONTEND_DIST_DIR=self.dist):
            response = self.client.get('/some/deep/link')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'<!doctype html>', response.content)

    def test_api_routes_are_not_swallowed_by_the_spa(self):
        with override_settings(FRONTEND_DIST_DIR=self.dist):
            response = self.client.get('/api/v1/test/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'connected': True})

    def test_unknown_api_route_404s_instead_of_serving_the_spa(self):
        with override_settings(FRONTEND_DIST_DIR=self.dist):
            response = self.client.get('/api/v1/user/does-not-exist/')
        self.assertEqual(response.status_code, 404)
        # Django's own 404 page is fine; silently handing back the SPA is not,
        # because a broken API path would then look like a successful page load.
        self.assertNotIn(b'<title>shell</title>', response.content)

    def test_missing_frontend_build_explains_itself(self):
        from pathlib import Path
        with override_settings(FRONTEND_DIST_DIR=Path('/nonexistent-build-dir')):
            response = self.client.get('/dashboard')
        self.assertEqual(response.status_code, 404)
        self.assertIn(b'npm run build', response.content)
