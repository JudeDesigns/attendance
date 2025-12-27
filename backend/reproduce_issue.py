import os
import django
from django.utils import timezone
import sys
import json

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.conf import settings

def check_settings():
    print(f"DEBUG: {settings.DEBUG}")
    print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
    try:
        print(f"CORS_ALLOW_ALL_ORIGINS: {getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', 'Not Set')}")
    except:
        print("CORS_ALLOW_ALL_ORIGINS: Error accessing")
        
    try:
        print(f"CORS_ALLOWED_ORIGINS: {getattr(settings, 'CORS_ALLOWED_ORIGINS', 'Not Set')}")
    except:
        print("CORS_ALLOWED_ORIGINS: Error accessing")

if __name__ == "__main__":
    check_settings()
