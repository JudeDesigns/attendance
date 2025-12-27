"""
Celery tasks for notifications and webhooks
"""
from celery import shared_task
from django.utils import timezone
from django.conf import settings
import requests
import logging
from datetime import timedelta

from .models import WebhookSubscription, WebhookDelivery, NotificationLog
from apps.employees.models import Employee

logger = logging.getLogger('worksync.notifications')


@shared_task(bind=True, max_retries=3)
def send_webhook_notification(self, event_type, payload):
    """
    Send webhook notification to all subscribed endpoints
    """
    try:
        subscriptions = WebhookSubscription.objects.filter(
            event_type=event_type,
            is_active=True
        )
        
        for subscription in subscriptions:
            # Create delivery record
            delivery = WebhookDelivery.objects.create(
                subscription=subscription,
                event_type=event_type,
                payload=payload,
                status='PENDING'
            )
            
            # Send webhook in separate task
            send_single_webhook.delay(delivery.id)
            
        logger.info(f"Queued webhook notifications for event: {event_type}")
        
    except Exception as e:
        logger.error(f"Error queuing webhook notifications for {event_type}: {str(e)}")
        raise


@shared_task(bind=True, max_retries=3)
def send_single_webhook(self, delivery_id):
    """
    Send a single webhook notification
    """
    try:
        delivery = WebhookDelivery.objects.get(id=delivery_id)
        delivery.attempt_count += 1
        delivery.status = 'RETRYING' if delivery.attempt_count > 1 else 'PENDING'
        delivery.save()
        
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'WorkSync-Webhook/1.0',
            'X-WorkSync-Event': delivery.event_type,
            'X-WorkSync-Delivery': str(delivery.id),
        }
        
        # Add secret key if configured
        if delivery.subscription.secret_key:
            headers['X-WorkSync-Signature'] = delivery.subscription.secret_key
        
        # Send webhook
        response = requests.post(
            delivery.subscription.target_url,
            json=delivery.payload,
            headers=headers,
            timeout=30
        )
        
        # Update delivery record
        delivery.http_status_code = response.status_code
        delivery.response_body = response.text[:1000]  # Limit response body size
        
        if response.status_code == 200:
            delivery.status = 'SUCCESS'
            logger.info(f"Webhook delivered successfully: {delivery.id}")
        else:
            delivery.status = 'FAILED'
            delivery.error_message = f"HTTP {response.status_code}: {response.text[:500]}"
            logger.warning(f"Webhook delivery failed: {delivery.id} - {delivery.error_message}")
        
        delivery.save()
        
        # Retry if failed and retries available
        if delivery.status == 'FAILED' and delivery.can_retry:
            # Exponential backoff: 1min, 5min, 15min
            retry_delays = [60, 300, 900]
            delay = retry_delays[min(delivery.attempt_count - 1, len(retry_delays) - 1)]
            
            delivery.next_retry_at = timezone.now() + timedelta(seconds=delay)
            delivery.save()
            
            # Schedule retry
            send_single_webhook.apply_async(args=[delivery_id], countdown=delay)
            logger.info(f"Webhook retry scheduled for delivery {delivery.id} in {delay} seconds")
        
    except WebhookDelivery.DoesNotExist:
        logger.error(f"Webhook delivery not found: {delivery_id}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Webhook request error for delivery {delivery_id}: {str(e)}")
        
        # Update delivery record
        try:
            delivery = WebhookDelivery.objects.get(id=delivery_id)
            delivery.status = 'FAILED'
            delivery.error_message = str(e)
            delivery.save()
            
            # Retry if available
            if delivery.can_retry:
                retry_delays = [60, 300, 900]
                delay = retry_delays[min(delivery.attempt_count - 1, len(retry_delays) - 1)]
                send_single_webhook.apply_async(args=[delivery_id], countdown=delay)
                
        except Exception as inner_e:
            logger.error(f"Error updating failed webhook delivery {delivery_id}: {str(inner_e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error sending webhook {delivery_id}: {str(e)}")
        raise


@shared_task
def send_sms_notification(employee_id, message, event_type=None):
    """
    Send SMS notification using Twilio
    """
    try:
        from twilio.rest import Client
        
        # Get Twilio credentials
        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_PHONE_NUMBER
        
        if not all([account_sid, auth_token, from_number]):
            logger.warning("Twilio credentials not configured, skipping SMS")
            return
        
        # Get employee
        employee = Employee.objects.get(id=employee_id)
        
        if not employee.phone_number:
            logger.warning(f"No phone number for employee {employee.employee_id}")
            return
        
        # Create notification log
        notification_log = NotificationLog.objects.create(
            recipient=employee,
            notification_type='SMS',
            event_type=event_type or 'general',
            message=message,
            recipient_address=employee.phone_number,
            status='PENDING'
        )
        
        # Send SMS
        client = Client(account_sid, auth_token)
        
        sms = client.messages.create(
            body=message,
            from_=from_number,
            to=employee.phone_number
        )
        
        # Update notification log
        notification_log.status = 'SENT'
        notification_log.external_id = sms.sid
        notification_log.sent_at = timezone.now()
        notification_log.save()
        
        logger.info(f"SMS sent to {employee.employee_id}: {sms.sid}")
        
    except Employee.DoesNotExist:
        logger.error(f"Employee not found: {employee_id}")
    except Exception as e:
        logger.error(f"Error sending SMS to employee {employee_id}: {str(e)}")
        
        # Update notification log if it exists
        try:
            notification_log.status = 'FAILED'
            notification_log.error_message = str(e)
            notification_log.save()
        except:
            pass


@shared_task
def send_email_notification(employee_id, subject, message, event_type=None):
    """
    Send email notification using dynamic configuration
    """
    try:
        from django.core.mail import get_connection, EmailMessage
        from .models import EmailConfiguration
        
        # Get active email configuration
        config = EmailConfiguration.objects.filter(is_active=True).first()
        
        if not config:
            logger.warning("No active email configuration found, skipping email")
            return
            
        # Get employee
        employee = Employee.objects.get(id=employee_id)
        
        if not employee.email:
            logger.warning(f"No email address for employee {employee.employee_id}")
            return
            
        # Create notification log
        notification_log = NotificationLog.objects.create(
            recipient=employee,
            notification_type='EMAIL',
            event_type=event_type or 'general',
            subject=subject,
            message=message,
            recipient_address=employee.email,
            status='PENDING'
        )
        
        # Create connection
        connection = get_connection(
            backend=config.email_backend,
            host=config.email_host,
            port=config.email_port,
            username=config.email_host_user,
            password=config.email_host_password,
            use_tls=config.email_use_tls
        )
        
        # Send email
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=config.default_from_email,
            to=[employee.email],
            connection=connection
        )
        email.send()
        
        # Update notification log
        notification_log.status = 'SENT'
        notification_log.sent_at = timezone.now()
        notification_log.save()
        
        logger.info(f"Email sent to {employee.employee_id}")
        
    except Employee.DoesNotExist:
        logger.error(f"Employee not found: {employee_id}")
    except Exception as e:
        logger.error(f"Error sending email to employee {employee_id}: {str(e)}")
        
        # Update notification log if it exists
        try:
            notification_log.status = 'FAILED'
            notification_log.error_message = str(e)
            notification_log.save()
        except:
            pass


@shared_task
def cleanup_old_webhook_deliveries():
    """
    Clean up old webhook delivery records (older than 30 days)
    """
    try:
        cutoff_date = timezone.now() - timedelta(days=30)
        
        deleted_count = WebhookDelivery.objects.filter(
            created_at__lt=cutoff_date
        ).delete()[0]
        
        logger.info(f"Cleaned up {deleted_count} old webhook delivery records")
        
    except Exception as e:
        logger.error(f"Error cleaning up webhook deliveries: {str(e)}")


@shared_task
def cleanup_old_notification_logs():
    """
    Clean up old notification logs (older than 90 days)
    """
    try:
        cutoff_date = timezone.now() - timedelta(days=90)
        
        deleted_count = NotificationLog.objects.filter(
            created_at__lt=cutoff_date
        ).delete()[0]
        
        logger.info(f"Cleaned up {deleted_count} old notification log records")
        
    except Exception as e:
        logger.error(f"Error cleaning up notification logs: {str(e)}")
