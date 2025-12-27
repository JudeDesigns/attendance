#!/usr/bin/env python3
"""
Analyze employee timezone settings and admin settings page
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.employees.models import Employee
from django.contrib.auth.models import User

def analyze_employee_timezones():
    """Analyze why employees have different timezones"""
    
    print("🌍 EMPLOYEE TIMEZONE ANALYSIS")
    print("=" * 60)
    
    # Get all employees
    employees = Employee.objects.all().select_related('user')
    
    print(f"📊 Found {employees.count()} employees:")
    print()
    
    for employee in employees:
        print(f"👤 {employee.employee_id} ({employee.user.first_name} {employee.user.last_name})")
        print(f"   User ID: {employee.user.id}")
        print(f"   Username: {employee.user.username}")
        print(f"   Email: {employee.user.email}")
        print(f"   Timezone: {employee.timezone}")
        print(f"   Employment Status: {employee.employment_status}")
        print(f"   Hire Date: {employee.hire_date}")
        print(f"   Created: {employee.created_at}")
        print(f"   Updated: {employee.updated_at}")
        print()
    
    # Check timezone distribution
    timezone_counts = {}
    for employee in employees:
        tz = employee.timezone
        timezone_counts[tz] = timezone_counts.get(tz, 0) + 1
    
    print("📈 TIMEZONE DISTRIBUTION:")
    for tz, count in timezone_counts.items():
        print(f"   {tz}: {count} employee(s)")
    
    print()
    print("🔍 ANALYSIS:")
    
    # Check if timezones were set manually or by default
    utc_employees = [e for e in employees if e.timezone == 'UTC']
    non_utc_employees = [e for e in employees if e.timezone != 'UTC']
    
    print(f"   UTC Employees: {len(utc_employees)}")
    print(f"   Non-UTC Employees: {len(non_utc_employees)}")
    
    if non_utc_employees:
        print(f"\n   Non-UTC Employee Details:")
        for emp in non_utc_employees:
            print(f"     • {emp.employee_id}: {emp.timezone}")
    
    print(f"\n💡 LIKELY EXPLANATION:")
    print(f"   - Default timezone in Employee model is 'UTC' (line 78 in models.py)")
    print(f"   - EMP005 likely created with default settings → UTC")
    print(f"   - JUDEOBA (Jude) likely had timezone manually set to Europe/Paris")
    print(f"   - This could be from:")
    print(f"     1. Manual admin panel configuration")
    print(f"     2. Different creation process/script")
    print(f"     3. User preference setting")
    
    print(f"\n🚨 PRODUCTION CONCERN:")
    print(f"   For San Francisco deployment, all employees should probably use:")
    print(f"   - 'America/Los_Angeles' (Pacific Time)")
    print(f"   - Or company-wide timezone policy")
    print(f"   - Mixed timezones can cause scheduling confusion")

if __name__ == "__main__":
    analyze_employee_timezones()
