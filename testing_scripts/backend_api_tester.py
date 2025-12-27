#!/usr/bin/env python3
"""
WorkSync Backend API Testing Script
Comprehensive testing of all API endpoints with detailed reporting
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import argparse

class WorkSyncAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/v1"
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.admin_user = None
        self.regular_user = None
        
    def log_test(self, test_name: str, status: str, details: str = "", response_time: float = 0):
        """Log test result"""
        result = {
            'test_name': test_name,
            'status': status,
            'details': details,
            'response_time': response_time,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        # Color coding for console output
        color = '\033[92m' if status == 'PASS' else '\033[91m' if status == 'FAIL' else '\033[93m'
        reset = '\033[0m'
        print(f"{color}[{status}]{reset} {test_name} ({response_time:.3f}s)")
        if details:
            print(f"    {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, auth_required: bool = True) -> requests.Response:
        """Make HTTP request with proper headers and authentication"""
        url = f"{self.api_url}{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.auth_token:
            request_headers['Authorization'] = f'Bearer {self.auth_token}'
        
        if headers:
            request_headers.update(headers)
        
        start_time = time.time()
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=request_headers, params=data)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=request_headers, 
                                           json=data if data else None)
            elif method.upper() == 'PUT':
                response = self.session.put(url, headers=request_headers, 
                                          json=data if data else None)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=request_headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response_time = time.time() - start_time
            return response, response_time
        except Exception as e:
            response_time = time.time() - start_time
            raise Exception(f"Request failed: {str(e)}") from e
    
    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n=== Testing Authentication ===")
        
        # Test login with invalid credentials
        try:
            response, rt = self.make_request('POST', '/auth/login/', {
                'username': 'invalid_user',
                'password': 'invalid_pass'
            }, auth_required=False)
            
            if response.status_code == 400:
                self.log_test("Login with invalid credentials", "PASS", 
                            "Correctly rejected invalid credentials", rt)
            else:
                self.log_test("Login with invalid credentials", "FAIL", 
                            f"Expected 400, got {response.status_code}", rt)
        except Exception as e:
            self.log_test("Login with invalid credentials", "ERROR", str(e))
        
        # Test login with valid credentials (if available)
        # Note: This requires existing test users in the database
        test_credentials = [
            {'username': 'admin', 'password': 'admin123'},
            {'username': 'testuser', 'password': 'testpass123'},
        ]
        
        for creds in test_credentials:
            try:
                response, rt = self.make_request('POST', '/auth/login/', creds, auth_required=False)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'access' in data and 'user' in data:
                        self.auth_token = data['access']
                        if data['user'].get('is_admin'):
                            self.admin_user = data['user']
                        else:
                            self.regular_user = data['user']
                        
                        self.log_test(f"Login as {creds['username']}", "PASS", 
                                    f"Successfully authenticated user", rt)
                        break
                    else:
                        self.log_test(f"Login as {creds['username']}", "FAIL", 
                                    "Missing required fields in response", rt)
                else:
                    self.log_test(f"Login as {creds['username']}", "FAIL", 
                                f"Login failed: {response.status_code}", rt)
            except Exception as e:
                self.log_test(f"Login as {creds['username']}", "ERROR", str(e))
        
        # Test token verification
        if self.auth_token:
            try:
                response, rt = self.make_request('POST', '/auth/verify/', 
                                               {'token': self.auth_token}, auth_required=False)
                
                if response.status_code == 200:
                    self.log_test("Token verification", "PASS", "Token is valid", rt)
                else:
                    self.log_test("Token verification", "FAIL", 
                                f"Token verification failed: {response.status_code}", rt)
            except Exception as e:
                self.log_test("Token verification", "ERROR", str(e))
    
    def test_employee_endpoints(self):
        """Test employee management endpoints"""
        print("\n=== Testing Employee Endpoints ===")
        
        if not self.auth_token:
            self.log_test("Employee endpoints", "SKIP", "No authentication token available")
            return
        
        # Test employee list
        try:
            response, rt = self.make_request('GET', '/employees/')
            
            if response.status_code == 200:
                data = response.json()
                if 'results' in data:
                    self.log_test("Employee list", "PASS", 
                                f"Retrieved {len(data['results'])} employees", rt)
                else:
                    self.log_test("Employee list", "PASS", 
                                f"Retrieved {len(data)} employees", rt)
            else:
                self.log_test("Employee list", "FAIL", 
                            f"Failed to retrieve employees: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Employee list", "ERROR", str(e))
        
        # Test employee profile (me endpoint)
        try:
            response, rt = self.make_request('GET', '/employees/me/')
            
            if response.status_code == 200:
                data = response.json()
                if 'employee_id' in data and 'user' in data:
                    self.log_test("Employee profile", "PASS", 
                                f"Retrieved profile for {data.get('employee_id')}", rt)
                else:
                    self.log_test("Employee profile", "FAIL", 
                                "Missing required fields in profile", rt)
            else:
                self.log_test("Employee profile", "FAIL", 
                            f"Failed to retrieve profile: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Employee profile", "ERROR", str(e))
        
        # Test employee statistics (admin only)
        try:
            response, rt = self.make_request('GET', '/employees/statistics/')
            
            if response.status_code == 200:
                data = response.json()
                if all(key in data for key in ['total', 'active', 'inactive']):
                    self.log_test("Employee statistics", "PASS", 
                                f"Total: {data['total']}, Active: {data['active']}", rt)
                else:
                    self.log_test("Employee statistics", "FAIL", 
                                "Missing required statistics fields", rt)
            elif response.status_code == 403:
                self.log_test("Employee statistics", "PASS", 
                            "Correctly restricted to admin users", rt)
            else:
                self.log_test("Employee statistics", "FAIL", 
                            f"Unexpected response: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Employee statistics", "ERROR", str(e))
    
    def test_attendance_endpoints(self):
        """Test attendance and time tracking endpoints"""
        print("\n=== Testing Attendance Endpoints ===")

        if not self.auth_token:
            self.log_test("Attendance endpoints", "SKIP", "No authentication token available")
            return

        # Test time logs list
        try:
            response, rt = self.make_request('GET', '/attendance/time-logs/')

            if response.status_code == 200:
                data = response.json()
                if 'results' in data:
                    self.log_test("Time logs list", "PASS",
                                f"Retrieved {len(data['results'])} time logs", rt)
                else:
                    self.log_test("Time logs list", "PASS",
                                f"Retrieved {len(data)} time logs", rt)
            else:
                self.log_test("Time logs list", "FAIL",
                            f"Failed to retrieve time logs: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Time logs list", "ERROR", str(e))

        # Test current status
        try:
            response, rt = self.make_request('GET', '/attendance/time-logs/current_status/')

            if response.status_code == 200:
                data = response.json()
                if 'is_clocked_in' in data:
                    status = "clocked in" if data['is_clocked_in'] else "clocked out"
                    self.log_test("Current attendance status", "PASS",
                                f"User is currently {status}", rt)
                else:
                    self.log_test("Current attendance status", "FAIL",
                                "Missing status information", rt)
            else:
                self.log_test("Current attendance status", "FAIL",
                            f"Failed to get status: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Current attendance status", "ERROR", str(e))

    def test_scheduling_endpoints(self):
        """Test scheduling and leave management endpoints"""
        print("\n=== Testing Scheduling Endpoints ===")

        if not self.auth_token:
            self.log_test("Scheduling endpoints", "SKIP", "No authentication token available")
            return

        # Test shifts list
        try:
            response, rt = self.make_request('GET', '/scheduling/shifts/')

            if response.status_code == 200:
                data = response.json()
                count = len(data.get('results', data))
                self.log_test("Shifts list", "PASS", f"Retrieved {count} shifts", rt)
            else:
                self.log_test("Shifts list", "FAIL",
                            f"Failed to retrieve shifts: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Shifts list", "ERROR", str(e))

        # Test leave requests
        try:
            response, rt = self.make_request('GET', '/scheduling/leave-requests/')

            if response.status_code == 200:
                data = response.json()
                count = len(data.get('results', data))
                self.log_test("Leave requests list", "PASS", f"Retrieved {count} leave requests", rt)
            else:
                self.log_test("Leave requests list", "FAIL",
                            f"Failed to retrieve leave requests: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Leave requests list", "ERROR", str(e))

    def test_notification_endpoints(self):
        """Test notification system endpoints"""
        print("\n=== Testing Notification Endpoints ===")

        if not self.auth_token:
            self.log_test("Notification endpoints", "SKIP", "No authentication token available")
            return

        # Test notifications list
        try:
            response, rt = self.make_request('GET', '/notifications/')

            if response.status_code == 200:
                data = response.json()
                count = len(data.get('results', data))
                self.log_test("Notifications list", "PASS", f"Retrieved {count} notifications", rt)
            else:
                self.log_test("Notifications list", "FAIL",
                            f"Failed to retrieve notifications: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Notifications list", "ERROR", str(e))

    def test_location_endpoints(self):
        """Test location management endpoints"""
        print("\n=== Testing Location Endpoints ===")

        if not self.auth_token:
            self.log_test("Location endpoints", "SKIP", "No authentication token available")
            return

        # Test locations list
        try:
            response, rt = self.make_request('GET', '/locations/')

            if response.status_code == 200:
                data = response.json()
                count = len(data.get('results', data))
                self.log_test("Locations list", "PASS", f"Retrieved {count} locations", rt)
            else:
                self.log_test("Locations list", "FAIL",
                            f"Failed to retrieve locations: {response.status_code}", rt)
        except Exception as e:
            self.log_test("Locations list", "ERROR", str(e))

    def test_qr_flow(self):
        """Test QR code clock-in/out flow"""
        print("\n=== Testing QR Code Flow ===")
        
        if not self.auth_token:
            self.log_test("QR Flow", "SKIP", "No authentication token available")
            return

        try:
            # 1. Get a valid location QR code
            response, rt = self.make_request('GET', '/locations/')
            if response.status_code == 200:
                data = response.json()
                locations = data.get('results', data)
                if len(locations) > 0:
                    location = locations[0]
                    qr_code = location['qr_code_payload']
                    print(f"    Using Location QR: {qr_code}")
                    


                    # 2. Clock In with QR
                    payload = {'qr_code': qr_code, 'action': 'clock_in'}
                    response, rt = self.make_request('POST', '/attendance/time-logs/qr_scan/', payload)

                    
                    if response.status_code == 200:
                        self.log_test("QR Clock In", "PASS", "Successfully clocked in with QR", rt)
                    elif response.status_code == 400 and "already clocked in" in response.text:
                        self.log_test("QR Clock In", "PASS", "Already clocked in (valid state)", rt)
                    else:
                        self.log_test("QR Clock In", "FAIL", f"Failed: {response.status_code} - {response.text}", rt)
                        
                    # 3. Clock Out with QR
                    payload = {'qr_code': qr_code, 'action': 'clock_out'}
                    response, rt = self.make_request('POST', '/attendance/time-logs/qr_scan/', payload)
                    
                    if response.status_code == 200:
                        self.log_test("QR Clock Out", "PASS", "Successfully clocked out with QR", rt)
                    elif response.status_code == 400 and "not currently clocked in" in response.text:
                        self.log_test("QR Clock Out", "PASS", "Not clocked in (valid state)", rt)
                    else:
                        self.log_test("QR Clock Out", "FAIL", f"Failed: {response.status_code} - {response.text}", rt)
                        
                    # 4. Invalid QR
                    payload = {'qr_code': 'INVALID-QR-CODE', 'action': 'clock_in'}
                    response, rt = self.make_request('POST', '/attendance/time-logs/qr_scan/', payload)
                    
                    if response.status_code == 400:
                        self.log_test("Invalid QR Rejection", "PASS", "Correctly rejected invalid QR", rt)
                    else:
                        self.log_test("Invalid QR Rejection", "FAIL", f"Expected 400, got {response.status_code}", rt)
                else:
                    self.log_test("QR Flow", "SKIP", "No locations available for QR test")
            else:
                self.log_test("QR Flow", "FAIL", "Failed to fetch locations")
        except Exception as e:
            self.log_test("QR Flow", "ERROR", str(e))

    def test_break_system(self):
        """Test Break System logic via API"""
        print("\n=== Testing Break System ===")
        
        if not self.auth_token:
            self.log_test("Break System", "SKIP", "No authentication token available")
            return

        try:
            # 1. Check Break Requirements (should be none initially)
            response, rt = self.make_request('GET', '/attendance/breaks/break_requirements/')
            if response.status_code == 200:
                data = response.json()
                self.log_test("Check Break Requirements", "PASS", f"Requires break: {data.get('requires_break')}", rt)
            elif response.status_code == 404:
                 self.log_test("Check Break Requirements", "FAIL", f"404: {response.text}", rt)
            else:
                 self.log_test("Check Break Requirements", "FAIL", f"Status: {response.status_code}", rt)

            # 2. Start a Break
            # First ensure we are clocked in (we might be from QR test, but let's be sure)
            # If not clocked in, this might fail.
            status_response, _ = self.make_request('GET', '/attendance/time-logs/current_status/')
            if status_response.status_code == 200 and status_response.json().get('is_clocked_in'):
                payload = {'break_type': 'SHORT'}
                response, rt = self.make_request('POST', '/attendance/breaks/start_break/', payload)
                
                if response.status_code == 201:
                    self.log_test("Start Break", "PASS", "Successfully started break", rt)
                    break_id = response.json().get('id')
                    
                    # 3. Check Active Break
                    active_response, _ = self.make_request('GET', '/attendance/breaks/active_break/')
                    if active_response.status_code == 200 and active_response.json().get('has_active_break'):
                        self.log_test("Verify Active Break", "PASS", "Active break confirmed", rt)
                        
                        # 4. End Break
                        end_response, end_rt = self.make_request('POST', f'/attendance/breaks/{break_id}/end_break/')
                        if end_response.status_code == 200:
                            self.log_test("End Break", "PASS", "Successfully ended break", end_rt)
                        else:
                            self.log_test("End Break", "FAIL", f"Failed: {end_response.status_code}", end_rt)
                    else:
                        self.log_test("Verify Active Break", "FAIL", "No active break found", rt)
                else:
                    self.log_test("Start Break", "FAIL", f"Failed to start: {response.status_code} - {response.text}", rt)
            else:
                self.log_test("Break System", "SKIP", "User not clocked in, cannot test breaks")

        except Exception as e:
            self.log_test("Break System", "ERROR", str(e))

    def test_detailed_report(self):
        """Test Detailed Timesheet Report generation"""
        print("\n=== Testing Detailed Timesheet Report ===")
        
        if not self.auth_token:
            self.log_test("Detailed Report", "SKIP", "No authentication token available")
            return

        try:
            # Generate report
            params = {
                'report_type': 'DETAILED_TIMESHEET',
                'start_date': (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
                'end_date': datetime.now().strftime('%Y-%m-%d')
            }
            response, rt = self.make_request('GET', '/reports/generate/', params)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Generate Detailed Report", "PASS", f"Generated report with {len(data)} rows", rt)
                # Verify columns
                if len(data) > 0:
                    row = data[0]
                    required_columns = ['Employee Name', 'Date', 'Day', 'Start Time', 'End Time', 'Total Hours', 'Finally Hours']
                    missing = [col for col in required_columns if col not in row]
                    if not missing:
                        self.log_test("Verify Report Columns", "PASS", "All required columns present", rt)
                    else:
                        self.log_test("Verify Report Columns", "FAIL", f"Missing columns: {missing}", rt)
            else:
                self.log_test("Generate Detailed Report", "FAIL", f"Status: {response.status_code} - {response.text}", rt)

        except Exception as e:
            self.log_test("Detailed Report", "ERROR", str(e))



    
    def run_all_tests(self):
        """Run all test suites"""
        print("Starting WorkSync API Testing...")
        print(f"Testing against: {self.api_url}")

        start_time = time.time()

        # Run test suites
        self.test_authentication()
        self.test_employee_endpoints()
        self.test_attendance_endpoints()
        self.test_scheduling_endpoints()
        self.test_notification_endpoints()
        self.test_notification_endpoints()
        self.test_location_endpoints()
        self.test_qr_flow()
        self.test_break_system()
        self.test_detailed_report()

        # Generate summary
        total_time = time.time() - start_time
        self.generate_summary(total_time)
    
    def generate_summary(self, total_time: float):
        """Generate test summary report"""
        print(f"\n{'='*50}")
        print("TEST SUMMARY")
        print(f"{'='*50}")
        
        total_tests = len(self.test_results)
        passed = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed = len([r for r in self.test_results if r['status'] == 'FAIL'])
        errors = len([r for r in self.test_results if r['status'] == 'ERROR'])
        skipped = len([r for r in self.test_results if r['status'] == 'SKIP'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Errors: {errors}")
        print(f"Skipped: {skipped}")
        print(f"Total Time: {total_time:.2f}s")
        
        if failed > 0 or errors > 0:
            print(f"\n{'='*30}")
            print("FAILED/ERROR TESTS:")
            print(f"{'='*30}")
            for result in self.test_results:
                if result['status'] in ['FAIL', 'ERROR']:
                    print(f"❌ {result['test_name']}: {result['details']}")
        
        # Save detailed results to file
        with open('api_test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'total': total_tests,
                    'passed': passed,
                    'failed': failed,
                    'errors': errors,
                    'skipped': skipped,
                    'total_time': total_time,
                    'timestamp': datetime.now().isoformat()
                },
                'results': self.test_results
            }, f, indent=2)
        
        print(f"\nDetailed results saved to: api_test_results.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='WorkSync API Tester')
    parser.add_argument('--url', default='http://localhost:8000', 
                       help='Base URL for the WorkSync API')
    
    args = parser.parse_args()
    
    tester = WorkSyncAPITester(args.url)
    tester.run_all_tests()
