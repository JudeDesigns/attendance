"""
Notification views with comprehensive API endpoints
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import datetime, timedelta
from .models import NotificationLog, NotificationTemplate, WebhookSubscription, WebhookDelivery, EmailConfiguration
from apps.employees.models import Employee
from .serializers import (
    NotificationLogSerializer, NotificationTemplateSerializer,
    WebhookSubscriptionSerializer, WebhookDeliverySerializer,
    NotificationStatsSerializer, SendNotificationSerializer,
    MarkNotificationReadSerializer, WebhookTestSerializer,
    EmailConfigurationSerializer
)
# from .tasks import send_webhook_notification, send_sms_notification
import logging

logger = logging.getLogger(__name__)


class IsAdminUser(permissions.BasePermission):
    """Custom permission for admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow users to view their own notifications or admins to access all"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        if hasattr(obj, 'recipient'):
            return obj.recipient.user == request.user
        return False


class NotificationLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing notification logs
    """
    queryset = NotificationLog.objects.select_related(
        'recipient__user', 'template'
    ).all()
    serializer_class = NotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['notification_type', 'event_type', 'status', 'recipient']
    search_fields = ['message', 'subject', 'recipient__user__first_name', 'recipient__user__last_name']
    ordering_fields = ['created_at', 'sent_at', 'delivered_at']
    ordering = ['-created_at']
    http_method_names = ['get', 'delete', 'head', 'options', 'post']  # Allow GET, DELETE, and custom POST actions

    def get_permissions(self):
        """Set permissions based on action"""
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()
        
        # Non-admin users can only see their own notifications
        if not self.request.user.is_staff:
            try:
                employee = Employee.objects.get(user=self.request.user)
                queryset = queryset.filter(recipient=employee)
            except Employee.DoesNotExist:
                queryset = queryset.none()
        
        return queryset
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_notifications(self, request):
        """Get current user's notifications"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get query parameters
        unread_only = request.query_params.get('unread_only', 'false').lower() == 'true'
        limit = int(request.query_params.get('limit', 50))
        
        queryset = NotificationLog.objects.filter(recipient=employee)
        
        if unread_only:
            # For this example, we'll consider 'PENDING' and 'SENT' as unread
            queryset = queryset.filter(status__in=['PENDING', 'SENT'])
        
        notifications = queryset.order_by('-created_at')[:limit]
        serializer = NotificationLogSerializer(notifications, many=True)
        
        return Response({
            'notifications': serializer.data,
            'unread_count': queryset.filter(status__in=['PENDING', 'SENT']).count(),
            'total_count': queryset.count()
        })
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_as_read(self, request):
        """Mark notifications as read (delivered)"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = MarkNotificationReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        notification_ids = serializer.validated_data.get('notification_ids', [])
        
        queryset = NotificationLog.objects.filter(recipient=employee)
        
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        
        # Update notifications to delivered status
        updated_count = queryset.filter(
            status__in=['PENDING', 'SENT']
        ).update(
            status='DELIVERED',
            delivered_at=timezone.now()
        )
        
        return Response({
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_all_as_read(self, request):
        """Mark all notifications as read for current user"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update all unread notifications to delivered status
        updated_count = NotificationLog.objects.filter(
            recipient=employee,
            status__in=['PENDING', 'SENT']
        ).update(
            status='DELIVERED',
            delivered_at=timezone.now()
        )

        logger.info(f"Marked all notifications as read for employee {employee.employee_id}: {updated_count} notifications")

        return Response({
            'message': f'Marked all {updated_count} notifications as read',
            'updated_count': updated_count
        })

    def destroy(self, request, *args, **kwargs):
        """Delete a notification (only own notifications or admin)"""
        notification = self.get_object()

        # Check if user owns this notification or is admin
        if not request.user.is_staff:
            try:
                employee = Employee.objects.get(user=request.user)
                if notification.recipient != employee:
                    return Response(
                        {'detail': 'You can only delete your own notifications'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Employee.DoesNotExist:
                return Response(
                    {'detail': 'Employee profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        logger.info(f"Notification deleted: ID {notification.id} by user {request.user.username}")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def stats(self, request):
        """Get notification statistics (admin only)"""
        # Get date range from query params
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        # Basic stats
        total_notifications = NotificationLog.objects.filter(created_at__gte=start_date).count()
        pending_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='PENDING'
        ).count()
        sent_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='SENT'
        ).count()
        failed_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='FAILED'
        ).count()
        delivered_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='DELIVERED'
        ).count()
        
        # Webhook stats
        total_webhooks = WebhookSubscription.objects.count()
        active_webhooks = WebhookSubscription.objects.filter(is_active=True).count()
        failed_webhook_deliveries = WebhookDelivery.objects.filter(
            created_at__gte=start_date, status='FAILED'
        ).count()
        
        # By type breakdown
        by_type = NotificationLog.objects.filter(
            created_at__gte=start_date
        ).values('notification_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Recent activity (last 10 notifications)
        recent_activity = NotificationLog.objects.select_related(
            'recipient__user'
        ).order_by('-created_at')[:10]
        
        recent_serializer = NotificationLogSerializer(recent_activity, many=True)
        
        stats_data = {
            'total_notifications': total_notifications,
            'pending_notifications': pending_notifications,
            'sent_notifications': sent_notifications,
            'failed_notifications': failed_notifications,
            'delivered_notifications': delivered_notifications,
            'total_webhooks': total_webhooks,
            'active_webhooks': active_webhooks,
            'failed_webhook_deliveries': failed_webhook_deliveries,
            'by_type': {item['notification_type']: item['count'] for item in by_type},
            'recent_activity': recent_serializer.data
        }
        
        serializer = NotificationStatsSerializer(stats_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def activity_feed(self, request):
        """Get notification activity feed grouped by employee and date (admin only)"""
        from apps.core.timezone_utils import convert_to_naive_la_time
        from collections import defaultdict

        # Filter parameters
        employee_id = request.query_params.get('employee_id')
        event_type = request.query_params.get('event_type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        limit = int(request.query_params.get('limit', 200))

        queryset = NotificationLog.objects.select_related(
            'recipient__user', 'recipient__role', 'template'
        ).order_by('-created_at')

        # Apply filters
        if employee_id:
            queryset = queryset.filter(recipient__id=employee_id)
        if event_type:
            # Support comma-separated event types
            event_types = [e.strip() for e in event_type.split(',')]
            queryset = queryset.filter(event_type__in=event_types)
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                queryset = queryset.filter(created_at__date__gte=from_date.date())
            except ValueError:
                pass
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                queryset = queryset.filter(created_at__date__lte=to_date.date())
            except ValueError:
                pass

        notifications = queryset[:limit]

        # Group by employee → date
        employee_groups = defaultdict(lambda: defaultdict(list))
        for notif in notifications:
            emp = notif.recipient
            emp_key = str(emp.id)
            la_time = convert_to_naive_la_time(notif.created_at)
            date_key = la_time.strftime('%Y-%m-%d') if la_time else 'Unknown'

            employee_groups[emp_key][date_key].append({
                'id': str(notif.id),
                'event_type': notif.event_type,
                'notification_type': notif.notification_type,
                'subject': notif.subject,
                'message': notif.message,
                'status': notif.status,
                'created_at': la_time.isoformat() if la_time else None,
                'sent_at': convert_to_naive_la_time(notif.sent_at).isoformat() if notif.sent_at else None,
            })

        # Build response
        result = []
        for emp_key, dates in employee_groups.items():
            try:
                emp = Employee.objects.select_related('user').get(id=emp_key)
                employee_data = {
                    'employee_id': str(emp.id),
                    'employee_name': emp.user.get_full_name() or emp.user.username,
                    'employee_code': emp.employee_id,
                    'dates': []
                }
                for date_key in sorted(dates.keys(), reverse=True):
                    employee_data['dates'].append({
                        'date': date_key,
                        'notifications': dates[date_key],
                        'count': len(dates[date_key]),
                    })
                employee_data['total_notifications'] = sum(d['count'] for d in employee_data['dates'])
                result.append(employee_data)
            except Employee.DoesNotExist:
                continue

        # Sort by total notifications descending
        result.sort(key=lambda x: x['total_notifications'], reverse=True)

        # Summary stats
        all_notifs = list(notifications)
        summary = {
            'total_activities': len(all_notifs),
            'break_waivers': sum(1 for n in all_notifs if n.event_type == 'break_waived'),
            'compliance_violations': sum(1 for n in all_notifs if n.event_type == 'break_compliance_violation'),
            'clock_ins': sum(1 for n in all_notifs if n.event_type == 'clock_in'),
            'clock_outs': sum(1 for n in all_notifs if n.event_type == 'clock_out'),
            'overtime_alerts': sum(1 for n in all_notifs if 'overtime' in n.event_type),
            'unique_employees': len(result),
        }

        return Response({
            'summary': summary,
            'employees': result,
        })


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing notification templates
    """
    queryset = NotificationTemplate.objects.all()
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['notification_type', 'event_type', 'is_active']
    search_fields = ['name', 'message_template']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def perform_create(self, serializer):
        """Create template with audit logging"""
        template = serializer.save()
        logger.info(
            f"Notification template created: {template.name} "
            f"by user {self.request.user.username}"
        )
    
    def perform_update(self, serializer):
        """Update template with audit logging"""
        template = serializer.save()
        logger.info(
            f"Notification template updated: {template.name} "
            f"by user {self.request.user.username}"
        )
    
    def perform_destroy(self, instance):
        """Delete template with audit logging"""
        logger.warning(
            f"Notification template deleted: {instance.name} "
            f"by user {self.request.user.username}"
        )
        instance.delete()


class WebhookSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing webhook subscriptions
    """
    queryset = WebhookSubscription.objects.all()
    serializer_class = WebhookSubscriptionSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['event_type', 'is_active']
    search_fields = ['target_url', 'created_by_app']
    ordering_fields = ['created_at', 'event_type']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        """Create webhook subscription with audit logging"""
        webhook = serializer.save()
        logger.info(
            f"Webhook subscription created: {webhook.event_type} -> {webhook.target_url} "
            f"by user {self.request.user.username}"
        )

    def perform_update(self, serializer):
        """Update webhook subscription with audit logging"""
        webhook = serializer.save()
        logger.info(
            f"Webhook subscription updated: {webhook.event_type} -> {webhook.target_url} "
            f"by user {self.request.user.username}"
        )

    def perform_destroy(self, instance):
        """Delete webhook subscription with audit logging"""
        logger.warning(
            f"Webhook subscription deleted: {instance.event_type} -> {instance.target_url} "
            f"by user {self.request.user.username}"
        )
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def test(self, request, pk=None):
        """Test a webhook subscription"""
        webhook = self.get_object()

        serializer = WebhookTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create test payload
        test_payload = serializer.validated_data.get('test_payload', {
            'event_type': webhook.event_type,
            'timestamp': timezone.now().isoformat(),
            'test': True,
            'data': {
                'message': 'This is a test webhook notification from WorkSync',
                'webhook_id': str(webhook.id)
            }
        })

        # Send test webhook
        try:
            from .tasks import send_webhook_notification
            send_webhook_notification.delay(webhook.event_type, test_payload)

            logger.info(
                f"Test webhook queued: {webhook.event_type} -> {webhook.target_url} "
                f"by user {request.user.username}"
            )

            return Response({
                'message': 'Test webhook queued successfully',
                'webhook_id': webhook.id,
                'event_type': webhook.event_type,
                'target_url': webhook.target_url
            })

        except Exception as e:
            logger.error(f"Error queuing test webhook: {str(e)}")
            return Response(
                {'error': f'Failed to queue test webhook: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WebhookDeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing webhook delivery logs
    """
    queryset = WebhookDelivery.objects.select_related('subscription').all()
    serializer_class = WebhookDeliverySerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['event_type', 'status', 'subscription']
    search_fields = ['subscription__target_url', 'error_message']
    ordering_fields = ['created_at', 'attempt_count']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def retry(self, request, pk=None):
        """Retry a failed webhook delivery"""
        delivery = self.get_object()

        if not delivery.can_retry:
            return Response(
                {'error': 'This delivery cannot be retried (max attempts reached or not in failed state)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset delivery for retry
        delivery.status = 'PENDING'
        delivery.next_retry_at = timezone.now()
        delivery.save()

        # Queue for retry
        from .tasks import send_single_webhook
        send_single_webhook.delay(delivery.id)

        logger.info(
            f"Webhook delivery retry queued: {delivery.id} "
            f"by user {request.user.username}"
        )

        return Response({
            'message': 'Webhook delivery queued for retry',
            'delivery_id': delivery.id,
            'attempt_count': delivery.attempt_count
        })


class NotificationManagementViewSet(viewsets.GenericViewSet):
    """
    ViewSet for notification management actions
    """
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def send_notification(self, request):
        """Send custom notification to employees"""
        serializer = SendNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        recipient_ids = data['recipient_ids']
        notification_type = data['notification_type']
        subject = data.get('subject', '')
        message = data['message']
        template = data.get('template')

        # Get recipients
        recipients = Employee.objects.filter(id__in=recipient_ids, employment_status='ACTIVE')

        notifications_created = []

        for recipient in recipients:
            # Determine recipient address based on notification type
            recipient_address = ''
            if notification_type == 'EMAIL':
                recipient_address = recipient.user.email
            elif notification_type == 'SMS':
                recipient_address = getattr(recipient, 'phone_number', '')

            if not recipient_address:
                logger.warning(f"No {notification_type.lower()} address for employee {recipient.employee_id}")
                continue

            # Create notification log
            notification_log = NotificationLog.objects.create(
                recipient=recipient,
                template=template,
                notification_type=notification_type,
                event_type='custom',
                subject=subject,
                message=message,
                recipient_address=recipient_address,
                status='PENDING'
            )

            notifications_created.append(notification_log)

            # Queue notification for sending
            if notification_type == 'SMS':
                from .tasks import send_sms_notification
                send_sms_notification.delay(recipient.id, message, 'custom')
            elif notification_type == 'WEBHOOK':
                webhook_payload = {
                    'event_type': 'custom_notification',
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        'recipient': {
                            'employee_id': recipient.employee_id,
                            'name': recipient.user.get_full_name()
                        },
                        'message': message,
                        'subject': subject
                    }
                }
                from .tasks import send_webhook_notification
                send_webhook_notification.delay('custom_notification', webhook_payload)

        logger.info(
            f"Custom notifications sent: {len(notifications_created)} notifications "
            f"of type {notification_type} by user {request.user.username}"
        )

        response_serializer = NotificationLogSerializer(notifications_created, many=True)
        return Response({
            'message': f'Successfully queued {len(notifications_created)} notifications',
            'notifications': response_serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def unread_count(self, request):
        """Get unread notification count for all employees"""
        employee_id = request.query_params.get('employee_id')

        if employee_id:
            try:
                employee = Employee.objects.get(id=employee_id)
                unread_count = NotificationLog.objects.filter(
                    recipient=employee,
                    status__in=['PENDING', 'SENT']
                ).count()

                return Response({
                    'employee_id': employee.employee_id,
                    'employee_name': employee.user.get_full_name(),
                    'unread_count': unread_count
                })
            except Employee.DoesNotExist:
                return Response(
                    {'error': 'Employee not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Get unread counts for all employees
            unread_counts = NotificationLog.objects.filter(
                status__in=['PENDING', 'SENT']
            ).values(
                'recipient__employee_id',
                'recipient__user__first_name',
                'recipient__user__last_name'
            ).annotate(
                unread_count=Count('id')
            ).order_by('-unread_count')

            return Response({
                'total_employees_with_unread': len(unread_counts),
                'unread_by_employee': [
                    {
                        'employee_id': item['recipient__employee_id'],
                        'employee_name': f"{item['recipient__user__first_name']} {item['recipient__user__last_name']}",
                        'unread_count': item['unread_count']
                    }
                    for item in unread_counts
                ]
            })
    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def stats(self, request):
        """Get notification statistics (admin only)"""
        # Get date range from query params
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        # Basic stats
        total_notifications = NotificationLog.objects.filter(created_at__gte=start_date).count()
        pending_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='PENDING'
        ).count()
        sent_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='SENT'
        ).count()
        failed_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='FAILED'
        ).count()
        delivered_notifications = NotificationLog.objects.filter(
            created_at__gte=start_date, status='DELIVERED'
        ).count()
        
        # Webhook stats
        total_webhooks = WebhookSubscription.objects.count()
        active_webhooks = WebhookSubscription.objects.filter(is_active=True).count()
        failed_webhook_deliveries = WebhookDelivery.objects.filter(
            created_at__gte=start_date, status='FAILED'
        ).count()
        
        # By type breakdown
        by_type = NotificationLog.objects.filter(
            created_at__gte=start_date
        ).values('notification_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Recent activity (last 10 notifications)
        recent_activity = NotificationLog.objects.select_related(
            'recipient__user'
        ).order_by('-created_at')[:10]
        
        recent_serializer = NotificationLogSerializer(recent_activity, many=True)
        
        stats_data = {
            'total_notifications': total_notifications,
            'pending_notifications': pending_notifications,
            'sent_notifications': sent_notifications,
            'failed_notifications': failed_notifications,
            'delivered_notifications': delivered_notifications,
            'total_webhooks': total_webhooks,
            'active_webhooks': active_webhooks,
            'failed_webhook_deliveries': failed_webhook_deliveries,
            'by_type': {item['notification_type']: item['count'] for item in by_type},
            'recent_activity': recent_serializer.data
        }
        
        serializer = NotificationStatsSerializer(stats_data)
        return Response(serializer.data)

class EmailConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email configuration
    """
    
    queryset = EmailConfiguration.objects.all()
    serializer_class = EmailConfigurationSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        # Only allow seeing the active configuration or all if admin
        return EmailConfiguration.objects.all().order_by('-is_active', '-created_at')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the currently active configuration"""
        try:
            config = EmailConfiguration.objects.filter(is_active=True).first()
            if not config:
                return Response({'detail': 'No active email configuration found'}, status=status.HTTP_404_NOT_FOUND)
            
            serializer = self.get_serializer(config)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test email configuration"""
        import logging
        logger = logging.getLogger(__name__)

        logger.error(f"=== EMAIL TEST START === PK: {pk}")
        logger.error(f"Request method: {request.method}")
        logger.error(f"Request data: {getattr(request, 'data', 'NO DATA ATTR')}")

        try:
            config = self.get_object()
            logger.error(f"Config retrieved: {config.id}")
        except Exception as e:
            logger.error(f"Failed to get config: {e}")
            return Response({'error': f'Config error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipient = request.data.get('recipient')
            logger.error(f"Recipient: {recipient}")
        except Exception as e:
            logger.error(f"Failed to get recipient: {e}")
            return Response({'error': f'Request data error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        if not recipient:
            logger.error("No recipient provided")
            return Response({'error': 'Recipient email is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Use the unified email queue system
            from apps.notifications.email_queue import EmailQueue

            # Queue the test email
            email_id = EmailQueue.queue_test_email(recipient)

            # Return success immediately - email will be sent by cron job
            
            return Response({'message': 'Test email sent successfully'})
        except Exception as e:
            return Response({'error': f'Failed to send test email: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
