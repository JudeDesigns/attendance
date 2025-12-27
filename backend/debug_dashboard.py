import os
import django
from django.utils import timezone
from datetime import datetime
import sys

# Setup Django
sys.path.append('/Users/mac/code_projects/WorkSync/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.employees.models import Employee
from apps.attendance.models import TimeLog

def debug_dashboard():
    print(f"Current Time (UTC): {timezone.now()}")
    print(f"Current Time (Local): {timezone.localtime(timezone.now())}")
    
    # Check Employees
    total_employees = Employee.objects.count()
    active_employees = Employee.objects.filter(employment_status='ACTIVE').count()
    print(f"\nTotal Employees: {total_employees}")
    print(f"Active Employees: {active_employees}")
    
    # Check Attendance for "Today" (UTC date vs Local date)
    utc_today = timezone.now().date()
    local_today = timezone.localtime(timezone.now()).date()
    
    print(f"\nUTC Today: {utc_today}")
    print(f"Local Today: {local_today}")
    
    # Query using UTC date (Current Implementation)
    logs_utc_date = TimeLog.objects.filter(clock_in_time__date=utc_today).count()
    print(f"Logs found using UTC date ({utc_today}): {logs_utc_date}")
    
    # Query using Local date (Correct Implementation?)
    logs_local_date = TimeLog.objects.filter(clock_in_time__date=local_today).count()
    print(f"Logs found using Local date ({local_today}): {logs_local_date}")
    
    # List actual logs to see their times
    print("\nRecent Logs (Last 5):")
    for log in TimeLog.objects.order_by('-created_at')[:5]:
        print(f"ID: {log.id}, Clock In (UTC): {log.clock_in_time}, Clock In (Local): {timezone.localtime(log.clock_in_time)}")

if __name__ == "__main__":
    debug_dashboard()
