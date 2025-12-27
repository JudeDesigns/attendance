import os
import sys
import django

# Setup Django
sys.path.append('/Users/mac/code_projects/WorkSync/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from apps.employees.views import EmployeeViewSet
from apps.employees.models import Employee
from django.contrib.auth.models import User

def debug_status_api():
    print("Debugging Employee Status API...")
    
    # Find user 'Jude' or fallback to first active employee
    user_jude = User.objects.filter(first_name__icontains='Jude').first()
    if user_jude:
        try:
            employee = user_jude.employee_profile
            user = user_jude
            print(f"Found User: {user.username} (Employee ID: {employee.employee_id})")
        except:
            print("User Jude found but has no employee profile.")
            return
    else:
        employee = Employee.objects.filter(employment_status='ACTIVE').first()
        user = employee.user
        print(f"User Jude not found. Testing with: {user.username} (Employee ID: {employee.employee_id})")

    # Inspect TimeLogs
    from apps.attendance.models import TimeLog
    print("\nInspecting TimeLogs:")
    logs = TimeLog.objects.filter(employee=employee).order_by('-created_at')[:3]
    for log in logs:
        print(f"ID: {log.id}, Status: {log.status}, In: {log.clock_in_time}, Out: {log.clock_out_time}")

    # Create a request factory
    factory = RequestFactory()
    
    # Instantiate views
    employee_view = EmployeeViewSet.as_view({'get': 'status'})
    employee_view = EmployeeViewSet.as_view({'get': 'status'})
    from apps.attendance.views import TimeLogViewSet, BreakViewSet
    attendance_view = TimeLogViewSet.as_view({'get': 'current_status'})

    # Test with UUID (Should work)
    print(f"\nTesting with UUID: {employee.id}")
    request = factory.get(f'/api/v1/employees/{employee.id}/status/')
    force_authenticate(request, user=user)
    try:
        response = employee_view(request, pk=employee.id)
        print(f"UUID Response Status: {response.status_code}")
        print(f"UUID Response Data: {response.data}")
    except Exception as e:
        print(f"UUID Error: {e}")

    # Test with Employee ID String (Should fail if backend expects UUID)
    print(f"\nTesting with String ID: {employee.employee_id}")
    request = factory.get(f'/api/v1/employees/{employee.employee_id}/status/')
    force_authenticate(request, user=user)
    try:
        response = employee_view(request, pk=employee.employee_id)
        print(f"String ID Response Status: {response.status_code}")
    except Exception as e:
        print(f"String ID Error: {e}")
        
    # Inspect TimeLogViewSet attributes
    print("\n--- START INSPECTION ---")
    print("Inspecting TimeLogViewSet attributes:")
    if hasattr(TimeLogViewSet, 'break_requirements'):
        print("break_requirements method FOUND in TimeLogViewSet")
    else:
        print("break_requirements method NOT FOUND in TimeLogViewSet")
        # Print all attributes to see what's there
        print(dir(TimeLogViewSet))
    print("--- END INSPECTION ---\n")

    # Test Current Status Endpoint (used by BreakButton)
    print(f"\nTesting Current Status Endpoint")
    request = factory.get('/api/v1/attendance/time-logs/current_status/')
    force_authenticate(request, user=user)
    try:
        response = attendance_view(request)
        print(f"Current Status Response Status: {response.status_code}")
        print(f"Current Status Response Data: {response.data}")
    except Exception as e:
        print(f"Current Status Error: {e}")

    # Test Shift Status Endpoint
    print(f"\nTesting Shift Status Endpoint")
    shift_view = TimeLogViewSet.as_view({'get': 'shift_status'})
    request = factory.get('/api/v1/attendance/time-logs/shift_status/')
    force_authenticate(request, user=user)
    try:
        response = shift_view(request)
        print(f"Shift Status Response Status: {response.status_code}")
        print(f"Shift Status Response Data: {response.data}")
    except Exception as e:
        print(f"Shift Status Error: {e}")

    # Test Break Requirements Endpoint
    print(f"\nTesting Break Requirements Endpoint")
    break_view = BreakViewSet.as_view({'get': 'break_requirements'})
    request = factory.get('/api/v1/attendance/breaks/break_requirements/')
    force_authenticate(request, user=user)
    try:
        response = break_view(request)
        print(f"Break Requirements Response Status: {response.status_code}")
        print(f"Break Requirements Response Data: {response.data}")
    except Exception as e:
        print(f"Break Requirements Error: {e}")

if __name__ == "__main__":
    debug_status_api()
