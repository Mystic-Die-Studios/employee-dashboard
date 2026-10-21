"""Isolated SQLite settings: no production database or live GitHub writes.

Run: python manage.py test --settings=employeedash_server.test_settings
"""
import os

# Set before importing settings (dotenv never overrides these values).
os.environ['REVIEW_GITHUB_TOKEN'] = ''
os.environ['REVIEW_GITHUB_REPOSITORY'] = ''
os.environ['DJANGO_KEY'] = 'isolated-test-key-not-for-deployment-at-least-32-characters'

from .settings import *  # noqa: F403,E402

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
DEBUG = True
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
AUTH_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
