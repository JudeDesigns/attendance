import json
import logging
import tempfile
import os
from typing import List, Dict, Optional, Union
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from pywebpush import webpush, WebPushException
from py_vapid import Vapid02 as Vapid
from .push_models import PushSubscription, PushNotificationLog, PushNotificationSettings

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending Web Push notifications"""
    
    def __init__(self):
        self.vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
        self.vapid_public_key = getattr(settings, 'VAPID_PUBLIC_KEY', None)
        self.vapid_claims = getattr(settings, 'VAPID_CLAIMS', {})
        self.vapid_key_file = None
        
        if not self.vapid_private_key or not self.vapid_public_key:
            logger.warning("VAPID keys not configured. Push notifications will not work.")
            self.vapid = None
        else:
            try:
                # Write key to temporary file (pywebpush works better with file paths)
                fd, self.vapid_key_file = tempfile.mkstemp(suffix='.pem', text=True)
                with os.fdopen(fd, 'w') as f:
                    f.write(self.vapid_private_key.strip())
                logger.info(f"VAPID key written to temp file: {self.vapid_key_file}")
            except Exception as e:
                logger.error(f"Failed to write VAPID key to file: {e}")
                self.vapid_key_file = None
    
    def send_to_user(
        self, 
        user: User, 
        title: str, 
        body: str, 
        icon: str = None,
        badge: str = None,
        tag: str = None,
        data: Dict = None,
        require_interaction: bool = False,
        silent: bool = False,
        notification_log_id: str = None
    ) -> Dict[str, int]:
        """
        Send push notification to all active subscriptions for a user
        
        Returns:
            Dict with counts: {'sent': 0, 'failed': 0, 'skipped': 0}
        """
        if not self.vapid_key_file:
            logger.error("VAPID key file not available")
            return {'sent': 0, 'failed': 0, 'skipped': 0}
        
        # Check user's notification preferences
        try:
            settings_obj = user.push_notification_settings
            if not settings_obj.enabled:
                logger.info(f"Push notifications disabled for user {user.username}")
                return {'sent': 0, 'failed': 0, 'skipped': 1}
            
            # Check quiet hours
            if settings_obj.is_in_quiet_hours():
                logger.info(f"User {user.username} is in quiet hours, skipping notification")
                return {'sent': 0, 'failed': 0, 'skipped': 1}
                
        except PushNotificationSettings.DoesNotExist:
            # Create default settings if they don't exist
            PushNotificationSettings.objects.create(user=user)
        
        # Get active subscriptions for user
        subscriptions = PushSubscription.objects.filter(
            user=user,
            is_active=True
        )
        
        if not subscriptions.exists():
            logger.info(f"No active push subscriptions for user {user.username}")
            return {'sent': 0, 'failed': 0, 'skipped': 1}
        
        results = {'sent': 0, 'failed': 0, 'skipped': 0}
        
        for subscription in subscriptions:
            result = self._send_to_subscription(
                subscription=subscription,
                title=title,
                body=body,
                icon=icon,
                badge=badge,
                tag=tag,
                data=data,
                require_interaction=require_interaction,
                silent=silent,
                notification_log_id=notification_log_id
            )
            results[result] += 1
        
        return results
    
    def send_to_users(
        self,
        user_ids: List[int],
        title: str,
        body: str,
        **kwargs
    ) -> Dict[str, int]:
        """Send push notification to multiple users"""
        total_results = {'sent': 0, 'failed': 0, 'skipped': 0}
        
        users = User.objects.filter(id__in=user_ids)
        
        for user in users:
            results = self.send_to_user(user, title, body, **kwargs)
            for key, value in results.items():
                total_results[key] += value
        
        return total_results
    
    def send_to_all_users(self, title: str, body: str, **kwargs) -> Dict[str, int]:
        """Send push notification to all users with active subscriptions"""
        user_ids = PushSubscription.objects.filter(
            is_active=True
        ).values_list('user_id', flat=True).distinct()
        
        return self.send_to_users(list(user_ids), title, body, **kwargs)
    
    def _send_to_subscription(
        self,
        subscription: PushSubscription,
        title: str,
        body: str,
        icon: str = None,
        badge: str = None,
        tag: str = None,
        data: Dict = None,
        require_interaction: bool = False,
        silent: bool = False,
        notification_log_id: str = None
    ) -> str:
        """
        Send push notification to a specific subscription
        
        Returns:
            'sent', 'failed', or 'skipped'
        """
        # Create notification log entry
        push_log = PushNotificationLog.objects.create(
            subscription=subscription,
            title=title,
            body=body,
            icon=icon or '/favicon.ico',
            badge=badge or '/favicon.ico',
            tag=tag or f'notification-{timezone.now().timestamp()}',
            notification_log_id=notification_log_id
        )
        
        try:
            # Prepare notification payload
            notification_data = {
                'title': title,
                'body': body,
                'icon': icon or '/favicon.ico',
                'badge': badge or '/favicon.ico',
                'tag': tag or f'notification-{timezone.now().timestamp()}',
                'requireInteraction': require_interaction,
                'silent': silent,
                'data': data or {},
                'timestamp': int(timezone.now().timestamp() * 1000),
                'actions': [
                    {
                        'action': 'view',
                        'title': 'View',
                        'icon': '/favicon.ico'
                    },
                    {
                        'action': 'dismiss',
                        'title': 'Dismiss',
                        'icon': '/favicon.ico'
                    }
                ]
            }
            
            # Send push notification using pywebpush with file path
            response = webpush(
                subscription_info=subscription.subscription_info,
                data=json.dumps(notification_data),
                vapid_private_key=self.vapid_key_file,  # Use file path
                vapid_claims=self.vapid_claims
            )
            
            # Mark as sent
            push_log.mark_as_sent()
            subscription.mark_as_used()
            subscription.reset_failures()
            
            logger.info(f"Push notification sent to {subscription.user.username} ({subscription.browser_name})")
            return 'sent'
            
        except WebPushException as e:
            error_message = str(e)
            http_status = getattr(e, 'response', {}).get('status_code', None) if hasattr(e, 'response') else None
            
            logger.error(f"WebPush error for {subscription.user.username}: {error_message}")
            
            # Mark as failed
            push_log.mark_as_failed(error_message, http_status)
            subscription.mark_as_failed(error_message)
            
            # Handle specific error cases
            if http_status in [410, 413]:  # Gone or Payload Too Large
                logger.info(f"Deactivating subscription due to HTTP {http_status}")
                subscription.is_active = False
                subscription.save()
            
            return 'failed'
            
        except Exception as e:
            error_message = f"Unexpected error: {str(e)}"
            logger.error(f"Unexpected error sending push notification: {error_message}")
            
            push_log.mark_as_failed(error_message)
            subscription.mark_as_failed(error_message)
            
            return 'failed'
    
    def cleanup_expired_subscriptions(self) -> int:
        """Remove subscriptions that have failed too many times"""
        expired_count = PushSubscription.objects.filter(
            is_active=False,
            failure_count__gte=5
        ).count()
        
        PushSubscription.objects.filter(
            is_active=False,
            failure_count__gte=5
        ).delete()
        
        logger.info(f"Cleaned up {expired_count} expired push subscriptions")
        return expired_count
    
    def get_subscription_stats(self) -> Dict[str, int]:
        """Get statistics about push subscriptions"""
        return {
            'total_subscriptions': PushSubscription.objects.count(),
            'active_subscriptions': PushSubscription.objects.filter(is_active=True).count(),
            'inactive_subscriptions': PushSubscription.objects.filter(is_active=False).count(),
            'unique_users': PushSubscription.objects.values('user').distinct().count(),
        }


# Global instance
push_service = PushNotificationService()
