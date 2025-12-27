#!/usr/bin/env python3
"""
Live Server API Integration Tester
Tests API endpoints with running Django server
"""

import os
import sys
import django
import requests
import json
from datetime import datetime, timedelta

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User
from apps.employees.models import Employee, Role
from apps.attendance.models import TimeLog
from django.utils import timezone

class LiveServerAPITester:
    def __init__(self):
        self.base_url = 'http://127.0.0.1:8000'
        self.api_url = f'{self.base_url}/api/v1'
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
    
    def setup_test_data(self):
        """Create test data for API testing"""
        try:
            # Create test user and employee
            self.test_user = User.objects.create_user(
                username='api_test_user',
                email='apitest@example.com',
                password='testpass123'
            )
            
            self.test_role = Role.objects.create(
                name='API_TEST_ROLE',
                description='Test role for API testing'
            )
            
            self.test_employee = Employee.objects.create(
                user=self.test_user,
                employee_id='API-TEST-001',
                role=self.test_role,
                employment_status='ACTIVE'
            )
            
            print("✅ Test data created successfully")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create test data: {e}")
            return False
    
    def authenticate(self):
        """Get JWT token for API authentication"""
        try:
            response = requests.post(f'{self.api_url}/auth/login/', {
                'username': 'api_test_user',
                'password': 'testpass123'
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access')
                self.log_test('authentication', 'JWT Token Acquisition', 'PASS', 'Token obtained successfully')
                return True
            else:
                self.log_test('authentication', 'JWT Token Acquisition', 'FAIL', f'Status: {response.status_code}')
                return False
                
        except Exception as e:
            self.log_test('authentication', 'JWT Token Acquisition', 'FAIL', f'Error: {str(e)}')
            return False
    
    def get_headers(self):
        """Get authentication headers"""
        return {
            'Authorization': f'Bearer {self.auth_token}',
            'Content-Type': 'application/json'
        }
    
    def test_clock_in_api(self):
        """Test clock-in API endpoint"""
        try:
            response = requests.post(
                f'{self.api_url}/attendance/clock-in/',
                json={'employee_id': self.test_employee.employee_id},
                headers=self.get_headers()
            )
            
            if response.status_code in [200, 201]:
                self.log_test('api_endpoints', 'Clock-In API', 'PASS', f'Status: {response.status_code}')
                return response.json()
            else:
                self.log_test('api_endpoints', 'Clock-In API', 'FAIL', f'Status: {response.status_code}, Response: {response.text}')
                return None
                
        except Exception as e:
            self.log_test('api_endpoints', 'Clock-In API', 'FAIL', f'Error: {str(e)}')
            return None
    
    def test_break_requirements_api(self):
        """Test break requirements API endpoint"""
        try:
            response = requests.get(
                f'{self.api_url}/attendance/breaks/break_requirements/',
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test('api_endpoints', 'Break Requirements API', 'PASS', f'Response: {data}')
                return data
            else:
                self.log_test('api_endpoints', 'Break Requirements API', 'FAIL', f'Status: {response.status_code}')
                return None
                
        except Exception as e:
            self.log_test('api_endpoints', 'Break Requirements API', 'FAIL', f'Error: {str(e)}')
            return None
    
    def test_employee_status_api(self):
        """Test employee status API endpoint"""
        try:
            response = requests.get(
                f'{self.api_url}/employees/{self.test_employee.employee_id}/status/',
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test('api_endpoints', 'Employee Status API', 'PASS', f'Status: {data.get("status", "unknown")}')
                return data
            else:
                self.log_test('api_endpoints', 'Employee Status API', 'FAIL', f'Status: {response.status_code}')
                return None
                
        except Exception as e:
            self.log_test('api_endpoints', 'Employee Status API', 'FAIL', f'Error: {str(e)}')
            return None
    
    def cleanup_test_data(self):
        """Clean up test data"""
        try:
            # Delete time logs first
            TimeLog.objects.filter(employee=self.test_employee).delete()
            
            # Delete employee and related data
            self.test_employee.delete()
            self.test_user.delete()
            self.test_role.delete()
            
            print("✅ Test data cleaned up successfully")
            
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
    
    def run_comprehensive_api_tests(self):
        """Run all API tests"""
        print("🚀 Starting Live Server API Integration Tests")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_data():
            return
        
        if not self.authenticate():
            self.cleanup_test_data()
            return
        
        # Run API tests
        print("\n🔌 Testing API Endpoints...")
        
        # Test clock-in
        clock_in_result = self.test_clock_in_api()
        
        # Test break requirements (should work after clock-in)
        break_req_result = self.test_break_requirements_api()
        
        # Test employee status
        status_result = self.test_employee_status_api()
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 LIVE SERVER API TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🟢 API Integration Status: EXCELLENT")
        elif success_rate >= 60:
            print("🟡 API Integration Status: GOOD")
        else:
            print("🔴 API Integration Status: NEEDS ATTENTION")
        
        # Save results
        with open('live_server_api_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_tests': total_tests,
                'passed': passed_tests,
                'failed': failed_tests,
                'success_rate': success_rate,
                'test_results': self.test_results
            }, f, indent=2)
        
        print(f"\n💾 Results saved to: live_server_api_test_results.json")
        
        # Cleanup
        self.cleanup_test_data()

if __name__ == "__main__":
    tester = LiveServerAPITester()
    tester.run_comprehensive_api_tests()
