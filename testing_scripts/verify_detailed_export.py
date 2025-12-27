import requests
import csv
import io
from datetime import datetime, timedelta
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

    # 2. Get employee (self)
    resp = session.get(f"{BASE_URL}/employees/me/", headers=headers)
    employee_id = resp.json()['id']
    print(f"Employee ID: {employee_id}")

    # 3. Create a Time Log with Breaks
    # Scenario: 9 hours total work (09:00 - 18:00)
    # Break 1: Short (10:00 - 10:15) - 15 mins (Not Deducted)
    # Break 2: Lunch (13:00 - 13:30) - 30 mins (Deducted)
    
    # We need to use the API to create these. 
    # Since we can't easily backdate via API (it defaults to now), we might need to rely on what we can control.
    # Actually, the API allows admin to create/edit logs? Or we can just use the clock-in/out endpoints and wait?
    # Waiting is too slow.
    # Let's use the 'bulk_create' or similar if available, or just manually create via shell if needed.
    # But we want to test the API export.
    
    # Alternative: Use the 'clock_in' and 'clock_out' but we can't easily set past times via those endpoints usually.
    # However, for this test, we can just check the *structure* and *logic* with a "current" log if we can simulate breaks.
    
    # Let's try to create a log via the shell for precision, then export via API.
    # This is a hybrid approach but safer for verification of the EXPORT logic.
    
    print("Creating test data via Django Shell...")
    # We'll use a subprocess to run a django shell script to create the data
    import subprocess
    
    setup_script = """
import os
import django
from datetime import datetime, timedelta
from django.utils import timezone
from apps.employees.models import Employee
from apps.attendance.models import TimeLog, Break

# Setup
employee = Employee.objects.get(id='{employee_id}')
today = timezone.now().date()

# Create TimeLog (09:00 - 18:00 UTC for simplicity, assuming user is UTC for this test or we handle conversion)
# Let's use a fixed date to avoid issues.
base_time = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
end_time = base_time + timedelta(hours=9) # 18:00

log = TimeLog.objects.create(
    employee=employee,
    clock_in_time=base_time,
    clock_out_time=end_time,
    status='CLOCKED_OUT',
    clock_in_method='API',
    clock_out_method='API'
)

# Break 1: Short (10:00 - 10:15)
Break.objects.create(
    time_log=log,
    break_type='SHORT',
    start_time=base_time + timedelta(hours=1),
    end_time=base_time + timedelta(hours=1, minutes=15)
)

# Break 2: Lunch (13:00 - 13:30)
Break.objects.create(
    time_log=log,
    break_type='LUNCH',
    start_time=base_time + timedelta(hours=4),
    end_time=base_time + timedelta(hours=4, minutes=30)
)

print(f"Created log: {log.id}")
print(f"Log In: {log.clock_in_time}")
print(f"Log Out: {log.clock_out_time}")
"""
    
    setup_script = setup_script.replace('{employee_id}', employee_id)
    
    # Write setup script to temp file
    with open('temp_setup.py', 'w') as f:
        f.write(setup_script)
        
    # Run it
    cmd = "source backend/venv/bin/activate && python backend/manage.py shell < temp_setup.py"
    subprocess.run(cmd, shell=True, executable='/bin/zsh')
    
    # 4. Export CSV
    print("Exporting CSV...")
    # We filter by today to get our specific log
    today_str = datetime.now().strftime('%Y-%m-%d')
    resp = session.get(f"{BASE_URL}/attendance/time-logs/export/?employee_id={employee_id}&start_date={today_str}&end_date={today_str}", headers=headers)
    
    if resp.status_code != 200:
        print(f"Export failed: {resp.status_code}")
        print(resp.text[:500])
        return

    # 5. Parse and Verify
    content = resp.content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    
    if not rows:
        print("No rows found in CSV.")
        return
        
    # Find our specific row (Start Time 10:00)
    # Note: The debug log showed 10:00 as the converted start time.
    target_start = "10:00"
    row = None
    for r in rows:
        if r['Start Time'] == target_start:
            row = r
            break
            
    if not row:
        print(f"Could not find row with Start Time {target_start}")
        print("Available rows:")
        for r in rows:
            print(f"- {r['Start Time']} ({r['Total Hours']})")
        return
    
    print(f"\nFound row for Start Time {target_start}")
    
    print("\n--- Verification Results ---")
    print(f"Total Hours (Gross): {row['Total Hours']}")
    print(f"Break 1 Type: Short (Implicit)")
    print(f"Break 1 Total: {row['Break 1 Total']}")
    print(f"Break 2 Type: Lunch (Implicit)")
    print(f"Break 2 Total: {row['Break 2 Total']}")
    print(f"Total Without Break (Net): {row['Total Without Break']}")
    print(f"Finally Hours: {row['Finally Hours']}")
    print(f"Over 8: {row['Over 8']}")
    
    # Expected Values:
    # Gross: 9h 0m (9.00)
    # Break 1: 0h 15m (Not deducted)
    # Break 2: 0h 30m (Deducted)
    # Net: 9h 0m - 30m = 8h 30m (8.50)
    # Over 8: 0.50
    
    failures = []
    
    if row['Total Hours'] != "9h 0m":
        failures.append(f"Gross Hours mismatch: Expected '9h 0m', got '{row['Total Hours']}'")
        
    if row['Break 1 Total'] != "0h 15m":
        failures.append(f"Break 1 mismatch: Expected '0h 15m', got '{row['Break 1 Total']}'")
        
    if row['Break 2 Total'] != "0h 30m":
        failures.append(f"Break 2 mismatch: Expected '0h 30m', got '{row['Break 2 Total']}'")
        
    if row['Total Without Break'] != "8h 30m":
        failures.append(f"Net Hours mismatch: Expected '8h 30m', got '{row['Total Without Break']}'")
        
    if row['Finally Hours'] != "8.50":
        failures.append(f"Finally Hours mismatch: Expected '8.50', got '{row['Finally Hours']}'")
        
    if row['Over 8'] != "0.50":
        failures.append(f"Over 8 mismatch: Expected '0.50', got '{row['Over 8']}'")
        
    if not failures:
        print("\nSUCCESS: All checks passed!")
    else:
        print("\nFAILURES:")
        for f in failures:
            print(f"- {f}")

if __name__ == "__main__":
    run_test()
