import requests
import json
import hashlib
import hmac
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Count, Avg
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from .models import WebhookEndpoint, WebhookDelivery, WebhookEvent, WebhookTemplate
from .serializers import (
    WebhookEndpointSerializer, WebhookDeliverySerializer, WebhookEventSerializer,
    WebhookTemplateSerializer, WebhookTestSerializer, WebhookStatsSerializer,
    BulkWebhookActionSerializer
)
from apps.employees.permissions import IsAdminUser


class WebhookEndpointViewSet(viewsets.ModelViewSet):
    """ViewSet for managing webhook endpoints"""
    
    queryset = WebhookEndpoint.objects.all()
    serializer_class = WebhookEndpointSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'status', 'event_types']
    search_fields = ['name', 'url', 'description']
    ordering_fields = ['name', 'created_at', 'last_triggered', 'success_rate']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by event type
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_types__contains=[event_type])
        
        # Filter by success rate
        min_success_rate = self.request.query_params.get('min_success_rate')
        if min_success_rate:
            # This would need to be calculated in the database for efficiency
            pass
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test a webhook endpoint"""
        endpoint = self.get_object()
        serializer = WebhookTestSerializer(data=request.data)
        
        if serializer.is_valid():
            event_type = serializer.validated_data['event_type']
            test_data = serializer.validated_data.get('test_data', {})
            
            # Create test payload
            payload = {
                'event_type': event_type,
                'timestamp': timezone.now().isoformat(),
                'data': test_data or self._get_sample_data(event_type),
                'webhook_id': str(endpoint.id),
                'test': True
            }
            
            # Send test webhook
            try:
                response = self._send_webhook(endpoint, payload, event_type)
                
                return Response({
                    'success': True,
                    'status_code': response.status_code,
                    'response_body': response.text[:1000],  # Limit response size
                    'message': 'Test webhook sent successfully'
                })
            except Exception as e:
                return Response({
                    'success': False,
                    'error': str(e),
                    'message': 'Failed to send test webhook'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def deliveries(self, request, pk=None):
        """Get delivery history for an endpoint"""
        endpoint = self.get_object()
        deliveries = WebhookDelivery.objects.filter(endpoint=endpoint).order_by('-created_at')
        
        # Pagination
        page = self.paginate_queryset(deliveries)
        if page is not None:
            serializer = WebhookDeliverySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = WebhookDeliverySerializer(deliveries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def retry_failed(self, request, pk=None):
        """Retry all failed deliveries for an endpoint"""
        endpoint = self.get_object()
        failed_deliveries = WebhookDelivery.objects.filter(
            endpoint=endpoint,
            status='FAILED'
        )
        
        retry_count = 0
        for delivery in failed_deliveries:
            if delivery.attempt_count < endpoint.max_retries:
                delivery.status = 'RETRYING'
                delivery.next_retry_at = timezone.now()
                delivery.save()
                retry_count += 1
        
        return Response({
            'message': f'Queued {retry_count} deliveries for retry',
            'retry_count': retry_count
        })
    
    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Perform bulk actions on multiple endpoints"""
        serializer = BulkWebhookActionSerializer(data=request.data)
        
        if serializer.is_valid():
            endpoint_ids = serializer.validated_data['endpoint_ids']
            action_type = serializer.validated_data['action']
            
            endpoints = WebhookEndpoint.objects.filter(id__in=endpoint_ids)
            
            if action_type == 'activate':
                endpoints.update(is_active=True, status='ACTIVE')
                message = f'Activated {endpoints.count()} endpoints'
            elif action_type == 'deactivate':
                endpoints.update(is_active=False, status='INACTIVE')
                message = f'Deactivated {endpoints.count()} endpoints'
            elif action_type == 'delete':
                count = endpoints.count()
                endpoints.delete()
                message = f'Deleted {count} endpoints'
            elif action_type == 'test':
                # Send test webhook to all endpoints
                test_count = 0
                for endpoint in endpoints:
                    try:
                        payload = {
                            'event_type': 'system.test',
                            'timestamp': timezone.now().isoformat(),
                            'data': {'message': 'Bulk test webhook'},
                            'webhook_id': str(endpoint.id),
                            'test': True
                        }
                        self._send_webhook(endpoint, payload, 'system.test')
                        test_count += 1
                    except Exception:
                        pass
                message = f'Sent test webhooks to {test_count} endpoints'
            
            return Response({'message': message})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get webhook statistics"""
        # Endpoint statistics
        total_endpoints = WebhookEndpoint.objects.count()
        active_endpoints = WebhookEndpoint.objects.filter(is_active=True).count()
        inactive_endpoints = WebhookEndpoint.objects.filter(is_active=False).count()
        failed_endpoints = WebhookEndpoint.objects.filter(status='FAILED').count()
        
        # Delivery statistics
        total_deliveries = WebhookDelivery.objects.count()
        successful_deliveries = WebhookDelivery.objects.filter(status='SUCCESS').count()
        failed_deliveries = WebhookDelivery.objects.filter(status='FAILED').count()

        success_rate = (successful_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0

        # Average response time calculation (using delivered_at - created_at)
        successful_deliveries_with_time = WebhookDelivery.objects.filter(
            status='SUCCESS',
            delivered_at__isnull=False
        )
        avg_response_time = None
        if successful_deliveries_with_time.exists():
            total_time = 0
            count = 0
            for delivery in successful_deliveries_with_time:
                if delivery.delivered_at and delivery.created_at:
                    response_time = (delivery.delivered_at - delivery.created_at).total_seconds()
                    total_time += response_time
                    count += 1
            if count > 0:
                avg_response_time = round(total_time / count, 2)
        
        # Recent activity
        recent_events = WebhookEvent.objects.order_by('-created_at')[:10]
        recent_deliveries = WebhookDelivery.objects.order_by('-created_at')[:10]
        
        stats_data = {
            'total_endpoints': total_endpoints,
            'active_endpoints': active_endpoints,
            'inactive_endpoints': inactive_endpoints,
            'failed_endpoints': failed_endpoints,
            'total_deliveries': total_deliveries,
            'successful_deliveries': successful_deliveries,
            'failed_deliveries': failed_deliveries,
            'success_rate': round(success_rate, 2),
            'avg_response_time': avg_response_time,
            'recent_events': WebhookEventSerializer(recent_events, many=True).data,
            'recent_deliveries': WebhookDeliverySerializer(recent_deliveries, many=True).data,
        }
        
        return Response(stats_data)
    
    def _send_webhook(self, endpoint, payload, event_type):
        """Send webhook to endpoint"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'WorkSync-Webhook/1.0',
            **endpoint.headers
        }
        
        # Add authentication
        if endpoint.auth_type == 'bearer' and endpoint.auth_credentials.get('token'):
            headers['Authorization'] = f"Bearer {endpoint.auth_credentials['token']}"
        elif endpoint.auth_type == 'api_key' and endpoint.auth_credentials.get('key'):
            headers[endpoint.auth_credentials.get('header', 'X-API-Key')] = endpoint.auth_credentials['key']
        
        # Add signature if secret key is provided
        if endpoint.secret_key:
            payload_str = json.dumps(payload, sort_keys=True)
            signature = hmac.new(
                endpoint.secret_key.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            headers['X-Webhook-Signature'] = f'sha256={signature}'
        
        # Send request
        response = requests.post(
            endpoint.url,
            json=payload,
            headers=headers,
            timeout=endpoint.timeout
        )
        
        return response
    
    def _get_sample_data(self, event_type):
        """Get sample data for different event types"""
        sample_data = {
            'employee.clock_in': {
                'employee_id': 'emp-123',
                'employee_name': 'John Doe',
                'timestamp': timezone.now().isoformat(),
                'location': {'lat': 40.7128, 'lng': -74.0060}
            },
            'leave.request_created': {
                'request_id': 'req-456',
                'employee_name': 'Jane Smith',
                'leave_type': 'Annual Leave',
                'start_date': '2024-01-15',
                'end_date': '2024-01-19',
                'total_days': 5
            },
            'shift.created': {
                'shift_id': 'shift-789',
                'employee_name': 'Bob Johnson',
                'date': '2024-01-20',
                'start_time': '09:00',
                'end_time': '17:00',
                'shift_type': 'Regular'
            }
        }
        
        return sample_data.get(event_type, {'message': 'Test webhook event'})


class WebhookDeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing webhook deliveries"""
    
    queryset = WebhookDelivery.objects.all()
    serializer_class = WebhookDeliverySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'event_type', 'endpoint']
    ordering_fields = ['created_at', 'delivered_at', 'attempt_count']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a specific delivery"""
        delivery = self.get_object()
        
        if delivery.status == 'SUCCESS':
            return Response({
                'error': 'Cannot retry successful delivery'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if delivery.attempt_count >= delivery.endpoint.max_retries:
            return Response({
                'error': 'Maximum retry attempts exceeded'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        delivery.status = 'RETRYING'
        delivery.next_retry_at = timezone.now()
        delivery.save()
        
        return Response({'message': 'Delivery queued for retry'})


class WebhookEventViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing webhook events"""
    
    queryset = WebhookEvent.objects.all()
    serializer_class = WebhookEventSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['event_type', 'resource_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class WebhookTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing webhook templates"""
    
    queryset = WebhookTemplate.objects.all()
    serializer_class = WebhookTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['integration_type', 'is_active']
    ordering_fields = ['name', 'integration_type', 'created_at']
    ordering = ['integration_type', 'name']
    
    @action(detail=True, methods=['post'])
    def create_endpoint(self, request, pk=None):
        """Create a webhook endpoint from a template"""
        template = self.get_object()
        
        # Get endpoint data from request
        endpoint_data = request.data.copy()
        
        # Apply template defaults
        endpoint_data.setdefault('event_types', template.default_event_types)
        endpoint_data.setdefault('auth_type', template.default_auth_type)
        endpoint_data.setdefault('headers', template.headers_template)
        
        # Create endpoint
        serializer = WebhookEndpointSerializer(data=endpoint_data, context={'request': request})
        if serializer.is_valid():
            endpoint = serializer.save()
            return Response(WebhookEndpointSerializer(endpoint).data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
