import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class WebhookEndpoint(models.Model):
    """Webhook endpoint configuration"""
    
    EVENT_TYPES = [
        ('employee.clock_in', 'Employee Clock In'),
        ('employee.clock_out', 'Employee Clock Out'),
        ('employee.break_start', 'Employee Break Start'),
        ('employee.break_end', 'Employee Break End'),
        ('leave.request_created', 'Leave Request Created'),
        ('leave.request_approved', 'Leave Request Approved'),
        ('leave.request_rejected', 'Leave Request Rejected'),
        ('shift.created', 'Shift Created'),
        ('shift.updated', 'Shift Updated'),
        ('shift.deleted', 'Shift Deleted'),
        ('employee.created', 'Employee Created'),
        ('employee.updated', 'Employee Updated'),
        ('employee.deactivated', 'Employee Deactivated'),
        ('attendance.late_arrival', 'Late Arrival Alert'),
        ('attendance.no_show', 'No Show Alert'),
        ('system.backup_completed', 'System Backup Completed'),
        ('system.error_occurred', 'System Error Occurred'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=500)
    description = models.TextField(blank=True)
    
    # Event configuration
    event_types = models.JSONField(default=list, help_text="List of event types to subscribe to")
    
    # Security
    secret_key = models.CharField(max_length=255, blank=True, help_text="Secret key for webhook signature")
    
    # Configuration
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # Headers and authentication
    headers = models.JSONField(default=dict, blank=True, help_text="Additional headers to send")
    auth_type = models.CharField(max_length=50, blank=True, choices=[
        ('', 'None'),
        ('bearer', 'Bearer Token'),
        ('basic', 'Basic Auth'),
        ('api_key', 'API Key'),
    ])
    auth_credentials = models.JSONField(default=dict, blank=True, help_text="Authentication credentials")
    
    # Retry configuration
    max_retries = models.IntegerField(default=3)
    retry_delay = models.IntegerField(default=60, help_text="Delay between retries in seconds")
    timeout = models.IntegerField(default=30, help_text="Request timeout in seconds")
    
    # Filtering
    filter_conditions = models.JSONField(default=dict, blank=True, help_text="Conditions to filter events")
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_webhooks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_triggered = models.DateTimeField(null=True, blank=True)
    
    # Statistics
    total_deliveries = models.IntegerField(default=0)
    successful_deliveries = models.IntegerField(default=0)
    failed_deliveries = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'webhook_mgmt_endpoints'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.url})"
    
    @property
    def success_rate(self):
        if self.total_deliveries == 0:
            return 0
        return (self.successful_deliveries / self.total_deliveries) * 100


class WebhookDelivery(models.Model):
    """Record of webhook delivery attempts"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('RETRYING', 'Retrying'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name='deliveries')
    
    # Event details
    event_type = models.CharField(max_length=100)
    event_id = models.UUIDField()
    payload = models.JSONField()
    
    # Delivery details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    http_status = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    response_headers = models.JSONField(default=dict, blank=True)
    
    # Timing
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Retry information
    attempt_count = models.IntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    
    # Error details
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'webhook_mgmt_deliveries'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['endpoint', 'status']),
            models.Index(fields=['event_type', 'created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]
    
    def __str__(self):
        return f"{self.endpoint.name} - {self.event_type} ({self.status})"


class WebhookEvent(models.Model):
    """Log of all webhook events generated"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)  # employee, leave_request, shift, etc.
    resource_id = models.UUIDField()
    
    # Event data
    data = models.JSONField()
    metadata = models.JSONField(default=dict, blank=True)
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Delivery tracking
    endpoints_notified = models.IntegerField(default=0)
    successful_deliveries = models.IntegerField(default=0)
    failed_deliveries = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'webhook_mgmt_events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.resource_type}:{self.resource_id}"


class WebhookTemplate(models.Model):
    """Predefined webhook templates for common integrations"""
    
    INTEGRATION_TYPES = [
        ('slack', 'Slack'),
        ('teams', 'Microsoft Teams'),
        ('discord', 'Discord'),
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('custom', 'Custom'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField()
    integration_type = models.CharField(max_length=50, choices=INTEGRATION_TYPES)
    
    # Template configuration
    url_template = models.CharField(max_length=500, blank=True)
    headers_template = models.JSONField(default=dict, blank=True)
    payload_template = models.JSONField(default=dict)
    
    # Default settings
    default_event_types = models.JSONField(default=list)
    default_auth_type = models.CharField(max_length=50, blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'webhook_mgmt_templates'
        ordering = ['integration_type', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.integration_type})"
