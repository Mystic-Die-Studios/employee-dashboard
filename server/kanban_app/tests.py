"""Tests for the Kanban bridge integration. The HTTP call to the Kanban app is
mocked, so these run offline. Run with:

    DB_ENGINE=sqlite python manage.py test kanban_app
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

User = get_user_model()


class FakeResp:
    def __init__(self, json_data=None, status_code=200, raise_json=False):
        self._json = {} if json_data is None else json_data
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self._raise_json = raise_json

    def json(self):
        if self._raise_json:
            raise ValueError('not json')
        return self._json


BRIDGE = dict(
    KANBAN_BRIDGE_URL='http://kanban.test/api/bridge.php',
    KANBAN_BRIDGE_SECRET='s3cret',
)


class KanbanStatusTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='octocat', password='x')

    def _login(self):
        self.client.force_login(self.user)

    def test_requires_auth(self):
        # DRF's IsAuthenticated + SessionAuthentication answers anonymous with 403.
        resp = self.client.get(reverse('kanban_status'))
        self.assertEqual(resp.status_code, 403)

    @override_settings(**BRIDGE)
    @patch('kanban_app.client.requests')
    def test_ping_connected(self, mock_requests):
        self._login()
        mock_requests.get.return_value = FakeResp(
            {'ok': True, 'service': 'issue-kanban-bridge', 'github_configured': False}
        )
        resp = self.client.get(reverse('kanban_status'))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['connected'])
        self.assertEqual(resp.json()['bridge']['service'], 'issue-kanban-bridge')
        # Secret is sent as a header; summary not requested by default.
        _, kwargs = mock_requests.get.call_args
        self.assertEqual(kwargs['headers']['X-Bridge-Secret'], 's3cret')
        self.assertEqual(kwargs['params'], {})

    @override_settings(**BRIDGE)
    @patch('kanban_app.client.requests')
    def test_summary_requests_include_param(self, mock_requests):
        self._login()
        mock_requests.get.return_value = FakeResp(
            {'ok': True, 'board': {'title': 'Reconnection', 'itemCount': 42}}
        )
        resp = self.client.get(reverse('kanban_status'), {'summary': '1'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['bridge']['board']['itemCount'], 42)
        _, kwargs = mock_requests.get.call_args
        self.assertEqual(kwargs['params'], {'include': 'summary'})

    @override_settings(KANBAN_BRIDGE_URL='', KANBAN_BRIDGE_SECRET='')
    def test_unconfigured_returns_503(self):
        self._login()
        resp = self.client.get(reverse('kanban_status'))
        self.assertEqual(resp.status_code, 503)
        self.assertFalse(resp.json()['connected'])
        self.assertIn('not configured', resp.json()['error'])

    @override_settings(**BRIDGE)
    @patch('kanban_app.client.requests')
    def test_bad_secret_returns_503(self, mock_requests):
        self._login()
        mock_requests.get.return_value = FakeResp({'error': 'Invalid'}, status_code=401)
        resp = self.client.get(reverse('kanban_status'))
        self.assertEqual(resp.status_code, 503)
        self.assertIn('401', resp.json()['error'])

    @override_settings(**BRIDGE)
    @patch('kanban_app.client.requests')
    def test_network_error_returns_503(self, mock_requests):
        import requests as real_requests
        self._login()
        mock_requests.RequestException = real_requests.RequestException
        mock_requests.get.side_effect = real_requests.RequestException('boom')
        resp = self.client.get(reverse('kanban_status'))
        self.assertEqual(resp.status_code, 503)
        self.assertIn('reach the Kanban bridge', resp.json()['error'])
