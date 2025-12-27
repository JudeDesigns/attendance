
import os
import django
from datetime import datetime, timedelta
from django.utils import timezone
from apps.employees.models import Employee
from apps.attendance.models import TimeLog, Break

# Setup
employee = Employee.objects.get(id='144641d8-6ecd-46ef-91ae-24a97fca7851')
today = timezone.now().date()

# Create TimeLog (09:00 - 18:00 UTC for simplicity, assuming user is UTC for this test or we handle conversion)
# Let's use a fixed date to avoid issues.
base_time = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
end_time = base_time + timedelta(hours=9) # 18:00

log = TimeLog.objects.create(
    employee=employee,
    clock_in_time=base_time,
    clock_out_time=end_time,
    status='CLOCKED_OUT',
    clock_in_method='API',
    clock_out_method='API'
)

# Break 1: Short (10:00 - 10:15)
Break.objects.create(
    time_log=log,
    break_type='SHORT',
    start_time=base_time + timedelta(hours=1),
    end_time=base_time + timedelta(hours=1, minutes=15)
)

# Break 2: Lunch (13:00 - 13:30)
Break.objects.create(
    time_log=log,
    break_type='LUNCH',
    start_time=base_time + timedelta(hours=4),
    end_time=base_time + timedelta(hours=4, minutes=30)
)

print(f"Created log: {log.id}")
print(f"Log In: {log.clock_in_time}")
print(f"Log Out: {log.clock_out_time}")
