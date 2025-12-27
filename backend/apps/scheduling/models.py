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
            # Handle overnight shifts
            if self.end_time <= self.start_time:
                delta = (self.end_time + timedelta(days=1)) - self.start_time
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

        # Handle overnight shifts
        if self.end_time <= self.start_time:
            # Overnight shift - check if current time is after start OR before end (next day)
            return now >= self.start_time or now <= self.end_time
        else:
            # Regular shift - normal time range check
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

        # Handle overnight shifts
        if self.end_time <= self.start_time:
            # Overnight shift - allow clock-in if within window before start OR during shift
            return (now >= clock_in_window_start) or (now <= self.end_time)
        else:
            # Regular shift - normal time range check
            return clock_in_window_start <= now <= self.end_time

    @property
    def allows_clock_out(self):
        """Check if current time allows clock-out (after shift start)"""
        now = timezone.now()

        # Handle overnight shifts
        if self.end_time <= self.start_time:
            # Overnight shift - allow clock-out if after start OR before end (next day)
            return now >= self.start_time or now <= self.end_time
        else:
            # Regular shift - allow clock-out after shift start
            return self.start_time <= now

    @classmethod
    def get_current_shift(cls, employee):
        """Get the current active shift for an employee"""
        now = timezone.now()

        # Get all published shifts for the employee
        shifts = cls.objects.filter(
            employee=employee,
            is_published=True
        )

        # Check each shift to see if it's currently active
        for shift in shifts:
            if shift.is_current:
                return shift

        return None

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
            # Handle overnight shifts - if end_time is "earlier" than start_time,
            # it means the shift crosses midnight and end_time is the next day
            duration = self.end_time - self.start_time
            if self.end_time <= self.start_time:
                # This is an overnight shift - add 24 hours to calculate duration
                duration = (self.end_time + timedelta(days=1)) - self.start_time

            # Validate shift duration (not more than 24 hours)
            duration_hours = duration.total_seconds() / 3600
            if duration_hours > 24:
                raise ValidationError('Shift duration cannot exceed 24 hours')
            
            # Check for overlapping shifts for the same employee
            # We need custom logic to handle overnight shifts properly
            existing_shifts = Shift.objects.filter(
                employee=self.employee
            ).exclude(id=self.id)
            
            for existing_shift in existing_shifts:
                # Check if the new shift overlaps with this existing shift
                # We need to handle 4 cases:
                # 1. Both shifts are regular (same day or end_time > start_time normally)
                # 2. New shift is overnight, existing is regular
                # 3. New shift is regular, existing is overnight
                # 4. Both shifts are overnight
                
                # An overnight shift crosses midnight: end_time is next day AND time is earlier
                new_is_overnight = (self.end_time.date() > self.start_time.date() and 
                                   self.end_time.time() < self.start_time.time())
                existing_is_overnight = (existing_shift.end_time.date() > existing_shift.start_time.date() and
                                        existing_shift.end_time.time() < existing_shift.start_time.time())
                
                overlaps = False
                
                if not new_is_overnight and not existing_is_overnight:
                    # Case 1: Both regular shifts - standard overlap check
                    overlaps = (self.start_time < existing_shift.end_time and 
                               self.end_time > existing_shift.start_time)
                
                elif new_is_overnight and not existing_is_overnight:
                    # Case 2: New shift is overnight, existing is regular
                    # New shift spans two days: [start_time on day1] to [end_time on day2]
                    # Existing shift is on one day
                    # They overlap if:
                    # - Existing shift is on day1 and overlaps with first part (after new start), OR
                    # - Existing shift is on day2 and overlaps with second part (before new end)
                    existing_on_day1 = existing_shift.start_time.date() == self.start_time.date()
                    existing_on_day2 = existing_shift.end_time.date() == self.end_time.date()
                    
                    if existing_on_day1:
                        overlaps = existing_shift.end_time > self.start_time
                    elif existing_on_day2:
                        overlaps = existing_shift.start_time < self.end_time
                
                elif not new_is_overnight and existing_is_overnight:
                    # Case 3: New shift is regular, existing is overnight
                    # Existing shift spans two days: [start_time on day1] to [end_time on day2]
                    # New shift is on one day
                    # They overlap if:
                    # - New shift is on day1 and overlaps with first part (after existing start), OR
                    # - New shift is on day2 and overlaps with second part (before existing end)
                    new_on_day1 = self.start_time.date() == existing_shift.start_time.date()
                    new_on_day2 = self.end_time.date() == existing_shift.end_time.date()
                    
                    if new_on_day1:
                        overlaps = self.end_time > existing_shift.start_time
                    elif new_on_day2:
                        overlaps = self.start_time < existing_shift.end_time
                
                else:
                    # Case 4: Both shifts are overnight
                    # Two overnight shifts will always overlap since they both span midnight
                    # Unless they're on completely different days
                    # Check if they're on the same day or consecutive days
                    overlaps = (self.start_time.date() == existing_shift.start_time.date() or
                               self.end_time.date() == existing_shift.end_time.date())
                
                if overlaps:
                    raise ValidationError(
                        f'Shift overlaps with existing shift from '
                        f'{existing_shift.start_time.strftime("%Y-%m-%d %H:%M")} to '
                        f'{existing_shift.end_time.strftime("%Y-%m-%d %H:%M")}'
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
