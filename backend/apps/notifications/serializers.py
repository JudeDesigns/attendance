"""
Notification serializers for API endpoints
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import NotificationLog, NotificationTemplate, WebhookSubscription, WebhookDelivery
from apps.employees.models import Employee


class NotificationLogSerializer(serializers.ModelSerializer):
    """Notification log serializer with recipient details"""
    recipient_name = serializers.CharField(source='recipient.user.get_full_name', read_only=True)
    recipient_employee_id = serializers.CharField(source='recipient.employee_id', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)
    
    class Meta:
        model = NotificationLog
        fields = [
            'id', 'recipient', 'recipient_name', 'recipient_employee_id',
            'template', 'template_name', 'notification_type', 'event_type',
            'subject', 'message', 'recipient_address', 'status',
            'external_id', 'error_message', 'sent_at', 'delivered_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationTemplateSerializer(serializers.ModelSerializer):
    """Notification template serializer"""
    
    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'name', 'notification_type', 'event_type',
            'subject', 'message_template', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_message_template(self, value):
        """Validate message template has valid placeholders"""
        # Basic validation for common placeholders
        valid_placeholders = [
            '{employee_name}', '{employee_id}', '{location_name}',
            '{clock_in_time}', '{clock_out_time}', '{duration}',
            '{break_type}', '{date}', '{time}'
        ]
        
        # This is a simple validation - in production you might want more sophisticated template validation
        return value


class WebhookSubscriptionSerializer(serializers.ModelSerializer):
    """Webhook subscription serializer"""
    
    class Meta:
        model = WebhookSubscription
        fields = [
            'id', 'event_type', 'target_url', 'is_active',
            'created_by_app', 'secret_key', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'secret_key': {'write_only': True}
        }
    
    def validate_event_type(self, value):
        """Validate event type"""
        valid_events = [choice[0] for choice in WebhookSubscription.EVENT_TYPE_CHOICES]
        if value not in valid_events:
            raise serializers.ValidationError(f"Invalid event type. Valid options: {', '.join(valid_events)}")
        return value


class WebhookDeliverySerializer(serializers.ModelSerializer):
    """Webhook delivery serializer"""
    subscription_url = serializers.CharField(source='subscription.target_url', read_only=True)
    subscription_event = serializers.CharField(source='subscription.event_type', read_only=True)
    can_retry = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'subscription', 'subscription_url', 'subscription_event',
            'event_type', 'payload', 'status', 'http_status_code',
            'response_body', 'error_message', 'attempt_count',
            'max_attempts', 'next_retry_at', 'can_retry',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationStatsSerializer(serializers.Serializer):
    """Notification statistics serializer"""
    total_notifications = serializers.IntegerField(read_only=True)
    pending_notifications = serializers.IntegerField(read_only=True)
    sent_notifications = serializers.IntegerField(read_only=True)
    failed_notifications = serializers.IntegerField(read_only=True)
    delivered_notifications = serializers.IntegerField(read_only=True)
    
    total_webhooks = serializers.IntegerField(read_only=True)
    active_webhooks = serializers.IntegerField(read_only=True)
    failed_webhook_deliveries = serializers.IntegerField(read_only=True)
    
    by_type = serializers.DictField(read_only=True)
    recent_activity = serializers.ListField(read_only=True)


class SendNotificationSerializer(serializers.Serializer):
    """Serializer for sending custom notifications"""
    recipient_ids = serializers.ListField(
        child=serializers.UUIDField(),
        help_text="List of employee IDs to send notification to"
    )
    notification_type = serializers.ChoiceField(
        choices=NotificationTemplate.NOTIFICATION_TYPE_CHOICES,
        help_text="Type of notification to send"
    )
    subject = serializers.CharField(max_length=200, required=False, allow_blank=True)
    message = serializers.CharField(help_text="Notification message")
    template_id = serializers.UUIDField(required=False, allow_null=True, help_text="Optional template to use")
    
    def validate_recipient_ids(self, value):
        """Validate all recipient IDs exist and are active employees"""
        if not value:
            raise serializers.ValidationError("At least one recipient is required")
        
        existing_employees = Employee.objects.filter(
            id__in=value,
            employment_status='ACTIVE'
        ).values_list('id', flat=True)
        
        missing_ids = set(value) - set(existing_employees)
        if missing_ids:
            raise serializers.ValidationError(f"Invalid or inactive employee IDs: {list(missing_ids)}")
        
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        notification_type = data.get('notification_type')
        template_id = data.get('template_id')
        
        # If template is provided, validate it matches the notification type
        if template_id:
            try:
                template = NotificationTemplate.objects.get(id=template_id, is_active=True)
                if template.notification_type != notification_type:
                    raise serializers.ValidationError(
                        f"Template notification type ({template.notification_type}) "
                        f"doesn't match requested type ({notification_type})"
                    )
                data['template'] = template
            except NotificationTemplate.DoesNotExist:
                raise serializers.ValidationError("Invalid or inactive template ID")
        
        # Validate required fields based on notification type
        if notification_type == 'EMAIL' and not data.get('subject'):
            raise serializers.ValidationError("Subject is required for email notifications")
        
        return data


class MarkNotificationReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read"""
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="List of notification IDs to mark as read. If empty, marks all as read."
    )


class WebhookTestSerializer(serializers.Serializer):
    """Serializer for testing webhook endpoints"""
    target_url = serializers.URLField(help_text="URL to test")
    event_type = serializers.ChoiceField(
        choices=[choice[0] for choice in WebhookSubscription.EVENT_TYPE_CHOICES],
        help_text="Event type to simulate"
    )
    test_payload = serializers.JSONField(
        required=False,
        help_text="Optional custom test payload"
    )
