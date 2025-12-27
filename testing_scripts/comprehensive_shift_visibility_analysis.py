#!/usr/bin/env python3
"""
COMPREHENSIVE ANALYSIS: Why overnight shifts are invisible across the application
This script will analyze every possible condition that could hide shifts
"""

import os
import sys
import django
import requests
from datetime import datetime, timedelta
import json

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.scheduling.models import Shift
from apps.scheduling.serializers import ShiftSerializer
from apps.employees.models import Employee
from django.contrib.auth.models import User

def comprehensive_shift_analysis():
    """Analyze every aspect of the overnight shifts to find why they're invisible"""
    
    print("🔍 COMPREHENSIVE SHIFT VISIBILITY ANALYSIS")
    print("=" * 80)
    print("Analyzing why overnight shifts are invisible across the application...")
    print()
    
    # Get the problematic shifts
    overnight_shifts = Shift.objects.filter(
        start_time__date=datetime(2025, 12, 27).date(),
        end_time__date=datetime(2025, 12, 28).date()  # Overnight condition
    ).select_related('employee__user')
    
    print(f"📊 Found {overnight_shifts.count()} overnight shifts for analysis")
    print()
    
    for i, shift in enumerate(overnight_shifts, 1):
        print(f"🔍 SHIFT {i}: {shift.employee.employee_id} ({shift.employee.user.first_name} {shift.employee.user.last_name})")
        print("=" * 60)
        
        # 1. BASIC SHIFT DATA
        print("1️⃣ BASIC SHIFT DATA:")
        print(f"   ID: {shift.id}")
        print(f"   Start Time (UTC): {shift.start_time}")
        print(f"   End Time (UTC): {shift.end_time}")
        print(f"   Duration: {shift.duration_hours} hours")
        print(f"   Status: {shift.status}")
        print(f"   Published: {shift.is_published}")
        print(f"   Shift Type: {shift.shift_type}")
        print(f"   Location: {shift.location or 'None'}")
        print(f"   Notes: {shift.notes or 'None'}")
        print()
        
        # 2. EMPLOYEE DATA
        print("2️⃣ EMPLOYEE DATA:")
        employee = shift.employee
        print(f"   Employee ID: {employee.employee_id}")
        print(f"   User ID: {employee.user.id}")
        print(f"   Active: {employee.is_active}")
        print(f"   Department: {employee.department or 'None'}")
        print(f"   Role: {employee.role.name if employee.role else 'None'}")
        print(f"   Timezone: {employee.timezone}")
        print(f"   User Active: {employee.user.is_active}")
        print(f"   User Staff: {employee.user.is_staff}")
        print()
        
        # 3. SERIALIZED DATA (What API returns)
        print("3️⃣ API SERIALIZED DATA:")
        serializer = ShiftSerializer(shift)
        serialized = serializer.data
        print(f"   Start Time: {serialized.get('start_time')}")
        print(f"   End Time: {serialized.get('end_time')}")
        print(f"   Start Time Local: {serialized.get('start_time_local')}")
        print(f"   End Time Local: {serialized.get('end_time_local')}")
        print(f"   Employee Name: {serialized.get('employee_name')}")
        print(f"   Employee ID: {serialized.get('employee_id')}")
        print(f"   Published: {serialized.get('is_published')}")
        print(f"   Status: {serialized.get('status')}")
        print()
        
        # 4. DATE ANALYSIS
        print("4️⃣ DATE ANALYSIS:")
        start_date_utc = shift.start_time.date()
        end_date_utc = shift.end_time.date()
        
        # Parse local times
        start_local_str = serialized.get('start_time_local')
        end_local_str = serialized.get('end_time_local')
        
        if start_local_str and end_local_str:
            try:
                start_local = datetime.fromisoformat(start_local_str.replace('Z', '+00:00'))
                end_local = datetime.fromisoformat(end_local_str.replace('Z', '+00:00'))
                start_date_local = start_local.date()
                end_date_local = end_local.date()
                
                print(f"   Start Date (UTC): {start_date_utc}")
                print(f"   End Date (UTC): {end_date_utc}")
                print(f"   Start Date (Local): {start_date_local}")
                print(f"   End Date (Local): {end_date_local}")
                print(f"   Is Overnight (UTC): {end_date_utc > start_date_utc}")
                print(f"   Is Overnight (Local): {end_date_local > start_date_local}")
                print(f"   Spans Multiple Days: {start_date_local != end_date_local}")
            except Exception as e:
                print(f"   ❌ Error parsing local times: {e}")
        print()
        
        # 5. POTENTIAL FILTERING CONDITIONS
        print("5️⃣ POTENTIAL FILTERING CONDITIONS:")
        
        # Check common filter conditions
        conditions = {
            "is_published == True": shift.is_published == True,
            "status == 'CONFIRMED'": shift.status == 'CONFIRMED',
            "status == 'PENDING'": shift.status == 'PENDING',
            "employee.is_active == True": employee.is_active == True,
            "user.is_active == True": employee.user.is_active == True,
            "start_time is not None": shift.start_time is not None,
            "end_time is not None": shift.end_time is not None,
            "duration_hours > 0": shift.duration_hours > 0,
            "start_time < end_time": shift.start_time < shift.end_time,
        }
        
        for condition, result in conditions.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {condition}: {status}")
        print()
        
        # 6. FRONTEND DATE EXTRACTION
        print("6️⃣ FRONTEND DATE EXTRACTION:")
        time_to_use = serialized.get('start_time_local') or serialized.get('start_time')
        if time_to_use and 'T' in time_to_use:
            extracted_date = time_to_use.split('T')[0]
            print(f"   time_to_use: {time_to_use}")
            print(f"   extracted_date: {extracted_date}")
            print(f"   matches 2025-12-27: {extracted_date == '2025-12-27'}")
        else:
            print(f"   ❌ Cannot extract date from: {time_to_use}")
        print()
        
        print("-" * 80)
        print()
    
    # 7. API ENDPOINT ANALYSIS
    print("7️⃣ API ENDPOINT ANALYSIS:")
    print("Testing actual API responses...")
    
    try:
        # Login to get token
        response = requests.post('http://127.0.0.1:8000/api/v1/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            token = response.json().get('access')
            headers = {'Authorization': f'Bearer {token}'}
            
            # Test different API calls
            api_tests = [
                {
                    'name': 'All Shifts (No Filter)',
                    'url': 'http://127.0.0.1:8000/api/v1/scheduling/shifts/',
                    'params': {}
                },
                {
                    'name': 'Date Range Filter (Dec 22-28)',
                    'url': 'http://127.0.0.1:8000/api/v1/scheduling/shifts/',
                    'params': {'start_date': '2025-12-22', 'end_date': '2025-12-28'}
                },
                {
                    'name': 'Specific Date Filter (Dec 27)',
                    'url': 'http://127.0.0.1:8000/api/v1/scheduling/shifts/',
                    'params': {'start_date': '2025-12-27', 'end_date': '2025-12-27'}
                },
                {
                    'name': 'Published Only Filter',
                    'url': 'http://127.0.0.1:8000/api/v1/scheduling/shifts/',
                    'params': {'is_published': 'true'}
                }
            ]
            
            for test in api_tests:
                response = requests.get(test['url'], params=test['params'], headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    shifts = data.get('results', [])
                    overnight_count = len([s for s in shifts if s.get('start_time_local', '').startswith('2025-12-27')])
                    print(f"   {test['name']}: {len(shifts)} total, {overnight_count} overnight shifts")
                else:
                    print(f"   {test['name']}: ❌ Error {response.status_code}")
        else:
            print("   ❌ Authentication failed")
    except Exception as e:
        print(f"   ❌ API test failed: {e}")
    
    print()
    print("🎯 ANALYSIS COMPLETE")
    print("=" * 80)
    print("Review the output above to identify any conditions that are failing")
    print("and causing the overnight shifts to be filtered out.")

if __name__ == "__main__":
    comprehensive_shift_analysis()
