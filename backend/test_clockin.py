import requests

# Assuming authentication is required, we can just print the error without auth to see if it's 401
# Wait, let's login first
response = requests.post('http://localhost:8000/api/v1/auth/login/', json={'username': 'jude', 'password': 'password'}) # guess Jude's password? Probably shouldn't.

# actually a better way is to just grep the django logs or modify the backend to print the error.
