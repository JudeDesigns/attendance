#!/usr/bin/env python3
"""
Script to create test users for WorkSync testing
Run this to set up test accounts for manual testing
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User
from apps.employees.models import Employee, Role, Department, Location
from django.db import transaction

def create_test_users():
    """Create test users for manual testing"""
    
    print("=" * 80)
    print("CREATING WORKSYNC TEST USERS")
    print("=" * 80)
    print()
    
    # Default test password
    TEST_PASSWORD = "password123"
    
    # Get or create default role and department
    try:
        driver_role, _ = Role.objects.get_or_create(
            name='DRIVER',
            defaults={'description': 'Driver role for testing'}
        )
        employee_role, _ = Role.objects.get_or_create(
            name='EMPLOYEE',
            defaults={'description': 'Employee role for testing'}
        )
        
        test_dept, _ = Department.objects.get_or_create(
            name='Test Department',
            defaults={'description': 'Department for test users'}
        )
        
        print("✅ Roles and departments ready")
        print()
    except Exception as e:
        print(f"❌ Error setting up roles/departments: {e}")
        return
    
    # Test users to create
    test_users = [
        {
            'username': 'admin',
            'email': 'admin@worksync.test',
            'first_name': 'Admin',
            'last_name': 'User',
            'is_staff': True,
            'is_superuser': True,
            'employee_id': 'ADMIN-001',
            'role': employee_role,
        },
        {
            'username': 'test_driver',
            'email': 'driver@worksync.test',
            'first_name': 'Test',
            'last_name': 'Driver',
            'is_staff': False,
            'is_superuser': False,
            'employee_id': 'DRV-001',
            'role': driver_role,
        },
        {
            'username': 'employee1',
            'email': 'employee1@worksync.test',
            'first_name': 'Employee',
            'last_name': 'One',
            'is_staff': False,
            'is_superuser': False,
            'employee_id': 'EMP-001',
            'role': employee_role,
        },
        {
            'username': 'employee2',
            'email': 'employee2@worksync.test',
            'first_name': 'Employee',
            'last_name': 'Two',
            'is_staff': False,
            'is_superuser': False,
            'employee_id': 'EMP-002',
            'role': employee_role,
        },
    ]
    
    created_count = 0
    skipped_count = 0
    
    for user_data in test_users:
        username = user_data['username']
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            print(f"⏭️  Skipping '{username}' - already exists")
            skipped_count += 1
            continue
        
        try:
            with transaction.atomic():
                # Create user
                user = User.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=TEST_PASSWORD,
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name'],
                    is_staff=user_data['is_staff'],
                    is_superuser=user_data['is_superuser'],
                )
                
                # Create employee profile
                employee = Employee.objects.create(
                    user=user,
                    employee_id=user_data['employee_id'],
                    role=user_data['role'],
                    department=test_dept,
                    employment_status='ACTIVE',
                    phone_number=f'+1555000{created_count + 1:04d}',
                )
                
                print(f"✅ Created '{username}' - {user_data['first_name']} {user_data['last_name']}")
                print(f"   Employee ID: {employee.employee_id}")
                print(f"   Role: {employee.role.name}")
                print(f"   Password: {TEST_PASSWORD}")
                print()
                
                created_count += 1
                
        except Exception as e:
            print(f"❌ Error creating '{username}': {e}")
            print()
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✅ Created: {created_count} users")
    print(f"⏭️  Skipped: {skipped_count} users (already exist)")
    print()
    
    if created_count > 0:
        print("🔐 TEST CREDENTIALS")
        print("-" * 80)
        print(f"Password for all test users: {TEST_PASSWORD}")
        print()
        print("Usernames created:")
        for user_data in test_users:
            if not User.objects.filter(username=user_data['username']).exists():
                continue
            role_type = "ADMIN" if user_data['is_staff'] else user_data['role'].name
            print(f"  - {user_data['username']} ({role_type})")
        print()
    
    print("=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print()
    print("1. Run get_test_users.py to see all test users:")
    print("   python3 get_test_users.py")
    print()
    print("2. Share TEST_USERS_QUICK_REFERENCE.md with testers")
    print()
    print("3. Update the reference document with actual credentials")
    print()
    print("4. Start testing using USER_TESTING_GUIDE.md")
    print()
    print("⚠️  SECURITY REMINDER:")
    print("   - These are TEST accounts with simple passwords")
    print("   - Change passwords after testing")
    print("   - Never use these credentials in production")
    print()

if __name__ == "__main__":
    try:
        create_test_users()
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
        print("Make sure you're running this from the WorkSync root directory:")
        print("  python3 create_test_users.py")
        sys.exit(1)

