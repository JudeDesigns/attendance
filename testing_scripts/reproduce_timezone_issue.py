import requests
import json
import sys
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "admin"
PASSWORD = "admin123"

def run_test():
    session = requests.Session()
    
    # 1. Login
    print("Logging in...")
    resp = session.post(f"{BASE_URL}/auth/login/", json={'username': USERNAME, 'password': PASSWORD})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    
    token = resp.json()['access']
    headers = {'Authorization': f'Bearer {token}'}
    print("Login successful.")

    # 2. Set Admin Timezone to Africa/Lagos (UTC+1)
    print("Setting timezone to Africa/Lagos...")
    resp = session.post(f"{BASE_URL}/core/timezones/update/", headers=headers, json={'timezone': 'Africa/Lagos'})
    if resp.status_code != 200:
        print(f"Update timezone failed: {resp.text}")
        return
    print("Timezone set to Africa/Lagos.")

    # 3. Get an employee (use self)
    resp = session.get(f"{BASE_URL}/employees/me/", headers=headers)
    employee_id = resp.json()['id']
    print(f"Employee ID: {employee_id}")

    # 4. Create Shift with Naive Datetime
    # We want 9 AM WAT.
    # If successful, it should be 08:00 UTC.
    # If failing (current behavior), it will be 09:00 PST -> 17:00 UTC.
    
    target_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
    start_time_str = f"{target_date}T09:00:00"
    end_time_str = f"{target_date}T17:00:00"
    
    print(f"Creating shift for {start_time_str} (Expect 9 AM WAT)...")
    
    shift_data = {
        'employee': employee_id,
        'start_time': start_time_str,
        'end_time': end_time_str,
        'notes': 'Timezone test shift',
        'is_published': True
    }
    
    resp = session.post(f"{BASE_URL}/scheduling/shifts/", headers=headers, json=shift_data)
    if resp.status_code != 201:
        print(f"Create shift failed: {resp.text}")
        return
    
    shift = resp.json()
    created_start = shift['start_time'] # UTC ISO string
    print(f"Created Shift Start (UTC): {created_start}")
    
    # Parse and convert to UTC
    dt_obj = datetime.fromisoformat(created_start.replace('Z', '+00:00'))
    dt_utc = dt_obj.astimezone(timezone.utc)
    print(f"UTC Hour: {dt_utc.hour}")
    
    if dt_utc.hour == 8:
        print("SUCCESS: Shift created at 08:00 UTC (09:00 WAT).")
    elif dt_utc.hour == 17:
        print("FAILURE: Shift created at 17:00 UTC (09:00 PST). Issue reproduced.")
    else:
        print(f"FAILURE: Unexpected hour {dt_utc.hour}")

if __name__ == "__main__":
    run_test()
