"""
Unified Email Queue System
Handles all email types that need to be sent via shell command
"""
import os
import json
import time
import uuid
from django.conf import settings

class EmailQueue:
    """
    Queue system for emails that need to be sent via shell command
    Each email is queued once and removed after sending
    """
    
    QUEUE_DIR = '/var/www/attendance/backend/email_queue'
    
    @classmethod
    def ensure_queue_dir(cls):
        """Create queue directory if it doesn't exist"""
        os.makedirs(cls.QUEUE_DIR, exist_ok=True)
    
    @classmethod
    def queue_email(cls, email_type, recipient, subject, message, template_data=None):
        """
        Queue an email for sending
        
        Args:
            email_type: Type of email (test, break_reminder, shift_alert, etc.)
            recipient: Email address to send to
            subject: Email subject
            message: Email message/body
            template_data: Optional data for email templates
        """
        cls.ensure_queue_dir()
        
        # Create unique filename to prevent duplicates
        email_id = str(uuid.uuid4())
        timestamp = int(time.time())
        filename = f'{email_type}_{timestamp}_{email_id}.json'
        
        email_data = {
            'id': email_id,
            'type': email_type,
            'recipient': recipient,
            'subject': subject,
            'message': message,
            'template_data': template_data or {},
            'created_at': timestamp,
            'status': 'queued'
        }
        
        filepath = os.path.join(cls.QUEUE_DIR, filename)
        with open(filepath, 'w') as f:
            json.dump(email_data, f, indent=2)
        
        return email_id
    
    @classmethod
    def queue_test_email(cls, recipient):
        """Queue a test email"""
        return cls.queue_email(
            email_type='test',
            recipient=recipient,
            subject='Attendance Email Test',
            message='This is a test email from Attendance to verify your configuration.'
        )
    
    @classmethod
    def queue_break_reminder(cls, employee_email, employee_name):
        """Queue a break reminder email"""
        return cls.queue_email(
            email_type='break_reminder',
            recipient=employee_email,
            subject='Break Reminder - Attendance System',
            message=f'Hi {employee_name},\n\nThis is a reminder that you are required to take a break. Please clock out for your break now.\n\nThank you,\nAttendance System',
            template_data={'employee_name': employee_name}
        )
    
    @classmethod
    def queue_shift_reminder(cls, employee_email, employee_name, shift_start, shift_end):
        """Queue a shift reminder email"""
        return cls.queue_email(
            email_type='shift_reminder',
            recipient=employee_email,
            subject='Upcoming Shift Reminder - Attendance System',
            message=f'Hi {employee_name},\n\nReminder: You have a shift scheduled from {shift_start} to {shift_end}.\n\nPlease make sure to clock in on time.\n\nThank you,\nAttendance System',
            template_data={
                'employee_name': employee_name,
                'shift_start': shift_start,
                'shift_end': shift_end
            }
        )
    
    @classmethod
    def queue_schedule_change(cls, employee_email, employee_name, change_details):
        """Queue a schedule change notification email"""
        return cls.queue_email(
            email_type='schedule_change',
            recipient=employee_email,
            subject='Schedule Change Notification - Attendance System',
            message=f'Hi {employee_name},\n\nYour schedule has been updated:\n\n{change_details}\n\nPlease review your updated schedule.\n\nThank you,\nAttendance System',
            template_data={
                'employee_name': employee_name,
                'change_details': change_details
            }
        )
    
    @classmethod
    def get_queue_count(cls):
        """Get number of emails in queue"""
        cls.ensure_queue_dir()
        return len([f for f in os.listdir(cls.QUEUE_DIR) if f.endswith('.json')])
