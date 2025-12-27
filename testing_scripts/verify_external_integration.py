import requests
import json
import datetime
import time

BASE_URL = "http://localhost:8000/api/v1"
API_KEY = "your-br-driver-app-api-key"  # Actual key from settings
EMPLOYEE_ID = "JUDEOBA"  # Jude Oba

def get_timestamp():
    # Use UTC and subtract 5 seconds to avoid "future" errors due to clock skew
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=5)).isoformat()

def run_test():
    headers = {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
    }
    
    print(f"Testing External API Integration for Employee: {EMPLOYEE_ID}")
    print(f"Using API Key: {API_KEY}")
    
    # 1. Check Status
    print("\n1. Checking Status...")
    resp = requests.get(f"{BASE_URL}/employees/{EMPLOYEE_ID}/status/", headers=headers)
    if resp.status_code == 200:
        print(f"Status: {resp.json()['data']['current_status']}")
        # If already clocked in, clock out first to reset
        if resp.json()['data']['current_status'] == 'CLOCKED_IN':
            print("Employee is clocked in. Clocking out to reset...")
            reset_resp = requests.post(
                f"{BASE_URL}/attendance/clock-out/",
                headers=headers,
                json={'employee_id': EMPLOYEE_ID, 'timestamp': get_timestamp()}
            )
            print(f"Reset response: {reset_resp.status_code} - {reset_resp.text}")
            time.sleep(1)
    else:
        print(f"Failed to get status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}...")
        return

    # 2. Clock In
    print("\n2. Clocking In...")
    payload = {
        'employee_id': EMPLOYEE_ID,
        'timestamp': get_timestamp(),
        'latitude': 34.0522,
        'longitude': -118.2437,
        'notes': 'Clock in from Driver App'
    }
    resp = requests.post(f"{BASE_URL}/attendance/clock-in/", headers=headers, json=payload)
    if resp.status_code == 200:
        print("Clock In Successful")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"Clock In Failed: {resp.status_code} - {resp.text}")
        return

    time.sleep(1)

    # 3. Start Break
    print("\n3. Starting Break...")
    payload = {
        'employee_id': EMPLOYEE_ID,
        'timestamp': get_timestamp(),
        'break_type': 'SHORT',
        'notes': 'Taking a quick break'
    }
    resp = requests.post(f"{BASE_URL}/attendance/start-break/", headers=headers, json=payload)
    if resp.status_code == 200:
        print("Start Break Successful")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"Start Break Failed: {resp.status_code} - {resp.text}")
        # Don't return, try to cleanup
        
    time.sleep(1)

    # 4. End Break
    print("\n4. Ending Break...")
    payload = {
        'employee_id': EMPLOYEE_ID,
        'timestamp': get_timestamp(),
        'notes': 'Break over'
    }
    resp = requests.post(f"{BASE_URL}/attendance/end-break/", headers=headers, json=payload)
    if resp.status_code == 200:
        print("End Break Successful")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"End Break Failed: {resp.status_code} - {resp.text}")

    time.sleep(1)

    # 5. Clock Out
    print("\n5. Clocking Out...")
    payload = {
        'employee_id': EMPLOYEE_ID,
        'timestamp': get_timestamp(),
        'latitude': 34.0522,
        'longitude': -118.2437,
        'notes': 'Clock out from Driver App'
    }
    resp = requests.post(f"{BASE_URL}/attendance/clock-out/", headers=headers, json=payload)
    if resp.status_code == 200:
        print("Clock Out Successful")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"Clock Out Failed: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    run_test()
