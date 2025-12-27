"""
URL configuration for notifications
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationLogViewSet, NotificationTemplateViewSet,
    WebhookSubscriptionViewSet, WebhookDeliveryViewSet,
    NotificationManagementViewSet, EmailConfigurationViewSet
)
from . import push_views

app_name = 'notifications'

router = DefaultRouter()
router.register(r'logs', NotificationLogViewSet, basename='notificationlog')
router.register(r'templates', NotificationTemplateViewSet, basename='notificationtemplate')
router.register(r'webhooks', WebhookSubscriptionViewSet, basename='webhooksubscription')
router.register(r'webhook-deliveries', WebhookDeliveryViewSet, basename='webhookdelivery')
router.register(r'management', NotificationManagementViewSet, basename='notificationmanagement')
router.register(r'email-config', EmailConfigurationViewSet, basename='emailconfiguration')

# Push notification routes
router.register(r'push/subscriptions', push_views.PushSubscriptionViewSet, basename='push-subscriptions')
router.register(r'push/settings', push_views.PushNotificationSettingsViewSet, basename='push-settings')
router.register(r'push/logs', push_views.PushNotificationLogViewSet, basename='push-logs')
router.register(r'push/admin', push_views.AdminPushNotificationViewSet, basename='push-admin')

urlpatterns = [
    path('', include(router.urls)),
]
