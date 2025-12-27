import requests
import json

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

    # 2. Get Templates
    print("Fetching report templates...")
    resp = session.get(f"{BASE_URL}/reports/templates/", headers=headers)
    
    if resp.status_code != 200:
        print(f"Failed to fetch templates: {resp.status_code}")
        print(resp.text)
        return
        
    data = resp.json()
    results = data.get('results', [])
    
    print(f"Found {len(results)} templates:")
    
    expected_types = [
        'LATE_ARRIVAL',
        'OVERTIME',
        'DEPARTMENT_SUMMARY',
        'ATTENDANCE_SUMMARY',
        'DETAILED_TIMESHEET',
        'BREAK_COMPLIANCE'
    ]
    
    found_types = []
    
    for t in results:
        print(f"- {t['name']} ({t['report_type']})")
        found_types.append(t['report_type'])
        
    # Check if all expected types are present
    missing = [t for t in expected_types if t not in found_types]
    
    if missing:
        print(f"\nFAILURE: Missing templates for types: {missing}")
    else:
        print("\nSUCCESS: All expected templates found.")

if __name__ == "__main__":
    run_test()
