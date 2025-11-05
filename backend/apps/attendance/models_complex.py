import uuid
from django.db import models
from django.utils import timezone
from apps.employees.models import Employee, Location
from datetime import timedelta


class TimeLog(models.Model):
    """Primary table for attendance records"""
    STATUS_CHOICES = [
        ('CLOCKED_IN', 'Clocked In'),
        ('ON_BREAK', 'On Break'),
        ('BACK_FROM_BREAK', 'Back from Break'),
        ('CLOCKED_OUT', 'Clocked Out'),
    ]

    CLOCK_METHOD_CHOICES = [
        ('PORTAL', 'Portal Button'),
        ('QR_CODE', 'QR Code Scan'),
        ('API', 'External API'),
        ('ADMIN', 'Admin Override'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='time_logs')
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Time tracking
    clock_in_time = models.DateTimeField()
    clock_out_time = models.DateTimeField(null=True, blank=True)
    
    # Method and verification
    clock_in_method = models.CharField(max_length=20, choices=CLOCK_METHOD_CHOICES, default='PORTAL')
    clock_out_method = models.CharField(max_length=20, choices=CLOCK_METHOD_CHOICES, null=True, blank=True)
    
    # GPS verification (for drivers)
    clock_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Status and notes
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CLOCKED_IN')
    notes = models.TextField(blank=True)
    
    # Admin fields
    created_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_time_logs')
    approved_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_time_logs')
    is_approved = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.clock_in_time.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def duration_minutes(self):
        """Calculate work duration in minutes"""
        if not self.clock_out_time:
            return None
        delta = self.clock_out_time - self.clock_in_time
        return int(delta.total_seconds() / 60)
    
    @property
    def duration_hours(self):
        """Calculate work duration in hours"""
        minutes = self.duration_minutes
        return round(minutes / 60, 2) if minutes else None
    
    @property
    def is_overtime(self):
        """Check if this shift qualifies as overtime (>8 hours)"""
        hours = self.duration_hours
        return hours and hours > 8
    
    @property
    def work_date(self):
        """Get the work date (date of clock-in)"""
        return self.clock_in_time.date()
    
    class Meta:
        db_table = 'time_logs'
        ordering = ['-clock_in_time']
        indexes = [
            models.Index(fields=['employee', 'clock_in_time']),
            # Note: work_date is a property, not a field, so can't be indexed
        ]


class BreakLog(models.Model):
    """Track lunch breaks and compliance"""
    BREAK_TYPE_CHOICES = [
        ('LUNCH', 'Lunch Break'),
        ('SHORT', 'Short Break'),
        ('PERSONAL', 'Personal Break'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name='breaks')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='breaks')
    
    break_type = models.CharField(max_length=20, choices=BREAK_TYPE_CHOICES, default='LUNCH')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Compliance tracking
    was_waived = models.BooleanField(default=False, help_text="Employee waived their break")
    waiver_reason = models.TextField(blank=True)
    is_compliant = models.BooleanField(default=True, help_text="Meets labor law requirements")
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.break_type} - {self.start_time.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def duration_minutes(self):
        """Calculate break duration in minutes"""
        if not self.end_time:
            return None
        delta = self.end_time - self.start_time
        return int(delta.total_seconds() / 60)
    
    @property
    def is_active(self):
        """Check if break is currently active"""
        return self.end_time is None
    
    class Meta:
        db_table = 'break_logs'
        ordering = ['-start_time']


class AttendanceRule(models.Model):
    """Configurable attendance rules and policies"""
    RULE_TYPE_CHOICES = [
        ('OVERTIME_THRESHOLD', 'Overtime Threshold'),
        ('BREAK_REQUIREMENT', 'Break Requirement'),
        ('LATE_ARRIVAL', 'Late Arrival'),
        ('EARLY_DEPARTURE', 'Early Departure'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    rule_type = models.CharField(max_length=30, choices=RULE_TYPE_CHOICES)
    description = models.TextField()
    
    # Rule configuration as JSON
    configuration = models.JSONField(default=dict, help_text="Rule parameters as JSON")
    
    # Applicability
    applies_to_roles = models.ManyToManyField('employees.Role', blank=True)
    applies_to_employees = models.ManyToManyField(Employee, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()})"
    
    class Meta:
        db_table = 'attendance_rules'


class AttendanceViolation(models.Model):
    """Track attendance policy violations"""
    VIOLATION_TYPE_CHOICES = [
        ('OVERTIME', 'Overtime Violation'),
        ('MISSING_BREAK', 'Missing Break'),
        ('LATE_ARRIVAL', 'Late Arrival'),
        ('EARLY_DEPARTURE', 'Early Departure'),
        ('MISSING_CLOCK_OUT', 'Missing Clock Out'),
    ]

    SEVERITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='violations')
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, null=True, blank=True)
    rule = models.ForeignKey(AttendanceRule, on_delete=models.SET_NULL, null=True, blank=True)
    
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    
    description = models.TextField()
    violation_data = models.JSONField(default=dict, help_text="Additional violation details")
    
    # Resolution
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_violations')
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.get_violation_type_display()}"
    
    class Meta:
        db_table = 'attendance_violations'
        ordering = ['-created_at']
