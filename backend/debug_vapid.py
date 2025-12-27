import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from pywebpush import webpush

key = settings.VAPID_PRIVATE_KEY
print(f"Key raw: {repr(key)}")

# Dummy subscription
sub_info = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/foo",
    "keys": {
        "p256dh": "BNc...",
        "auth": "Auth..."
    }
}

print("\n--- Testing webpush with RAW key ---")
try:
    webpush(
        subscription_info=sub_info,
        data="test",
        vapid_private_key=key,
        vapid_claims={"sub": "mailto:admin@example.com"}
    )
except Exception as e:
    print(f"Caught error with RAW key: {e}")

print("\n--- Testing webpush with STRIPPED key ---")
try:
    webpush(
        subscription_info=sub_info,
        data="test",
        vapid_private_key=key.strip(),
        vapid_claims={"sub": "mailto:admin@example.com"}
    )
except Exception as e:
    print(f"Caught error with STRIPPED key: {e}")
