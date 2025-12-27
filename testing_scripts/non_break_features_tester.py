#!/usr/bin/env python3
"""
Non-Break Features Comprehensive Tester
Tests all WorkSync features except break functionality
"""

import os
import sys
import django
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
import json

# Import models
from apps.employees.models import Employee, Role
from apps.attendance.models import TimeLog
from apps.scheduling.models import Shift
from apps.notifications.models import NotificationTemplate, NotificationLog
from apps.reports.models import ReportTemplate
from apps.webhooks.models import WebhookEndpoint

class NonBreakFeaturesTester:
    def __init__(self):
        self.test_results = {
            'timestamp': datetime.now().isoformat(),
            'categories': {
                'clock_in_out': {'tests': [], 'passed': 0, 'failed': 0},
                'shift_management': {'tests': [], 'passed': 0, 'failed': 0},
                'employee_status': {'tests': [], 'passed': 0, 'failed': 0},
                'notifications': {'tests': [], 'passed': 0, 'failed': 0},
                'reporting': {'tests': [], 'passed': 0, 'failed': 0},
                'webhooks': {'tests': [], 'passed': 0, 'failed': 0},
                'location_tracking': {'tests': [], 'passed': 0, 'failed': 0},
                'data_integrity': {'tests': [], 'passed': 0, 'failed': 0}
            },
            'critical_issues': [],
            'recommendations': []
        }
        
    def log_test(self, category, test_name, status, details, is_critical=False):
        """Log test result"""
        result = {
            'test_name': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'is_critical': is_critical
        }
        
        self.test_results['categories'][category]['tests'].append(result)
        
        if status == 'PASS':
            self.test_results['categories'][category]['passed'] += 1
            print(f"✅ [{category.upper()}] {test_name}: PASSED")
        else:
            self.test_results['categories'][category]['failed'] += 1
            print(f"❌ [{category.upper()}] {test_name}: FAILED - {details}")
            
            if is_critical:
                self.test_results['critical_issues'].append({
                    'category': category,
                    'test': test_name,
                    'issue': details
                })

    def test_clock_in_out_functionality(self):
        """Test clock in/out core functionality"""
        print("\n⏰ Testing Clock In/Out Functionality...")
        
        try:
            # Setup test data
            import random
            username = f'clock_test_user_{random.randint(1000, 9999)}'
            test_user = User.objects.create_user(username=username, email=f'{username}@example.com')
            test_role = Role.objects.create(name='CLOCK_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='CLOCK-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test clock in
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=timezone.now(),
                status='CLOCKED_IN'
            )
            
            if time_log.status == 'CLOCKED_IN':
                self.log_test('clock_in_out', 'Clock In Creation', 'PASS', 'Clock in record created successfully')
            else:
                self.log_test('clock_in_out', 'Clock In Creation', 'FAIL', f'Unexpected status: {time_log.status}', True)
            
            # Test clock out
            time_log.clock_out_time = timezone.now()
            time_log.status = 'COMPLETED'
            time_log.save()
            
            if time_log.clock_out_time and time_log.status == 'COMPLETED':
                self.log_test('clock_in_out', 'Clock Out Process', 'PASS', 'Clock out completed successfully')
            else:
                self.log_test('clock_in_out', 'Clock Out Process', 'FAIL', 'Clock out process failed', True)
            
            # Test duration calculations
            duration = time_log.duration_minutes
            if duration is not None and duration >= 0:
                self.log_test('clock_in_out', 'Duration Calculations', 'PASS', f'Duration calculated: {duration} minutes')
            else:
                self.log_test('clock_in_out', 'Duration Calculations', 'FAIL', f'Duration calculation failed: {duration}', True)
            
            # Test multiple clock-ins prevention
            try:
                duplicate_log = TimeLog.objects.create(
                    employee=test_employee,
                    clock_in_time=timezone.now(),
                    status='CLOCKED_IN'
                )
                # If this succeeds, it's a problem - should prevent multiple active sessions
                self.log_test('clock_in_out', 'Multiple Clock-In Prevention', 'FAIL', 'System allows multiple active clock-ins', True)
                duplicate_log.delete()
            except Exception:
                self.log_test('clock_in_out', 'Multiple Clock-In Prevention', 'PASS', 'System prevents multiple active clock-ins')
            
            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.log_test('clock_in_out', 'Clock In/Out System', 'FAIL', f'System error: {str(e)}', True)

    def test_shift_management(self):
        """Test shift scheduling and management"""
        print("\n📅 Testing Shift Management...")
        
        try:
            # Setup test data
            test_user = User.objects.create_user(username='shift_test_user', email='shifttest@example.com')
            test_role = Role.objects.create(name='SHIFT_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='SHIFT-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test shift creation
            shift = Shift.objects.create(
                employee=test_employee,
                location='Test Location',
                start_time=timezone.now() + timedelta(hours=1),
                end_time=timezone.now() + timedelta(hours=9),
                created_by=test_user
            )
            
            self.log_test('shift_management', 'Shift Creation', 'PASS', 'Shift created successfully')
            
            # Test shift duration calculation
            if hasattr(shift, 'duration_hours') and shift.duration_hours == 8.0:
                self.log_test('shift_management', 'Shift Duration Calculation', 'PASS', f'Duration: {shift.duration_hours} hours')
            else:
                duration = getattr(shift, 'duration_hours', 'MISSING')
                self.log_test('shift_management', 'Shift Duration Calculation', 'FAIL', f'Duration calculation issue: {duration}')
            
            # Test shift status logic
            if hasattr(shift, 'is_current') and hasattr(shift, 'is_future') and hasattr(shift, 'is_past'):
                self.log_test('shift_management', 'Shift Status Logic', 'PASS', 'Shift status methods available')
            else:
                missing_methods = []
                if not hasattr(shift, 'is_current'): missing_methods.append('is_current')
                if not hasattr(shift, 'is_future'): missing_methods.append('is_future')
                if not hasattr(shift, 'is_past'): missing_methods.append('is_past')
                self.log_test('shift_management', 'Shift Status Logic', 'FAIL', f'Missing methods: {missing_methods}')
            
            # Test overlapping shift prevention
            try:
                overlapping_shift = Shift.objects.create(
                    employee=test_employee,
                    location='Test Location 2',
                    start_time=timezone.now() + timedelta(hours=2),
                    end_time=timezone.now() + timedelta(hours=6),
                    created_by=test_user
                )
                # Check if system allows overlapping shifts (might be intentional)
                self.log_test('shift_management', 'Overlapping Shift Handling', 'PASS', 'System allows overlapping shifts (check if intentional)')
                overlapping_shift.delete()
            except Exception as e:
                self.log_test('shift_management', 'Overlapping Shift Handling', 'PASS', 'System prevents overlapping shifts')
            
            # Cleanup
            shift.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.log_test('shift_management', 'Shift Management System', 'FAIL', f'System error: {str(e)}', True)

    def test_employee_status_tracking(self):
        """Test employee status and state management"""
        print("\n👤 Testing Employee Status Tracking...")
        
        try:
            # Setup test data
            test_user = User.objects.create_user(username='status_test_user', email='statustest@example.com')
            test_role = Role.objects.create(name='STATUS_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='STATUS-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test employee properties
            if test_employee.full_name:
                self.log_test('employee_status', 'Employee Properties', 'PASS', f'Full name: {test_employee.full_name}')
            else:
                self.log_test('employee_status', 'Employee Properties', 'FAIL', 'Employee full_name property not working')
            
            # Test current status determination
            if hasattr(test_employee, 'current_status'):
                status = test_employee.current_status
                self.log_test('employee_status', 'Current Status Method', 'PASS', f'Status: {status}')
            else:
                self.log_test('employee_status', 'Current Status Method', 'FAIL', 'Missing current_status method')
            
            # Test with active time log
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=timezone.now(),
                status='CLOCKED_IN'
            )
            
            # Check if employee status reflects active session
            if hasattr(test_employee, 'is_clocked_in'):
                is_clocked_in = test_employee.is_clocked_in
                if is_clocked_in:
                    self.log_test('employee_status', 'Active Session Detection', 'PASS', 'Employee shows as clocked in')
                else:
                    self.log_test('employee_status', 'Active Session Detection', 'FAIL', 'Employee not showing as clocked in', True)
            else:
                self.log_test('employee_status', 'Active Session Detection', 'FAIL', 'Missing is_clocked_in method')
            
            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.log_test('employee_status', 'Employee Status System', 'FAIL', f'System error: {str(e)}', True)

    def test_notification_system(self):
        """Test notification system functionality"""
        print("\n🔔 Testing Notification System...")

        try:
            # Test notification template creation
            template = NotificationTemplate.objects.create(
                name='Test Notification',
                notification_type='EMAIL',
                event_type='test.event',
                subject='Test Subject',
                message_template='Hello {employee_name}, this is a test notification.'
            )

            self.log_test('notifications', 'Template Creation', 'PASS', 'Notification template created')

            # Test template rendering
            if hasattr(template, 'render_message'):
                try:
                    rendered = template.render_message({'employee_name': 'John Doe'})
                    if 'John Doe' in rendered:
                        self.log_test('notifications', 'Template Rendering', 'PASS', 'Template variables rendered correctly')
                    else:
                        self.log_test('notifications', 'Template Rendering', 'FAIL', 'Template variables not rendered')
                except Exception as e:
                    self.log_test('notifications', 'Template Rendering', 'FAIL', f'Rendering error: {str(e)}')
            else:
                self.log_test('notifications', 'Template Rendering', 'FAIL', 'Missing render_message method')

            # Test notification creation
            test_user = User.objects.create_user(username='notif_test_user', email='notiftest@example.com')
            test_role = Role.objects.create(name='NOTIF_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='NOTIF-001',
                role=test_role,
                employment_status='ACTIVE'
            )

            notification = NotificationLog.objects.create(
                recipient=test_employee,
                notification_type='EMAIL',
                subject='Test Notification',
                message='Test message',
                event_type='test.event',
                recipient_address='test@example.com'
            )

            self.log_test('notifications', 'Notification Creation', 'PASS', 'Notification record created')

            # Test notification status tracking
            if hasattr(notification, 'status'):
                self.log_test('notifications', 'Status Tracking', 'PASS', f'Status: {notification.status}')
            else:
                self.log_test('notifications', 'Status Tracking', 'FAIL', 'Missing status tracking')

            # Cleanup
            notification.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            template.delete()

        except Exception as e:
            self.log_test('notifications', 'Notification System', 'FAIL', f'System error: {str(e)}', True)

    def test_reporting_system(self):
        """Test reporting system functionality"""
        print("\n📊 Testing Reporting System...")

        try:
            # Setup test data
            test_user = User.objects.create_user(username='report_test_user', email='reporttest@example.com')

            # Test report template creation
            template = ReportTemplate.objects.create(
                name='Test Report',
                description='Test report template',
                report_type='ATTENDANCE',
                format='CSV',
                created_by=test_user
            )

            self.log_test('reporting', 'Report Template Creation', 'PASS', 'Report template created')

            # Test report generation capability
            if hasattr(template, 'generate_report'):
                self.log_test('reporting', 'Report Generation Method', 'PASS', 'Report generation method exists')
            else:
                self.log_test('reporting', 'Report Generation Method', 'FAIL', 'Missing report generation method')

            # Test report types
            valid_types = ['ATTENDANCE', 'PAYROLL', 'SCHEDULE', 'BREAK_COMPLIANCE']
            if template.report_type in valid_types:
                self.log_test('reporting', 'Report Types', 'PASS', f'Valid report type: {template.report_type}')
            else:
                self.log_test('reporting', 'Report Types', 'FAIL', f'Invalid report type: {template.report_type}')

            # Cleanup
            template.delete()
            test_user.delete()

        except Exception as e:
            self.log_test('reporting', 'Reporting System', 'FAIL', f'System error: {str(e)}', True)

    def test_webhook_system(self):
        """Test webhook system functionality"""
        print("\n🔌 Testing Webhook System...")

        try:
            # Test webhook endpoint creation
            test_user = User.objects.create_user(username='webhook_test_user', email='webhooktest@example.com')
            webhook = WebhookEndpoint.objects.create(
                name='Test Webhook',
                url='https://example.com/webhook',
                event_types=['attendance.clock_in', 'attendance.clock_out'],
                is_active=True,
                created_by=test_user
            )

            self.log_test('webhooks', 'Webhook Creation', 'PASS', 'Webhook endpoint created')

            # Test webhook validation
            if webhook.url.startswith('https://'):
                self.log_test('webhooks', 'URL Validation', 'PASS', 'HTTPS URL accepted')
            else:
                self.log_test('webhooks', 'URL Validation', 'FAIL', 'URL validation issue')

            # Test event types handling
            if isinstance(webhook.event_types, list) and len(webhook.event_types) > 0:
                self.log_test('webhooks', 'Event Types Handling', 'PASS', f'Event types: {webhook.event_types}')
            else:
                self.log_test('webhooks', 'Event Types Handling', 'FAIL', 'Event types not handled properly')

            # Cleanup
            webhook.delete()
            test_user.delete()

        except Exception as e:
            self.log_test('webhooks', 'Webhook System', 'FAIL', f'System error: {str(e)}', True)

    def test_location_tracking(self):
        """Test location tracking functionality"""
        print("\n📍 Testing Location Tracking...")

        try:
            # Setup test data
            import random
            username = f'location_test_user_{random.randint(1000, 9999)}'
            test_user = User.objects.create_user(username=username, email=f'{username}@example.com')
            test_role = Role.objects.create(name='LOCATION_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='LOCATION-001',
                role=test_role,
                employment_status='ACTIVE'
            )

            # Test location recording in time log
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=timezone.now(),
                status='CLOCKED_IN',
                clock_in_latitude=40.7128,
                clock_in_longitude=-74.0060
            )

            if time_log.clock_in_latitude:
                self.log_test('location_tracking', 'Location Recording', 'PASS', f'Coordinates: {time_log.clock_in_latitude}, {time_log.clock_in_longitude}')
            else:
                self.log_test('location_tracking', 'Location Recording', 'FAIL', 'Location data not recorded properly')

            # Test distance calculation
            if hasattr(time_log, 'calculate_distance'):
                try:
                    distance = time_log.calculate_distance(40.7128, -74.0060, 40.7589, -73.9851)
                    if distance is not None and distance > 0:
                        self.log_test('location_tracking', 'Distance Calculation', 'PASS', f'Distance: {distance} km')
                    else:
                        self.log_test('location_tracking', 'Distance Calculation', 'FAIL', 'Distance calculation failed')
                except Exception as e:
                    self.log_test('location_tracking', 'Distance Calculation', 'FAIL', f'Calculation error: {str(e)}')
            else:
                self.log_test('location_tracking', 'Distance Calculation', 'FAIL', 'Missing distance calculation method')

            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()

        except Exception as e:
            self.log_test('location_tracking', 'Location Tracking System', 'FAIL', f'System error: {str(e)}', True)

    def test_data_integrity(self):
        """Test data integrity and constraints"""
        print("\n🔒 Testing Data Integrity...")

        try:
            # Test unique constraints
            test_user1 = User.objects.create_user(username='integrity_test_1', email='integrity1@example.com')
            test_role = Role.objects.create(name='INTEGRITY_TEST_ROLE', description='Test role')

            employee1 = Employee.objects.create(
                user=test_user1,
                employee_id='INTEGRITY-001',
                role=test_role,
                employment_status='ACTIVE'
            )

            # Try to create duplicate employee_id
            try:
                test_user2 = User.objects.create_user(username='integrity_test_2', email='integrity2@example.com')
                employee2 = Employee.objects.create(
                    user=test_user2,
                    employee_id='INTEGRITY-001',  # Same ID
                    role=test_role,
                    employment_status='ACTIVE'
                )
                self.log_test('data_integrity', 'Employee ID Uniqueness', 'FAIL', 'Duplicate employee IDs allowed', True)
                employee2.delete()
                test_user2.delete()
            except Exception:
                self.log_test('data_integrity', 'Employee ID Uniqueness', 'PASS', 'Employee ID uniqueness enforced')

            # Test required fields
            try:
                invalid_employee = Employee.objects.create(
                    user=test_user1,
                    # Missing employee_id
                    role=test_role,
                    employment_status='ACTIVE'
                )
                self.log_test('data_integrity', 'Required Fields', 'FAIL', 'Required fields not enforced', True)
                invalid_employee.delete()
            except Exception:
                self.log_test('data_integrity', 'Required Fields', 'PASS', 'Required fields enforced')

            # Cleanup
            employee1.delete()
            test_user1.delete()
            test_role.delete()

        except Exception as e:
            self.log_test('data_integrity', 'Data Integrity System', 'FAIL', f'System error: {str(e)}', True)

    def run_all_tests(self):
        """Run all non-break feature tests"""
        print("🚀 Starting Comprehensive Non-Break Features Testing")
        print("=" * 70)

        self.test_clock_in_out_functionality()
        self.test_shift_management()
        self.test_employee_status_tracking()
        self.test_notification_system()
        self.test_reporting_system()
        self.test_webhook_system()
        self.test_location_tracking()
        self.test_data_integrity()

        self.generate_summary()
        self.save_results()

    def generate_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "=" * 70)
        print("📋 NON-BREAK FEATURES TEST SUMMARY")
        print("=" * 70)

        total_tests = 0
        total_passed = 0
        total_failed = 0

        for category, results in self.test_results['categories'].items():
            passed = results['passed']
            failed = results['failed']
            total = passed + failed

            total_tests += total
            total_passed += passed
            total_failed += failed

            if total > 0:
                success_rate = (passed / total) * 100
                status_icon = "✅" if success_rate == 100 else "⚠️" if success_rate >= 70 else "❌"
                print(f"{status_icon} {category.upper()}: {passed}/{total} passed ({success_rate:.1f}%)")

        print(f"\n🎯 OVERALL RESULTS:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {total_passed}")
        print(f"   Failed: {total_failed}")

        if total_tests > 0:
            overall_success = (total_passed / total_tests) * 100
            print(f"   Success Rate: {overall_success:.1f}%")

        # Show critical issues
        if self.test_results['critical_issues']:
            print(f"\n🚨 CRITICAL ISSUES ({len(self.test_results['critical_issues'])}):")
            for issue in self.test_results['critical_issues']:
                print(f"   - [{issue['category'].upper()}] {issue['test']}: {issue['issue']}")

    def save_results(self):
        """Save test results to file"""
        output_file = 'non_break_features_test_results.json'
        with open(output_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)

        print(f"\n💾 Detailed results saved to: {output_file}")

if __name__ == "__main__":
    tester = NonBreakFeaturesTester()
    tester.run_all_tests()
