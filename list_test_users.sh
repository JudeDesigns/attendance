#!/bin/bash
# Simple script to list test users from WorkSync database

echo "Listing WorkSync test users..."
echo ""

cd backend && python3 manage.py shell <<'EOF'
from django.contrib.auth.models import User
from apps.employees.models import Employee

print("=" * 80)
print("WORKSYNC TEST USERS")
print("=" * 80)
print()

users = User.objects.all().order_by('is_staff', 'username')

if not users.exists():
    print("❌ No users found in database!")
    print("   Run: python3 create_test_users.py")
else:
    print(f"Found {users.count()} total users\n")
    
    # Admin users
    admin_users = users.filter(is_staff=True)
    if admin_users.exists():
        print("🔑 ADMIN USERS")
        print("-" * 80)
        for user in admin_users:
            try:
                employee = Employee.objects.get(user=user)
                emp_id = employee.employee_id
                role = employee.role.name if employee.role else 'N/A'
            except Employee.DoesNotExist:
                emp_id = 'No profile'
                role = 'N/A'
            
            print(f"  Username: {user.username}")
            print(f"  Name: {user.get_full_name() or 'Not set'}")
            print(f"  Email: {user.email or 'Not set'}")
            print(f"  Employee ID: {emp_id}")
            print(f"  Role: {role}")
            print()
    
    # Regular users
    regular_users = users.filter(is_staff=False)
    if regular_users.exists():
        print("👤 EMPLOYEE/DRIVER USERS")
        print("-" * 80)
        for user in regular_users:
            try:
                employee = Employee.objects.get(user=user)
                emp_id = employee.employee_id
                role = employee.role.name if employee.role else 'N/A'
                status = employee.employment_status
            except Employee.DoesNotExist:
                emp_id = 'No profile'
                role = 'N/A'
                status = 'N/A'
            
            print(f"  Username: {user.username}")
            print(f"  Name: {user.get_full_name() or 'Not set'}")
            print(f"  Email: {user.email or 'Not set'}")
            print(f"  Employee ID: {emp_id}")
            print(f"  Role: {role}")
            print(f"  Status: {status}")
            print()

print("=" * 80)
print("NOTES")
print("=" * 80)
print()
print("1. To reset a user's password:")
print("   cd backend && python3 manage.py changepassword <username>")
print()
print("2. To create test users:")
print("   python3 create_test_users.py")
print()
print("3. Recommended test password: password123")
print()
print("=" * 80)

EOF

