#!/usr/bin/env python3
"""
Comprehensive WorkSync Feature Tester
Tests all major features and identifies issues across the application
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
from apps.attendance.models import TimeLog, Break
from apps.scheduling.models import Shift
from apps.notifications.models import NotificationTemplate
from apps.reports.models import ReportTemplate

class ComprehensiveFeatureTester:
    def __init__(self):
        self.test_results = {
            'timestamp': datetime.now().isoformat(),
            'categories': {
                'authentication': {'tests': [], 'passed': 0, 'failed': 0},
                'employee_management': {'tests': [], 'passed': 0, 'failed': 0},
                'attendance_tracking': {'tests': [], 'passed': 0, 'failed': 0},
                'break_management': {'tests': [], 'passed': 0, 'failed': 0},
                'scheduling': {'tests': [], 'passed': 0, 'failed': 0},
                'notifications': {'tests': [], 'passed': 0, 'failed': 0},
                'reporting': {'tests': [], 'passed': 0, 'failed': 0},
                'api_integration': {'tests': [], 'passed': 0, 'failed': 0}
            },
            'critical_issues': [],
            'recommendations': []
        }
        
    def log_test(self, category, test_name, status, details, is_critical=False):
        """Log test result to specific category"""
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

    def test_authentication_features(self):
        """Test authentication and user management"""
        print("\n🔐 Testing Authentication Features...")
        
        try:
            # Test user creation
            test_user = User.objects.create_user(
                username='auth_test_user',
                email='authtest@example.com',
                password='testpass123'
            )
            self.log_test('authentication', 'User Creation', 'PASS', 'User created successfully')
            
            # Test user authentication
            from django.contrib.auth import authenticate
            auth_user = authenticate(username='auth_test_user', password='testpass123')
            if auth_user:
                self.log_test('authentication', 'User Authentication', 'PASS', 'User authenticated successfully')
            else:
                self.log_test('authentication', 'User Authentication', 'FAIL', 'User authentication failed', True)
                
            # Cleanup
            test_user.delete()
            
        except Exception as e:
            self.log_test('authentication', 'Authentication System', 'FAIL', f'Authentication error: {str(e)}', True)

    def test_employee_management(self):
        """Test employee management features"""
        print("\n👥 Testing Employee Management...")
        
        try:
            # Test role creation
            test_role = Role.objects.create(
                name='TEST_ROLE',
                description='Test role for feature testing'
            )
            self.log_test('employee_management', 'Role Creation', 'PASS', 'Role created successfully')
            
            # Test employee creation
            test_user = User.objects.create_user(
                username='emp_test_user',
                email='emptest@example.com'
            )
            
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='EMP-TEST-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            self.log_test('employee_management', 'Employee Creation', 'PASS', 'Employee created successfully')
            
            # Test employee properties
            if test_employee.full_name:
                self.log_test('employee_management', 'Employee Properties', 'PASS', 'Employee properties accessible')
            else:
                self.log_test('employee_management', 'Employee Properties', 'FAIL', 'Employee properties not working')
                
            # Cleanup
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.log_test('employee_management', 'Employee Management System', 'FAIL', f'Employee management error: {str(e)}', True)

    def test_attendance_tracking(self):
        """Test attendance tracking features"""
        print("\n⏰ Testing Attendance Tracking...")
        
        try:
            # Setup test data
            test_user = User.objects.create_user(username='att_test_user', email='atttest@example.com')
            test_role = Role.objects.create(name='ATT_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='ATT-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test time log creation
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=timezone.now(),
                status='CLOCKED_IN'
            )
            self.log_test('attendance_tracking', 'Time Log Creation', 'PASS', 'Time log created successfully')
            
            # Test time log properties
            if time_log.duration_minutes is not None:
                self.log_test('attendance_tracking', 'Time Calculations', 'PASS', 'Time calculations working')
            else:
                self.log_test('attendance_tracking', 'Time Calculations', 'FAIL', 'Time calculations not working')
                
            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.log_test('attendance_tracking', 'Attendance System', 'FAIL', f'Attendance error: {str(e)}', True)

    def test_break_management(self):
        """Test break management features"""
        print("\n☕ Testing Break Management...")

        try:
            # Setup test data
            test_user = User.objects.create_user(username='break_test_user', email='breaktest@example.com')
            test_role = Role.objects.create(name='BREAK_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='BRK-001',
                role=test_role,
                employment_status='ACTIVE'
            )

            # Create time log first
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=timezone.now() - timedelta(hours=3),
                status='CLOCKED_IN'
            )

            # Test break creation
            break_record = Break.objects.create(
                time_log=time_log,
                break_type='SHORT',
                start_time=timezone.now() - timedelta(minutes=15)
            )
            self.log_test('break_management', 'Break Creation', 'PASS', 'Break record created successfully')

            # Test break compliance system
            from apps.attendance.break_compliance import BreakComplianceManager
            compliance_manager = BreakComplianceManager()
            requirements = compliance_manager.get_break_requirements(test_employee)

            if requirements:
                self.log_test('break_management', 'Break Compliance System', 'PASS', 'Break compliance system working')
            else:
                self.log_test('break_management', 'Break Compliance System', 'FAIL', 'Break compliance system not working', True)

            # Cleanup
            break_record.delete()
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()

        except Exception as e:
            self.log_test('break_management', 'Break Management System', 'FAIL', f'Break management error: {str(e)}', True)

    def test_scheduling_features(self):
        """Test scheduling features"""
        print("\n📅 Testing Scheduling Features...")

        try:
            # Setup test data
            test_user = User.objects.create_user(username='sched_test_user', email='schedtest@example.com')
            test_role = Role.objects.create(name='SCHED_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='SCH-001',
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
            self.log_test('scheduling', 'Shift Creation', 'PASS', 'Shift created successfully')

            # Test shift methods
            if shift.duration_hours > 0:
                self.log_test('scheduling', 'Shift Calculations', 'PASS', 'Shift calculations working')
            else:
                self.log_test('scheduling', 'Shift Calculations', 'FAIL', 'Shift calculations not working')

            # Cleanup
            shift.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()

        except Exception as e:
            self.log_test('scheduling', 'Scheduling System', 'FAIL', f'Scheduling error: {str(e)}', True)

    def test_notifications(self):
        """Test notification features"""
        print("\n🔔 Testing Notification Features...")

        try:
            # Test notification template creation
            template = NotificationTemplate.objects.create(
                name='Test Template',
                notification_type='EMAIL',
                event_type='test.event',
                subject='Test Subject',
                message_template='Test message: {employee_name}'
            )
            self.log_test('notifications', 'Notification Template Creation', 'PASS', 'Notification template created')

            # Cleanup
            template.delete()

        except Exception as e:
            self.log_test('notifications', 'Notification System', 'FAIL', f'Notification error: {str(e)}', True)

    def test_reporting(self):
        """Test reporting features"""
        print("\n📊 Testing Reporting Features...")

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

            # Cleanup
            template.delete()
            test_user.delete()

        except Exception as e:
            self.log_test('reporting', 'Reporting System', 'FAIL', f'Reporting error: {str(e)}', True)

    def test_api_integration(self):
        """Test API integration features"""
        print("\n🔌 Testing API Integration...")

        try:
            # Test API key authentication
            from apps.api.authentication import APIKeyAuthentication
            auth = APIKeyAuthentication()
            self.log_test('api_integration', 'API Authentication Class', 'PASS', 'API authentication class exists')

            # Test external API endpoints exist
            from apps.api import views
            if hasattr(views, 'clock_in') and hasattr(views, 'clock_out'):
                self.log_test('api_integration', 'External API Endpoints', 'PASS', 'External API endpoints exist')
            else:
                self.log_test('api_integration', 'External API Endpoints', 'FAIL', 'External API endpoints missing', True)

        except Exception as e:
            self.log_test('api_integration', 'API Integration System', 'FAIL', f'API integration error: {str(e)}', True)

    def run_all_tests(self):
        """Run all feature tests"""
        print("🚀 Starting Comprehensive WorkSync Feature Testing")
        print("=" * 60)

        # Run all test categories
        self.test_authentication_features()
        self.test_employee_management()
        self.test_attendance_tracking()
        self.test_break_management()
        self.test_scheduling_features()
        self.test_notifications()
        self.test_reporting()
        self.test_api_integration()

        # Generate summary
        self.generate_summary()

        # Save results
        self.save_results()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📋 COMPREHENSIVE FEATURE TEST SUMMARY")
        print("=" * 60)

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
                status_icon = "✅" if success_rate == 100 else "⚠️" if success_rate >= 50 else "❌"
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

        # Generate recommendations
        self.generate_recommendations()

    def generate_recommendations(self):
        """Generate recommendations based on test results"""
        recommendations = []

        # Check for critical issues
        if self.test_results['critical_issues']:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'Critical Issues',
                'recommendation': f'Address {len(self.test_results["critical_issues"])} critical issues immediately'
            })

        # Check specific feature issues
        for category, results in self.test_results['categories'].items():
            if results['failed'] > 0:
                recommendations.append({
                    'priority': 'MEDIUM',
                    'category': category,
                    'recommendation': f'Fix {results["failed"]} failed tests in {category}'
                })

        self.test_results['recommendations'] = recommendations

        if recommendations:
            print(f"\n💡 RECOMMENDATIONS:")
            for rec in recommendations:
                priority_icon = "🔴" if rec['priority'] == 'HIGH' else "🟡"
                print(f"   {priority_icon} [{rec['priority']}] {rec['recommendation']}")

    def save_results(self):
        """Save test results to file"""
        output_file = 'comprehensive_test_results.json'
        with open(output_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)

        print(f"\n💾 Detailed results saved to: {output_file}")

if __name__ == "__main__":
    tester = ComprehensiveFeatureTester()
    tester.run_all_tests()
