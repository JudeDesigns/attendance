import requests
import json
import sys
import time

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

    # 2. Check current status
    print("Checking current status...")
    resp = session.get(f"{BASE_URL}/attendance/time-logs/current_status/", headers=headers)
    status_data = resp.json()
    print(f"Current status: {status_data}")

    # If already clocked in, clock out first to start fresh
    if status_data.get('is_clocked_in'):
        print("Already clocked in. Clocking out...")
        resp = session.post(f"{BASE_URL}/attendance/time-logs/clock_out/", headers=headers)
        if resp.status_code != 200:
            print(f"Clock out failed: {resp.text}")
            return
        print("Clocked out.")

    # 3. Clock In
    print("Clocking in...")
    resp = session.post(f"{BASE_URL}/attendance/time-logs/clock_in/", headers=headers, json={'method': 'PORTAL'})
    if resp.status_code != 201:
        print(f"Clock in failed: {resp.text}")
        return
    print("Clocked in.")

    # 4. Check Break Requirements
    print("Checking break requirements...")
    resp = session.get(f"{BASE_URL}/attendance/breaks/break_requirements/", headers=headers)
    print(f"Break requirements: {resp.json()}")

    # 5. Start Break
    print("Starting break (SHORT)...")
    resp = session.post(f"{BASE_URL}/attendance/breaks/start_break/", headers=headers, json={'break_type': 'SHORT'})
    if resp.status_code != 201:
        print(f"Start break failed: {resp.text}")
        return
    break_data = resp.json()
    break_id = break_data['id']
    print(f"Break started. ID: {break_id}")

    # 6. Check Active Break
    print("Checking active break...")
    resp = session.get(f"{BASE_URL}/attendance/breaks/active_break/", headers=headers)
    active_break = resp.json()
    print(f"Active break: {active_break}")
    if not active_break.get('has_active_break'):
        print("ERROR: No active break found!")
        return

    # 7. End Break
    print("Ending break...")
    resp = session.patch(f"{BASE_URL}/attendance/breaks/{break_id}/end_break/", headers=headers, json={'notes': 'Test break'})
    if resp.status_code != 200:
        print(f"End break failed: {resp.text}")
        return
    print("Break ended.")

    # 8. Clock Out
    print("Clocking out...")
    resp = session.post(f"{BASE_URL}/attendance/time-logs/clock_out/", headers=headers)
    if resp.status_code != 200:
        print(f"Clock out failed: {resp.text}")
        return
    print("Clocked out.")
    
    print("\nSUCCESS: Break system flow verified.")

if __name__ == "__main__":
    run_test()
