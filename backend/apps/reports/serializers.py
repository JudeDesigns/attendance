"""
Reports serializers for WorkSync
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ReportTemplate, ReportExecution, ReportSchedule


class ReportTemplateSerializer(serializers.ModelSerializer):
    """Serializer for report templates"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    execution_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'name', 'description', 'report_type', 'format',
            'config', 'created_by', 'created_by_name', 'is_active',
            'execution_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_execution_count(self, obj):
        """Get number of times this template has been executed"""
        return obj.executions.count()


class ReportExecutionSerializer(serializers.ModelSerializer):
    """Serializer for report executions"""
    template_name = serializers.CharField(source='template.name', read_only=True)
    template_type = serializers.CharField(source='template.get_report_type_display', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    duration_seconds = serializers.IntegerField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ReportExecution
        fields = [
            'id', 'template', 'template_name', 'template_type',
            'start_date', 'end_date', 'filters', 'status', 'progress',
            'file_path', 'file_size', 'record_count', 'error_message',
            'requested_by', 'requested_by_name', 'duration_seconds',
            'is_expired', 'started_at', 'completed_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'status', 'progress', 'file_path', 'file_size',
            'record_count', 'error_message', 'requested_by',
            'started_at', 'completed_at', 'created_at'
        ]


class ReportScheduleSerializer(serializers.ModelSerializer):
    """Serializer for report schedules"""
    template_name = serializers.CharField(source='template.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = ReportSchedule
        fields = [
            'id', 'template', 'template_name', 'name', 'frequency',
            'day_of_week', 'day_of_month', 'time_of_day', 'recipients',
            'is_active', 'last_run', 'next_run', 'created_by',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'last_run', 'next_run', 'created_by', 'created_at', 'updated_at'
        ]


class ReportGenerationSerializer(serializers.Serializer):
    """Serializer for generating reports on-demand"""
    template_id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    format = serializers.ChoiceField(
        choices=['CSV', 'PDF', 'JSON'],
        default='CSV'
    )
    filters = serializers.JSONField(required=False, default=dict)
    
    def validate(self, data):
        """Validate report generation parameters"""
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError("Start date must be before end date")
        
        # Validate date range (max 1 year)
        date_diff = data['end_date'] - data['start_date']
        if date_diff.days > 365:
            raise serializers.ValidationError("Date range cannot exceed 1 year")
        
        return data


class LateArrivalReportSerializer(serializers.Serializer):
    """Serializer for late arrival report data"""
    employee_id = serializers.CharField()
    employee_name = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    date = serializers.DateField()
    scheduled_time = serializers.TimeField()
    actual_time = serializers.TimeField()
    minutes_late = serializers.IntegerField()
    location = serializers.CharField(allow_blank=True)


class OvertimeReportSerializer(serializers.Serializer):
    """Serializer for overtime report data"""
    employee_id = serializers.CharField()
    employee_name = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    date = serializers.DateField()
    regular_hours = serializers.FloatField()
    overtime_hours = serializers.FloatField()
    total_hours = serializers.FloatField()
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    overtime_pay = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)


class DepartmentSummarySerializer(serializers.Serializer):
    """Serializer for department summary report data"""
    department = serializers.CharField()
    employee_count = serializers.IntegerField()
    total_hours = serializers.FloatField()
    average_hours_per_employee = serializers.FloatField()
    late_arrivals = serializers.IntegerField()
    overtime_hours = serializers.FloatField()
    attendance_rate = serializers.FloatField()


class AttendanceSummaryReportSerializer(serializers.Serializer):
    """Serializer for attendance summary report data"""
    employee_id = serializers.CharField()
    employee_name = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    total_days_worked = serializers.IntegerField()
    total_hours = serializers.FloatField()
    average_hours_per_day = serializers.FloatField()
    late_arrivals = serializers.IntegerField()
    overtime_days = serializers.IntegerField()
    break_compliance_rate = serializers.FloatField()


class ReportStatsSerializer(serializers.Serializer):
    """Serializer for report statistics"""
    total_reports = serializers.IntegerField()
    reports_this_month = serializers.IntegerField()
    most_popular_type = serializers.CharField()
    average_generation_time = serializers.FloatField()
    total_file_size = serializers.IntegerField()
    active_schedules = serializers.IntegerField()
