#!/usr/bin/env python3
"""
WorkSync Test Environment Setup Script
Prepares the testing environment with test data and configurations
"""

import os
import sys
import json
import subprocess
from pathlib import Path
import django
from django.core.management import execute_from_command_line

class TestEnvironmentSetup:
    def __init__(self, project_root="."):
        self.project_root = Path(project_root)
        self.backend_path = self.project_root / "backend"
        self.frontend_path = self.project_root / "frontend"
        self.venv_path = self.backend_path / "venv"
        self.python_executable = self.get_venv_python()

    def get_venv_python(self):
        """Get the Python executable from the virtual environment"""
        if self.venv_path.exists():
            # Check for different possible Python executable names
            for python_name in ['python', 'python3', 'python3.11']:
                python_path = self.venv_path / "bin" / python_name
                if python_path.exists():
                    return str(python_path)

        # Fallback to system Python
        return sys.executable

    def setup_django_environment(self):
        """Setup Django environment for database operations"""
        sys.path.insert(0, str(self.backend_path))
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
        django.setup()
    
    def check_backend_dependencies(self):
        """Check if backend dependencies are installed"""
        print("Checking backend dependencies...")
        
        requirements_file = self.backend_path / "requirements.txt"
        if not requirements_file.exists():
            print("❌ requirements.txt not found")
            return False
        
        try:
            # Check if Django is available
            import django
            print(f"✅ Django {django.get_version()} available")
            
            # Check if DRF is available
            import rest_framework
            print("✅ Django REST Framework available")
            
            return True
        except ImportError as e:
            print(f"❌ Missing dependency: {e}")
            print("Run: pip install -r requirements.txt")
            return False
    
    def check_frontend_dependencies(self):
        """Check if frontend dependencies are installed"""
        print("Checking frontend dependencies...")
        
        node_modules = self.frontend_path / "node_modules"
        package_json = self.frontend_path / "package.json"
        
        if not package_json.exists():
            print("❌ package.json not found")
            return False
        
        if not node_modules.exists():
            print("❌ node_modules not found")
            print("Run: cd frontend && npm install")
            return False
        
        print("✅ Frontend dependencies available")
        return True
    
    def setup_database(self):
        """Setup database with migrations and test data"""
        print("Setting up database...")

        try:
            original_dir = os.getcwd()
            os.chdir(self.backend_path)

            # Run migrations using the venv Python
            print("Running database migrations...")
            subprocess.run([
                self.python_executable, 'manage.py', 'migrate'
            ], check=True)

            # Create superuser if it doesn't exist
            print("Creating test superuser...")
            self.create_test_superuser()

            # Create test data
            print("Creating test data...")
            self.create_test_data()

            print("✅ Database setup complete")
            os.chdir(original_dir)
            return True

        except Exception as e:
            print(f"❌ Database setup failed: {e}")
            os.chdir(original_dir)
            return False
    
    def create_test_superuser(self):
        """Create test superuser account"""
        try:
            from django.contrib.auth.models import User
            
            if not User.objects.filter(username='admin').exists():
                User.objects.create_superuser(
                    username='admin',
                    email='admin@worksync.com',
                    password='admin123'
                )
                print("✅ Test admin user created (admin/admin123)")
            else:
                print("✅ Test admin user already exists")
                
        except Exception as e:
            print(f"❌ Failed to create superuser: {e}")
    
    def create_test_data(self):
        """Create test data for testing"""
        try:
            from django.contrib.auth.models import User
            from apps.employees.models import Employee, Role, Location
            
            # Create test roles
            admin_role, _ = Role.objects.get_or_create(
                name='ADMIN',
                defaults={'description': 'Administrator role'}
            )
            
            employee_role, _ = Role.objects.get_or_create(
                name='EMPLOYEE',
                defaults={'description': 'Regular employee role'}
            )
            
            driver_role, _ = Role.objects.get_or_create(
                name='DRIVER',
                defaults={'description': 'Driver role'}
            )
            
            # Create test locations
            main_office, _ = Location.objects.get_or_create(
                name='Main Office',
                defaults={
                    'address': '123 Business St, City, State 12345',
                    'latitude': 40.7128,
                    'longitude': -74.0060,
                    'qr_code_payload': 'LOC-MAIN-OFFICE'
                }
            )
            
            warehouse, _ = Location.objects.get_or_create(
                name='Warehouse',
                defaults={
                    'address': '456 Industrial Ave, City, State 12345',
                    'latitude': 40.7589,
                    'longitude': -73.9851,
                    'qr_code_payload': 'LOC-WAREHOUSE'
                }
            )
            
            # Create test users and employees
            test_users = [
                {
                    'username': 'testuser1',
                    'email': 'test1@worksync.com',
                    'password': 'testpass123',
                    'first_name': 'John',
                    'last_name': 'Doe',
                    'employee_id': 'EMP-001',
                    'role': employee_role,
                    'location': main_office
                },
                {
                    'username': 'testdriver1',
                    'email': 'driver1@worksync.com',
                    'password': 'testpass123',
                    'first_name': 'Jane',
                    'last_name': 'Smith',
                    'employee_id': 'DRV-001',
                    'role': driver_role,
                    'location': warehouse
                },
                {
                    'username': 'testmanager1',
                    'email': 'manager1@worksync.com',
                    'password': 'testpass123',
                    'first_name': 'Mike',
                    'last_name': 'Johnson',
                    'employee_id': 'MGR-001',
                    'role': admin_role,
                    'location': main_office
                }
            ]
            
            for user_data in test_users:
                if not User.objects.filter(username=user_data['username']).exists():
                    user = User.objects.create_user(
                        username=user_data['username'],
                        email=user_data['email'],
                        password=user_data['password'],
                        first_name=user_data['first_name'],
                        last_name=user_data['last_name']
                    )
                    
                    Employee.objects.create(
                        user=user,
                        employee_id=user_data['employee_id'],
                        role=user_data['role'],
                        location=user_data['location'],
                        employment_status='ACTIVE'
                    )
                    
                    print(f"✅ Created test user: {user_data['username']}")
            
            print("✅ Test data created successfully")
            
        except Exception as e:
            print(f"❌ Failed to create test data: {e}")
    
    def setup_testing_scripts(self):
        """Setup testing scripts dependencies"""
        print("Setting up testing scripts...")

        testing_scripts_path = self.project_root / "testing_scripts"
        original_dir = os.getcwd()

        # Install Python dependencies for testing scripts in the venv
        try:
            subprocess.run([
                self.python_executable, "-m", "pip", "install", "requests", "beautifulsoup4"
            ], check=True)
            print("✅ Python testing dependencies installed in venv")
        except subprocess.CalledProcessError:
            print("❌ Failed to install Python testing dependencies")

        # Install Node.js dependencies for frontend testing
        try:
            os.chdir(testing_scripts_path)
            subprocess.run(["npm", "install"], check=True)
            print("✅ Node.js testing dependencies installed")
            os.chdir(original_dir)
        except subprocess.CalledProcessError:
            print("❌ Failed to install Node.js testing dependencies")
            print("Make sure Node.js and npm are installed")
            os.chdir(original_dir)
    
    def run_setup(self):
        """Run complete test environment setup"""
        print("🚀 Setting up WorkSync test environment...")
        print(f"Project root: {self.project_root}")
        
        success = True
        
        # Check dependencies
        if not self.check_backend_dependencies():
            success = False
        
        if not self.check_frontend_dependencies():
            success = False
        
        # Setup Django environment
        if success:
            try:
                self.setup_django_environment()
                print("✅ Django environment configured")
            except Exception as e:
                print(f"❌ Django setup failed: {e}")
                success = False
        
        # Setup database
        if success:
            success = self.setup_database()
        
        # Setup testing scripts
        self.setup_testing_scripts()
        
        print(f"\n{'='*50}")
        if success:
            print("✅ Test environment setup complete!")
            print("\nNext steps:")
            print("1. Start backend: cd backend && python manage.py runserver")
            print("2. Start frontend: cd frontend && npm start")
            print("3. Run tests: cd testing_scripts && python3 run_comprehensive_tests.py")
        else:
            print("❌ Test environment setup failed!")
            print("Please resolve the issues above and try again.")
        
        return success

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='WorkSync Test Environment Setup')
    parser.add_argument('--project-root', default='.', 
                       help='Root directory of the WorkSync project')
    
    args = parser.parse_args()
    
    setup = TestEnvironmentSetup(args.project_root)
    setup.run_setup()
