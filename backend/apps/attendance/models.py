"""
Simple Attendance models for WorkSync
"""
from django.db import models
from apps.employees.models import Employee, Location
import uuid

class TimeLog(models.Model):
    """Employee time tracking"""
    STATUS_CHOICES = [
        ('CLOCKED_IN', 'Clocked In'),
        ('CLOCKED_OUT', 'Clocked Out'),
    ]
    
    METHOD_CHOICES = [
        ('PORTAL', 'Web Portal'),
        ('QR_CODE', 'QR Code'),
        ('API', 'API Integration'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    clock_in_time = models.DateTimeField()
    clock_out_time = models.DateTimeField(null=True, blank=True)
    clock_in_location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='clock_ins')
    clock_out_location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='clock_outs')
    clock_in_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='PORTAL')
    clock_out_method = models.CharField(max_length=20, choices=METHOD_CHOICES, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CLOCKED_IN')

    # Geolocation fields
    clock_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Clock-in GPS latitude")
    clock_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Clock-in GPS longitude")
    clock_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Clock-out GPS latitude")
    clock_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Clock-out GPS longitude")

    # Break compliance tracking fields
    CLOCK_OUT_REASON_CHOICES = [
        ('END_SHIFT', 'End of Shift'),
        ('LUNCH_BREAK', 'Lunch Break'),
        ('SHORT_BREAK', 'Short Break'),
        ('PERSONAL_BREAK', 'Personal Break'),
        ('EMERGENCY', 'Emergency'),
        ('OTHER', 'Other'),
    ]

    clock_out_reason = models.CharField(
        max_length=50,
        choices=CLOCK_OUT_REASON_CHOICES,
        blank=True,
        null=True,
        help_text="Reason for clocking out"
    )
    break_reminder_sent_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When break reminder was last sent"
    )
    break_reminder_count = models.IntegerField(
        default=0,
        help_text="Number of break reminders sent"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def duration_minutes(self):
        """Calculate duration in minutes"""
        if self.clock_out_time:
            delta = self.clock_out_time - self.clock_in_time
        else:
            # For active time logs, calculate from clock_in_time to now
            from django.utils import timezone
            delta = timezone.now() - self.clock_in_time
        return int(delta.total_seconds() / 60)
    
    @property
    def duration_hours(self):
        """Calculate duration in hours"""
        minutes = self.duration_minutes
        return round(minutes / 60, 2) if minutes else None

    @property
    def hours_worked(self):
        """Calculate hours worked (alias for duration_hours for break compliance)"""
        return self.duration_hours

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates using Haversine formula"""
        if not all([lat1, lon1, lat2, lon2]):
            return None

        import math

        # Convert latitude and longitude from degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))

        # Radius of earth in meters
        r = 6371000

        return c * r

    def is_within_geofence(self, latitude, longitude, location):
        """Check if GPS coordinates are within location's geofence"""
        if not location or not location.latitude or not location.longitude:
            return True  # No geofencing if location doesn't have GPS coordinates

        if not latitude or not longitude:
            return False  # GPS coordinates required if location has geofencing

        distance = self.calculate_distance(
            latitude, longitude,
            location.latitude, location.longitude
        )

        if distance is None:
            return False

        # Check if within radius (default 100 meters if not specified)
        allowed_radius = location.radius_meters if hasattr(location, 'radius_meters') and location.radius_meters else 100
        return distance <= allowed_radius

    def validate_clock_in_location(self):
        """Validate clock-in location against geofence"""
        if self.clock_in_location and self.clock_in_location.requires_gps_verification:
            return self.is_within_geofence(
                self.clock_in_latitude,
                self.clock_in_longitude,
                self.clock_in_location
            )
        return True

    def validate_clock_out_location(self):
        """Validate clock-out location against geofence"""
        if self.clock_out_location and self.clock_out_location.requires_gps_verification:
            return self.is_within_geofence(
                self.clock_out_latitude,
                self.clock_out_longitude,
                self.clock_out_location
            )
        return True

    @property
    def work_date(self):
        """Get the work date (date of clock-in)"""
        return self.clock_in_time.date()

    @property
    def is_overtime(self):
        """Check if this shift qualifies as overtime (>8 hours)"""
        hours = self.duration_hours
        return hours and hours > 8

    @property
    def scheduled_shift(self):
        """Get the scheduled shift that corresponds to this time log"""
        from apps.scheduling.models import Shift

        # Find shift that overlaps with this time log
        shifts = Shift.objects.filter(
            employee=self.employee,
            start_time__date=self.work_date,
            is_published=True
        )

        # Find the shift that best matches this time log
        for shift in shifts:
            # Check if clock-in time falls within reasonable range of shift start
            clock_in_diff = abs((self.clock_in_time - shift.start_time).total_seconds() / 60)
            if clock_in_diff <= 30:  # Within 30 minutes of shift start
                return shift

        # No matching shift found — do NOT return an arbitrary shift
        return None

    @property
    def attendance_status(self):
        """Calculate attendance status based on shift compliance"""
        if not self.clock_out_time:
            return 'IN_PROGRESS'

        shift = self.scheduled_shift
        if not shift:
            # No matching scheduled shift — this is an unscheduled work session
            if self.duration_hours and self.duration_hours > 8:
                return 'OVERTIME'
            return 'UNSCHEDULED'

        # Check if clocked out before shift end time
        if self.clock_out_time < shift.end_time:
            return 'EARLY_DEPARTURE'

        # Check for overtime
        if self.duration_hours and self.duration_hours > 8:
            return 'OVERTIME'

        # Verify the employee actually worked a reasonable portion of the shift
        # Only mark as COMPLETED if they worked at least 75% of scheduled hours
        shift_duration_hours = shift.duration_hours or 0
        actual_hours = self.duration_hours or 0
        if shift_duration_hours > 0 and actual_hours < (shift_duration_hours * 0.75):
            return 'EARLY_DEPARTURE'

        return 'COMPLETED'

    @property
    def is_shift_compliant(self):
        """Check if this time log complies with scheduled shift"""
        shift = self.scheduled_shift
        if not shift:
            return False

        # Check if clocked in within reasonable time of shift start (30 minutes)
        clock_in_diff = abs((self.clock_in_time - shift.start_time).total_seconds() / 60)
        if clock_in_diff > 30:
            return False

        # If clocked out, check if it was at or after shift end time
        if self.clock_out_time and self.clock_out_time < shift.end_time:
            return False

        return True

    def __str__(self):
        return f"{self.employee.employee_id} - {self.clock_in_time.date()}"
    
    class Meta:
        ordering = ['-clock_in_time']


class Break(models.Model):
    """Employee break tracking during work shifts"""
    BREAK_TYPE_CHOICES = [
        ('LUNCH', 'Lunch Break'),
        ('SHORT', 'Short Break'),
        ('PERSONAL', 'Personal Break'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name='breaks')
    break_type = models.CharField(max_length=20, choices=BREAK_TYPE_CHOICES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # Break compliance tracking fields
    was_waived = models.BooleanField(
        default=False,
        help_text="Employee waived their break"
    )
    waiver_reason = models.TextField(
        blank=True,
        help_text="Reason for waiving the break"
    )
    is_compliant = models.BooleanField(
        default=True,
        help_text="Meets labor law requirements"
    )
    reminder_acknowledged = models.BooleanField(
        default=False,
        help_text="Employee acknowledged break reminder"
    )
    reminder_acknowledged_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When break reminder was acknowledged"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def duration_minutes(self):
        """Calculate break duration in minutes"""
        if self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return None

    @property
    def duration_hours(self):
        """Calculate break duration in hours"""
        minutes = self.duration_minutes
        return round(minutes / 60, 2) if minutes else None

    @property
    def is_active(self):
        """Check if break is currently active (not ended)"""
        return self.end_time is None

    def __str__(self):
        return f"{self.time_log.employee.employee_id} - {self.get_break_type_display()} - {self.start_time.date()}"

    class Meta:
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['time_log', 'start_time']),
            models.Index(fields=['break_type']),
        ]
