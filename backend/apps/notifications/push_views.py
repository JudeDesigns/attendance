from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db import IntegrityError
import logging

from .push_models import PushSubscription, PushNotificationSettings, PushNotificationLog
from .push_serializers import (
    PushSubscriptionSerializer, 
    PushSubscriptionCreateSerializer,
    PushNotificationSettingsSerializer,
    PushNotificationLogSerializer,
    SendPushNotificationSerializer
)
from .push_service import push_service

logger = logging.getLogger(__name__)


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing push subscriptions"""
    
    serializer_class = PushSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return subscriptions for the current user"""
        return PushSubscription.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """Use different serializer for creation"""
        if self.action == 'create':
            return PushSubscriptionCreateSerializer
        return PushSubscriptionSerializer
    
    def create(self, request, *args, **kwargs):
        """Create or update push subscription"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            # Check if subscription already exists for this user and endpoint
            endpoint = serializer.validated_data.get('endpoint')
            if not endpoint and 'subscription' in serializer.validated_data:
                endpoint = serializer.validated_data['subscription']['endpoint']
            
            existing_subscription = PushSubscription.objects.filter(
                user=request.user,
                endpoint=endpoint
            ).first()
            
            if existing_subscription:
                # Update existing subscription
                for key, value in serializer.validated_data.items():
                    if key != 'subscription':  # Skip the subscription object
                        setattr(existing_subscription, key, value)
                
                # Handle subscription object
                if 'subscription' in serializer.validated_data:
                    sub_data = serializer.validated_data['subscription']
                    existing_subscription.p256dh_key = sub_data['keys']['p256dh']
                    existing_subscription.auth_key = sub_data['keys']['auth']
                
                existing_subscription.is_active = True
                existing_subscription.failure_count = 0
                existing_subscription.save()
                
                serializer = PushSubscriptionSerializer(existing_subscription)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                # Create new subscription
                instance = serializer.save()
                return Response(
                    PushSubscriptionSerializer(instance).data, 
                    status=status.HTTP_201_CREATED
                )
                
        except IntegrityError as e:
            logger.error(f"IntegrityError creating push subscription: {e}")
            return Response(
                {'error': 'Subscription already exists for this user and endpoint'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error creating push subscription: {e}")
            return Response(
                {'error': 'Failed to create push subscription'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """Deactivate subscription instead of deleting"""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        
        return Response(
            {'message': 'Push subscription deactivated'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['post'])
    def unsubscribe_all(self, request):
        """Deactivate all subscriptions for the current user"""
        count = PushSubscription.objects.filter(
            user=request.user,
            is_active=True
        ).update(is_active=False)
        
        return Response(
            {'message': f'Deactivated {count} push subscriptions'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['post'])
    def test_notification(self, request):
        """Send a test push notification to the current user"""
        if not request.user.push_subscriptions.filter(is_active=True).exists():
            return Response(
                {'error': 'No active push subscriptions found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = push_service.send_to_user(
            user=request.user,
            title='WorkSync Test Notification',
            body='This is a test push notification from WorkSync!',
            icon='/favicon.ico',
            tag='test-notification'
        )
        
        return Response({
            'message': 'Test notification sent',
            'results': results
        }, status=status.HTTP_200_OK)


class PushNotificationSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for managing push notification settings"""
    
    serializer_class = PushNotificationSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return settings for the current user"""
        return PushNotificationSettings.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Get or create settings for the current user"""
        settings_obj, created = PushNotificationSettings.objects.get_or_create(
            user=self.request.user
        )
        return settings_obj
    
    def list(self, request, *args, **kwargs):
        """Return settings for the current user"""
        settings_obj = self.get_object()
        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """Update settings (treat create as update)"""
        return self.update(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Update push notification settings"""
        settings_obj = self.get_object()
        serializer = self.get_serializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)


class PushNotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing push notification logs"""
    
    serializer_class = PushNotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return logs for the current user's subscriptions"""
        return PushNotificationLog.objects.filter(
            subscription__user=self.request.user
        ).order_by('-created_at')


class AdminPushNotificationViewSet(viewsets.ViewSet):
    """Admin-only viewset for sending push notifications"""

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def list(self, request):
        """List available admin actions"""
        return Response({
            'available_actions': [
                'send_notification',
                'stats',
                'cleanup_expired'
            ],
            'endpoints': {
                'send_notification': '/api/v1/notifications/push/admin/send_notification/',
                'stats': '/api/v1/notifications/push/admin/stats/',
                'cleanup_expired': '/api/v1/notifications/push/admin/cleanup_expired/'
            }
        })
    
    @action(detail=False, methods=['post'])
    def send_notification(self, request):
        """Send push notification to specified users or all users"""
        serializer = SendPushNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        user_ids = data.get('user_ids')
        
        try:
            if user_ids:
                # Send to specific users
                results = push_service.send_to_users(
                    user_ids=user_ids,
                    title=data['title'],
                    body=data['body'],
                    icon=data.get('icon'),
                    badge=data.get('badge'),
                    tag=data.get('tag'),
                    data=data.get('data'),
                    require_interaction=data.get('require_interaction', False),
                    silent=data.get('silent', False)
                )
            else:
                # Send to all users
                results = push_service.send_to_all_users(
                    title=data['title'],
                    body=data['body'],
                    icon=data.get('icon'),
                    badge=data.get('badge'),
                    tag=data.get('tag'),
                    data=data.get('data'),
                    require_interaction=data.get('require_interaction', False),
                    silent=data.get('silent', False)
                )
            
            return Response({
                'message': 'Push notifications sent',
                'results': results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error sending push notifications: {e}")
            return Response(
                {'error': 'Failed to send push notifications'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get push notification statistics"""
        stats = push_service.get_subscription_stats()
        
        # Add recent activity stats
        from django.utils import timezone
        from datetime import timedelta
        
        last_24h = timezone.now() - timedelta(hours=24)
        last_7d = timezone.now() - timedelta(days=7)
        
        stats.update({
            'notifications_sent_24h': PushNotificationLog.objects.filter(
                status='SENT',
                sent_at__gte=last_24h
            ).count(),
            'notifications_sent_7d': PushNotificationLog.objects.filter(
                status='SENT',
                sent_at__gte=last_7d
            ).count(),
            'failed_notifications_24h': PushNotificationLog.objects.filter(
                status='FAILED',
                created_at__gte=last_24h
            ).count(),
        })
        
        return Response(stats)
    
    @action(detail=False, methods=['post'])
    def cleanup_expired(self, request):
        """Clean up expired push subscriptions"""
        count = push_service.cleanup_expired_subscriptions()
        return Response({
            'message': f'Cleaned up {count} expired subscriptions'
        })
