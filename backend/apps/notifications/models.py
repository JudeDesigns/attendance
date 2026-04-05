import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from apps.employees.models import Employee

# Import push notification models
from .push_models import PushSubscription, PushNotificationLog, PushNotificationSettings


class WebhookSubscription(models.Model):
    """Store webhook subscriptions for external services"""
    EVENT_TYPE_CHOICES = [
        ('overtime.threshold.reached', 'Overtime Threshold Reached'),
        ('attendance.violation', 'Attendance Violation'),
        ('employee.clocked_in', 'Employee Clocked In'),
        ('employee.clocked_out', 'Employee Clocked Out'),
        ('break.started', 'Break Started'),
        ('break.ended', 'Break Ended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    target_url = models.URLField(help_text="URL to send webhook notifications")
    is_active = models.BooleanField(default=True)

    # Metadata
    created_by_app = models.CharField(max_length=50, default='unknown')
    secret_key = models.CharField(max_length=100, blank=True, help_text="Optional secret for webhook verification")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_event_type_display()} -> {self.target_url}"

    class Meta:
        db_table = 'webhook_subscriptions'
        unique_together = ['event_type', 'target_url']


class WebhookDelivery(models.Model):
    """Track webhook delivery attempts"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('RETRYING', 'Retrying'),
    ]

    subscription = models.ForeignKey(WebhookSubscription, on_delete=models.CASCADE, related_name='deliveries')
    event_type = models.CharField(max_length=50)
    payload = models.JSONField()

    # Delivery tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    http_status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    # Retry tracking
    attempt_count = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=3)
    next_retry_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.event_type} -> {self.subscription.target_url} ({self.status})"

    @property
    def can_retry(self):
        return self.attempt_count < self.max_attempts and self.status in ['FAILED', 'RETRYING']

    class Meta:
        db_table = 'webhook_deliveries'
        ordering = ['-created_at']


class NotificationTemplate(models.Model):
    """Templates for different types of notifications"""
    NOTIFICATION_TYPE_CHOICES = [
        ('SMS', 'SMS'),
        ('EMAIL', 'Email'),
        ('WEBHOOK', 'Webhook'),
        ('PUSH', 'Push Notification'),
    ]

    name = models.CharField(max_length=100)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    event_type = models.CharField(max_length=50)

    # Template content
    subject = models.CharField(max_length=200, blank=True, help_text="For email notifications")
    message_template = models.TextField(help_text="Template with placeholders like {employee_name}")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_notification_type_display()})"

    def render_message(self, context):
        """Render message template with context variables"""
        try:
            return self.message_template.format(**context)
        except KeyError as e:
            return f"Template error: Missing variable {e}"
        except Exception as e:
            return f"Template error: {str(e)}"

    class Meta:
        db_table = 'notification_templates'


class NotificationLog(models.Model):
    """Log all sent notifications"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
        ('DELIVERED', 'Delivered'),
    ]

    recipient = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='notifications')
    template = models.ForeignKey(NotificationTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    notification_type = models.CharField(max_length=20, choices=NotificationTemplate.NOTIFICATION_TYPE_CHOICES)
    event_type = models.CharField(max_length=50)

    # Content
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    recipient_address = models.CharField(max_length=200, help_text="Email, phone number, etc.")

    # Delivery tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    external_id = models.CharField(max_length=100, blank=True, help_text="External service message ID")
    error_message = models.TextField(blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_notification_type_display()} to {self.recipient.full_name} ({self.status})"

    class Meta:
        db_table = 'notification_logs'
        ordering = ['-created_at']


class EmailConfiguration(models.Model):
    """
    Dynamic email configuration settings
    """
    EMAIL_BACKEND_CHOICES = [
        ('django.core.mail.backends.smtp.EmailBackend', 'SMTP'),
        ('django.core.mail.backends.console.EmailBackend', 'Console (Development)'),
    ]

    email_backend = models.CharField(max_length=255, choices=EMAIL_BACKEND_CHOICES, default='django.core.mail.backends.smtp.EmailBackend')
    email_host = models.CharField(max_length=255, help_text="SMTP Host (e.g., smtp.gmail.com)")
    email_port = models.IntegerField(default=587, help_text="SMTP Port (e.g., 587)")
    email_use_tls = models.BooleanField(default=True, help_text="Use TLS")
    email_host_user = models.CharField(max_length=255, help_text="SMTP Username/Email")
    email_host_password = models.CharField(max_length=255, help_text="SMTP Password")
    default_from_email = models.CharField(max_length=255, help_text="Default From Email")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Ensure only one active configuration exists
        if self.is_active:
            EmailConfiguration.objects.filter(is_active=True).exclude(id=self.id).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Email Configuration ({self.email_host})"

    class Meta:
        db_table = 'email_configurations'
        verbose_name = 'Email Configuration'
        verbose_name_plural = 'Email Configurations'



class CompanySettings(models.Model):
    """
    Singleton model for company-wide settings:
    - Overtime pay rate multipliers
    - Alert recipient emails
    """

    # Overtime rate multipliers
    regular_rate_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.00,
        help_text="Multiplier for regular hours (≤8h). Default: 1.00"
    )
    overtime_8_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.50,
        help_text="Multiplier for hours over 8 (up to 12). Default: 1.50"
    )
    overtime_12_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=2.00,
        help_text="Multiplier for hours over 12. Default: 2.00"
    )

    # Alert recipient emails
    overtime_alert_email = models.EmailField(
        blank=True, default='',
        help_text="Email address to receive overtime alerts (e.g., warehouse manager)"
    )
    stuck_clockin_alert_email = models.EmailField(
        blank=True, default='',
        help_text="Email address to receive stuck clock-in alerts"
    )
    driver_activity_alert_email = models.EmailField(
        blank=True, default='',
        help_text="Email address to receive Driver clock-in/out and break activity alerts"
    )
    missed_clockout_hours = models.DecimalField(
        max_digits=4, decimal_places=1, default=2.0,
        help_text="Hours after shift end to trigger missed clock-out alert"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Enforce singleton — only one CompanySettings row allowed
        if not self.pk and CompanySettings.objects.exists():
            existing = CompanySettings.objects.first()
            self.pk = existing.pk
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Get or create the singleton settings instance"""
        obj, created = cls.objects.get_or_create(pk=1, defaults={})
        return obj

    def __str__(self):
        return "Company Settings"

    class Meta:
        db_table = 'company_settings'
        verbose_name = 'Company Settings'
        verbose_name_plural = 'Company Settings'
