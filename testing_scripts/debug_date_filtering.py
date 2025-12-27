#!/usr/bin/env python3
"""
Debug the exact date filtering logic that's causing overnight shifts to disappear
"""

import os
import sys
import django
from datetime import datetime

# Setup Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worksync.settings')
django.setup()

from apps.scheduling.models import Shift

def debug_date_filtering():
    """Debug the exact date filtering that's failing"""
    
    print("🔍 DEBUGGING DATE FILTERING LOGIC")
    print("=" * 60)
    
    # Get all shifts first
    all_shifts = Shift.objects.all().order_by('start_time')
    print(f"📊 Total shifts in database: {all_shifts.count()}")
    
    # Show all shifts with their dates
    print("\n📋 ALL SHIFTS:")
    for shift in all_shifts:
        print(f"   {shift.employee.employee_id}: {shift.start_time} → {shift.end_time}")
        print(f"      Start Date: {shift.start_time.date()}")
        print(f"      End Date: {shift.end_time.date()}")
        print(f"      Published: {shift.is_published}")
        print()
    
    # Test the exact filtering logic from the backend
    print("🧪 TESTING BACKEND FILTERING LOGIC:")
    print("-" * 40)
    
    # Test 1: Date range filter (Dec 22-28) - This works
    print("1️⃣ Date Range Filter (2025-12-22 to 2025-12-28):")
    start_date_str = '2025-12-22'
    end_date_str = '2025-12-28'
    
    start = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
    end = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    
    print(f"   start datetime: {start}")
    print(f"   end datetime: {end}")
    
    queryset = Shift.objects.filter(start_time__gte=start, start_time__lte=end)
    print(f"   Results: {queryset.count()} shifts")
    
    for shift in queryset:
        print(f"     • {shift.employee.employee_id}: {shift.start_time}")
    print()
    
    # Test 2: Specific date filter (Dec 27) - This fails
    print("2️⃣ Specific Date Filter (2025-12-27 to 2025-12-27):")
    start_date_str = '2025-12-27'
    end_date_str = '2025-12-27'
    
    start = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
    end = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    
    print(f"   start datetime: {start}")
    print(f"   end datetime: {end}")
    
    queryset = Shift.objects.filter(start_time__gte=start, start_time__lte=end)
    print(f"   Results: {queryset.count()} shifts")
    
    for shift in queryset:
        print(f"     • {shift.employee.employee_id}: {shift.start_time}")
    print()
    
    # Test 3: Check what happens with end-of-day
    print("3️⃣ Testing End-of-Day Logic:")
    from datetime import time
    
    # What the frontend probably expects
    start_of_day = datetime.combine(datetime(2025, 12, 27).date(), time.min)  # 00:00:00
    end_of_day = datetime.combine(datetime(2025, 12, 27).date(), time.max)    # 23:59:59.999999
    
    print(f"   start_of_day: {start_of_day}")
    print(f"   end_of_day: {end_of_day}")
    
    queryset = Shift.objects.filter(start_time__gte=start_of_day, start_time__lte=end_of_day)
    print(f"   Results: {queryset.count()} shifts")
    
    for shift in queryset:
        print(f"     • {shift.employee.employee_id}: {shift.start_time}")
    print()
    
    # Test 4: Check our specific overnight shifts
    print("4️⃣ Finding Our Specific Overnight Shifts:")
    target_shifts = Shift.objects.filter(
        start_time__date=datetime(2025, 12, 27).date()
    )
    
    print(f"   Shifts starting on 2025-12-27: {target_shifts.count()}")
    for shift in target_shifts:
        print(f"     • {shift.employee.employee_id}: {shift.start_time} → {shift.end_time}")
        
        # Check if this shift would pass the filters
        passes_range_filter = (shift.start_time >= datetime(2025, 12, 22) and 
                              shift.start_time <= datetime(2025, 12, 28))
        passes_specific_filter = (shift.start_time >= datetime(2025, 12, 27) and 
                                 shift.start_time <= datetime(2025, 12, 27))
        
        print(f"       Passes range filter (Dec 22-28): {passes_range_filter}")
        print(f"       Passes specific filter (Dec 27): {passes_specific_filter}")
        print(f"       Start time hour: {shift.start_time.hour}")
    
    print("\n🎯 ANALYSIS:")
    print("If overnight shifts pass the range filter but fail the specific filter,")
    print("the issue is in how the end_date is being interpreted.")
    print("The backend might be treating '2025-12-27' as '2025-12-27 00:00:00'")
    print("instead of '2025-12-27 23:59:59', causing shifts later in the day to be excluded.")

if __name__ == "__main__":
    debug_date_filtering()
