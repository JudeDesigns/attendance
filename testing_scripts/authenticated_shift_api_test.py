#!/usr/bin/env python3
"""
Test the shift API with authentication to see if it returns the shifts
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
from apps.employees.models import Employee, Role

def test_authenticated_shift_api():
    """Test shift API with authentication"""
    backend_url = 'http://127.0.0.1:8000'
    api_url = f'{backend_url}/api/v1'
    
    print("🔐 Testing Authenticated Shift API")
    print("=" * 50)
    
    # Create test user if doesn't exist
    try:
        user = User.objects.get(username='admin')
        print(f"✅ Using existing admin user")
    except User.DoesNotExist:
        # Create admin user
        user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            is_staff=True,
            is_superuser=True
        )
        print(f"✅ Created admin user")
    
    # Login to get token
    try:
        response = requests.post(f'{api_url}/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access')
            print(f"✅ Authentication successful")
            
            # Test shift API with authentication
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
            
            print(f"📡 Authenticated API Request:")
            print(f"   URL: /scheduling/shifts/")
            print(f"   Parameters: start_date=2025-12-22, end_date=2025-12-28")
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                shifts = data.get('results', [])
                print(f"   ✅ API Success! Returned {len(shifts)} shifts")
                
                if shifts:
                    print("   📋 Shifts returned:")
                    for shift in shifts:
                        print(f"     • ID: {shift.get('id')}")
                        print(f"       Employee: {shift.get('employee_id')} ({shift.get('employee_name')})")
                        print(f"       Start: {shift.get('start_time')}")
                        print(f"       End: {shift.get('end_time')}")
                        print(f"       Published: {shift.get('is_published')}")
                        print("       ---")
                else:
                    print("   ⚠️ No shifts returned (this might be expected for admin user)")
                    print("   💡 Admin users see all shifts, but there might be additional filtering")
                    
            else:
                print(f"   ❌ API Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
    
    print("\n🎯 CONCLUSION:")
    print("If this test shows shifts, then the issue is frontend authentication.")
    print("If this test shows no shifts, then there's a backend filtering issue.")

if __name__ == "__main__":
    test_authenticated_shift_api()
