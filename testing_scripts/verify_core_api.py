import requests
import json
import sys

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

    # 2. Get Timezones
    print("Fetching timezones...")
    resp = session.get(f"{BASE_URL}/core/timezones/", headers=headers)
    if resp.status_code != 200:
        print(f"Get timezones failed: {resp.status_code} - {resp.text}")
    else:
        data = resp.json()
        print(f"Timezones fetched. Count: {len(data.get('timezones', []))}")
        print(f"Current timezone: {data.get('current_user_timezone')}")

    # 3. Get Time Info
    print("Fetching time info...")
    resp = session.get(f"{BASE_URL}/core/time-info/", headers=headers)
    if resp.status_code != 200:
        print(f"Get time info failed: {resp.status_code} - {resp.text}")
    else:
        print(f"Time info: {resp.json()}")

    # 4. Update Timezone
    print("Updating timezone to UTC...")
    resp = session.post(f"{BASE_URL}/core/timezones/update/", headers=headers, json={'timezone': 'UTC'})
    if resp.status_code != 200:
        print(f"Update timezone failed: {resp.status_code} - {resp.text}")
    else:
        print("Timezone updated successfully.")

if __name__ == "__main__":
    run_test()
