"""
Scheduling models for WorkSync
"""
import uuid
from datetime import timedelta
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.auth.models import User
from apps.employees.models import Employee, Location


class Shift(models.Model):
    """Employee shift scheduling with conflict detection"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shifts')
    location = models.CharField(max_length=200, blank=True, help_text="Work location (free text)")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    notes = models.TextField(blank=True)
    is_published = models.BooleanField(default=False, help_text="Whether this shift is published to the employee")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_shifts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def duration_minutes(self):
        """Calculate shift duration in minutes"""
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return None
    
    @property
    def duration_hours(self):
        """Calculate shift duration in hours"""
        minutes = self.duration_minutes
        return round(minutes / 60, 2) if minutes else None
    
    @property
    def is_past(self):
        """Check if shift is in the past"""
        return self.end_time < timezone.now()
    
    @property
    def is_current(self):
        """Check if shift is currently active"""
        now = timezone.now()
        return self.start_time <= now <= self.end_time
    
    @property
    def is_future(self):
        """Check if shift is in the future"""
        return self.start_time > timezone.now()

    @property
    def allows_clock_in(self):
        """Check if current time allows clock-in (within 15 minutes before shift start)"""
        now = timezone.now()
        clock_in_window_start = self.start_time - timedelta(minutes=15)
        return clock_in_window_start <= now <= self.end_time

    @property
    def allows_clock_out(self):
        """Check if current time allows clock-out (after shift start)"""
        now = timezone.now()
        return self.start_time <= now

    @classmethod
    def get_current_shift(cls, employee):
        """Get the current active shift for an employee"""
        now = timezone.now()
        return cls.objects.filter(
            employee=employee,
            start_time__lte=now,
            end_time__gte=now,
            is_published=True
        ).first()

    @classmethod
    def get_upcoming_shift(cls, employee, within_minutes=15):
        """Get the next upcoming shift for an employee within specified minutes"""
        now = timezone.now()
        upcoming_window = now + timedelta(minutes=within_minutes)
        return cls.objects.filter(
            employee=employee,
            start_time__gt=now,
            start_time__lte=upcoming_window,
            is_published=True
        ).first()

    @classmethod
    def get_clockin_eligible_shift(cls, employee):
        """Get shift that allows clock-in (current or upcoming within 15 minutes)"""
        current_shift = cls.get_current_shift(employee)
        if current_shift:
            return current_shift

        upcoming_shift = cls.get_upcoming_shift(employee, within_minutes=15)
        if upcoming_shift and upcoming_shift.allows_clock_in:
            return upcoming_shift

        return None

    @classmethod
    def get_clockout_eligible_shift(cls, employee):
        """Get shift that allows clock-out (must be currently active)"""
        return cls.get_current_shift(employee)

    def clean(self):
        """Validate shift data"""
        if self.start_time and self.end_time:
            # Validate end time is after start time
            if self.end_time <= self.start_time:
                raise ValidationError('End time must be after start time')
            
            # Validate shift duration (not more than 24 hours)
            duration_hours = self.duration_hours
            if duration_hours and duration_hours > 24:
                raise ValidationError('Shift duration cannot exceed 24 hours')
            
            # Check for overlapping shifts for the same employee
            overlapping_shifts = Shift.objects.filter(
                employee=self.employee,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time
            ).exclude(id=self.id)
            
            if overlapping_shifts.exists():
                overlapping_shift = overlapping_shifts.first()
                raise ValidationError(
                    f'Shift overlaps with existing shift from '
                    f'{overlapping_shift.start_time.strftime("%Y-%m-%d %H:%M")} to '
                    f'{overlapping_shift.end_time.strftime("%Y-%m-%d %H:%M")}'
                )
    
    def save(self, *args, **kwargs):
        """Override save to run validation"""
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.start_time.date()} ({self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')})"
    
    class Meta:
        db_table = 'shifts'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['employee', 'start_time']),
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['is_published']),
            models.Index(fields=['location']),
        ]


class ShiftTemplate(models.Model):
    """Template for recurring shifts"""
    
    RECURRENCE_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('BIWEEKLY', 'Bi-weekly'),
        ('MONTHLY', 'Monthly'),
    ]
    
    WEEKDAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="Template name (e.g., 'Morning Shift', 'Weekend Coverage')")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shift_templates')
    location = models.CharField(max_length=200, blank=True, help_text="Work location (free text)")
    
    # Time settings
    start_time = models.TimeField(help_text="Daily start time")
    end_time = models.TimeField(help_text="Daily end time")
    
    # Recurrence settings
    recurrence_type = models.CharField(max_length=20, choices=RECURRENCE_CHOICES, default='WEEKLY')
    weekdays = models.JSONField(
        default=list, 
        help_text="List of weekday numbers (0=Monday, 6=Sunday) for weekly recurrence"
    )
    
    # Active period
    effective_from = models.DateField(help_text="When this template becomes active")
    effective_until = models.DateField(null=True, blank=True, help_text="When this template expires (optional)")
    
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} - {self.employee.employee_id}"
    
    class Meta:
        db_table = 'shift_templates'
        ordering = ['name']
