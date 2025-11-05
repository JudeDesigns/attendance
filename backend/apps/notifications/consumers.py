"""
WebSocket consumers for real-time notifications and dashboard updates
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser, User
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .models import NotificationLog
import logging

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications
    """
    
    async def connect(self):
        """Handle WebSocket connection"""
        # Get user from token or scope
        user = await self.get_user_from_token()
        if not user:
            # Fallback to scope user
            if self.scope["user"] == AnonymousUser():
                await self.close()
                return
            user = self.scope["user"]

        self.user = user
        self.user_group_name = f"notifications_{user.id}"

        # Join user-specific group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        # Join admin group if user is admin
        if user.is_staff:
            self.admin_group_name = "admin_notifications"
            await self.channel_layer.group_add(
                self.admin_group_name,
                self.channel_name
            )

        await self.accept()
        logger.info(f"WebSocket connected for user {user.username}")

        # Send initial data
        await self.send_initial_data()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'user'):
            # Leave user group
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

            # Leave admin group if applicable
            if hasattr(self, 'admin_group_name'):
                await self.channel_layer.group_discard(
                    self.admin_group_name,
                    self.channel_name
                )

            logger.info(f"WebSocket disconnected for user {self.user.username}")
    
    async def receive(self, text_data):
        """Handle messages from WebSocket"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
            elif message_type == 'mark_notification_read':
                notification_id = text_data_json.get('notification_id')
                await self.mark_notification_read(notification_id)
            elif message_type == 'request_stats':
                await self.send_dashboard_stats()

        except json.JSONDecodeError:
            logger.error("Invalid JSON received in WebSocket")
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {str(e)}")
    
    async def get_user_from_token(self):
        """Extract user from JWT token in query string"""
        try:
            # Get token from query string
            query_string = self.scope['query_string'].decode()
            token = None

            for param in query_string.split('&'):
                if param.startswith('token='):
                    token = param.split('=')[1]
                    break

            if not token:
                return None

            # Validate token
            try:
                UntypedToken(token)
                # Get user from token
                from rest_framework_simplejwt.authentication import JWTAuthentication
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(token)
                user = await database_sync_to_async(jwt_auth.get_user)(validated_token)
                return user
            except (InvalidToken, TokenError):
                return None

        except Exception as e:
            logger.error(f"Error extracting user from token: {str(e)}")
            return None

    async def send_initial_data(self):
        """Send initial data when user connects"""
        # Send unread notification count
        unread_count = await self.get_unread_notification_count()
        await self.send(text_data=json.dumps({
            'type': 'initial_data',
            'unread_notifications': unread_count,
            'user_id': self.user.id,
            'is_admin': self.user.is_staff
        }))

    async def send_dashboard_stats(self):
        """Send dashboard statistics"""
        if not self.user.is_staff:
            return

        stats = await self.get_dashboard_stats()
        await self.send(text_data=json.dumps({
            'type': 'dashboard_stats',
            'data': stats
        }))

    @database_sync_to_async
    def get_unread_notification_count(self):
        """Get recent notification count for user (last 24 hours)"""
        from django.utils import timezone
        from datetime import timedelta

        try:
            # Since NotificationLog doesn't have is_read field,
            # return count of recent notifications (last 24 hours)
            yesterday = timezone.now() - timedelta(days=1)
            return NotificationLog.objects.filter(
                recipient=self.user.employee_profile,
                created_at__gte=yesterday
            ).count()
        except AttributeError:
            # User doesn't have employee_profile
            return 0

    @database_sync_to_async
    def get_dashboard_stats(self):
        """Get dashboard statistics"""
        from apps.attendance.models import TimeLog
        from apps.employees.models import Employee
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())

        # Active employees
        active_employees = Employee.objects.filter(employment_status='ACTIVE').count()

        # Today's attendance
        today_attendance = TimeLog.objects.filter(
            clock_in_time__date=today
        ).count()

        # Currently clocked in
        clocked_in = TimeLog.objects.filter(
            status='CLOCKED_IN'
        ).count()

        # This week's total hours
        week_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=week_start,
            status='CLOCKED_OUT'
        )
        week_hours = sum([log.duration_hours for log in week_logs if log.duration_hours]) or 0

        return {
            'active_employees': active_employees,
            'today_attendance': today_attendance,
            'currently_clocked_in': clocked_in,
            'week_total_hours': round(week_hours, 2),
            'timestamp': timezone.now().isoformat()
        }

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Mark notification as read (placeholder - NotificationLog doesn't support read status)"""
        try:
            notification = NotificationLog.objects.get(
                id=notification_id,
                recipient=self.user.employee_profile
            )
            # NotificationLog doesn't have is_read field
            # This is a placeholder for future implementation
            # Could add a separate UserNotificationRead model if needed
            return True
        except (NotificationLog.DoesNotExist, AttributeError):
            return False

    # Message handlers for group messages
    async def notification_message(self, event):
        """Handle notification messages from group"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'message': event['message'],
            'data': event.get('data', {})
        }))

    async def dashboard_update(self, event):
        """Handle dashboard update messages"""
        await self.send(text_data=json.dumps({
            'type': 'dashboard_update',
            'data': event['data']
        }))

    async def attendance_update(self, event):
        """Handle attendance update messages"""
        await self.send(text_data=json.dumps({
            'type': 'attendance_update',
            'data': event['data']
        }))
