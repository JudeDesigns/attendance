import requests
import json

session = requests.Session()
# Let's login as admin user (user: admin, password: password) - earlier scripts used this
res = session.post('http://localhost:8000/api/v1/auth/login/', json={'username': 'admin', 'password': 'password'})
print("Login status:", res.status_code)
if res.status_code == 200:
    token = res.json().get('access')
    headers = {'Authorization': f'Bearer {token}'}
    # Let's try to clock in
    clock_in_data = {
        "method": "PORTAL",
        "notes": "Clock-in via portal"
    }
    r = session.post('http://localhost:8000/api/v1/attendance/time-logs/clock_in/', headers=headers, json=clock_in_data)
    print("Clock in status:", r.status_code)
    print("Clock in response:", r.text)
