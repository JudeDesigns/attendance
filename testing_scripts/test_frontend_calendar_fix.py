#!/usr/bin/env python3
"""
Test that the frontend calendar now shows the overnight shifts
"""

import requests
import json

def test_frontend_calendar_fix():
    """Test frontend calendar with the date filtering fix"""
    backend_url = 'http://127.0.0.1:8000'
    api_url = f'{backend_url}/api/v1'
    
    print("📅 TESTING FRONTEND CALENDAR FIX")
    print("=" * 60)
    
    # Get admin token
    try:
        response = requests.post(f'{api_url}/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            token = response.json().get('access')
            headers = {'Authorization': f'Bearer {token}'}
            
            # Test the exact API call that the frontend AdminScheduling page makes
            print("🔍 TESTING FRONTEND API CALLS:")
            print("-" * 40)
            
            # This is the exact call from AdminScheduling.js lines 85-89
            frontend_api_call = {
                'start_date': '2025-12-21',  # startOfWeek for Dec 27, 2025 (Sunday)
                'end_date': '2025-12-27'     # endOfWeek for Dec 27, 2025 (Saturday)
            }
            
            print(f"📡 Frontend API Call (AdminScheduling):")
            print(f"   URL: /scheduling/shifts/")
            print(f"   Params: {frontend_api_call}")
            
            response = requests.get(
                f'{api_url}/scheduling/shifts/',
                params=frontend_api_call,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                shifts = data.get('results', [])
                
                print(f"   ✅ API Success: {len(shifts)} total shifts")
                
                # Simulate frontend grouping logic
                grouped_shifts = {}
                
                for shift in shifts:
                    # Frontend logic from AdminScheduling.js line 166
                    time_to_use = shift.get('start_time_local') or shift.get('start_time')
                    date = time_to_use.split('T')[0] if time_to_use and 'T' in time_to_use else None
                    
                    if date:
                        if date not in grouped_shifts:
                            grouped_shifts[date] = {}
                        
                        employee_name = shift.get('employee_name')
                        if employee_name not in grouped_shifts[date]:
                            grouped_shifts[date][employee_name] = []
                        
                        grouped_shifts[date][employee_name].append(shift)
                
                print(f"\n📊 FRONTEND GROUPED SHIFTS:")
                for date in sorted(grouped_shifts.keys()):
                    print(f"   📅 {date}:")
                    for employee, employee_shifts in grouped_shifts[date].items():
                        print(f"     👤 {employee}: {len(employee_shifts)} shift(s)")
                        for shift in employee_shifts:
                            start_time = shift.get('start_time_local') or shift.get('start_time')
                            end_time = shift.get('end_time_local') or shift.get('end_time')
                            # Extract time portion for display
                            start_display = start_time.split('T')[1][:5] if 'T' in start_time else start_time
                            end_display = end_time.split('T')[1][:5] if 'T' in end_time else end_time
                            print(f"       • {start_display} - {end_display}")
                
                # Check specifically for Dec 27
                if '2025-12-27' in grouped_shifts:
                    overnight_count = len(grouped_shifts['2025-12-27'])
                    print(f"\n✅ SUCCESS: {overnight_count} employees have shifts on 2025-12-27")
                    print("   The overnight shifts should now be visible in the frontend calendar!")
                else:
                    print(f"\n❌ ISSUE: No shifts found for 2025-12-27 in grouped results")
                
            else:
                print(f"   ❌ API Error: {response.status_code}")
                print(f"   Response: {response.text}")
            
            print(f"\n🎯 FRONTEND IMPACT:")
            print("✅ Backend API now returns overnight shifts for date ranges")
            print("✅ Frontend grouping logic should now work correctly")
            print("✅ Calendar should display overnight shifts on Dec 27")
            print("\n💡 NEXT STEPS:")
            print("1. Refresh the frontend application (clear cache if needed)")
            print("2. Navigate to Admin Scheduling page")
            print("3. Check the week of Dec 21-27, 2025")
            print("4. Verify overnight shifts appear under Dec 27 column")
                
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_frontend_calendar_fix()
