import requests
import os

BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "admin"
PASSWORD = "admin123"
EMPLOYEE_ID = "JUDEOBA"

def test_status():
    # 1. Login to get token
    print(f"Logging in as {USERNAME}...")
    auth_resp = requests.post(f"{BASE_URL}/auth/login/", json={
        "username": USERNAME,
        "password": PASSWORD
    })
    
    if auth_resp.status_code != 200:
        print(f"Login failed: {auth_resp.status_code} {auth_resp.text}")
        return

    token = auth_resp.json()['access']
    print("Login successful. Token obtained.")
    
    # 2. Get Employee Status using Token
    print(f"Fetching status for {EMPLOYEE_ID}...")
    headers = {"Authorization": f"Bearer {token}"}
    status_resp = requests.get(f"{BASE_URL}/employees/{EMPLOYEE_ID}/status/", headers=headers)
    
    print(f"Status Code: {status_resp.status_code}")
    print(f"Response: {status_resp.text}")

if __name__ == "__main__":
    test_status()
