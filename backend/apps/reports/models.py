"""
Reports models for WorkSync
"""
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from apps.employees.models import Employee


class ReportTemplate(models.Model):
    """Template for generating reports"""
    REPORT_TYPE_CHOICES = [
        ('LATE_ARRIVAL', 'Late Arrival Report'),
        ('OVERTIME', 'Overtime Report'),
        ('DEPARTMENT_SUMMARY', 'Department Summary'),
        ('ATTENDANCE_SUMMARY', 'Attendance Summary'),
        ('BREAK_COMPLIANCE', 'Break Compliance Report'),
        ('DETAILED_TIMESHEET', 'Detailed Timesheet'),
        ('CUSTOM', 'Custom Report'),
    ]
    
    FORMAT_CHOICES = [
        ('CSV', 'CSV Export'),
        ('PDF', 'PDF Export'),
        ('JSON', 'JSON Data'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='CSV')
    
    # Report configuration
    config = models.JSONField(default=dict, help_text="Report configuration parameters")
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_report_templates')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.get_report_type_display()})"

    def generate_report(self, filters=None):
        """Generate report based on template configuration"""
        # This is a placeholder - actual implementation would depend on report type
        return {
            'status': 'success',
            'message': f'Report {self.name} generated successfully',
            'data': [],
            'filters': filters or {}
        }
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['report_type']),
            models.Index(fields=['created_by']),
        ]


class ReportExecution(models.Model):
    """Track report execution history"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='executions')
    
    # Execution parameters
    start_date = models.DateField()
    end_date = models.DateField()
    filters = models.JSONField(default=dict, help_text="Additional filters applied")
    
    # Execution status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    progress = models.IntegerField(default=0, help_text="Progress percentage (0-100)")
    
    # Results
    file_path = models.CharField(max_length=500, blank=True, help_text="Path to generated report file")
    file_size = models.BigIntegerField(null=True, blank=True, help_text="File size in bytes")
    record_count = models.IntegerField(null=True, blank=True, help_text="Number of records in report")
    
    # Error handling
    error_message = models.TextField(blank=True)
    
    # Metadata
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requested_reports')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    @property
    def duration_seconds(self):
        """Calculate execution duration in seconds"""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds())
        return None
    
    @property
    def is_expired(self):
        """Check if report file has expired (older than 7 days)"""
        if self.completed_at:
            expiry_date = self.completed_at + timezone.timedelta(days=7)
            return timezone.now() > expiry_date
        return False
    
    def __str__(self):
        return f"{self.template.name} - {self.start_date} to {self.end_date}"
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['template', 'status']),
            models.Index(fields=['requested_by', '-created_at']),
            models.Index(fields=['start_date', 'end_date']),
        ]


class ReportSchedule(models.Model):
    """Schedule automatic report generation"""
    FREQUENCY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='schedules')
    name = models.CharField(max_length=100)
    
    # Schedule configuration
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    day_of_week = models.IntegerField(null=True, blank=True, help_text="Day of week for weekly reports (0=Monday)")
    day_of_month = models.IntegerField(null=True, blank=True, help_text="Day of month for monthly reports")
    time_of_day = models.TimeField(default='09:00:00', help_text="Time to generate report")
    
    # Recipients
    recipients = models.JSONField(default=list, help_text="List of email addresses to send report to")
    
    # Status
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_report_schedules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()})"
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active', 'next_run']),
            models.Index(fields=['template']),
        ]
