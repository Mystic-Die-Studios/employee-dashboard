from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import client


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def kanban_status(request):
    """Report whether the Dashboard can talk to the Kanban bridge.

    `?summary=1` also asks the bridge for a live board summary (requires the
    service token configured on the Kanban side).
    """
    want_summary = request.query_params.get('summary') in ('1', 'true', 'yes')
    try:
        data = client.board_summary() if want_summary else client.ping()
    except client.KanbanBridgeError as exc:
        return Response(
            {'connected': False, 'error': str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({'connected': True, 'bridge': data})
