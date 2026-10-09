from django.test import Client, TestCase
from django.urls import reverse

from .auth_utils import create_access_token, create_refresh_token
from .models import User


class CookieSecurityTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username='artist', email='artist@example.com', password='test-pass',
        )
        self.admin = User.objects.create_user(
            username='lead', email='lead@example.com', password='test-pass', role='admin',
        )
        self.payload = {
            'email': 'new-admin@example.com', 'username': 'new-admin',
            'password': 'Unique-copper-lantern-984!',
        }

    def sign_in(self, user, client=None):
        client = client or self.client
        client.cookies['access_token'] = create_access_token(user)
        client.cookies['refresh_token'] = create_refresh_token(user)
        return client

    def test_anonymous_cannot_create_an_admin(self):
        response = self.client.post(reverse('create_admin_user'), self.payload)
        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.filter(email=self.payload['email']).exists())

    def test_employee_cannot_create_an_admin(self):
        self.sign_in(self.employee)
        self.assertEqual(self.client.post(reverse('create_admin_user'), self.payload).status_code, 403)

    def test_admin_can_provision_without_overwriting_session(self):
        self.sign_in(self.admin)
        response = self.client.post(reverse('create_admin_user'), self.payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(email=self.payload['email']).role, 'admin')
        self.assertNotIn('access_token', response.cookies)
        self.assertEqual(self.client.get(reverse('user_info')).json()['id'], self.admin.id)

    def test_admin_password_is_validated(self):
        self.sign_in(self.admin)
        response = self.client.post(reverse('create_admin_user'), {**self.payload, 'password': '123'})
        self.assertEqual(response.status_code, 400)

    def test_csrf_required_even_for_drf_logout(self):
        client = self.sign_in(self.employee, Client(enforce_csrf_checks=True))
        self.assertEqual(client.post(reverse('logout')).status_code, 403)
        token = client.get(reverse('csrf_token')).json()['csrfToken']
        response = client.post(reverse('logout'), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies['access_token'].value, '')

    def test_login_and_refresh_require_csrf(self):
        client = self.sign_in(self.admin, Client(enforce_csrf_checks=True))
        self.assertEqual(client.post(reverse('refresh_token')).status_code, 403)
        self.assertEqual(client.post(reverse('admin_login'), {
            'email': self.admin.email, 'password': 'test-pass',
        }).status_code, 403)
        token = client.get(reverse('csrf_token')).json()['csrfToken']
        response = client.post(reverse('refresh_token'), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('access_token', response.json())
        self.assertTrue(response.cookies['access_token']['httponly'])

    def test_unsafe_workspace_requests_require_csrf(self):
        client = self.sign_in(self.employee, Client(enforce_csrf_checks=True))
        self.assertEqual(client.post('/api/v1/workspace/documents/', {'title': 'Page'}).status_code, 403)
        token = client.get(reverse('csrf_token')).json()['csrfToken']
        response = client.post('/api/v1/workspace/documents/', {'title': 'Page'}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)

    def test_cross_origin_mutations_are_rejected(self):
        client = self.sign_in(self.employee, Client(enforce_csrf_checks=True))
        token = client.get(reverse('csrf_token')).json()['csrfToken']
        response = client.post(reverse('logout'), HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN='https://attacker.example')
        self.assertEqual(response.status_code, 403)

    def test_disabled_user_cannot_refresh_or_login(self):
        self.sign_in(self.admin)
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        self.assertEqual(self.client.post(reverse('refresh_token')).status_code, 401)
        self.assertEqual(self.client.get(reverse('user_info')).status_code, 401)
        self.assertEqual(self.client.post(reverse('admin_login'), {
            'email': self.admin.email, 'password': 'test-pass',
        }).status_code, 401)

    def test_superuser_can_provision_and_has_admin_ui_role(self):
        superuser = User.objects.create_superuser(
            username='owner', email='owner@example.com', password='test-pass',
        )
        self.sign_in(superuser)
        self.assertEqual(self.client.get(reverse('user_info')).json()['role'], 'admin')
        self.assertEqual(self.client.post(reverse('create_admin_user'), self.payload).status_code, 201)
