"""
Attendance serializers with validation and security
"""
from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import TimeLog, Break
from apps.employees.models import Employee, Location
from apps.employees.serializers import EmployeeSerializer, LocationSerializer
from apps.core.timezone_utils import convert_to_naive_la_time


class TimeLogSerializer(serializers.ModelSerializer):
    """TimeLog serializer with calculated fields"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    clock_in_location_name = serializers.CharField(source='clock_in_location.name', read_only=True, allow_null=True)
    clock_out_location_name = serializers.CharField(source='clock_out_location.name', read_only=True, allow_null=True)
    duration_minutes = serializers.SerializerMethodField()
    duration_hours = serializers.SerializerMethodField()
    attendance_status = serializers.SerializerMethodField()
    scheduled_shift_id = serializers.SerializerMethodField()
    is_shift_compliant = serializers.SerializerMethodField()

    def get_duration_minutes(self, obj):
        """Calculate duration in minutes, including current time for active logs"""
        if obj.clock_out_time:
            # Completed log - use actual duration
            delta = obj.clock_out_time - obj.clock_in_time
            return int(delta.total_seconds() / 60)
        else:
            # Active log - calculate current duration
            from django.utils import timezone
            delta = timezone.now() - obj.clock_in_time
            return int(delta.total_seconds() / 60)

    def get_duration_hours(self, obj):
        """Calculate duration in hours, including current time for active logs"""
        minutes = self.get_duration_minutes(obj)
        return round(minutes / 60, 2) if minutes else 0

    def get_attendance_status(self, obj):
        """Get attendance status based on shift compliance"""
        return obj.attendance_status

    def get_scheduled_shift_id(self, obj):
        """Get the ID of the scheduled shift for this time log"""
        shift = obj.scheduled_shift
        return str(shift.id) if shift else None

    def get_is_shift_compliant(self, obj):
        """Check if this time log is compliant with scheduled shift"""
        return obj.is_shift_compliant

    def to_representation(self, instance):
        """
        Convert timezone-aware datetimes to naive LA time before sending to frontend.
        This prevents the browser from doing additional timezone conversions.
        """
        representation = super().to_representation(instance)

        # Convert clock_in_time to naive LA time
        if representation.get('clock_in_time'):
            representation['clock_in_time'] = convert_to_naive_la_time(instance.clock_in_time)

        # Convert clock_out_time to naive LA time
        if representation.get('clock_out_time'):
            representation['clock_out_time'] = convert_to_naive_la_time(instance.clock_out_time)

        # Convert created_at to naive LA time
        if representation.get('created_at'):
            representation['created_at'] = convert_to_naive_la_time(instance.created_at)

        # Convert updated_at to naive LA time
        if representation.get('updated_at'):
            representation['updated_at'] = convert_to_naive_la_time(instance.updated_at)

        return representation

    class Meta:
        model = TimeLog
        fields = [
            'id', 'employee', 'employee_name', 'employee_id',
            'clock_in_time', 'clock_out_time',
            'clock_in_location', 'clock_in_location_name',
            'clock_out_location', 'clock_out_location_name',
            'clock_in_method', 'clock_out_method',
            'clock_in_latitude', 'clock_in_longitude',
            'clock_out_latitude', 'clock_out_longitude',
            'status', 'notes', 'duration_minutes', 'duration_hours',
            'attendance_status', 'scheduled_shift_id', 'is_shift_compliant',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'status']


class ClockInSerializer(serializers.Serializer):
    """Serializer for clock-in action"""
    location_id = serializers.UUIDField(required=False, allow_null=True)
    method = serializers.ChoiceField(
        choices=['PORTAL', 'QR_CODE', 'API'],
        default='PORTAL'
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    # GPS coordinates (optional)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    
    def validate_location_id(self, value):
        """Validate location exists and is active"""
        if value:
            try:
                location = Location.objects.get(id=value)
                if not location.is_active:
                    raise serializers.ValidationError("This location is not active")
                return value
            except Location.DoesNotExist:
                raise serializers.ValidationError("Location not found")
        return value
    
    def validate(self, data):
        """Validate clock-in request"""
        # Check if employee already has an active clock-in
        employee = self.context['employee']
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if active_log:
            raise serializers.ValidationError({
                'detail': 'You are already clocked in',
                'clock_in_time': active_log.clock_in_time,
                'location': active_log.clock_in_location.name if active_log.clock_in_location else None
            })

        # Validate geofencing if location requires GPS verification
        location_id = data.get('location_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if location_id:
            try:
                location = Location.objects.get(id=location_id)
                if hasattr(location, 'requires_gps_verification') and location.requires_gps_verification:
                    if not latitude or not longitude:
                        raise serializers.ValidationError({
                            'gps': 'GPS coordinates are required for this location'
                        })

                    # Create a temporary TimeLog instance to use geofencing validation
                    temp_log = TimeLog()
                    if not temp_log.is_within_geofence(latitude, longitude, location):
                        raise serializers.ValidationError({
                            'gps': f'You are not within the required area for {location.name}. '
                                   f'Please move closer to the location and try again.'
                        })
            except Location.DoesNotExist:
                pass  # Already validated in validate_location_id

        return data


class ClockOutSerializer(serializers.Serializer):
    """Serializer for clock-out action"""
    location_id = serializers.UUIDField(required=False, allow_null=True)
    method = serializers.ChoiceField(
        choices=['PORTAL', 'QR_CODE', 'API'],
        default='PORTAL'
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    # GPS coordinates (optional)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    
    def validate_location_id(self, value):
        """Validate location exists and is active"""
        if value:
            try:
                location = Location.objects.get(id=value)
                if not location.is_active:
                    raise serializers.ValidationError("This location is not active")
                return value
            except Location.DoesNotExist:
                raise serializers.ValidationError("Location not found")
        return value
    
    def validate(self, data):
        """Validate clock-out request"""
        # Check if employee has an active clock-in
        employee = self.context['employee']
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if not active_log:
            raise serializers.ValidationError({
                'detail': 'You are not currently clocked in'
            })

        # Validate geofencing if location requires GPS verification
        location_id = data.get('location_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if location_id:
            try:
                location = Location.objects.get(id=location_id)
                if hasattr(location, 'requires_gps_verification') and location.requires_gps_verification:
                    if not latitude or not longitude:
                        raise serializers.ValidationError({
                            'gps': 'GPS coordinates are required for this location'
                        })

                    # Create a temporary TimeLog instance to use geofencing validation
                    temp_log = TimeLog()
                    if not temp_log.is_within_geofence(latitude, longitude, location):
                        raise serializers.ValidationError({
                            'gps': f'You are not within the required area for {location.name}. '
                                   f'Please move closer to the location and try again.'
                        })
            except Location.DoesNotExist:
                pass  # Already validated in validate_location_id

        # Store the active log in context for use in view
        self.context['active_log'] = active_log

        return data


class QRCodeClockSerializer(serializers.Serializer):
    """Serializer for QR code clock-in/out"""
    qr_code = serializers.CharField(required=True)
    action = serializers.ChoiceField(choices=['clock_in', 'clock_out'], required=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    
    def validate_qr_code(self, value):
        """Validate QR code and get location"""
        try:
            location = Location.objects.get(qr_code_payload=value)
            if not location.is_active:
                raise serializers.ValidationError("This location is not active")
            return value
        except Location.DoesNotExist:
            raise serializers.ValidationError("Invalid QR code")
    
    def validate(self, data):
        """Validate QR code clock action"""
        employee = self.context['employee']
        action = data['action']
        
        # Get location from QR code
        location = Location.objects.get(qr_code_payload=data['qr_code'])
        data['location'] = location
        
        # Check current clock status
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()
        
        if action == 'clock_in':
            if active_log:
                raise serializers.ValidationError({
                    'detail': 'You are already clocked in',
                    'clock_in_time': active_log.clock_in_time,
                    'location': active_log.clock_in_location.name if active_log.clock_in_location else None
                })
        else:  # clock_out
            if not active_log:
                raise serializers.ValidationError({
                    'detail': 'You are not currently clocked in'
                })
            data['active_log'] = active_log
        
        return data


class TimeLogDetailSerializer(serializers.ModelSerializer):
    """Detailed TimeLog serializer with all related information"""
    employee = EmployeeSerializer(read_only=True)
    clock_in_location = LocationSerializer(read_only=True)
    clock_out_location = LocationSerializer(read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)
    
    class Meta:
        model = TimeLog
        fields = [
            'id', 'employee',
            'clock_in_time', 'clock_out_time',
            'clock_in_location', 'clock_out_location',
            'clock_in_method', 'clock_out_method',
            'status', 'notes', 'duration_minutes', 'duration_hours',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttendanceSummarySerializer(serializers.Serializer):
    """Serializer for attendance summary statistics"""
    employee_id = serializers.CharField()
    employee_name = serializers.CharField()
    total_days = serializers.IntegerField()
    total_hours = serializers.FloatField()
    average_hours_per_day = serializers.FloatField()
    earliest_clock_in = serializers.DateTimeField()
    latest_clock_out = serializers.DateTimeField()


class CurrentStatusSerializer(serializers.Serializer):
    """Serializer for current clock-in status"""
    is_clocked_in = serializers.BooleanField()
    clock_in_time = serializers.DateTimeField(allow_null=True)
    clock_in_location = serializers.CharField(allow_null=True)
    duration_minutes = serializers.IntegerField(allow_null=True)
    duration_hours = serializers.FloatField(allow_null=True)


class BreakSerializer(serializers.ModelSerializer):
    """Break serializer with calculated fields"""
    employee_name = serializers.CharField(source='time_log.employee.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='time_log.employee.employee_id', read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Break
        fields = [
            'id', 'time_log', 'employee_name', 'employee_id',
            'break_type', 'start_time', 'end_time', 'notes',
            'duration_minutes', 'duration_hours', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BreakStartSerializer(serializers.Serializer):
    """Serializer for starting a break"""
    break_type = serializers.ChoiceField(
        choices=['LUNCH', 'SHORT', 'PERSONAL'],
        help_text="Type of break being taken"
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text="Optional notes about the break"
    )

    def validate(self, data):
        """Validate break start request"""
        employee = self.context.get('employee')
        if not employee:
            raise serializers.ValidationError("Employee context is required")

        # Check if employee is currently clocked in
        active_time_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if not active_time_log:
            raise serializers.ValidationError("You must be clocked in to start a break")

        # Check if employee already has an active break
        active_break = Break.objects.filter(
            time_log=active_time_log,
            end_time__isnull=True
        ).first()

        if active_break:
            raise serializers.ValidationError(
                f"You already have an active {active_break.get_break_type_display().lower()}. "
                "Please end your current break before starting a new one."
            )

        # Store the active time log for use in the view
        self.context['active_time_log'] = active_time_log
        return data


class BreakEndSerializer(serializers.Serializer):
    """Serializer for ending a break"""
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text="Optional notes about ending the break"
    )

