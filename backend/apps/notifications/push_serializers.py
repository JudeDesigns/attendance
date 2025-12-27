from rest_framework import serializers
from .push_models import PushSubscription, PushNotificationSettings, PushNotificationLog
import json
import re


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for push subscription registration"""
    
    class Meta:
        model = PushSubscription
        fields = [
            'id', 'endpoint', 'p256dh_key', 'auth_key', 
            'browser_name', 'device_type', 'is_active',
            'created_at', 'updated_at', 'last_used_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_used_at']
    
    def validate_endpoint(self, value):
        """Validate push service endpoint URL"""
        if not value:
            raise serializers.ValidationError("Endpoint is required")
        
        # Basic URL validation for known push services
        valid_domains = [
            'fcm.googleapis.com',
            'updates.push.services.mozilla.com',
            'wns2-',  # Windows Push Notification Service
            'notify.windows.com',
            'push.apple.com'
        ]
        
        if not any(domain in value for domain in valid_domains):
            # Allow localhost and other domains for development
            if 'localhost' not in value and '127.0.0.1' not in value:
                raise serializers.ValidationError("Invalid push service endpoint")
        
        return value
    
    def validate_p256dh_key(self, value):
        """Validate P256DH key format"""
        if not value:
            raise serializers.ValidationError("P256DH key is required")
        
        # Basic validation - should be base64url encoded
        if len(value) < 80:  # Minimum expected length
            raise serializers.ValidationError("Invalid P256DH key format")
        
        return value
    
    def validate_auth_key(self, value):
        """Validate auth key format"""
        if not value:
            raise serializers.ValidationError("Auth key is required")
        
        # Basic validation - should be base64url encoded
        if len(value) < 20:  # Minimum expected length
            raise serializers.ValidationError("Invalid auth key format")
        
        return value


class PushSubscriptionCreateSerializer(PushSubscriptionSerializer):
    """Serializer for creating new push subscriptions"""
    
    # Accept subscription object from frontend
    subscription = serializers.JSONField(write_only=True, required=False)
    
    class Meta(PushSubscriptionSerializer.Meta):
        fields = PushSubscriptionSerializer.Meta.fields + ['subscription']
        extra_kwargs = {
            'endpoint': {'required': False},
            'p256dh_key': {'required': False},
            'auth_key': {'required': False},
        }
    
    def validate_subscription(self, value):
        """Validate subscription object from frontend"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Subscription must be an object")
        
        required_fields = ['endpoint', 'keys']
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(f"Missing required field: {field}")
        
        if not isinstance(value['keys'], dict):
            raise serializers.ValidationError("Keys must be an object")
        
        required_keys = ['p256dh', 'auth']
        for key in required_keys:
            if key not in value['keys']:
                raise serializers.ValidationError(f"Missing required key: {key}")
        
        return value
    
    def create(self, validated_data):
        """Create push subscription from frontend subscription object"""
        subscription_data = validated_data.pop('subscription', None)
        
        if subscription_data:
            # Extract data from subscription object
            validated_data['endpoint'] = subscription_data['endpoint']
            validated_data['p256dh_key'] = subscription_data['keys']['p256dh']
            validated_data['auth_key'] = subscription_data['keys']['auth']
        
        # Set user from request context
        validated_data['user'] = self.context['request'].user
        
        # Extract browser info from user agent
        user_agent = self.context['request'].META.get('HTTP_USER_AGENT', '')
        validated_data['user_agent'] = user_agent
        
        # Simple browser detection
        if 'Chrome' in user_agent:
            validated_data['browser_name'] = 'Chrome'
        elif 'Firefox' in user_agent:
            validated_data['browser_name'] = 'Firefox'
        elif 'Safari' in user_agent:
            validated_data['browser_name'] = 'Safari'
        elif 'Edge' in user_agent:
            validated_data['browser_name'] = 'Edge'
        else:
            validated_data['browser_name'] = 'Unknown'
        
        # Simple device detection
        if 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent:
            validated_data['device_type'] = 'mobile'
        elif 'Tablet' in user_agent or 'iPad' in user_agent:
            validated_data['device_type'] = 'tablet'
        else:
            validated_data['device_type'] = 'desktop'
        
        return super().create(validated_data)


class PushNotificationSettingsSerializer(serializers.ModelSerializer):
    """Serializer for push notification settings"""
    
    class Meta:
        model = PushNotificationSettings
        fields = [
            'enabled', 'break_reminders', 'clock_in_out_confirmations',
            'shift_reminders', 'admin_notifications', 'quiet_hours_enabled',
            'quiet_hours_start', 'quiet_hours_end', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def validate(self, data):
        """Validate quiet hours settings"""
        if data.get('quiet_hours_enabled'):
            if not data.get('quiet_hours_start') or not data.get('quiet_hours_end'):
                raise serializers.ValidationError(
                    "Quiet hours start and end times are required when quiet hours are enabled"
                )
        
        return data


class PushNotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for push notification logs"""
    
    subscription_info = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()
    
    class Meta:
        model = PushNotificationLog
        fields = [
            'id', 'title', 'body', 'icon', 'badge', 'tag',
            'status', 'sent_at', 'delivered_at', 'error_message',
            'http_status_code', 'created_at', 'updated_at',
            'subscription_info', 'user_info'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_subscription_info(self, obj):
        """Get basic subscription info"""
        return {
            'id': str(obj.subscription.id),
            'browser_name': obj.subscription.browser_name,
            'device_type': obj.subscription.device_type,
        }
    
    def get_user_info(self, obj):
        """Get basic user info"""
        return {
            'id': obj.subscription.user.id,
            'username': obj.subscription.user.username,
            'full_name': obj.subscription.user.get_full_name(),
        }


class SendPushNotificationSerializer(serializers.Serializer):
    """Serializer for sending push notifications"""
    
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=1000)
    icon = serializers.URLField(required=False, allow_blank=True)
    badge = serializers.URLField(required=False, allow_blank=True)
    tag = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    # Target users
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="List of user IDs to send notification to. If empty, sends to all subscribed users."
    )
    
    # Notification options
    require_interaction = serializers.BooleanField(default=False)
    silent = serializers.BooleanField(default=False)
    
    # Custom data
    data = serializers.JSONField(required=False, help_text="Custom data to include with notification")
    
    def validate_user_ids(self, value):
        """Validate user IDs exist"""
        if value:
            from django.contrib.auth.models import User
            existing_ids = set(User.objects.filter(id__in=value).values_list('id', flat=True))
            invalid_ids = set(value) - existing_ids
            
            if invalid_ids:
                raise serializers.ValidationError(f"Invalid user IDs: {list(invalid_ids)}")
        
        return value
