import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worksync.settings")
django.setup()

from apps.employees.models import Employee

print("Existing Employees:")
for e in Employee.objects.all():
    print(f"ID: {e.employee_id}, Name: {e.full_name}, Status: {e.employment_status}")
