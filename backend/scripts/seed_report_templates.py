import os
import django
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.reports.models import ReportTemplate

User = get_user_model()

def seed_templates():
    # Get admin user
    try:
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            print("No admin user found. Please create a superuser first.")
            return
    except Exception as e:
        print(f"Error getting admin user: {e}")
        return

    templates = [
        {
            'name': 'Late Arrival Report',
            'description': 'Report of employees who arrived late to work',
            'report_type': 'LATE_ARRIVAL',
            'format': 'CSV',
            'config': {'threshold_minutes': 15}
        },
        {
            'name': 'Overtime Report',
            'description': 'Report of employees who worked overtime hours',
            'report_type': 'OVERTIME',
            'format': 'CSV',
            'config': {'daily_threshold': 8, 'weekly_threshold': 40}
        },
        {
            'name': 'Department Summary',
            'description': 'Summary of attendance by department',
            'report_type': 'DEPARTMENT_SUMMARY',
            'format': 'CSV',
            'config': {}
        },
        {
            'name': 'Attendance Summary',
            'description': 'Detailed attendance summary for all employees',
            'report_type': 'ATTENDANCE_SUMMARY',
            'format': 'CSV',
            'config': {}
        },
        {
            'name': 'Detailed Timesheet',
            'description': 'Detailed timesheet with break breakdowns and overtime calculation',
            'report_type': 'DETAILED_TIMESHEET',
            'format': 'CSV',
            'config': {}
        },
        {
            'name': 'Break Compliance Report',
            'description': 'Report on break compliance and waivers',
            'report_type': 'BREAK_COMPLIANCE',
            'format': 'CSV',
            'config': {}
        }
    ]

    for t in templates:
        # Check for existing templates of this type
        existing = ReportTemplate.objects.filter(report_type=t['report_type'])
        if existing.count() > 1:
            print(f"Found {existing.count()} templates for {t['report_type']}. Cleaning up...")
            existing.delete()
        
        template, created = ReportTemplate.objects.update_or_create(
            report_type=t['report_type'],
            defaults={
                'name': t['name'],
                'description': t['description'],
                'format': t['format'],
                'config': t['config'],
                'created_by': admin_user,
                'is_active': True
            }
        )
        
        if created:
            print(f"Created template: {template.name}")
        else:
            print(f"Updated template: {template.name}")

if __name__ == '__main__':
    seed_templates()
