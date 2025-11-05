import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import json


class PushSubscription(models.Model):
    """
    Model to store Web Push API subscriptions for users
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    
    # Push subscription data
    endpoint = models.URLField(max_length=500, help_text="Push service endpoint URL")
    p256dh_key = models.TextField(help_text="P256DH public key for encryption")
    auth_key = models.TextField(help_text="Auth secret for encryption")
    
    # Browser/device information
    user_agent = models.TextField(blank=True, help_text="Browser user agent string")
    browser_name = models.CharField(max_length=100, blank=True)
    device_type = models.CharField(max_length=50, blank=True)  # desktop, mobile, tablet
    
    # Subscription metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    # Failure tracking
    failure_count = models.IntegerField(default=0)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    last_failure_reason = models.TextField(blank=True)
    
    class Meta:
        db_table = 'push_subscriptions'
        unique_together = ['user', 'endpoint']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['endpoint']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Push subscription for {self.user.username} ({self.browser_name})"
    
    @property
    def subscription_info(self):
        """Return subscription info in the format expected by pywebpush"""
        return {
            "endpoint": self.endpoint,
            "keys": {
                "p256dh": self.p256dh_key,
                "auth": self.auth_key
            }
        }
    
    def mark_as_used(self):
        """Mark subscription as recently used"""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])
    
    def mark_as_failed(self, reason=""):
        """Mark subscription as failed and increment failure count"""
        self.failure_count += 1
        self.last_failure_at = timezone.now()
        self.last_failure_reason = reason
        
        # Deactivate subscription after 5 consecutive failures
        if self.failure_count >= 5:
            self.is_active = False
        
        self.save(update_fields=['failure_count', 'last_failure_at', 'last_failure_reason', 'is_active'])
    
    def reset_failures(self):
        """Reset failure count after successful delivery"""
        if self.failure_count > 0:
            self.failure_count = 0
            self.last_failure_at = None
            self.last_failure_reason = ""
            self.save(update_fields=['failure_count', 'last_failure_at', 'last_failure_reason'])


class PushNotificationLog(models.Model):
    """
    Log of push notifications sent to track delivery status
    """
    DELIVERY_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
        ('EXPIRED', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(PushSubscription, on_delete=models.CASCADE, related_name='notification_logs')
    
    # Notification content
    title = models.CharField(max_length=200)
    body = models.TextField()
    icon = models.URLField(blank=True)
    badge = models.URLField(blank=True)
    tag = models.CharField(max_length=100, blank=True)
    
    # Delivery tracking
    status = models.CharField(max_length=20, choices=DELIVERY_STATUS_CHOICES, default='PENDING')
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    error_message = models.TextField(blank=True)
    http_status_code = models.IntegerField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Link to original notification
    notification_log = models.ForeignKey(
        'notifications.NotificationLog', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='push_logs'
    )
    
    class Meta:
        db_table = 'push_notification_logs'
        indexes = [
            models.Index(fields=['subscription', 'status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status', 'sent_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Push notification to {self.subscription.user.username}: {self.title}"
    
    def mark_as_sent(self):
        """Mark notification as sent"""
        self.status = 'SENT'
        self.sent_at = timezone.now()
        self.save(update_fields=['status', 'sent_at'])
    
    def mark_as_delivered(self):
        """Mark notification as delivered"""
        self.status = 'DELIVERED'
        self.delivered_at = timezone.now()
        self.save(update_fields=['status', 'delivered_at'])
    
    def mark_as_failed(self, error_message="", http_status_code=None):
        """Mark notification as failed"""
        self.status = 'FAILED'
        self.error_message = error_message
        self.http_status_code = http_status_code
        self.save(update_fields=['status', 'error_message', 'http_status_code'])


class PushNotificationSettings(models.Model):
    """
    User preferences for push notifications
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='push_notification_settings')
    
    # Notification preferences
    enabled = models.BooleanField(default=True)
    break_reminders = models.BooleanField(default=True)
    clock_in_out_confirmations = models.BooleanField(default=True)
    shift_reminders = models.BooleanField(default=True)
    admin_notifications = models.BooleanField(default=True)
    
    # Quiet hours
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'push_notification_settings'
    
    def __str__(self):
        return f"Push settings for {self.user.username}"
    
    def is_in_quiet_hours(self):
        """Check if current time is within quiet hours"""
        if not self.quiet_hours_enabled or not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        
        current_time = timezone.now().time()
        
        if self.quiet_hours_start <= self.quiet_hours_end:
            # Same day quiet hours (e.g., 22:00 to 06:00 next day)
            return self.quiet_hours_start <= current_time <= self.quiet_hours_end
        else:
            # Overnight quiet hours (e.g., 22:00 to 06:00 next day)
            return current_time >= self.quiet_hours_start or current_time <= self.quiet_hours_end
