from rest_framework import serializers
from .models import WebhookEndpoint, WebhookDelivery, WebhookEvent, WebhookTemplate


class WebhookEndpointSerializer(serializers.ModelSerializer):
    success_rate = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = WebhookEndpoint
        fields = [
            'id', 'name', 'url', 'description', 'event_types', 'secret_key',
            'is_active', 'status', 'headers', 'auth_type', 'auth_credentials',
            'max_retries', 'retry_delay', 'timeout', 'filter_conditions',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'last_triggered', 'total_deliveries', 'successful_deliveries',
            'failed_deliveries', 'success_rate'
        ]
        read_only_fields = [
            'id', 'created_by', 'created_at', 'updated_at', 'last_triggered',
            'total_deliveries', 'successful_deliveries', 'failed_deliveries'
        ]
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def validate_event_types(self, value):
        """Validate that event types are from the allowed list"""
        valid_events = [choice[0] for choice in WebhookEndpoint.EVENT_TYPES]
        for event_type in value:
            if event_type not in valid_events:
                raise serializers.ValidationError(f"Invalid event type: {event_type}")
        return value
    
    def validate_url(self, value):
        """Validate webhook URL to prevent SSRF attacks"""
        import ipaddress
        from urllib.parse import urlparse

        if not value.startswith(('http://', 'https://')):
            raise serializers.ValidationError("URL must start with http:// or https://")

        try:
            parsed = urlparse(value)
            hostname = parsed.hostname

            if not hostname:
                raise serializers.ValidationError("Invalid URL: no hostname")

            # Block localhost and loopback addresses
            if hostname.lower() in ['localhost', '127.0.0.1', '::1']:
                raise serializers.ValidationError("Localhost URLs are not allowed")

            # Block private IP ranges
            try:
                ip = ipaddress.ip_address(hostname)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    raise serializers.ValidationError("Private IP addresses are not allowed")
            except ValueError:
                # Not an IP address, check for internal domains
                if any(internal in hostname.lower() for internal in ['internal', 'local', 'private']):
                    raise serializers.ValidationError("Internal domain names are not allowed")

            # Block non-HTTP protocols
            if parsed.scheme not in ['http', 'https']:
                raise serializers.ValidationError("Only HTTP and HTTPS protocols are allowed")

            # Block common internal ports
            if parsed.port and parsed.port in [22, 23, 25, 53, 80, 110, 143, 993, 995, 3306, 5432, 6379, 27017]:
                if parsed.port != 80 and parsed.scheme == 'http':
                    raise serializers.ValidationError("Access to internal service ports is not allowed")
                if parsed.port != 443 and parsed.scheme == 'https':
                    raise serializers.ValidationError("Access to internal service ports is not allowed")

        except Exception as e:
            raise serializers.ValidationError(f"Invalid URL: {str(e)}")

        return value


class WebhookDeliverySerializer(serializers.ModelSerializer):
    endpoint_name = serializers.CharField(source='endpoint.name', read_only=True)
    endpoint_url = serializers.CharField(source='endpoint.url', read_only=True)
    
    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'endpoint', 'endpoint_name', 'endpoint_url', 'event_type',
            'event_id', 'payload', 'status', 'http_status', 'response_body',
            'response_headers', 'created_at', 'delivered_at', 'attempt_count',
            'next_retry_at', 'error_message'
        ]
        read_only_fields = ['id', 'created_at']


class WebhookEventSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.CharField(source='triggered_by.get_full_name', read_only=True)
    
    class Meta:
        model = WebhookEvent
        fields = [
            'id', 'event_type', 'resource_type', 'resource_id', 'data',
            'metadata', 'created_at', 'triggered_by', 'triggered_by_name',
            'endpoints_notified', 'successful_deliveries', 'failed_deliveries'
        ]
        read_only_fields = ['id', 'created_at']


class WebhookTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookTemplate
        fields = [
            'id', 'name', 'description', 'integration_type', 'url_template',
            'headers_template', 'payload_template', 'default_event_types',
            'default_auth_type', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WebhookTestSerializer(serializers.Serializer):
    """Serializer for testing webhook endpoints"""
    event_type = serializers.ChoiceField(choices=WebhookEndpoint.EVENT_TYPES)
    test_data = serializers.JSONField(required=False, default=dict)
    
    def validate_event_type(self, value):
        """Ensure the event type is valid"""
        valid_events = [choice[0] for choice in WebhookEndpoint.EVENT_TYPES]
        if value not in valid_events:
            raise serializers.ValidationError(f"Invalid event type: {value}")
        return value


class WebhookStatsSerializer(serializers.Serializer):
    """Serializer for webhook statistics"""
    total_endpoints = serializers.IntegerField()
    active_endpoints = serializers.IntegerField()
    inactive_endpoints = serializers.IntegerField()
    failed_endpoints = serializers.IntegerField()
    total_deliveries = serializers.IntegerField()
    successful_deliveries = serializers.IntegerField()
    failed_deliveries = serializers.IntegerField()
    success_rate = serializers.FloatField()
    recent_events = WebhookEventSerializer(many=True)
    recent_deliveries = WebhookDeliverySerializer(many=True)


class BulkWebhookActionSerializer(serializers.Serializer):
    """Serializer for bulk webhook actions"""
    endpoint_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1
    )
    action = serializers.ChoiceField(choices=[
        ('activate', 'Activate'),
        ('deactivate', 'Deactivate'),
        ('delete', 'Delete'),
        ('test', 'Test'),
    ])
    
    def validate_endpoint_ids(self, value):
        """Validate that all endpoint IDs exist"""
        existing_ids = set(
            WebhookEndpoint.objects.filter(id__in=value).values_list('id', flat=True)
        )
        provided_ids = set(value)
        
        if not provided_ids.issubset(existing_ids):
            missing_ids = provided_ids - existing_ids
            raise serializers.ValidationError(
                f"The following endpoint IDs do not exist: {list(missing_ids)}"
            )
        
        return value
