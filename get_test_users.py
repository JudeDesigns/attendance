#!/usr/bin/env python3
"""
Script to extract test user credentials from WorkSync database
Run this to get a list of users you can share with testers

Usage:
    cd /Users/mac/code_projects/WorkSync
    python3 backend/manage.py shell < get_test_users.py

Or run directly:
    cd backend && python3 manage.py shell
    Then paste the code from this file
"""

# This script is meant to be run via Django shell
# Run: python3 backend/manage.py shell < get_test_users.py

from django.contrib.auth.models import User
from apps.employees.models import Employee

def get_test_users():
    """Get all users suitable for testing"""
    
    print("=" * 80)
    print("WORKSYNC TEST USERS")
    print("=" * 80)
    print()
    
    # Get all users
    users = User.objects.all().order_by('is_staff', 'username')
    
    if not users.exists():
        print("❌ No users found in database!")
        print("   You may need to create test users first.")
        return
    
    print(f"Found {users.count()} total users in database\n")
    
    # Admin users
    admin_users = users.filter(is_staff=True)
    if admin_users.exists():
        print("🔑 ADMIN USERS (Full Access)")
        print("-" * 80)
        for user in admin_users:
            employee = None
            try:
                employee = Employee.objects.get(user=user)
            except Employee.DoesNotExist:
                pass
            
            print(f"  Username: {user.username}")
            print(f"  Email: {user.email or 'Not set'}")
            print(f"  Name: {user.get_full_name() or 'Not set'}")
            print(f"  Employee Profile: {'Yes' if employee else 'No'}")
            if employee:
                print(f"  Employee ID: {employee.employee_id}")
                print(f"  Role: {employee.role.name if employee.role else 'Not set'}")
            print(f"  Password: ⚠️  RESET OR SET A TEST PASSWORD")
            print()
    
    # Regular users
    regular_users = users.filter(is_staff=False)
    if regular_users.exists():
        print("👤 EMPLOYEE/DRIVER USERS")
        print("-" * 80)
        for user in regular_users:
            employee = None
            try:
                employee = Employee.objects.get(user=user)
            except Employee.DoesNotExist:
                pass
            
            print(f"  Username: {user.username}")
            print(f"  Email: {user.email or 'Not set'}")
            print(f"  Name: {user.get_full_name() or 'Not set'}")
            print(f"  Employee Profile: {'Yes' if employee else 'No'}")
            if employee:
                print(f"  Employee ID: {employee.employee_id}")
                print(f"  Role: {employee.role.name if employee.role else 'Not set'}")
                print(f"  Status: {employee.employment_status}")
            print(f"  Password: ⚠️  RESET OR SET A TEST PASSWORD")
            print()
    
    print("=" * 80)
    print("RECOMMENDATIONS FOR TESTING")
    print("=" * 80)
    print()
    print("1. Create test passwords for these users:")
    print("   python backend/manage.py changepassword <username>")
    print()
    print("2. Recommended test accounts to create (if not exist):")
    print("   - admin (admin user)")
    print("   - test_driver (driver role)")
    print("   - employee1 (regular employee)")
    print("   - employee2 (for data privacy testing)")
    print()
    print("3. Share credentials with testers using TEST_USERS_QUICK_REFERENCE.md")
    print()
    print("4. SECURITY NOTE:")
    print("   - Use simple passwords for testing (e.g., 'password123')")
    print("   - Change all passwords after testing")
    print("   - Never use production passwords for test accounts")
    print()
    
    # Check for common test usernames
    print("=" * 80)
    print("QUICK CHECK: Common Test Usernames")
    print("=" * 80)
    print()
    
    test_usernames = ['admin', 'test_driver', 'employee1', 'employee2', 'driver1', 'driver2']
    for username in test_usernames:
        exists = User.objects.filter(username=username).exists()
        status = "✅ EXISTS" if exists else "❌ NOT FOUND"
        print(f"  {username}: {status}")
    
    print()
    print("=" * 80)

# Auto-run when loaded in Django shell
get_test_users()

