#!/usr/bin/env python3
"""
Shift Calendar Debug Tester
Debug why shifts are not showing in the frontend calendar
"""

import os
import sys
import django
import requests
import json
from datetime import datetime, timedelta

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from django.contrib.auth.models import User
from apps.employees.models import Employee
from apps.scheduling.models import Shift
from django.utils import timezone

class ShiftCalendarDebugger:
    def __init__(self):
        self.backend_url = 'http://127.0.0.1:8000'
        self.api_url = f'{self.backend_url}/api/v1'
        
    def debug_database_shifts(self):
        """Check what shifts exist in the database"""
        print("🔍 DEBUGGING DATABASE SHIFTS")
        print("=" * 50)
        
        # Check all shifts for 2025-12-27
        target_date = datetime(2025, 12, 27).date()
        
        shifts = Shift.objects.filter(
            start_time__date=target_date
        ).select_related('employee__user')
        
        print(f"📅 Shifts in database for {target_date}:")
        for shift in shifts:
            print(f"  • ID: {shift.id}")
            print(f"    Employee: {shift.employee.employee_id} ({shift.employee.user.first_name} {shift.employee.user.last_name})")
            print(f"    Start: {shift.start_time}")
            print(f"    End: {shift.end_time}")
            print(f"    Published: {shift.is_published}")
            print(f"    Location: {shift.location}")
            print("    ---")
        
        if not shifts:
            print("  ❌ No shifts found in database for this date")
        
        return shifts
    
    def debug_api_response(self):
        """Test the API endpoint directly"""
        print("\n🔌 DEBUGGING API RESPONSE")
        print("=" * 50)
        
        # Test the API call that frontend makes
        try:
            # Simulate the frontend API call for the week containing 2025-12-27
            start_date = '2025-12-22'  # Start of week containing 2025-12-27
            end_date = '2025-12-28'    # End of week containing 2025-12-27
            
            response = requests.get(
                f'{self.api_url}/scheduling/shifts/',
                params={
                    'start_date': start_date,
                    'end_date': end_date
                },
                timeout=10
            )
            
            print(f"📡 API Request: GET /scheduling/shifts/")
            print(f"   Parameters: start_date={start_date}, end_date={end_date}")
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                shifts = data.get('results', [])
                print(f"   Total Shifts Returned: {len(shifts)}")
                
                if shifts:
                    print("   📋 Shifts in API response:")
                    for shift in shifts:
                        print(f"     • ID: {shift.get('id')}")
                        print(f"       Employee: {shift.get('employee_id')} ({shift.get('employee_name')})")
                        print(f"       Start: {shift.get('start_time')}")
                        print(f"       End: {shift.get('end_time')}")
                        print(f"       Published: {shift.get('is_published')}")
                        print(f"       Location: {shift.get('location')}")
                        print("       ---")
                else:
                    print("   ❌ No shifts returned by API")
            else:
                print(f"   ❌ API Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except Exception as e:
            print(f"   ❌ API Request Failed: {str(e)}")
    
    def debug_date_filtering_logic(self):
        """Debug the date filtering logic in the backend"""
        print("\n📅 DEBUGGING DATE FILTERING LOGIC")
        print("=" * 50)
        
        # Check what the backend filtering logic is doing
        from apps.scheduling.views import ShiftViewSet
        
        # Simulate the filtering logic
        start_date_str = '2025-12-22'
        end_date_str = '2025-12-28'
        
        print(f"🔍 Testing date filtering with:")
        print(f"   start_date: {start_date_str}")
        print(f"   end_date: {end_date_str}")
        
        try:
            # Parse dates like the backend does
            start = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            
            print(f"   Parsed start: {start}")
            print(f"   Parsed end: {end}")
            
            # Apply the same filtering logic as the backend
            queryset = Shift.objects.all()
            queryset = queryset.filter(start_time__gte=start)
            queryset = queryset.filter(start_time__lte=end)
            
            print(f"   Filtered queryset count: {queryset.count()}")
            
            for shift in queryset:
                print(f"     • {shift.employee.employee_id}: {shift.start_time} to {shift.end_time}")
                
        except Exception as e:
            print(f"   ❌ Date filtering error: {str(e)}")
    
    def debug_published_filter(self):
        """Debug the published filter"""
        print("\n📢 DEBUGGING PUBLISHED FILTER")
        print("=" * 50)
        
        # Check published vs unpublished shifts
        all_shifts = Shift.objects.filter(start_time__date=datetime(2025, 12, 27).date())
        published_shifts = all_shifts.filter(is_published=True)
        unpublished_shifts = all_shifts.filter(is_published=False)
        
        print(f"📊 Shift Publication Status for 2025-12-27:")
        print(f"   Total shifts: {all_shifts.count()}")
        print(f"   Published shifts: {published_shifts.count()}")
        print(f"   Unpublished shifts: {unpublished_shifts.count()}")
        
        if unpublished_shifts.exists():
            print("\n   ⚠️ Unpublished shifts found:")
            for shift in unpublished_shifts:
                print(f"     • {shift.employee.employee_id}: {shift.start_time} (UNPUBLISHED)")
    
    def debug_frontend_date_logic(self):
        """Debug the frontend date logic"""
        print("\n🖥️ DEBUGGING FRONTEND DATE LOGIC")
        print("=" * 50)
        
        # Simulate what the frontend does
        from datetime import datetime
        
        # Frontend uses date-fns startOfWeek/endOfWeek
        # Let's simulate this for 2025-12-27
        target_date = datetime(2025, 12, 27)
        
        # Calculate week start/end (assuming Sunday start)
        days_since_sunday = target_date.weekday() + 1  # Monday = 0, so Sunday = 6
        if days_since_sunday == 7:
            days_since_sunday = 0
            
        week_start = target_date - timedelta(days=days_since_sunday)
        week_end = week_start + timedelta(days=6)
        
        print(f"📅 Frontend week calculation for {target_date.date()}:")
        print(f"   Week start: {week_start.date()}")
        print(f"   Week end: {week_end.date()}")
        print(f"   Target date ({target_date.date()}) is in this range: {week_start.date() <= target_date.date() <= week_end.date()}")
        
        # Check if shifts exist in this date range
        shifts_in_range = Shift.objects.filter(
            start_time__date__gte=week_start.date(),
            start_time__date__lte=week_end.date(),
            is_published=True
        )
        
        print(f"   Shifts in this date range: {shifts_in_range.count()}")
        for shift in shifts_in_range:
            print(f"     • {shift.employee.employee_id}: {shift.start_time.date()}")
    
    def run_comprehensive_debug(self):
        """Run all debugging tests"""
        print("🚀 STARTING SHIFT CALENDAR DEBUG SESSION")
        print("=" * 70)
        
        # 1. Check database
        db_shifts = self.debug_database_shifts()
        
        # 2. Test API response
        self.debug_api_response()
        
        # 3. Debug date filtering
        self.debug_date_filtering_logic()
        
        # 4. Debug published filter
        self.debug_published_filter()
        
        # 5. Debug frontend date logic
        self.debug_frontend_date_logic()
        
        # Summary
        print("\n" + "=" * 70)
        print("📋 DEBUG SUMMARY")
        print("=" * 70)
        
        if db_shifts:
            print("✅ Shifts exist in database")
            print("🔍 Next steps:")
            print("   1. Check if API is returning the shifts")
            print("   2. Check if frontend is filtering them correctly")
            print("   3. Check if frontend is rendering them properly")
        else:
            print("❌ No shifts found in database for target date")
            print("🔍 This explains why calendar is empty")
        
        print("\n🎯 RECOMMENDED ACTIONS:")
        print("   1. Verify API endpoint is working correctly")
        print("   2. Check frontend date range calculations")
        print("   3. Verify frontend shift filtering logic")
        print("   4. Check if shifts are being grouped correctly for display")

if __name__ == "__main__":
    debugger = ShiftCalendarDebugger()
    debugger.run_comprehensive_debug()
