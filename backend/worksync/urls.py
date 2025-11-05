"""
Simple URL configuration for WorkSync project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
import redis
from decouple import config


def health_check(request):
    """Health check endpoint for monitoring"""
    try:
        # Check database
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    try:
        # Check cache/Redis
        cache.set('health_check', 'ok', 30)
        cache_status = "healthy" if cache.get('health_check') == 'ok' else "unhealthy"
    except Exception as e:
        cache_status = f"unhealthy: {str(e)}"

    try:
        # Check Redis directly
        r = redis.Redis.from_url(config('REDIS_URL', default='redis://127.0.0.1:6379/0'))
        r.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"

    status = {
        'status': 'healthy' if all(
            s == 'healthy' for s in [db_status, cache_status, redis_status]
        ) else 'unhealthy',
        'database': db_status,
        'cache': cache_status,
        'redis': redis_status,
        'timestamp': request.META.get('HTTP_DATE', 'unknown')
    }

    return JsonResponse(status)

urlpatterns = [
    # Health check
    path('health/', health_check, name='health_check'),

    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API endpoints
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/', include('apps.employees.urls')),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    path('api/v1/scheduling/', include('apps.scheduling.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/webhooks/', include('apps.webhooks.urls')),

]
