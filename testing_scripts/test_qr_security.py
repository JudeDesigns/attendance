import os
import sys
import django
from django.conf import settings
# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from apps.employees.models import Employee, Location
from apps.attendance.models import TimeLog
from apps.attendance.views import TimeLogViewSet
from django.contrib.auth.models import User

def test_qr_security():
    print("Starting QR Code Security Verification...")

    # 1. Setup Test Data
    try:
        user = User.objects.filter(username='test_driver').first()
        if not user:
            print("Creating test user...")
            user = User.objects.create_user(username='test_driver', password='password123')
            
        employee = Employee.objects.filter(user=user).first()
        if not employee:
            # Create employee profile if missing (simplified)
            from apps.employees.models import Role
            role, _ = Role.objects.get_or_create(name='DRIVER')
            employee = Employee.objects.create(
                user=user, 
                employee_id='TEST-DRV-001',
                role=role,
                employment_status='ACTIVE'
            )

        # Clear any existing active logs
        TimeLog.objects.filter(employee=employee, status='CLOCKED_IN').update(
            status='CLOCKED_OUT', 
            clock_out_time=django.utils.timezone.now()
        )

        location = Location.objects.first()
        if not location:
            location = Location.objects.create(
                name="Test Warehouse",
                qr_code_payload="TEST-QR-PAYLOAD",
                latitude=34.052235,
                longitude=-118.243683,
                requires_gps_verification=False
            )
        
        # Ensure we have valid coords for the test
        lat = location.latitude if location.latitude else 34.052235
        lon = location.longitude if location.longitude else -118.243683
        
        # Round to 6 decimal places as per serializer
        lat = round(float(lat), 6)
        lon = round(float(lon), 6)

        qr_payload = location.qr_code_payload
        print(f"Test Employee: {employee.employee_id}")
        print(f"Test Location: {location.name} (Payload: {qr_payload})")

    except Exception as e:
        print(f"Setup failed: {e}")
        return

    factory = APIRequestFactory()
    view = TimeLogViewSet.as_view({'post': 'clock_in'})
    qr_view = TimeLogViewSet.as_view({'post': 'qr_scan'})

    # ---------------------------------------------------------
    # Test 1: Try to spoof QR clock-in via generic endpoint
    # ---------------------------------------------------------
    print("\n[Test 1] Attempting to spoof QR clock-in via generic endpoint...")
    data = {
        'location_id': str(location.id),
        'method': 'QR_CODE',
        'latitude': lat,
        'longitude': lon
    }
    request = factory.post('/api/v1/attendance/time-logs/clock_in/', data)
    force_authenticate(request, user=user)
    
    response = view(request)
    
    if response.status_code == 403 and "not allowed" in str(response.data.get('detail', '')):
        print("✅ SUCCESS: Generic endpoint correctly rejected QR_CODE method.")
    else:
        print(f"❌ FAILED: Generic endpoint allowed QR_CODE method! Status: {response.status_code}, Data: {response.data}")

    # ---------------------------------------------------------
    # Test 2: Use valid QR Code via dedicated endpoint
    # ---------------------------------------------------------
    print("\n[Test 2] Attempting valid scan via qr_scan endpoint...")
    data = {
        'qr_code': qr_payload,
        'action': 'clock_in'
    }
    request = factory.post('/api/v1/attendance/time-logs/qr_scan/', data)
    force_authenticate(request, user=user)
    
    response = qr_view(request)
    
    if response.status_code == 200:
        print("✅ SUCCESS: Valid QR scan accepted.")
        if response.data.get('time_log', {}).get('clock_in_method') == 'QR_CODE':
             print("   Verified method is recorded as QR_CODE.")
    else:
        print(f"❌ FAILED: Valid QR scan rejected. Status: {response.status_code}, Data: {response.data}")

    # ---------------------------------------------------------
    # Test 3: Use INVALID QR Code
    # ---------------------------------------------------------
    print("\n[Test 3] Attempting invalid QR code...")
    data = {
        'qr_code': 'INVALID-PAYLOAD-XYZ',
        'action': 'clock_out' # Trying to clock out with bad code
    }
    request = factory.post('/api/v1/attendance/time-logs/qr_scan/', data)
    force_authenticate(request, user=user)
    
    response = qr_view(request)
    
    if response.status_code == 400 and "Invalid QR code" in str(response.data):
         print("✅ SUCCESS: Invalid QR code correctly rejected.")
    else:
         print(f"❌ FAILED: Invalid QR behavior unexpected. Status: {response.status_code}, Data: {response.data}")

    # Cleanup
    TimeLog.objects.filter(employee=employee, status='CLOCKED_IN').update(
            status='CLOCKED_OUT', 
            clock_out_time=django.utils.timezone.now()
    )
    print("\nVerification Complete.")

if __name__ == "__main__":
    test_qr_security()
