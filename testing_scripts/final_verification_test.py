#!/usr/bin/env python3
"""
Final Verification Test for WorkSync Fixes
Tests all the critical fixes we implemented
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
from apps.attendance.break_compliance import BreakComplianceManager

class FinalVerificationTest:
    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'fixes_verified': [],
            'remaining_issues': [],
            'overall_status': 'UNKNOWN'
        }
        
    def test_time_calculations_fix(self):
        """Verify time calculations now work for active time logs"""
        print("🔍 Testing Time Calculations Fix...")
        
        try:
            # Create test data
            test_user = User.objects.create_user(username='time_fix_test', email='timefix@test.com')
            test_role = Role.objects.create(name='TIME_FIX_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='TIME-FIX-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Create active time log (no clock_out_time)
            clock_in_time = timezone.now() - timedelta(hours=2, minutes=30)
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=clock_in_time,
                status='CLOCKED_IN'
            )
            
            # Test duration calculation for active session
            duration = time_log.duration_minutes
            hours_worked = time_log.hours_worked
            
            print(f"   Duration minutes: {duration}")
            print(f"   Hours worked: {hours_worked}")
            
            if duration is not None and duration > 140:  # Should be ~150 minutes
                self.results['fixes_verified'].append({
                    'fix': 'Time Calculations for Active Sessions',
                    'status': 'VERIFIED',
                    'details': f'duration_minutes now works for active sessions: {duration} minutes'
                })
                print("   ✅ FIXED: Time calculations now work for active sessions")
            else:
                self.results['remaining_issues'].append({
                    'issue': 'Time calculations still not working properly',
                    'details': f'Expected >140 minutes, got {duration}'
                })
                print(f"   ❌ Still broken: Expected >140 minutes, got {duration}")
            
            if hours_worked is not None and hours_worked > 2.0:
                self.results['fixes_verified'].append({
                    'fix': 'Hours Worked Property',
                    'status': 'VERIFIED',
                    'details': f'hours_worked property now exists: {hours_worked} hours'
                })
                print("   ✅ FIXED: hours_worked property now exists")
            else:
                self.results['remaining_issues'].append({
                    'issue': 'hours_worked property still missing or incorrect',
                    'details': f'Expected >2.0 hours, got {hours_worked}'
                })
                print(f"   ❌ Still broken: Expected >2.0 hours, got {hours_worked}")
            
            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.results['remaining_issues'].append({
                'issue': 'Time calculations test failed with exception',
                'details': str(e)
            })
            print(f"   ❌ Exception: {str(e)}")

    def test_break_compliance_fix(self):
        """Verify break compliance API method name fix"""
        print("\n🔍 Testing Break Compliance Fix...")
        
        try:
            # Create test data
            test_user = User.objects.create_user(username='break_fix_test', email='breakfix@test.com')
            test_role = Role.objects.create(name='BREAK_FIX_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='BREAK-FIX-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test break compliance manager
            compliance_manager = BreakComplianceManager()
            
            # Test that get_break_requirements method now exists
            if hasattr(compliance_manager, 'get_break_requirements'):
                print("   ✅ FIXED: get_break_requirements method exists")
                
                # Test the method works
                requirements = compliance_manager.get_break_requirements(test_employee)
                
                if isinstance(requirements, dict) and 'requires_break' in requirements:
                    self.results['fixes_verified'].append({
                        'fix': 'Break Compliance API Method',
                        'status': 'VERIFIED',
                        'details': 'get_break_requirements method now works properly'
                    })
                    print("   ✅ FIXED: get_break_requirements returns proper data structure")
                    print(f"   Response: {requirements}")
                else:
                    self.results['remaining_issues'].append({
                        'issue': 'get_break_requirements returns invalid data',
                        'details': f'Got: {requirements}'
                    })
                    print(f"   ❌ Invalid response: {requirements}")
            else:
                self.results['remaining_issues'].append({
                    'issue': 'get_break_requirements method still missing',
                    'details': 'Method not found on BreakComplianceManager'
                })
                print("   ❌ Still broken: get_break_requirements method missing")
            
            # Cleanup
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.results['remaining_issues'].append({
                'issue': 'Break compliance test failed with exception',
                'details': str(e)
            })
            print(f"   ❌ Exception: {str(e)}")

    def test_break_requirements_logic(self):
        """Test break requirements logic with actual time logs"""
        print("\n🔍 Testing Break Requirements Logic...")
        
        try:
            # Create test data
            test_user = User.objects.create_user(username='logic_test', email='logictest@test.com')
            test_role = Role.objects.create(name='LOGIC_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='LOGIC-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            compliance_manager = BreakComplianceManager()
            
            # Test scenarios
            scenarios = [
                {'hours': 1.0, 'expected_manual': True, 'expected_required': False},
                {'hours': 2.5, 'expected_manual': True, 'expected_required': True},
                {'hours': 4.5, 'expected_manual': True, 'expected_required': True}
            ]
            
            for scenario in scenarios:
                # Create time log for scenario
                clock_in_time = timezone.now() - timedelta(hours=scenario['hours'])
                time_log = TimeLog.objects.create(
                    employee=test_employee,
                    clock_in_time=clock_in_time,
                    status='CLOCKED_IN'
                )
                
                requirements = compliance_manager.get_break_requirements(test_employee, time_log)
                
                requires_break = requirements.get('requires_break', False)
                can_take_manual = requirements.get('can_take_manual_break', False)
                
                print(f"   {scenario['hours']} hours: required={requires_break}, manual={can_take_manual}")
                
                # Verify logic
                if (requires_break == scenario['expected_required'] and 
                    can_take_manual == scenario['expected_manual']):
                    print(f"   ✅ {scenario['hours']} hour scenario: CORRECT")
                else:
                    print(f"   ❌ {scenario['hours']} hour scenario: INCORRECT")
                    self.results['remaining_issues'].append({
                        'issue': f'Break logic incorrect at {scenario["hours"]} hours',
                        'details': f'Expected req={scenario["expected_required"]}, manual={scenario["expected_manual"]}, got req={requires_break}, manual={can_take_manual}'
                    })
                
                time_log.delete()
            
            # Cleanup
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.results['remaining_issues'].append({
                'issue': 'Break requirements logic test failed',
                'details': str(e)
            })
            print(f"   ❌ Exception: {str(e)}")

    def run_verification(self):
        """Run all verification tests"""
        print("🚀 Starting Final Verification of WorkSync Fixes")
        print("=" * 60)
        
        self.test_time_calculations_fix()
        self.test_break_compliance_fix()
        self.test_break_requirements_logic()
        
        self.generate_final_report()

    def generate_final_report(self):
        """Generate final verification report"""
        print("\n" + "=" * 60)
        print("📋 FINAL VERIFICATION REPORT")
        print("=" * 60)
        
        fixes_count = len(self.results['fixes_verified'])
        issues_count = len(self.results['remaining_issues'])
        
        print(f"✅ FIXES VERIFIED: {fixes_count}")
        for fix in self.results['fixes_verified']:
            print(f"   - {fix['fix']}: {fix['status']}")
            print(f"     {fix['details']}")
        
        if issues_count > 0:
            print(f"\n❌ REMAINING ISSUES: {issues_count}")
            for issue in self.results['remaining_issues']:
                print(f"   - {issue['issue']}")
                print(f"     {issue['details']}")
            self.results['overall_status'] = 'PARTIAL_SUCCESS'
        else:
            print(f"\n🎉 ALL CRITICAL ISSUES RESOLVED!")
            self.results['overall_status'] = 'SUCCESS'
        
        # Save results
        with open('final_verification_results.json', 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: final_verification_results.json")

if __name__ == "__main__":
    tester = FinalVerificationTest()
    tester.run_verification()
