"""
WebSocket routing configuration for WorkSync
"""
from django.urls import re_path
from apps.notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
    re_path(r'ws/dashboard/$', NotificationConsumer.as_asgi()),
]
