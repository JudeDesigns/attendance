"""
Management command to create default roles
"""
from django.core.management.base import BaseCommand
from apps.employees.models import Role


class Command(BaseCommand):
    help = 'Create default roles for the application'
    
    def handle(self, *args, **options):
        """Create default roles"""
        
        # Default roles based on the model choices
        default_roles = [
            {
                'name': 'EMPLOYEE',
                'description': 'Regular employee with basic access to attendance features'
            },
            {
                'name': 'DRIVER',
                'description': 'Driver role with mobile access and location-based features'
            },
            {
                'name': 'ADMIN',
                'description': 'Administrator with full access to manage employees and settings'
            },
            {
                'name': 'SUPER_ADMIN',
                'description': 'Super Administrator with complete system access'
            }
        ]
        
        created_count = 0
        
        for role_data in default_roles:
            role, created = Role.objects.get_or_create(
                name=role_data['name'],
                defaults={
                    'description': role_data['description'],
                    'is_active': True
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created role: {role.get_name_display()}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'• Role already exists: {role.get_name_display()}')
                )
        
        self.stdout.write('')
        if created_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created {created_count} new roles')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('All default roles already exist')
            )
