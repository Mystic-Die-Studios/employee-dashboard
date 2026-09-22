"""
URL configuration for employeedash_server project.

The API lives under /api/v1/. Everything else falls through to the built React
app, which is served from the same origin so that auth cookies stay same-site.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseNotFound

def connection_test(request):
    return JsonResponse({"connected":True})

def spa_index(request):
    """Hand the React shell to any non-API route so deep links survive a refresh.

    WhiteNoise already serves /, /assets/* and the other build output; this only
    catches client-side routes like /dashboard that have no file behind them.
    """
    index_file = settings.FRONTEND_DIST_DIR / 'index.html'
    if not index_file.is_file():
        return HttpResponseNotFound(
            'Frontend build not found. Run "npm run build" in client/ '
            'or set FRONTEND_DIST_DIR.'
        )
    response = HttpResponse(index_file.read_bytes(), content_type='text/html')
    response['Cache-Control'] = 'no-cache'
    return response

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/test/', connection_test),
    path('api/v1/user/', include('user_app.urls')),
    # Keep this last: it matches anything the routes above did not.
    re_path(r'^(?!api/|admin/|static/).*$', spa_index, name='spa_index'),
]
