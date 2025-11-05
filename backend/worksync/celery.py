"""
Celery configuration for WorkSync
"""
import os
from celery import Celery
import django
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')


django.setup()
app = Celery('worksync')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Import break compliance tasks
try:
    from apps.attendance.break_compliance import check_break_reminders, generate_break_compliance_report
except ImportError:
    pass

# Celery Beat Schedule
app.conf.beat_schedule = {
    'cleanup-webhook-deliveries': {
        'task': 'apps.notifications.tasks.cleanup_old_webhook_deliveries',
        'schedule': 86400.0,  # Run daily
    },
    'cleanup-notification-logs': {
        'task': 'apps.notifications.tasks.cleanup_old_notification_logs',
        'schedule': 86400.0,  # Run daily
    },
    'check-break-reminders': {
        'task': 'apps.attendance.break_compliance.check_break_reminders',
        'schedule': 1800.0,  # Run every 30 minutes
    },
    'generate-break-compliance-report': {
        'task': 'apps.attendance.break_compliance.generate_break_compliance_report',
        'schedule': 86400.0,  # Run daily at midnight
    },
    'monitor-stuck-clockins': {
        'task': 'apps.attendance.stuck_clockin_monitor.monitor_stuck_clockins',
        'schedule': 3600.0,  # Run every hour
    },
    'generate-stuck-clockin-report': {
        'task': 'apps.attendance.stuck_clockin_monitor.generate_stuck_clockin_report',
        'schedule': 86400.0,  # Run daily
    },
}

app.conf.timezone = 'UTC'

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
