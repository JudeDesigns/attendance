#!/usr/bin/env python3
"""
Frontend Integration Tester
Tests frontend-backend integration with both servers running
"""

import os
import sys
import django
import requests
import json
import time
from datetime import datetime, timedelta

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User
from apps.employees.models import Employee, Role
from apps.attendance.models import TimeLog
from django.utils import timezone

class FrontendIntegrationTester:
    def __init__(self):
        self.backend_url = 'http://127.0.0.1:8000'
        self.frontend_url = 'http://localhost:3000'
        self.api_url = f'{self.backend_url}/api/v1'
        self.test_results = []
        self.auth_token = None
        
    def log_test(self, category, test_name, status, details):
        """Log test result"""
        result = {
            'timestamp': datetime.now().isoformat(),
            'category': category,
            'test_name': test_name,
            'status': status,
            'details': details
        }
        self.test_results.append(result)
        status_icon = "✅" if status == 'PASS' else "❌"
        print(f"{status_icon} [{category.upper()}] {test_name}: {status} - {details}")
    
    def test_server_connectivity(self):
        """Test if both servers are running"""
        print("🔌 Testing Server Connectivity...")
        
        # Test backend
        try:
            response = requests.get(f'{self.backend_url}/health/', timeout=5)
            if response.status_code == 200:
                self.log_test('connectivity', 'Backend Server', 'PASS', f'Status: {response.status_code}')
            else:
                self.log_test('connectivity', 'Backend Server', 'FAIL', f'Status: {response.status_code}')
                return False
        except Exception as e:
            self.log_test('connectivity', 'Backend Server', 'FAIL', f'Error: {str(e)}')
            return False
        
        # Test frontend
        try:
            response = requests.get(self.frontend_url, timeout=5)
            if response.status_code == 200:
                self.log_test('connectivity', 'Frontend Server', 'PASS', f'Status: {response.status_code}')
            else:
                self.log_test('connectivity', 'Frontend Server', 'FAIL', f'Status: {response.status_code}')
                return False
        except Exception as e:
            self.log_test('connectivity', 'Frontend Server', 'FAIL', f'Error: {str(e)}')
            return False
        
        return True
    
    def setup_test_employee(self):
        """Create test employee for integration testing"""
        try:
            # Create test user and employee
            self.test_user = User.objects.create_user(
                username='frontend_test_user',
                email='frontendtest@example.com',
                password='testpass123',
                first_name='Frontend',
                last_name='Tester'
            )
            
            self.test_role = Role.objects.create(
                name='FRONTEND_TEST_ROLE',
                description='Test role for frontend integration'
            )
            
            self.test_employee = Employee.objects.create(
                user=self.test_user,
                employee_id='FRONTEND-001',
                role=self.test_role,
                employment_status='ACTIVE'
            )
            
            self.log_test('setup', 'Test Employee Creation', 'PASS', f'Employee ID: {self.test_employee.employee_id}')
            return True
            
        except Exception as e:
            self.log_test('setup', 'Test Employee Creation', 'FAIL', f'Error: {str(e)}')
            return False
    
    def test_authentication_flow(self):
        """Test authentication API that frontend uses"""
        try:
            response = requests.post(f'{self.api_url}/auth/login/', {
                'username': 'frontend_test_user',
                'password': 'testpass123'
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access')
                self.log_test('authentication', 'Login API', 'PASS', 'JWT token obtained')
                return True
            else:
                self.log_test('authentication', 'Login API', 'FAIL', f'Status: {response.status_code}')
                return False
                
        except Exception as e:
            self.log_test('authentication', 'Login API', 'FAIL', f'Error: {str(e)}')
            return False
    
    def test_clock_in_integration(self):
        """Test clock-in functionality that frontend uses"""
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f'{self.api_url}/attendance/clock-in/',
                json={'employee_id': self.test_employee.employee_id},
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.log_test('integration', 'Clock-In Flow', 'PASS', f'Time log created: {data.get("id", "unknown")}')
                return True
            else:
                self.log_test('integration', 'Clock-In Flow', 'FAIL', f'Status: {response.status_code}, Response: {response.text}')
                return False
                
        except Exception as e:
            self.log_test('integration', 'Clock-In Flow', 'FAIL', f'Error: {str(e)}')
            return False
    
    def test_break_requirements_integration(self):
        """Test break requirements API that frontend break button uses"""
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f'{self.api_url}/attendance/breaks/break_requirements/',
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test('integration', 'Break Requirements Flow', 'PASS', 
                            f'Requires break: {data.get("requires_break")}, Can take manual: {data.get("can_take_manual_break")}')
                return data
            else:
                self.log_test('integration', 'Break Requirements Flow', 'FAIL', f'Status: {response.status_code}')
                return None
                
        except Exception as e:
            self.log_test('integration', 'Break Requirements Flow', 'FAIL', f'Error: {str(e)}')
            return None
    
    def test_employee_status_integration(self):
        """Test employee status API that frontend uses"""
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f'{self.api_url}/employees/{self.test_employee.employee_id}/status/',
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test('integration', 'Employee Status Flow', 'PASS', f'Status: {data.get("status", "unknown")}')
                return data
            else:
                self.log_test('integration', 'Employee Status Flow', 'FAIL', f'Status: {response.status_code}')
                return None
                
        except Exception as e:
            self.log_test('integration', 'Employee Status Flow', 'FAIL', f'Error: {str(e)}')
            return None

    def simulate_work_hours_for_break_testing(self):
        """Simulate work hours to test break functionality"""
        try:
            # Get the active time log and modify its clock_in_time to simulate 2+ hours of work
            active_log = TimeLog.objects.filter(
                employee=self.test_employee,
                status='CLOCKED_IN'
            ).first()

            if active_log:
                # Set clock_in_time to 2.5 hours ago
                active_log.clock_in_time = timezone.now() - timedelta(hours=2.5)
                active_log.save()

                self.log_test('simulation', 'Work Hours Simulation', 'PASS', '2.5 hours of work simulated')
                return True
            else:
                self.log_test('simulation', 'Work Hours Simulation', 'FAIL', 'No active time log found')
                return False

        except Exception as e:
            self.log_test('simulation', 'Work Hours Simulation', 'FAIL', f'Error: {str(e)}')
            return False

    def test_break_button_functionality(self):
        """Test break button functionality after simulating work hours"""
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }

            # Test break requirements after simulating work hours
            response = requests.get(
                f'{self.api_url}/attendance/breaks/break_requirements/',
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                requires_break = data.get('requires_break', False)
                can_take_manual = data.get('can_take_manual_break', False)
                hours_worked = data.get('hours_worked', 0)

                if requires_break or can_take_manual:
                    self.log_test('break_functionality', 'Break Button Should Be Enabled', 'PASS',
                                f'Hours worked: {hours_worked}, Requires break: {requires_break}, Can take manual: {can_take_manual}')
                    return True
                else:
                    self.log_test('break_functionality', 'Break Button Should Be Enabled', 'FAIL',
                                f'Hours worked: {hours_worked}, but no break options available')
                    return False
            else:
                self.log_test('break_functionality', 'Break Button Should Be Enabled', 'FAIL', f'Status: {response.status_code}')
                return False

        except Exception as e:
            self.log_test('break_functionality', 'Break Button Should Be Enabled', 'FAIL', f'Error: {str(e)}')
            return False

    def cleanup_test_data(self):
        """Clean up test data"""
        try:
            # Delete time logs first
            TimeLog.objects.filter(employee=self.test_employee).delete()

            # Delete employee and related data
            self.test_employee.delete()
            self.test_user.delete()
            self.test_role.delete()

            self.log_test('cleanup', 'Test Data Cleanup', 'PASS', 'All test data removed')

        except Exception as e:
            self.log_test('cleanup', 'Test Data Cleanup', 'FAIL', f'Error: {str(e)}')

    def run_comprehensive_integration_tests(self):
        """Run all frontend-backend integration tests"""
        print("🚀 Starting Frontend-Backend Integration Tests")
        print("=" * 70)

        # Test server connectivity
        if not self.test_server_connectivity():
            print("❌ Server connectivity failed. Ensure both servers are running.")
            return

        # Setup test data
        if not self.setup_test_employee():
            return

        # Test authentication
        if not self.test_authentication_flow():
            self.cleanup_test_data()
            return

        print("\n🔄 Testing Core Integration Flows...")

        # Test clock-in integration
        clock_in_success = self.test_clock_in_integration()

        # Test initial break requirements (should be false)
        initial_break_req = self.test_break_requirements_integration()

        # Test employee status
        status_result = self.test_employee_status_integration()

        # Simulate work hours for break testing
        if clock_in_success:
            print("\n⏰ Simulating Work Hours for Break Testing...")
            if self.simulate_work_hours_for_break_testing():
                # Test break functionality after work hours
                self.test_break_button_functionality()

        # Summary
        print("\n" + "=" * 70)
        print("📋 FRONTEND-BACKEND INTEGRATION TEST SUMMARY")
        print("=" * 70)

        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        print(f"Total Integration Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")

        if success_rate >= 90:
            print("🟢 Frontend-Backend Integration: EXCELLENT")
            print("✅ Break button should be functional in the UI!")
            print("✅ All core attendance features integrated properly!")
        elif success_rate >= 75:
            print("🟡 Frontend-Backend Integration: GOOD")
            print("⚠️ Some minor integration issues detected")
        else:
            print("🔴 Frontend-Backend Integration: NEEDS ATTENTION")
            print("❌ Critical integration issues found")

        # Save results
        with open('frontend_integration_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_tests': total_tests,
                'passed': passed_tests,
                'failed': failed_tests,
                'success_rate': success_rate,
                'test_results': self.test_results
            }, f, indent=2)

        print(f"\n💾 Results saved to: frontend_integration_test_results.json")

        # Cleanup
        self.cleanup_test_data()

if __name__ == "__main__":
    tester = FrontendIntegrationTester()
    tester.run_comprehensive_integration_tests()
