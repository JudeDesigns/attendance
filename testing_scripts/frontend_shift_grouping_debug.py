#!/usr/bin/env python3
"""
Debug frontend shift grouping by simulating the JavaScript logic
"""

import os
import sys
import django
import requests
import json

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User

def test_frontend_shift_grouping():
    """Test how frontend would group the shifts"""
    backend_url = 'http://127.0.0.1:8000'
    api_url = f'{backend_url}/api/v1'
    
    print("🔍 DEBUGGING FRONTEND SHIFT GROUPING")
    print("=" * 60)
    
    # Get admin token
    try:
        response = requests.post(f'{api_url}/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access')
            
            # Get shifts with authentication
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f'{api_url}/scheduling/shifts/',
                params={
                    'start_date': '2025-12-22',
                    'end_date': '2025-12-28'
                },
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                shifts = data.get('results', [])
                
                print(f"📡 API returned {len(shifts)} shifts")
                print()
                
                # Simulate frontend grouping logic
                grouped_shifts = {}
                
                for shift in shifts:
                    print(f"🔍 Processing shift: {shift.get('employee_name')}")
                    print(f"   start_time: {shift.get('start_time')}")
                    print(f"   start_time_local: {shift.get('start_time_local')}")
                    
                    # Frontend logic: Extract date from start_time_local if available, fallback to start_time
                    time_to_use = shift.get('start_time_local') or shift.get('start_time')
                    print(f"   time_to_use: {time_to_use}")
                    
                    if time_to_use:
                        # Frontend logic: timeToUse.split('T')[0]
                        date = time_to_use.split('T')[0] if 'T' in time_to_use else None
                        print(f"   extracted_date: {date}")
                        
                        if date:
                            if date not in grouped_shifts:
                                grouped_shifts[date] = {}
                            
                            employee_name = shift.get('employee_name')
                            if employee_name not in grouped_shifts[date]:
                                grouped_shifts[date][employee_name] = []
                            
                            grouped_shifts[date][employee_name].append(shift)
                            print(f"   ✅ Added to grouped_shifts[{date}][{employee_name}]")
                        else:
                            print(f"   ❌ Could not extract date")
                    else:
                        print(f"   ❌ No time_to_use")
                    
                    print("   " + "-" * 40)
                
                print(f"\n📊 GROUPED SHIFTS RESULT:")
                for date, employees in grouped_shifts.items():
                    print(f"   📅 {date}:")
                    for employee, shifts in employees.items():
                        print(f"     👤 {employee}: {len(shifts)} shift(s)")
                        for shift in shifts:
                            start_local = shift.get('start_time_local') or shift.get('start_time')
                            end_local = shift.get('end_time_local') or shift.get('end_time')
                            print(f"       • {start_local} - {end_local}")
                
                # Check specifically for 2025-12-27
                target_date = '2025-12-27'
                if target_date in grouped_shifts:
                    print(f"\n✅ Shifts found for {target_date}:")
                    for employee, shifts in grouped_shifts[target_date].items():
                        print(f"   👤 {employee}: {len(shifts)} shift(s)")
                else:
                    print(f"\n❌ No shifts found for {target_date} in grouped results")
                    print("   This explains why the calendar is empty!")
                
            else:
                print(f"❌ API Error: {response.status_code}")
                print(f"Response: {response.text}")
                
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_frontend_shift_grouping()
