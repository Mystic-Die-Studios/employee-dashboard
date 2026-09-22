"""Passenger entrypoint for cPanel's "Setup Python App".

cPanel points Passenger at this file and expects a module-level `application`.
It must sit in the Application Root alongside manage.py.
"""
import os
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'employeedash_server.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
