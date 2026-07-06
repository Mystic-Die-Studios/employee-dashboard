"""OAuth flow tests. GitHub HTTP calls are mocked, so these run offline with
no real credentials. Use the sqlite engine to avoid needing MySQL:

    DB_ENGINE=sqlite python manage.py test user_app
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import Profile

User = get_user_model()

GH_USER = {
    'id': 4242,
    'login': 'octocat',
    'name': 'The Octocat',
    'avatar_url': 'https://avatars.githubusercontent.com/u/4242',
    'email': 'octocat@example.com',
}


class FakeResp:
    def __init__(self, json_data=None, status_code=200):
        self._json = {} if json_data is None else json_data
        self.status_code = status_code
        self.ok = 200 <= status_code < 300

    def json(self):
        return self._json


def _get_router(member=True):
    """Build a side_effect for requests.get keyed on the URL path."""
    def _get(url, **kwargs):
        if '/user/memberships/orgs/' in url:
            if member:
                return FakeResp({'state': 'active'}, 200)
            return FakeResp({'message': 'Not Found'}, 404)
        if url.endswith('/user'):
            return FakeResp(GH_USER, 200)
        if url.endswith('/user/emails'):
            return FakeResp([{'email': 'primary@example.com', 'primary': True, 'verified': True}], 200)
        raise AssertionError(f'unexpected GET {url}')
    return _get


@override_settings(
    GITHUB_REQUIRED_ORG='Mystic-Die-Studios',
    FRONTEND_URL='http://localhost:5173',
    GITHUB_CLIENT_ID='test-id',
    GITHUB_CLIENT_SECRET='test-secret',
)
class OAuthFlowTests(TestCase):
    def _prime_state(self, state='teststate'):
        session = self.client.session
        session['oauth_state'] = state
        session.save()
        return state

    def test_me_requires_auth(self):
        resp = self.client.get(reverse('me'))
        self.assertEqual(resp.status_code, 401)

    def test_login_redirects_to_github_and_sets_state(self):
        resp = self.client.get(reverse('github_login'))
        self.assertEqual(resp.status_code, 302)
        self.assertTrue(resp['Location'].startswith('https://github.com/login/oauth/authorize'))
        self.assertIn('oauth_state', self.client.session)

    def test_callback_rejects_bad_state(self):
        self._prime_state('good')
        resp = self.client.get(reverse('github_callback'), {'code': 'abc', 'state': 'MISMATCH'})
        self.assertEqual(resp.status_code, 302)
        self.assertIn('error=invalid_state', resp['Location'])
        self.assertFalse(User.objects.exists())

    @patch('user_app.views.requests')
    def test_callback_happy_path_creates_user_and_session(self, mock_requests):
        state = self._prime_state()
        mock_requests.post.return_value = FakeResp({'access_token': 'gho_test'})
        mock_requests.get.side_effect = _get_router(member=True)

        resp = self.client.get(reverse('github_callback'), {'code': 'abc', 'state': state})

        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], 'http://localhost:5173/dashboard')
        profile = Profile.objects.get(github_id=GH_USER['id'])
        self.assertEqual(profile.github_login, 'octocat')
        self.assertEqual(profile.user.email, 'octocat@example.com')
        # Session is live: /me now returns the user.
        me = self.client.get(reverse('me'))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['login'], 'octocat')

    @patch('user_app.views.requests')
    def test_callback_rejects_non_org_member(self, mock_requests):
        state = self._prime_state()
        mock_requests.post.return_value = FakeResp({'access_token': 'gho_test'})
        mock_requests.get.side_effect = _get_router(member=False)

        resp = self.client.get(reverse('github_callback'), {'code': 'abc', 'state': state})

        self.assertEqual(resp.status_code, 302)
        self.assertIn('error=not_org_member', resp['Location'])
        self.assertFalse(User.objects.exists())

    @patch('user_app.views.requests')
    def test_callback_upserts_existing_user_on_relogin(self, mock_requests):
        mock_requests.post.return_value = FakeResp({'access_token': 'gho_test'})
        mock_requests.get.side_effect = _get_router(member=True)

        self._prime_state('s1')
        self.client.get(reverse('github_callback'), {'code': 'a', 'state': 's1'})
        self._prime_state('s2')
        self.client.get(reverse('github_callback'), {'code': 'b', 'state': 's2'})

        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Profile.objects.count(), 1)

    @patch('user_app.views.requests')
    def test_callback_token_exchange_failure(self, mock_requests):
        state = self._prime_state()
        mock_requests.post.return_value = FakeResp({}, 200)  # no access_token
        resp = self.client.get(reverse('github_callback'), {'code': 'abc', 'state': state})
        self.assertIn('error=token_exchange_failed', resp['Location'])
        self.assertFalse(User.objects.exists())

    def test_logout_returns_204(self):
        resp = self.client.post(reverse('logout'))
        self.assertEqual(resp.status_code, 204)

    def test_csrf_endpoint_returns_token(self):
        resp = self.client.get(reverse('csrf'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('csrfToken', resp.json())


@override_settings(GITHUB_REQUIRED_ORG='', FRONTEND_URL='http://localhost:5173')
class OAuthNoOrgRestrictionTests(TestCase):
    @patch('user_app.views.requests')
    def test_any_github_user_allowed_when_org_blank(self, mock_requests):
        session = self.client.session
        session['oauth_state'] = 'st'
        session.save()
        mock_requests.post.return_value = FakeResp({'access_token': 'gho_test'})
        # No membership call should happen; only /user is needed.
        mock_requests.get.side_effect = _get_router(member=False)

        resp = self.client.get(reverse('github_callback'), {'code': 'a', 'state': 'st'})
        self.assertEqual(resp['Location'], 'http://localhost:5173/dashboard')
        self.assertTrue(Profile.objects.filter(github_id=GH_USER['id']).exists())
