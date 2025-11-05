"""
WSGI config for WorkSync project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')

application = get_wsgi_application()
