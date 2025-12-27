#!/usr/bin/env python3
"""
Fix timezone mixing issue by standardizing all employees to Pacific Time
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.employees.models import Employee
from django.conf import settings

def fix_timezone_standardization():
    """Standardize all employee timezones to Pacific Time for San Francisco deployment"""
    
    print("🔧 FIXING TIMEZONE STANDARDIZATION")
    print("=" * 60)
    
    # Target timezone for San Francisco
    target_timezone = 'America/Los_Angeles'
    
    # Get all employees
    employees = Employee.objects.all()
    
    print(f"📊 Found {employees.count()} employees")
    print(f"🎯 Target timezone: {target_timezone}")
    print()
    
    print("📋 BEFORE STANDARDIZATION:")
    for employee in employees:
        print(f"   {employee.employee_id}: {employee.timezone}")
    
    # Update all employees to Pacific Time
    updated_count = Employee.objects.all().update(timezone=target_timezone)
    
    print(f"\n✅ STANDARDIZATION COMPLETE:")
    print(f"   Updated {updated_count} employees to {target_timezone}")
    
    print(f"\n📋 AFTER STANDARDIZATION:")
    employees = Employee.objects.all()  # Refresh from database
    for employee in employees:
        print(f"   {employee.employee_id}: {employee.timezone}")
    
    # Verify all are standardized
    unique_timezones = set(emp.timezone for emp in employees)
    
    if len(unique_timezones) == 1 and target_timezone in unique_timezones:
        print(f"\n🎉 SUCCESS: All employees now use {target_timezone}")
        print("✅ Timezone mixing issue resolved!")
        print("✅ Ready for San Francisco production deployment!")
    else:
        print(f"\n❌ ERROR: Still have mixed timezones: {unique_timezones}")
        return False
    
    return True

if __name__ == "__main__":
    success = fix_timezone_standardization()
    if success:
        print(f"\n🚀 NEXT STEPS:")
        print("1. Restart Django server to apply changes")
        print("2. Test shift scheduling with Pacific Time")
        print("3. Verify frontend displays correct times")
    else:
        print(f"\n❌ MANUAL INTERVENTION REQUIRED")
        sys.exit(1)
