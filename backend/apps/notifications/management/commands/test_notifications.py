from django.core.management.base import BaseCommand
from django.template import Template, Context
from django.utils import timezone
from apps.notifications.models import NotificationTemplate, NotificationLog
from apps.employees.models import Employee
from apps.notifications.services import NotificationService


class Command(BaseCommand):
    help = 'Test notification template rendering'

    def handle(self, *args, **options):
        # Test 1: Direct template rendering
        self.stdout.write(self.style.SUCCESS('=== Test 1: Direct Template Rendering ==='))

        template = NotificationTemplate.objects.filter(
            event_type='clock_in',
            is_active=True
        ).first()

        if not template:
            self.stdout.write(self.style.ERROR('No clock_in template found'))
            return

        self.stdout.write(f'Template found: {template.name}')
        self.stdout.write(f'Template content: {repr(template.message_template)}')

        # Test context
        context = {
            'employee_name': 'John Doe',
            'clock_in_time': '09:00:00',
            'location': 'Main Office',
        }

        self.stdout.write(f'Context: {context}')

        try:
            # Render the template
            message_template = Template(template.message_template)
            rendered_message = message_template.render(Context(context))

            self.stdout.write(f'Rendered message: {rendered_message}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Template rendering error: {str(e)}'))

        # Test 2: Using NotificationService
        self.stdout.write(self.style.SUCCESS('\n=== Test 2: Using NotificationService ==='))

        # Get a test employee
        employee = Employee.objects.first()
        if not employee:
            self.stdout.write(self.style.ERROR('No employee found for testing'))
            return

        self.stdout.write(f'Test employee: {employee.user.get_full_name()}')

        # Create a mock time log object
        class MockTimeLog:
            def __init__(self):
                self.clock_in_time = timezone.now()
                self.clock_in_location = None

        mock_time_log = MockTimeLog()

        # Test the notification service
        notification_service = NotificationService()

        try:
            result = notification_service.send_clock_in_notification(employee, mock_time_log)
            self.stdout.write(f'Notification service result: {result}')

            # Check the most recent notification log
            recent_log = NotificationLog.objects.filter(
                event_type='clock_in',
                recipient=employee
            ).order_by('-created_at').first()

            if recent_log:
                self.stdout.write(f'Recent log message: {recent_log.message}')
                self.stdout.write(f'Recent log template: {recent_log.template.message_template if recent_log.template else "None"}')
            else:
                self.stdout.write('No recent notification log found')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'NotificationService error: {str(e)}'))
