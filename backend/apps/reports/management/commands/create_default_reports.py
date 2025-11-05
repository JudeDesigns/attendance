"""
Management command to create default report templates
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.reports.models import ReportTemplate


class Command(BaseCommand):
    help = 'Create default report templates'
    
    def handle(self, *args, **options):
        # Get admin user
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(
                self.style.ERROR('No admin user found. Please create an admin user first.')
            )
            return
        
        # Default report templates
        templates = [
            {
                'name': 'Late Arrival Report',
                'description': 'Report showing employees who arrived late to work',
                'report_type': 'LATE_ARRIVAL',
                'format': 'CSV',
                'config': {
                    'grace_period_minutes': 5,
                    'include_weekends': False
                }
            },
            {
                'name': 'Overtime Report',
                'description': 'Report showing employees who worked overtime hours',
                'report_type': 'OVERTIME',
                'format': 'CSV',
                'config': {
                    'overtime_threshold_hours': 8,
                    'calculate_pay': True
                }
            },
            {
                'name': 'Department Summary',
                'description': 'Summary report by department showing attendance metrics',
                'report_type': 'DEPARTMENT_SUMMARY',
                'format': 'CSV',
                'config': {
                    'include_inactive_employees': False
                }
            },
            {
                'name': 'Attendance Summary',
                'description': 'Detailed attendance summary for all employees',
                'report_type': 'ATTENDANCE_SUMMARY',
                'format': 'CSV',
                'config': {
                    'include_break_details': True,
                    'calculate_compliance': True
                }
            },
            {
                'name': 'Late Arrival Report (PDF)',
                'description': 'Late arrival report in PDF format for management',
                'report_type': 'LATE_ARRIVAL',
                'format': 'PDF',
                'config': {
                    'grace_period_minutes': 5,
                    'include_charts': True
                }
            },
            {
                'name': 'Overtime Report (JSON)',
                'description': 'Overtime report in JSON format for API integration',
                'report_type': 'OVERTIME',
                'format': 'JSON',
                'config': {
                    'overtime_threshold_hours': 8,
                    'include_metadata': True
                }
            }
        ]
        
        created_count = 0
        
        for template_data in templates:
            template, created = ReportTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults={
                    'description': template_data['description'],
                    'report_type': template_data['report_type'],
                    'format': template_data['format'],
                    'config': template_data['config'],
                    'created_by': admin_user,
                    'is_active': True
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created report template: {template.name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Report template already exists: {template.name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} report templates')
        )
