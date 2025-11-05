from django.core.management.base import BaseCommand
from apps.notifications.models import NotificationTemplate


class Command(BaseCommand):
    help = 'Create default notification templates'

    def handle(self, *args, **options):
        templates = [
            {
                'name': 'Clock In Notification',
                'notification_type': 'PUSH',
                'event_type': 'clock_in',
                'subject': 'Clock In Recorded',
                'message_template': 'Employee {{ employee_name }} clocked in at {{ clock_in_time }} at {{ location }}.',
                'is_active': True,
            },
            {
                'name': 'Clock Out Notification',
                'notification_type': 'PUSH',
                'event_type': 'clock_out',
                'subject': 'Clock Out Recorded',
                'message_template': 'Employee {{ employee_name }} clocked out at {{ clock_out_time }} at {{ location }}. Total hours: {{ total_hours }}.',
                'is_active': True,
            },
            {
                'name': 'Overtime Alert',
                'notification_type': 'PUSH',
                'event_type': 'overtime',
                'subject': 'Overtime Alert',
                'message_template': 'Employee {{ employee_name }} has worked {{ total_hours }} hours today, exceeding the standard 8-hour workday.',
                'is_active': True,
            },
            {
                'name': 'Late Clock In Alert',
                'notification_type': 'PUSH',
                'event_type': 'late_clock_in',
                'subject': 'Late Clock In Alert',
                'message_template': 'Employee {{ employee_name }} clocked in late at {{ clock_in_time }}. Scheduled start time was {{ scheduled_start_time }}.',
                'is_active': True,
            },
            {
                'name': 'Missed Clock Out Alert',
                'notification_type': 'PUSH',
                'event_type': 'missed_clock_out',
                'subject': 'Missed Clock Out Alert',
                'message_template': 'Employee {{ employee_name }} has not clocked out. Last clock in was at {{ clock_in_time }}.',
                'is_active': True,
            },
            {
                'name': 'Shift Reminder',
                'notification_type': 'PUSH',
                'event_type': 'shift_reminder',
                'subject': 'Upcoming Shift Reminder',
                'message_template': 'Reminder: You have a shift scheduled from {{ start_time }} to {{ end_time }} at {{ location }}.',
                'is_active': True,
            },
            {
                'name': 'Break Reminder',
                'notification_type': 'PUSH',
                'event_type': 'break_reminder',
                'subject': 'Break Time Reminder',
                'message_template': 'You have been working for {{ hours_worked }} hours. Consider taking a break.',
                'is_active': True,
            },
            {
                'name': 'Weekly Hours Summary',
                'notification_type': 'EMAIL',
                'event_type': 'weekly_summary',
                'subject': 'Weekly Hours Summary',
                'message_template': 'Weekly summary for {employee_name}: Total hours: {total_hours}, Regular: {regular_hours}, Overtime: {overtime_hours}.',
                'is_active': True,
            },
            {
                'name': 'Leave Request Submitted',
                'notification_type': 'PUSH',
                'event_type': 'leave_request_submitted',
                'subject': 'Leave Request Submitted',
                'message_template': 'Leave request submitted by {employee_name} for {leave_dates}. Reason: {reason}.',
                'is_active': True,
            },
            {
                'name': 'Leave Request Approved',
                'notification_type': 'PUSH',
                'event_type': 'leave_request_approved',
                'subject': 'Leave Request Approved',
                'message_template': 'Your leave request for {leave_dates} has been approved by {approver_name}.',
                'is_active': True,
            },
            {
                'name': 'Leave Request Rejected',
                'notification_type': 'PUSH',
                'event_type': 'leave_request_rejected',
                'subject': 'Leave Request Rejected',
                'message_template': 'Your leave request for {leave_dates} has been rejected. Reason: {rejection_reason}.',
                'is_active': True,
            },
            {
                'name': 'Schedule Published',
                'notification_type': 'PUSH',
                'event_type': 'schedule_published',
                'subject': 'New Schedule Published',
                'message_template': 'Your schedule for {week_dates} has been published. Check your shifts in the app.',
                'is_active': True,
            },
            {
                'name': 'Shift Assignment',
                'notification_type': 'PUSH',
                'event_type': 'shift_assigned',
                'subject': 'New Shift Assignment',
                'message_template': 'You have been assigned a new shift: {shift_date} from {start_time} to {end_time} at {location}.',
                'is_active': True,
            },
            {
                'name': 'Shift Cancellation',
                'notification_type': 'PUSH',
                'event_type': 'shift_cancelled',
                'subject': 'Shift Cancelled',
                'message_template': 'Your shift on {shift_date} from {start_time} to {end_time} has been cancelled.',
                'is_active': True,
            },
            {
                'name': 'Employee Birthday',
                'notification_type': 'PUSH',
                'event_type': 'employee_birthday',
                'subject': 'Happy Birthday!',
                'message_template': 'Happy Birthday {employee_name}! Wishing you a wonderful day!',
                'is_active': True,
            },
            {
                'name': 'Work Anniversary',
                'notification_type': 'PUSH',
                'event_type': 'work_anniversary',
                'subject': 'Work Anniversary',
                'message_template': 'Congratulations {employee_name} on your {years} year work anniversary!',
                'is_active': True,
            },
            {
                'name': 'Overtime Admin Alert',
                'notification_type': 'EMAIL',
                'event_type': 'overtime_admin',
                'subject': 'Employee Overtime Alert - {{ employee_name }}',
                'message_template': 'Employee {{ employee_name }} ({{ employee_id }}) has worked {{ total_hours }} hours on {{ date }}, exceeding the standard 8-hour workday.',
                'is_active': True,
            },
            {
                'name': 'Break Waived Admin Notification',
                'notification_type': 'EMAIL',
                'event_type': 'break_waived',
                'subject': 'Break Waived - {{ employee_name }}',
                'message_template': 'Employee {{ employee_name }} ({{ employee_id }}) has waived their break. Reason: {{ waiver_reason }}. Hours worked: {{ hours_worked }}.',
                'is_active': True,
            },
            {
                'name': 'Break Compliance Violation',
                'notification_type': 'EMAIL',
                'event_type': 'break_compliance_violation',
                'subject': 'Break Compliance Violation - {{ employee_name }}',
                'message_template': 'COMPLIANCE ALERT: Employee {{ employee_name }} ({{ employee_id }}) worked {{ hours_worked }} hours without taking required break or recording waiver on {{ date }}.',
                'is_active': True,
            },
        ]

        created_count = 0
        updated_count = 0

        for template_data in templates:
            template, created = NotificationTemplate.objects.get_or_create(
                event_type=template_data['event_type'],
                defaults=template_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created template: {template.name}')
                )
            else:
                # Update existing template with new data
                for key, value in template_data.items():
                    setattr(template, key, value)
                template.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated template: {template.name}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed {len(templates)} templates. '
                f'Created: {created_count}, Updated: {updated_count}'
            )
        )
