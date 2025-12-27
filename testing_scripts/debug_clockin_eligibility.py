import os
import django
import sys
from django.utils import timezone

# Setup Django environment
sys.path.append('/Users/mac/code_projects/WorkSync/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.employees.models import Employee
from apps.scheduling.models import Shift

def check_jude_status():
    print(f"Server Time (UTC): {timezone.now()}")
    
    try:
        # Find Jude Oba
        # Try by name parts since we don't know exact username
        employees = Employee.objects.filter(user__first_name__icontains='Jude')
        if not employees.exists():
            print("Employee 'Jude' not found.")
            return

        for employee in employees:
            print(f"\nChecking Employee: {employee.user.get_full_name()} ({employee.employee_id})")
            print(f"Timezone: {employee.timezone}")
            
            # Get shifts for today/tomorrow
            now = timezone.now()
            start_range = now - timezone.timedelta(hours=12)
            end_range = now + timezone.timedelta(hours=24)
            
            shifts = Shift.objects.filter(
                employee=employee,
                start_time__gte=start_range,
                start_time__lte=end_range
            ).order_by('start_time')
            
            if not shifts.exists():
                print("No shifts found in the next 24 hours.")
                continue
                
            for shift in shifts:
                print(f"\n  Shift ID: {shift.id}")
                print(f"  Start (UTC): {shift.start_time}")
                print(f"  End (UTC):   {shift.end_time}")
                print(f"  Is Published: {shift.is_published}")
                
                # Check eligibility methods
                is_current = shift.is_current
                allows_clock_in = shift.allows_clock_in
                
                print(f"  Is Current: {is_current}")
                print(f"  Allows Clock In: {allows_clock_in}")
                
                # Manual check
                window_start = shift.start_time - timezone.timedelta(minutes=15)
                print(f"  Clock-in Window Start (UTC): {window_start}")
                
                if now < window_start:
                    print(f"  Result: Too early (starts in {(window_start - now).total_seconds()/60:.1f} mins)")
                elif now > shift.end_time:
                    print("  Result: Too late (shift ended)")
                else:
                    print("  Result: SHOULD BE ELIGIBLE")

            # Check get_clockin_eligible_shift
            eligible = Shift.get_clockin_eligible_shift(employee)
            print(f"\n  Shift.get_clockin_eligible_shift() returns: {eligible}")

            # Check active logs
            from apps.attendance.models import TimeLog
            active_log = TimeLog.objects.filter(employee=employee, status='CLOCKED_IN').first()
            print(f"  Active TimeLog: {active_log}")

            # Simulate shift_status response
            data = {
                'can_clock_in': bool(eligible and not active_log),
                'can_clock_out': bool(active_log),
                'is_clocked_in': bool(active_log),
                'current_time': timezone.now().isoformat(),
            }
            print(f"  Simulated API Response: {data}")

            # Simulate API call as Jude using requests
            import requests
            from rest_framework_simplejwt.tokens import RefreshToken
            
            print("\n  Simulating API Call as Jude (via requests)...")
            user = employee.user
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            
            headers = {'Authorization': f'Bearer {access_token}'}
            resp = requests.get('http://localhost:8000/api/v1/attendance/time-logs/shift_status/', headers=headers)
            
            print(f"  API Response Status: {resp.status_code}")
            try:
                print(f"  API Response Data: {resp.json()}")
            except:
                print(f"  API Response Content: {resp.text[:500]}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_jude_status()
