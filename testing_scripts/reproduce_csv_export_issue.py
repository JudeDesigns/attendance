import requests
import csv
import io
from datetime import datetime

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

    # 2. Get an employee (use self)
    resp = session.get(f"{BASE_URL}/employees/me/", headers=headers)
    employee_id = resp.json()['id']
    print(f"Employee ID: {employee_id}")

    # 2.5 Create a fresh time log
    print("Creating fresh time log...")
    # Clock in
    resp = session.post(f"{BASE_URL}/attendance/time-logs/clock_in/", headers=headers, json={
        'method': 'PORTAL',
        'notes': 'CSV Export Test'
    })
    if resp.status_code == 201:
        print("Clocked in.")
    else:
        print(f"Clock in failed (might be already clocked in): {resp.status_code}")

    # Clock out immediately
    resp = session.post(f"{BASE_URL}/attendance/time-logs/clock_out/", headers=headers, json={
        'method': 'PORTAL',
        'notes': 'CSV Export Test End'
    })
    if resp.status_code == 200:
        print("Clocked out.")
    else:
        print(f"Clock out failed: {resp.status_code}")

    # 3. Export CSV
    print("Exporting CSV...")
    resp = session.get(f"{BASE_URL}/attendance/time-logs/export/?employee_id={employee_id}", headers=headers)
    
    if resp.status_code != 200:
        print(f"Export failed: {resp.status_code}")
        print(resp.text[:500])
        return

    # 4. Parse CSV
    content = resp.content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    
    rows = list(reader)
    if not rows:
        print("No logs found in CSV.")
        return

    # Check the most recent log
    latest_log = rows[0]
    print("\nLatest Log Entry:")
    print(f"Date: {latest_log['Date']}")
    print(f"Clock In Time: {latest_log['Clock In Time']}")
    print(f"Clock Out Time: {latest_log['Clock Out Time']}")
    
    # We know from previous context that Jude clocked in around 16:00 UTC (17:00 WAT)
    # If the CSV shows 16:xx, it's UTC. If it shows 17:xx, it's WAT.
    
    clock_in_time = latest_log['Clock In Time']
    hour = int(clock_in_time.split(':')[0])
    
    print(f"\nExported Hour: {hour}")
    
    # Assuming the test run created a shift/log around 16:00 UTC
    if hour == 16:
        print("FAILURE: Exported time is likely UTC (16:xx). Expected local time (17:xx).")
    elif hour == 17:
        print("SUCCESS: Exported time is likely Local Time (17:xx).")
    else:
        print(f"UNCERTAIN: Hour {hour} doesn't match expected test window (16 or 17). Check recent activity.")

if __name__ == "__main__":
    run_test()
