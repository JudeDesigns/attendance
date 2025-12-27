import os
import sys
import django

sys.path.append('/Users/mac/code_projects/WorkSync/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.attendance.views import TimeLogViewSet, BreakViewSet

print("Inspecting TimeLogViewSet:")
if hasattr(TimeLogViewSet, 'break_requirements'):
    print("break_requirements FOUND in TimeLogViewSet")
else:
    print("break_requirements NOT FOUND in TimeLogViewSet")

print("\nInspecting BreakViewSet:")
if hasattr(BreakViewSet, 'break_requirements'):
    print("break_requirements FOUND in BreakViewSet")
else:
    print("break_requirements NOT FOUND in BreakViewSet")
    print("Attributes of BreakViewSet starting with 'break':")
    for attr in dir(BreakViewSet):
        if 'break' in attr:
            print(attr)
