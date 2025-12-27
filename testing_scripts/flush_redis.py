import os
import sys
import redis
from django.conf import settings

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
import django
django.setup()

def flush_redis():
    try:
        # Get redis connection from settings or default
        redis_url = 'redis://localhost:6379/1' # Default for WorkSync based on typical setup
        # Or check settings.CACHES
        if hasattr(settings, 'CACHES') and 'default' in settings.CACHES:
            location = settings.CACHES['default'].get('LOCATION')
            if location:
                redis_url = location
        
        print(f"Connecting to Redis at {redis_url}")
        r = redis.from_url(redis_url)
        r.flushall()
        print("Redis flushed successfully.")
    except Exception as e:
        print(f"Error flushing Redis: {e}")

if __name__ == '__main__':
    flush_redis()
