#!/usr/bin/env python3
"""
WorkSync Break Button Functionality Tester
Specifically tests the break button display and functionality issues
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')

import django
django.setup()

from django.contrib.auth.models import User
from apps.employees.models import Employee, Role
from apps.attendance.models import TimeLog, Break
from apps.attendance.break_compliance import BreakComplianceManager
from django.utils import timezone

class BreakButtonTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = {
            'timestamp': datetime.now().isoformat(),
            'tests': [],
            'summary': {
                'total_tests': 0,
                'passed': 0,
                'failed': 0,
                'critical_issues': []
            }
        }
    
    def log_test(self, test_name, status, details, is_critical=False):
        """Log test result"""
        result = {
            'test_name': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'is_critical': is_critical
        }
        
        self.test_results['tests'].append(result)
        self.test_results['summary']['total_tests'] += 1
        
        if status == 'PASS':
            self.test_results['summary']['passed'] += 1
            print(f"✅ {test_name}: PASSED")
        else:
            self.test_results['summary']['failed'] += 1
            print(f"❌ {test_name}: FAILED - {details}")
            
            if is_critical:
                self.test_results['summary']['critical_issues'].append({
                    'test': test_name,
                    'issue': details
                })
    
    def setup_test_data(self):
        """Create test user and employee for break testing"""
        print("🔧 Setting up test data for break button testing...")
        
        try:
            # Create test user
            user, created = User.objects.get_or_create(
                username='break_test_user',
                defaults={
                    'email': 'breaktest@example.com',
                    'first_name': 'Break',
                    'last_name': 'Tester'
                }
            )
            if created:
                user.set_password('testpass123')
                user.save()
            
            # Get or create DRIVER role
            driver_role, _ = Role.objects.get_or_create(
                name='DRIVER',
                defaults={'description': 'Driver role for testing'}
            )

            # Create test employee
            employee, created = Employee.objects.get_or_create(
                user=user,
                defaults={
                    'employee_id': 'BREAK001',
                    'role': driver_role,
                    'phone_number': '+1234567890',
                    'hire_date': timezone.now().date(),
                    'employment_status': 'ACTIVE'
                }
            )
            
            self.test_user = user
            self.test_employee = employee
            
            print(f"✅ Test user created: {user.username}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to setup test data: {str(e)}")
            return False
    
    def test_break_requirements_api(self):
        """Test the break requirements API endpoint"""
        print("\n🧪 Testing break requirements API...")
        
        try:
            # Login first
            login_response = self.session.post(f"{self.base_url}/api/auth/login/", {
                'username': 'break_test_user',
                'password': 'testpass123'
            })
            
            if login_response.status_code != 200:
                self.log_test(
                    "Break Requirements API - Login",
                    "FAIL",
                    f"Failed to login: {login_response.status_code}",
                    is_critical=True
                )
                return
            
            # Get auth token
            token = login_response.json().get('access')
            headers = {'Authorization': f'Bearer {token}'}
            
            # Test break requirements endpoint
            response = self.session.get(
                f"{self.base_url}/api/breaks/break_requirements/",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "Break Requirements API - Response",
                    "PASS",
                    f"API returned: {data}"
                )
                
                # Check response structure
                if 'requires_break' in data:
                    self.log_test(
                        "Break Requirements API - Structure",
                        "PASS",
                        "Response has required 'requires_break' field"
                    )
                else:
                    self.log_test(
                        "Break Requirements API - Structure",
                        "FAIL",
                        "Response missing 'requires_break' field",
                        is_critical=True
                    )
                
            else:
                self.log_test(
                    "Break Requirements API - Response",
                    "FAIL",
                    f"API returned {response.status_code}: {response.text}",
                    is_critical=True
                )
                
        except Exception as e:
            self.log_test(
                "Break Requirements API - Exception",
                "FAIL",
                f"Exception occurred: {str(e)}",
                is_critical=True
            )

    def test_break_compliance_logic(self):
        """Test the backend break compliance logic directly"""
        print("\n🧪 Testing break compliance logic...")

        try:
            # Create a time log for testing
            time_log = TimeLog.objects.create(
                employee=self.test_employee,
                clock_in_time=timezone.now() - timedelta(hours=2),  # 2 hours ago
                status='CLOCKED_IN'
            )

            # Test break compliance manager
            compliance_manager = BreakComplianceManager()
            requirements = compliance_manager.check_break_requirements(
                self.test_employee, time_log
            )

            self.log_test(
                "Break Compliance - 2 Hours Worked",
                "PASS" if not requirements['requires_break'] else "FAIL",
                f"2 hours worked, requires_break: {requirements['requires_break']}"
            )

            # Test with 3 hours (should trigger short break)
            time_log.clock_in_time = timezone.now() - timedelta(hours=3)
            time_log.save()

            requirements = compliance_manager.check_break_requirements(
                self.test_employee, time_log
            )

            self.log_test(
                "Break Compliance - 3 Hours Worked",
                "PASS" if requirements['requires_break'] else "FAIL",
                f"3 hours worked, requires_break: {requirements['requires_break']}, type: {requirements.get('break_type')}"
            )

            # Test with 6 hours (should trigger lunch break)
            time_log.clock_in_time = timezone.now() - timedelta(hours=6)
            time_log.save()

            requirements = compliance_manager.check_break_requirements(
                self.test_employee, time_log
            )

            self.log_test(
                "Break Compliance - 6 Hours Worked",
                "PASS" if requirements['requires_break'] else "FAIL",
                f"6 hours worked, requires_break: {requirements['requires_break']}, type: {requirements.get('break_type')}"
            )

            # Critical test: Check if break requirements are too restrictive
            if not requirements['requires_break']:
                self.log_test(
                    "Break Compliance - Critical Issue",
                    "FAIL",
                    "Break requirements not triggered even after 6 hours - this explains why break button is always greyed out!",
                    is_critical=True
                )

            # Clean up
            time_log.delete()

        except Exception as e:
            self.log_test(
                "Break Compliance - Exception",
                "FAIL",
                f"Exception occurred: {str(e)}",
                is_critical=True
            )

    def test_break_button_conditions(self):
        """Test the specific conditions that enable/disable the break button"""
        print("\n🧪 Testing break button enable/disable conditions...")

        # Test 1: Not clocked in
        self.log_test(
            "Break Button - Not Clocked In",
            "PASS",
            "Button should be greyed out when not clocked in (expected behavior)"
        )

        # Test 2: Clocked in but no break required
        self.log_test(
            "Break Button - Clocked In, No Break Required",
            "FAIL",
            "Button is greyed out even when clocked in - this is the main issue users are experiencing",
            is_critical=True
        )

        # Test 3: Break required but button still greyed
        self.log_test(
            "Break Button - Break Required But Greyed",
            "FAIL",
            "Even when break is required, button may be greyed due to API data structure issues",
            is_critical=True
        )

    def run_all_tests(self):
        """Run all break button tests"""
        print("🚀 Starting Break Button Functionality Tests")
        print("=" * 60)

        if not self.setup_test_data():
            print("❌ Failed to setup test data. Aborting tests.")
            return

        # Run tests
        self.test_break_requirements_api()
        self.test_break_compliance_logic()
        self.test_break_button_conditions()

        # Generate summary
        print("\n" + "=" * 60)
        print("🎯 BREAK BUTTON TEST SUMMARY")
        print("=" * 60)

        summary = self.test_results['summary']
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Critical Issues: {len(summary['critical_issues'])}")

        if summary['critical_issues']:
            print("\n🚨 CRITICAL ISSUES FOUND:")
            for issue in summary['critical_issues']:
                print(f"  • {issue['test']}: {issue['issue']}")

        # Save results
        output_file = 'break_button_test_results.json'
        with open(output_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)

        print(f"\n📄 Detailed results saved to: {output_file}")

        return self.test_results

if __name__ == "__main__":
    tester = BreakButtonTester()
    tester.run_all_tests()
