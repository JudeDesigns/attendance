#!/usr/bin/env python3
"""
Test the date filtering fix to ensure overnight shifts are now visible
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

def test_date_filtering_fix():
    """Test that the date filtering fix works for overnight shifts"""
    backend_url = 'http://127.0.0.1:8000'
    api_url = f'{backend_url}/api/v1'
    
    print("🧪 TESTING DATE FILTERING FIX")
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
            
            # Test the previously failing case: specific date filter
            print("🎯 TESTING SPECIFIC DATE FILTER (Previously Failed):")
            print("-" * 50)
            
            test_cases = [
                {
                    'name': 'Dec 27 Only (Should now show overnight shifts)',
                    'params': {'start_date': '2025-12-27', 'end_date': '2025-12-27'}
                },
                {
                    'name': 'Dec 26 Only (Should show no overnight shifts)',
                    'params': {'start_date': '2025-12-26', 'end_date': '2025-12-26'}
                },
                {
                    'name': 'Dec 28 Only (Should show no overnight shifts)',
                    'params': {'start_date': '2025-12-28', 'end_date': '2025-12-28'}
                },
                {
                    'name': 'Range Dec 22-28 (Should show overnight shifts)',
                    'params': {'start_date': '2025-12-22', 'end_date': '2025-12-28'}
                }
            ]
            
            for test_case in test_cases:
                print(f"\n📋 {test_case['name']}:")
                
                response = requests.get(
                    f'{api_url}/scheduling/shifts/',
                    params=test_case['params'],
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    shifts = data.get('results', [])
                    
                    # Count overnight shifts (those starting on 2025-12-27)
                    overnight_shifts = [
                        s for s in shifts 
                        if s.get('start_time_local', '').startswith('2025-12-27') and
                           s.get('end_time_local', '').startswith('2025-12-28')
                    ]
                    
                    print(f"   Total shifts: {len(shifts)}")
                    print(f"   Overnight shifts (Dec 27→28): {len(overnight_shifts)}")
                    
                    if overnight_shifts:
                        print("   📋 Overnight shifts found:")
                        for shift in overnight_shifts:
                            print(f"     • {shift.get('employee_name')}: {shift.get('start_time_local')} → {shift.get('end_time_local')}")
                    else:
                        print("   ⚪ No overnight shifts found")
                        
                else:
                    print(f"   ❌ API Error: {response.status_code}")
                    print(f"   Response: {response.text}")
            
            print(f"\n🎯 EXPECTED RESULTS:")
            print("✅ Dec 27 Only: Should show 2 overnight shifts (JUDEOBA & EMP005)")
            print("⚪ Dec 26 Only: Should show 0 overnight shifts")
            print("⚪ Dec 28 Only: Should show 0 overnight shifts")
            print("✅ Range Dec 22-28: Should show 2 overnight shifts")
            
            print(f"\n🔍 ANALYSIS:")
            print("If 'Dec 27 Only' now shows the overnight shifts, the fix is working!")
            print("The overnight shifts start on Dec 27 at 20:00 and should be visible")
            print("when filtering for Dec 27 specifically.")
                
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_date_filtering_fix()
