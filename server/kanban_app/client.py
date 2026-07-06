"""Thin client for the Issue Kanban app's server-to-server bridge.

The Kanban app (a separate PHP deployment) exposes `/api/bridge.php`, authorized
by a shared secret. This module is the only place the Dashboard talks to it, so
fleshing out the integration later means adding methods here + fields on the
bridge — not touching views.
"""
import requests
from django.conf import settings

HTTP_TIMEOUT = 10


class KanbanBridgeError(Exception):
    """Raised when the bridge is unconfigured or unreachable."""


def _bridge_get(params=None):
    url = settings.KANBAN_BRIDGE_URL
    secret = settings.KANBAN_BRIDGE_SECRET
    if not url or not secret:
        raise KanbanBridgeError(
            'Kanban bridge not configured — set KANBAN_BRIDGE_URL and KANBAN_BRIDGE_SECRET.'
        )
    try:
        resp = requests.get(
            url,
            headers={'X-Bridge-Secret': secret},
            params=params or {},
            timeout=HTTP_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise KanbanBridgeError(f'Could not reach the Kanban bridge: {exc}') from exc

    if resp.status_code == 401:
        raise KanbanBridgeError('Bridge rejected the shared secret (401).')
    if not resp.ok:
        raise KanbanBridgeError(f'Bridge returned HTTP {resp.status_code}.')
    try:
        return resp.json()
    except ValueError as exc:
        raise KanbanBridgeError('Bridge returned a non-JSON response.') from exc


def ping():
    """Prove the channel is up (no GitHub call on the bridge side)."""
    return _bridge_get()


def board_summary():
    """Ask the bridge for a small live board summary (needs the service token)."""
    return _bridge_get({'include': 'summary'})
