import os
import django
from django.utils import timezone
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.attendance.models import TimeLog, Break
from apps.attendance.break_compliance import BreakComplianceManager

def debug_break_issue():
    print(f"Current Time (timezone.now()): {timezone.now()}")
    
    # Get all active time logs
    active_logs = TimeLog.objects.filter(status='CLOCKED_IN')
    
    print(f"Found {active_logs.count()} active time logs.")
    
    compliance_manager = BreakComplianceManager()
    
    for log in active_logs:
        print("-" * 50)
        print(f"Employee: {log.employee.user.email} (ID: {log.employee.employee_id})")
        print(f"Clock In Time: {log.clock_in_time}")
        
        # Calculate duration manually
        now = timezone.now()
        duration = now - log.clock_in_time
        hours = duration.total_seconds() / 3600
        print(f"Calculated Duration: {duration}")
        print(f"Calculated Hours: {hours:.2f}")
        
        # Check compliance
        requirements = compliance_manager.check_break_requirements(log.employee, log)
        print(f"Compliance Requirements: {requirements}")
        
        # Check existing breaks
        breaks = Break.objects.filter(time_log=log)
        print(f"Existing Breaks: {breaks.count()}")
        for b in breaks:
            print(f"  - {b.break_type}: {b.start_time} to {b.end_time}")

if __name__ == "__main__":
    debug_break_issue()
