"""
Simple Attendance models for WorkSync
"""
from django.db import models
from apps.employees.models_simple import Employee, Location
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
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def duration_minutes(self):
        """Calculate duration in minutes"""
        if self.clock_out_time:
            delta = self.clock_out_time - self.clock_in_time
            return int(delta.total_seconds() / 60)
        return None
    
    @property
    def duration_hours(self):
        """Calculate duration in hours"""
        minutes = self.duration_minutes
        return round(minutes / 60, 2) if minutes else None
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.clock_in_time.date()}"
    
    class Meta:
        ordering = ['-clock_in_time']
