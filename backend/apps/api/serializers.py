"""
Serializers for external API integration
"""
from rest_framework import serializers
from apps.employees.models import Employee
from apps.attendance.models import TimeLog
from django.utils import timezone


class ClockInSerializer(serializers.Serializer):
    """Serializer for clock-in API endpoint"""
    employee_id = serializers.CharField(max_length=20, help_text="Unique employee identifier")
    timestamp = serializers.DateTimeField(default=timezone.now, help_text="Clock-in timestamp (ISO 8601 format)")
    location_id = serializers.CharField(max_length=100, required=False, help_text="Optional location identifier")
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, help_text="GPS latitude")
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, help_text="GPS longitude")
    notes = serializers.CharField(max_length=500, required=False, help_text="Optional notes")
    
    def validate_employee_id(self, value):
        """Validate that employee exists and is active"""
        try:
            employee = Employee.objects.get(employee_id=value, employment_status='ACTIVE')
            return value
        except Employee.DoesNotExist:
            raise serializers.ValidationError(f"Employee with ID '{value}' not found or inactive")
    
    def validate_timestamp(self, value):
        """Validate timestamp is not in the future"""
        if value > timezone.now():
            raise serializers.ValidationError("Clock-in time cannot be in the future")
        return value


class ClockOutSerializer(serializers.Serializer):
    """Serializer for clock-out API endpoint"""
    employee_id = serializers.CharField(max_length=20, help_text="Unique employee identifier")
    timestamp = serializers.DateTimeField(default=timezone.now, help_text="Clock-out timestamp (ISO 8601 format)")
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, help_text="GPS latitude")
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, help_text="GPS longitude")
    notes = serializers.CharField(max_length=500, required=False, help_text="Optional notes")
    
    def validate_employee_id(self, value):
        """Validate that employee exists and is active"""
        try:
            employee = Employee.objects.get(employee_id=value, employment_status='ACTIVE')
            return value
        except Employee.DoesNotExist:
            raise serializers.ValidationError(f"Employee with ID '{value}' not found or inactive")
    
    def validate_timestamp(self, value):
        """Validate timestamp is not in the future"""
        if value > timezone.now():
            raise serializers.ValidationError("Clock-out time cannot be in the future")
        return value


class TimeLogResponseSerializer(serializers.ModelSerializer):
    """Serializer for time log responses"""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)
    work_date = serializers.DateField(read_only=True)
    
    class Meta:
        model = TimeLog
        fields = [
            'id', 'employee_name', 'clock_in_time', 'clock_out_time',
            'duration_minutes', 'duration_hours', 'work_date', 'status',
            'clock_in_method', 'clock_out_method', 'notes'
        ]
        read_only_fields = ['id']


class EmployeeStatusSerializer(serializers.ModelSerializer):
    """Serializer for employee status information"""
    full_name = serializers.CharField(read_only=True)
    current_status = serializers.SerializerMethodField()
    current_time_log = TimeLogResponseSerializer(read_only=True)
    
    class Meta:
        model = Employee
        fields = [
            'employee_id', 'full_name', 'employment_status', 
            'current_status', 'current_time_log'
        ]
    
    def get_current_status(self, obj):
        """Get current work status of employee"""
        current_log = TimeLog.objects.filter(
            employee=obj,
            clock_out_time__isnull=True
        ).first()
        
        if current_log:
            return current_log.status
        return 'CLOCKED_OUT'


class WebhookSubscriptionSerializer(serializers.Serializer):
    """Serializer for webhook subscription"""
    event_type = serializers.CharField(max_length=50, help_text="Type of event to subscribe to")
    target_url = serializers.URLField(help_text="URL to send webhook notifications")
    is_active = serializers.BooleanField(default=True)
    
    def validate_event_type(self, value):
        """Validate event type"""
        valid_events = [
            'overtime.threshold.reached',
            'attendance.violation',
            'employee.clocked_in',
            'employee.clocked_out',
            'break.started',
            'break.ended'
        ]
        
        if value not in valid_events:
            raise serializers.ValidationError(f"Invalid event type. Valid options: {', '.join(valid_events)}")
        
        return value
