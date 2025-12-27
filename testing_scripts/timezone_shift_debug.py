#!/usr/bin/env python3
"""
Debug timezone issues with shift display
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
from apps.scheduling.serializers import ShiftSerializer

def debug_timezone_shifts():
    """Debug timezone conversion in shifts"""
    print("🕐 DEBUGGING TIMEZONE SHIFT CONVERSION")
    print("=" * 60)
    
    # Get the shifts for 2025-12-27
    shifts = Shift.objects.filter(
        start_time__date=datetime(2025, 12, 27).date()
    ).select_related('employee__user')
    
    print(f"📅 Found {shifts.count()} shifts for 2025-12-27")
    print()
    
    for shift in shifts:
        print(f"🔍 SHIFT: {shift.employee.employee_id} ({shift.employee.user.first_name} {shift.employee.user.last_name})")
        print(f"   Database Raw Times:")
        print(f"     Start: {shift.start_time} (UTC: {shift.start_time.utctimetuple()})")
        print(f"     End: {shift.end_time} (UTC: {shift.end_time.utctimetuple()})")
        
        # Check if shift has timezone info
        print(f"   Employee Timezone: {getattr(shift.employee, 'timezone', 'Not set')}")
        
        # Check serialized output
        serializer = ShiftSerializer(shift)
        serialized_data = serializer.data
        
        print(f"   API Serialized Times:")
        print(f"     Start: {serialized_data.get('start_time')}")
        print(f"     End: {serialized_data.get('end_time')}")
        print(f"     Start Local: {serialized_data.get('start_time_local')}")
        print(f"     End Local: {serialized_data.get('end_time_local')}")
        
        # Check if this is an overnight shift
        is_overnight = shift.end_time.date() > shift.start_time.date()
        print(f"   Is Overnight Shift: {is_overnight}")
        
        # Check duration
        print(f"   Duration: {serialized_data.get('duration_hours')} hours")
        
        print("   " + "-" * 50)
        print()
    
    print("🎯 ANALYSIS:")
    print("If start_time_local and end_time_local are different from database times,")
    print("then there's a timezone conversion happening that might be affecting display.")
    print()
    print("The frontend uses start_time_local for filtering shifts by date.")
    print("If start_time_local is on a different date than expected, the shift won't show.")

if __name__ == "__main__":
    debug_timezone_shifts()
