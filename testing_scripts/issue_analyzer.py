#!/usr/bin/env python3
"""
WorkSync Issue Analyzer
Analyzes specific issues found during testing and provides detailed fixes
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

class IssueAnalyzer:
    def __init__(self):
        self.issues_found = []
        
    def analyze_time_calculations(self):
        """Analyze time calculation issues in TimeLog model"""
        print("🔍 Analyzing Time Calculation Issues...")
        
        try:
            # Create test data
            test_user = User.objects.create_user(username='time_calc_test', email='timecalc@test.com')
            test_role = Role.objects.create(name='TIME_TEST_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='TIME-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Create time log with specific times
            clock_in_time = timezone.now() - timedelta(hours=3, minutes=30)
            time_log = TimeLog.objects.create(
                employee=test_employee,
                clock_in_time=clock_in_time,
                status='CLOCKED_IN'
            )
            
            # Test duration calculation
            duration = time_log.duration_minutes
            print(f"   Clock-in time: {clock_in_time}")
            print(f"   Current time: {timezone.now()}")
            print(f"   Duration minutes: {duration}")
            
            if duration is None:
                self.issues_found.append({
                    'category': 'Time Calculations',
                    'issue': 'duration_minutes property returns None',
                    'severity': 'HIGH',
                    'location': 'apps/attendance/models.py - TimeLog.duration_minutes',
                    'fix_needed': 'Check duration_minutes property implementation'
                })
                print("   ❌ Issue: duration_minutes returns None")
            elif duration < 180:  # Should be ~210 minutes (3.5 hours)
                self.issues_found.append({
                    'category': 'Time Calculations',
                    'issue': f'duration_minutes calculation incorrect: {duration} minutes (expected ~210)',
                    'severity': 'MEDIUM',
                    'location': 'apps/attendance/models.py - TimeLog.duration_minutes',
                    'fix_needed': 'Review duration calculation logic'
                })
                print(f"   ⚠️ Issue: Incorrect duration calculation: {duration} minutes")
            else:
                print("   ✅ Time calculations working correctly")
            
            # Test hours worked calculation
            hours_worked = time_log.hours_worked if hasattr(time_log, 'hours_worked') else None
            if hours_worked is None:
                self.issues_found.append({
                    'category': 'Time Calculations',
                    'issue': 'hours_worked property missing or returns None',
                    'severity': 'HIGH',
                    'location': 'apps/attendance/models.py - TimeLog.hours_worked',
                    'fix_needed': 'Implement hours_worked property'
                })
                print("   ❌ Issue: hours_worked property missing")
            else:
                print(f"   ✅ Hours worked: {hours_worked}")
            
            # Cleanup
            time_log.delete()
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.issues_found.append({
                'category': 'Time Calculations',
                'issue': f'Exception during time calculation analysis: {str(e)}',
                'severity': 'CRITICAL',
                'location': 'apps/attendance/models.py',
                'fix_needed': 'Debug time calculation system'
            })
            print(f"   ❌ Critical error: {str(e)}")

    def analyze_break_compliance_logic(self):
        """Analyze break compliance logic issues"""
        print("\n🔍 Analyzing Break Compliance Logic...")
        
        try:
            from apps.attendance.break_compliance import BreakComplianceManager
            
            # Create test data
            test_user = User.objects.create_user(username='break_comp_test', email='breakcomp@test.com')
            test_role = Role.objects.create(name='BREAK_COMP_ROLE', description='Test role')
            test_employee = Employee.objects.create(
                user=test_user,
                employee_id='BREAK-COMP-001',
                role=test_role,
                employment_status='ACTIVE'
            )
            
            # Test break compliance at different time intervals
            compliance_manager = BreakComplianceManager()
            
            # Test scenarios
            test_scenarios = [
                {'hours': 1.0, 'expected_break': False, 'expected_manual': True},
                {'hours': 2.0, 'expected_break': True, 'expected_manual': True},
                {'hours': 4.0, 'expected_break': True, 'expected_manual': True},
                {'hours': 6.0, 'expected_break': True, 'expected_manual': True}
            ]
            
            for scenario in test_scenarios:
                # Create time log for scenario
                clock_in_time = timezone.now() - timedelta(hours=scenario['hours'])
                time_log = TimeLog.objects.create(
                    employee=test_employee,
                    clock_in_time=clock_in_time,
                    status='CLOCKED_IN'
                )
                
                requirements = compliance_manager.get_break_requirements(test_employee)
                
                requires_break = requirements.get('requires_break', False)
                can_take_manual = requirements.get('can_take_manual_break', False)
                
                print(f"   {scenario['hours']} hours: requires_break={requires_break}, manual={can_take_manual}")
                
                # Check if results match expectations
                if requires_break != scenario['expected_break']:
                    self.issues_found.append({
                        'category': 'Break Compliance',
                        'issue': f'Break requirement logic incorrect at {scenario["hours"]} hours',
                        'severity': 'HIGH',
                        'location': 'apps/attendance/break_compliance.py',
                        'fix_needed': f'Expected requires_break={scenario["expected_break"]}, got {requires_break}'
                    })
                
                if can_take_manual != scenario['expected_manual']:
                    self.issues_found.append({
                        'category': 'Break Compliance',
                        'issue': f'Manual break logic incorrect at {scenario["hours"]} hours',
                        'severity': 'MEDIUM',
                        'location': 'apps/attendance/break_compliance.py',
                        'fix_needed': f'Expected can_take_manual_break={scenario["expected_manual"]}, got {can_take_manual}'
                    })
                
                time_log.delete()
            
            # Cleanup
            test_employee.delete()
            test_user.delete()
            test_role.delete()
            
        except Exception as e:
            self.issues_found.append({
                'category': 'Break Compliance',
                'issue': f'Exception during break compliance analysis: {str(e)}',
                'severity': 'CRITICAL',
                'location': 'apps/attendance/break_compliance.py',
                'fix_needed': 'Debug break compliance system'
            })
            print(f"   ❌ Critical error: {str(e)}")

    def analyze_frontend_api_integration(self):
        """Analyze frontend API integration issues"""
        print("\n🔍 Analyzing Frontend API Integration...")
        
        # Check if API endpoints are properly configured
        try:
            from apps.api import urls as api_urls
            from django.urls import reverse
            
            # Check if break-related endpoints exist
            expected_endpoints = [
                'clock_in',
                'clock_out', 
                'start_break',
                'end_break',
                'employee_status'
            ]
            
            for endpoint in expected_endpoints:
                try:
                    url = reverse(f'api:{endpoint}')
                    print(f"   ✅ Endpoint '{endpoint}' exists: {url}")
                except:
                    self.issues_found.append({
                        'category': 'API Integration',
                        'issue': f'Missing API endpoint: {endpoint}',
                        'severity': 'HIGH',
                        'location': 'apps/api/urls.py',
                        'fix_needed': f'Add {endpoint} endpoint to API URLs'
                    })
                    print(f"   ❌ Missing endpoint: {endpoint}")
                    
        except Exception as e:
            self.issues_found.append({
                'category': 'API Integration',
                'issue': f'Exception during API analysis: {str(e)}',
                'severity': 'CRITICAL',
                'location': 'apps/api/',
                'fix_needed': 'Debug API configuration'
            })
            print(f"   ❌ Critical error: {str(e)}")

    def run_analysis(self):
        """Run all issue analyses"""
        print("🚀 Starting Detailed Issue Analysis")
        print("=" * 50)
        
        self.analyze_time_calculations()
        self.analyze_break_compliance_logic()
        self.analyze_frontend_api_integration()
        
        self.generate_report()

    def generate_report(self):
        """Generate detailed issue report"""
        print("\n" + "=" * 50)
        print("📋 DETAILED ISSUE ANALYSIS REPORT")
        print("=" * 50)
        
        if not self.issues_found:
            print("✅ No issues found in detailed analysis!")
            return
        
        # Group issues by severity
        critical_issues = [i for i in self.issues_found if i['severity'] == 'CRITICAL']
        high_issues = [i for i in self.issues_found if i['severity'] == 'HIGH']
        medium_issues = [i for i in self.issues_found if i['severity'] == 'MEDIUM']
        
        print(f"🚨 CRITICAL ISSUES ({len(critical_issues)}):")
        for issue in critical_issues:
            print(f"   - [{issue['category']}] {issue['issue']}")
            print(f"     Location: {issue['location']}")
            print(f"     Fix: {issue['fix_needed']}")
            print()
        
        print(f"⚠️ HIGH PRIORITY ISSUES ({len(high_issues)}):")
        for issue in high_issues:
            print(f"   - [{issue['category']}] {issue['issue']}")
            print(f"     Location: {issue['location']}")
            print(f"     Fix: {issue['fix_needed']}")
            print()
        
        print(f"🟡 MEDIUM PRIORITY ISSUES ({len(medium_issues)}):")
        for issue in medium_issues:
            print(f"   - [{issue['category']}] {issue['issue']}")
            print(f"     Location: {issue['location']}")
            print(f"     Fix: {issue['fix_needed']}")
            print()
        
        # Save detailed report
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_issues': len(self.issues_found),
            'critical_issues': len(critical_issues),
            'high_issues': len(high_issues),
            'medium_issues': len(medium_issues),
            'issues': self.issues_found
        }
        
        with open('detailed_issue_analysis.json', 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"💾 Detailed report saved to: detailed_issue_analysis.json")

if __name__ == "__main__":
    analyzer = IssueAnalyzer()
    analyzer.run_analysis()
