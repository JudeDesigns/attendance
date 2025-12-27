#!/usr/bin/env python3
"""
Check if frontend authentication is working by testing the API endpoints
that the frontend would call
"""

import requests
import json

def test_frontend_auth_flow():
    """Test the complete frontend authentication flow"""
    backend_url = 'http://127.0.0.1:8000'
    api_url = f'{backend_url}/api/v1'
    
    print("🔐 TESTING FRONTEND AUTHENTICATION FLOW")
    print("=" * 60)
    
    # Step 1: Login (what frontend does on login page)
    print("1️⃣ Testing login endpoint...")
    try:
        response = requests.post(f'{api_url}/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get('access')
            refresh_token = data.get('refresh')
            
            print(f"   ✅ Login successful")
            print(f"   Access token: {access_token[:50]}...")
            print(f"   Refresh token: {refresh_token[:50]}...")
            
            # Step 2: Test authenticated API call (what frontend does on scheduling page)
            print("\n2️⃣ Testing authenticated scheduling API call...")
            headers = {
                'Authorization': f'Bearer {access_token}',
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
                print(f"   ✅ Scheduling API successful - {len(shifts)} shifts returned")
                
                # Check for our target shifts
                target_shifts = [s for s in shifts if s.get('start_time_local', '').startswith('2025-12-27')]
                print(f"   🎯 Shifts for 2025-12-27: {len(target_shifts)}")
                
                for shift in target_shifts:
                    print(f"     • {shift.get('employee_name')}: {shift.get('start_time_local')} - {shift.get('end_time_local')}")
                
                # Step 3: Test employee API (what frontend does to get employee list)
                print("\n3️⃣ Testing employee API call...")
                response = requests.get(f'{api_url}/employees/', headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    employees = data.get('results', [])
                    print(f"   ✅ Employee API successful - {len(employees)} employees returned")
                    
                    # Find our target employees
                    jude = next((e for e in employees if 'Jude' in e.get('user', {}).get('first_name', '')), None)
                    omideyi = next((e for e in employees if 'Omideyi' in e.get('user', {}).get('first_name', '')), None)
                    
                    if jude:
                        print(f"     • Found Jude Oba: {jude.get('employee_id')}")
                    if omideyi:
                        print(f"     • Found Omideyi Taiwo: {omideyi.get('employee_id')}")
                    
                    print("\n🎯 CONCLUSION:")
                    if len(target_shifts) >= 2:
                        print("✅ Backend is returning the overnight shifts correctly!")
                        print("✅ Authentication is working properly!")
                        print("🔍 The issue must be in the frontend React components or caching.")
                        print("\n💡 NEXT STEPS:")
                        print("1. Check if you're logged in to the frontend application")
                        print("2. Clear browser cache/localStorage if needed")
                        print("3. Check browser Network tab for API calls")
                        print("4. Verify React Query cache is not stale")
                    else:
                        print("❌ Backend is not returning the expected shifts")
                        print("🔍 Need to investigate backend filtering logic further")
                        
                else:
                    print(f"   ❌ Employee API failed: {response.status_code}")
                    print(f"   Response: {response.text}")
                    
            else:
                print(f"   ❌ Scheduling API failed: {response.status_code}")
                print(f"   Response: {response.text}")
                
        else:
            print(f"   ❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_frontend_auth_flow()
