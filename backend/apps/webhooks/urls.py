from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WebhookEndpointViewSet,
    WebhookDeliveryViewSet,
    WebhookEventViewSet,
    WebhookTemplateViewSet
)

router = DefaultRouter()
router.register(r'endpoints', WebhookEndpointViewSet)
router.register(r'deliveries', WebhookDeliveryViewSet)
router.register(r'events', WebhookEventViewSet)
router.register(r'templates', WebhookTemplateViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
