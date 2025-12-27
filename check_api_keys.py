import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worksync.settings")
django.setup()

from django.conf import settings

print(f"API_KEYS setting: {settings.API_KEYS}")
