"""
Notification service for automated notifications
"""
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.template import Template, Context
from django.core.mail import send_mail
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import requests
import json

from apps.employees.models import Employee
from apps.core.timezone_utils import convert_to_naive_la_time
from .models import NotificationTemplate, NotificationLog

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending automated notifications"""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
    
    def send_notification(self, event_type, recipient, context_data=None, notification_type=None):
        """
        Send a notification based on event type
        
        Args:
            event_type (str): The type of event (e.g., 'clock_in', 'overtime')
            recipient (Employee): The employee to notify
            context_data (dict): Data to fill template placeholders
            notification_type (str): Override notification type if needed
        """
        try:
            # Get the template for this event type
            template = NotificationTemplate.objects.filter(
                event_type=event_type,
                is_active=True
            ).first()
            
            if not template:
                logger.warning(f"No active template found for event type: {event_type}")
                return False
            
            # Prepare context data
            context = context_data or {}
            context.update({
                'employee_name': f"{recipient.user.first_name} {recipient.user.last_name}",
                'employee_email': recipient.user.email,
                'timestamp': convert_to_naive_la_time(timezone.now()).strftime('%Y-%m-%d %H:%M:%S'),
            })
            
            # Render the message template
            message_template = Template(template.message_template)
            rendered_message = message_template.render(Context(context))
            
            # Render the subject template
            subject_template = Template(template.subject)
            rendered_subject = subject_template.render(Context(context))
            
            # Create notification log
            notification_log = NotificationLog.objects.create(
                recipient=recipient,
                template=template,
                notification_type=notification_type or template.notification_type,
                event_type=event_type,
                subject=rendered_subject,
                message=rendered_message,
                recipient_address=recipient.user.email,
                status='PENDING'
            )
            
            # Send real-time notification via WebSocket (always send for immediate feedback)
            self._send_websocket_notification(recipient, {
                'id': str(notification_log.id),
                'type': 'notification',
                'event_type': event_type,
                'subject': rendered_subject,
                'message': rendered_message,
                'timestamp': notification_log.created_at.isoformat(),
                'notification_type': notification_log.notification_type,
            })

            # Send via appropriate channel based on notification type
            success = True
            if notification_log.notification_type == 'EMAIL':
                success = self._send_email_notification(notification_log)
            elif notification_log.notification_type == 'SMS':
                success = self._send_sms_notification(notification_log)
            elif notification_log.notification_type == 'PUSH':
                success = self._send_push_notification(notification_log, rendered_subject, rendered_message)
            else:
                # For WEBHOOK, mark as sent (WebSocket already sent)
                notification_log.status = 'SENT'
                notification_log.sent_at = timezone.now()
                notification_log.save()

            logger.info(f"Notification sent to {recipient.user.email} for event: {event_type} via {notification_log.notification_type}")
            return success
            
        except Exception as e:
            logger.error(f"Failed to send notification for event {event_type}: {str(e)}")
            return False
    
    def _send_websocket_notification(self, recipient, notification_data):
        """Send real-time notification via WebSocket"""
        if self.channel_layer:
            try:
                user_group_name = f"notifications_{recipient.user.id}"
                async_to_sync(self.channel_layer.group_send)(
                    user_group_name,
                    notification_data
                )
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification: {str(e)}")

    def _send_email_notification(self, notification_log):
        """Send email notification"""
        try:
            if not notification_log.recipient.user.email:
                logger.warning(f"No email address for user {notification_log.recipient.user.username}")
                return False

            subject = notification_log.subject or f"WorkSync Notification: {notification_log.event_type}"
            message = notification_log.message
            from_email = settings.DEFAULT_FROM_EMAIL
            recipient_list = [notification_log.recipient.user.email]

            # Use the email queue system that works in production
            from apps.notifications.email_queue import EmailQueue

            EmailQueue.queue_email(
                email_type=notification_log.event_type,
                recipient=notification_log.recipient.user.email,
                subject=subject,
                message=message,
                template_data={'employee_name': notification_log.recipient.name}
            )

            notification_log.status = 'SENT'
            notification_log.sent_at = timezone.now()
            notification_log.save()

            logger.info(f"Email sent to {notification_log.recipient.user.email} for event {notification_log.event_type}")
            return True

        except Exception as e:
            notification_log.status = 'FAILED'
            notification_log.error_message = str(e)
            notification_log.save()
            logger.error(f"Failed to send email notification: {str(e)}")
            return False

    def _send_sms_notification(self, notification_log):
        """Send SMS notification via Twilio"""
        try:
            if not hasattr(notification_log.recipient, 'phone_number') or not notification_log.recipient.phone_number:
                logger.warning(f"No phone number for user {notification_log.recipient.user.username}")
                return False

            if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
                logger.warning("Twilio credentials not configured")
                return False

            # Twilio API endpoint
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"

            # Prepare SMS message (limit to 160 characters)
            message = notification_log.message[:160]
            if len(notification_log.message) > 160:
                message = message[:157] + "..."

            data = {
                'From': settings.TWILIO_PHONE_NUMBER,
                'To': notification_log.recipient.phone_number,
                'Body': message
            }

            response = requests.post(
                url,
                data=data,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            )

            if response.status_code == 201:
                notification_log.status = 'SENT'
                notification_log.sent_at = timezone.now()
                notification_log.save()
                logger.info(f"SMS sent to {notification_log.recipient.phone_number} for event {notification_log.event_type}")
                return True
            else:
                raise Exception(f"Twilio API error: {response.status_code} - {response.text}")

        except Exception as e:
            notification_log.status = 'FAILED'
            notification_log.error_message = str(e)
            notification_log.save()
            logger.error(f"Failed to send SMS notification: {str(e)}")
            return False

    def send_clock_in_notification(self, employee, time_log):
        """Send notification when employee clocks in"""
        from apps.core.timezone_utils import convert_to_naive_la_time
        location_name = time_log.clock_in_location.name if time_log.clock_in_location else "Unknown Location"
        pst_time = convert_to_naive_la_time(time_log.clock_in_time)
        
        context = {
            'clock_in_time': pst_time.strftime('%H:%M:%S'),
            'location': location_name,
            'date': pst_time.strftime('%Y-%m-%d'),
        }
        
        # Notify the employee
        employee_result = self.send_notification('clock_in', employee, context)
        
        # Also notify admins
        admin_context = {
            **context,
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
        }
        self.send_notification_to_admins(
            'clock_in',
            admin_context,
            custom_message=f"{admin_context['employee_name']} ({employee.employee_id}) clocked in at {pst_time.strftime('%I:%M %p')} at {location_name}.",
            custom_subject=f"Clock In: {admin_context['employee_name']}"
        )
        
        return employee_result
    
    def send_clock_out_notification(self, employee, time_log):
        """Send notification when employee clocks out"""
        location_name = time_log.clock_out_location.name if time_log.clock_out_location else "Unknown Location"
        
        # Calculate total hours
        if time_log.clock_in_time and time_log.clock_out_time:
            duration = time_log.clock_out_time - time_log.clock_in_time
            total_hours = round(duration.total_seconds() / 3600, 2)
        else:
            total_hours = 0
        
        context = {
            'clock_out_time': time_log.clock_out_time.strftime('%H:%M:%S'),
            'location': location_name,
            'total_hours': total_hours,
            'date': time_log.clock_out_time.strftime('%Y-%m-%d'),
        }
        
        # Notify the employee
        employee_result = self.send_notification('clock_out', employee, context)

        # Also notify admins
        admin_context = {
            **context,
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
        }
        
        # We need the pst time for the message just like clock_in
        from apps.core.timezone_utils import convert_to_naive_la_time
        pst_time = convert_to_naive_la_time(time_log.clock_out_time)

        self.send_notification_to_admins(
            'clock_out',
            admin_context,
            custom_message=f"{admin_context['employee_name']} ({employee.employee_id}) clocked out at {pst_time.strftime('%I:%M %p')} at {location_name}. Total hours: {total_hours}.",
            custom_subject=f"Clock Out: {admin_context['employee_name']}"
        )
        
        return employee_result
    
    def send_overtime_alert(self, employee, total_hours):
        """Send alert when employee works overtime"""
        context = {
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
            'total_hours': total_hours,
            'date': convert_to_naive_la_time(timezone.now()).strftime('%Y-%m-%d'),
        }

        # Send notification to employee
        employee_success = self.send_notification('overtime', employee, context)

        # Also notify admin users about overtime (simplified for Admin/Employee system)
        admin_success = self.send_notification_to_admins('overtime_admin', context)

        return employee_success or admin_success
    
    def send_late_clock_in_alert(self, employee, time_log, scheduled_start_time):
        """Send alert when employee clocks in late"""
        context = {
            'clock_in_time': time_log.clock_in_time.strftime('%H:%M:%S'),
            'scheduled_start_time': scheduled_start_time.strftime('%H:%M:%S'),
            'date': time_log.clock_in_time.strftime('%Y-%m-%d'),
        }
        
        return self.send_notification('late_clock_in', employee, context)
    
    def send_missed_clock_out_alert(self, employee, time_log):
        """Send alert when employee misses clock out"""
        context = {
            'clock_in_time': time_log.clock_in_time.strftime('%H:%M:%S'),
            'date': time_log.clock_in_time.strftime('%Y-%m-%d'),
        }
        
        return self.send_notification('missed_clock_out', employee, context)
    
    def send_shift_reminder(self, employee, shift):
        """Send reminder about upcoming shift"""
        location_name = shift.location.name if shift.location else "TBD"
        
        context = {
            'start_time': shift.start_time.strftime('%H:%M'),
            'end_time': shift.end_time.strftime('%H:%M'),
            'location': location_name,
            'shift_date': shift.date.strftime('%Y-%m-%d'),
        }
        
        return self.send_notification('shift_reminder', employee, context)
    
    def send_shift_assignment_notification(self, employee, shift):
        """Send notification about new shift assignment"""
        location_name = shift.location.name if shift.location else "TBD"
        
        context = {
            'shift_date': shift.date.strftime('%Y-%m-%d'),
            'start_time': shift.start_time.strftime('%H:%M'),
            'end_time': shift.end_time.strftime('%H:%M'),
            'location': location_name,
        }
        
        return self.send_notification('shift_assigned', employee, context)
    
    def send_shift_cancellation_notification(self, employee, shift):
        """Send notification about shift cancellation"""
        context = {
            'shift_date': shift.date.strftime('%Y-%m-%d'),
            'start_time': shift.start_time.strftime('%H:%M'),
            'end_time': shift.end_time.strftime('%H:%M'),
        }
        
        return self.send_notification('shift_cancelled', employee, context)
    
    def send_break_reminder(self, employee, hours_worked, break_type='LUNCH', is_overdue=False):
        """Send break reminder with enhanced context"""
        from .break_templates import format_break_notification

        # Determine template based on urgency
        template_key = 'break_overdue' if is_overdue else 'break_reminder'

        context = {
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
            'hours_worked': hours_worked,
            'break_type': break_type,
            'is_overdue': is_overdue,
            'date': convert_to_naive_la_time(timezone.now()).strftime('%Y-%m-%d'),
            'time': convert_to_naive_la_time(timezone.now()).strftime('%H:%M'),
        }

        # Format notification using template
        formatted_notification = format_break_notification(template_key, context)

        # Send using formatted content
        return self.send_notification(
            template_key,
            employee,
            context,
            custom_message=formatted_notification.get('message'),
            custom_subject=formatted_notification.get('email_subject')
        )

    def send_break_waiver_notification(self, employee, waiver_reason, hours_worked):
        """Send notification when break is waived"""
        from .break_templates import format_break_notification

        context = {
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
            'waiver_reason': waiver_reason,
            'hours_worked': hours_worked,
            'date': convert_to_naive_la_time(timezone.now()).strftime('%Y-%m-%d'),
            'time': convert_to_naive_la_time(timezone.now()).strftime('%H:%M'),
        }

        # Format notification using template
        formatted_notification = format_break_notification('break_waived', context)

        # Send to all admin users (simplified for Admin/Employee system)
        return self.send_notification_to_admins(
            'break_waived',
            context
        )

    def send_break_compliance_violation(self, employee, hours_worked):
        """Send compliance violation notification"""
        from .break_templates import format_break_notification

        context = {
            'employee_name': employee.full_name,
            'employee_id': employee.employee_id,
            'hours_worked': hours_worked,
            'date': convert_to_naive_la_time(timezone.now()).strftime('%Y-%m-%d'),
        }

        # Format notification using template
        formatted_notification = format_break_notification('break_compliance_violation', context)

        # Send to all admin users (simplified for Admin/Employee system)
        return self.send_notification_to_admins(
            'break_compliance_violation',
            context
        )
    
    def send_weekly_summary(self, employee, total_hours, regular_hours, overtime_hours):
        """Send weekly hours summary"""
        context = {
            'total_hours': total_hours,
            'regular_hours': regular_hours,
            'overtime_hours': overtime_hours,
            'week_start': (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
            'week_end': timezone.now().strftime('%Y-%m-%d'),
        }
        
        return self.send_notification('weekly_summary', employee, context, 'EMAIL')

    def send_stuck_clockin_notification(self, template_key, employee, context):
        """Send stuck clock-in notification using templates"""
        from .stuck_clockin_templates import format_stuck_clockin_notification

        try:
            formatted_notification = format_stuck_clockin_notification(template_key, context)

            return self.send_notification(
                template_key,
                employee,
                context,
                custom_message=formatted_notification.get('message'),
                custom_subject=formatted_notification.get('email_subject')
            )

        except Exception as e:
            logger.error(f"Error sending stuck clock-in notification: {str(e)}")
            return False

    def _send_push_notification(self, notification_log, title, message):
        """Send push notification using the push service"""
        try:
            from .push_service import push_service

            # Get the employee/user from the notification log
            employee = notification_log.recipient
            user = employee.user

            # Send push notification
            results = push_service.send_to_user(
                user=user,
                title=title,
                body=message,
                icon='/favicon.ico',
                tag=f'notification-{notification_log.id}',
                data={
                    'notification_id': str(notification_log.id),
                    'event_type': notification_log.event_type,
                    'timestamp': notification_log.created_at.isoformat(),
                },
                notification_log_id=str(notification_log.id)
            )

            # Check if any notifications were sent successfully
            if results['sent'] > 0:
                notification_log.status = 'SENT'
                notification_log.sent_at = timezone.now()
                notification_log.save()
                logger.info(f"Push notification sent to {user.username}: {results}")
                return True
            elif results['skipped'] > 0:
                # User has notifications disabled or no active subscriptions
                notification_log.status = 'SENT'  # Mark as sent to avoid retries
                notification_log.sent_at = timezone.now()
                notification_log.save()
                logger.info(f"Push notification skipped for {user.username}: {results}")
                return True
            else:
                # All notifications failed
                notification_log.status = 'FAILED'
                notification_log.error_message = f"Push notification failed: {results}"
                notification_log.save()
                logger.error(f"Push notification failed for {user.username}: {results}")
                return False

        except Exception as e:
            logger.error(f"Error sending push notification: {str(e)}")
            notification_log.status = 'FAILED'
            notification_log.error_message = str(e)
            notification_log.save()
            return False

    def send_notification_to_admins(self, event_type, context_data, custom_message=None, custom_subject=None):
        """Send notification to all admin users (simplified for Admin/Employee system)"""
        from apps.employees.models import Employee
        from django.db.models import Q

        try:
            # Get all admin users - case-insensitive role match + is_staff fallback
            admin_employees = Employee.objects.filter(
                Q(role__name__iexact='admin') | Q(role__name__iexact='administrator') | Q(user__is_staff=True)
            ).distinct()

            if not admin_employees.exists():
                logger.warning("No admin users found to send notification to")
                return False

            success_count = 0
            for admin in admin_employees:
                try:
                    # Use the standard send_notification method (without custom parameters)
                    success = self.send_notification(
                        event_type,
                        admin,
                        context_data
                    )
                    if success:
                        success_count += 1
                except Exception as e:
                    logger.error(f"Error sending notification to admin {admin.employee_id}: {str(e)}")
                    continue

            logger.info(f"Sent {event_type} notification to {success_count}/{admin_employees.count()} admin users")
            return success_count > 0

        except Exception as e:
            logger.error(f"Error sending notification to admins: {str(e)}")
            return False


# Global instance
notification_service = NotificationService()
