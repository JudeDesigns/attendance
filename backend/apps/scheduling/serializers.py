"""
Scheduling serializers with validation and conflict detection
"""
from rest_framework import serializers
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from datetime import datetime, timedelta
from .models import Shift, ShiftTemplate
from .leave_models import LeaveType, LeaveBalance, LeaveRequest, LeaveApprovalWorkflow
from apps.employees.models import Employee, Location
from apps.employees.serializers import EmployeeSerializer, LocationSerializer


class ShiftSerializer(serializers.ModelSerializer):
    """Shift serializer with calculated fields"""
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    is_current = serializers.BooleanField(read_only=True)
    is_future = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)

    def get_employee_name(self, obj):
        """Get employee name with fallback to employee_id if name is empty"""
        full_name = obj.employee.user.get_full_name().strip()
        if full_name:
            return full_name
        # Fallback to employee_id if name is empty
        return obj.employee.employee_id

    class Meta:
        model = Shift
        fields = [
            'id', 'employee', 'employee_name', 'employee_id',
            'location', 'start_time', 'end_time',
            'duration_minutes', 'duration_hours', 'notes', 'is_published',
            'is_past', 'is_current', 'is_future',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShiftCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating shifts with validation"""
    
    class Meta:
        model = Shift
        fields = [
            'employee', 'location', 'start_time', 'end_time', 
            'notes', 'is_published'
        ]
    
    def validate(self, data):
        """Validate shift data"""
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        employee = data.get('employee')
        
        if start_time and end_time:
            # Validate end time is after start time
            if end_time <= start_time:
                raise serializers.ValidationError('End time must be after start time')
            
            # Validate shift duration (not more than 24 hours)
            duration = end_time - start_time
            if duration.total_seconds() > 24 * 3600:
                raise serializers.ValidationError('Shift duration cannot exceed 24 hours')
            
            # Check for overlapping shifts for the same employee
            if employee:
                overlapping_shifts = Shift.objects.filter(
                    employee=employee,
                    start_time__lt=end_time,
                    end_time__gt=start_time
                )
                
                # Exclude current shift if updating
                if self.instance:
                    overlapping_shifts = overlapping_shifts.exclude(id=self.instance.id)
                
                if overlapping_shifts.exists():
                    overlapping_shift = overlapping_shifts.first()
                    raise serializers.ValidationError(
                        f'Shift overlaps with existing shift from '
                        f'{overlapping_shift.start_time.strftime("%Y-%m-%d %H:%M")} to '
                        f'{overlapping_shift.end_time.strftime("%Y-%m-%d %H:%M")}'
                    )
        
        return data
    
    def validate_employee(self, value):
        """Validate employee exists and is active"""
        if value.employment_status != 'ACTIVE':
            raise serializers.ValidationError('Cannot schedule shifts for inactive employees')
        return value
    
    def validate_location(self, value):
        """Validate location text"""
        # Location is now a text field, so just validate length
        if value and len(value.strip()) > 200:
            raise serializers.ValidationError('Location name cannot exceed 200 characters')
        return value.strip() if value else value


class ShiftUpdateSerializer(ShiftCreateSerializer):
    """Serializer for updating shifts"""
    
    class Meta(ShiftCreateSerializer.Meta):
        fields = ShiftCreateSerializer.Meta.fields + ['is_published']


class ShiftBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating shifts"""
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(employment_status='ACTIVE'))
    location = serializers.CharField(max_length=200, required=False, allow_blank=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    weekdays = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        help_text="List of weekday numbers (0=Monday, 6=Sunday)"
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    is_published = serializers.BooleanField(default=False)
    
    def validate(self, data):
        """Validate bulk create data"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if start_date and end_date:
            if end_date < start_date:
                raise serializers.ValidationError('End date must be after start date')
            
            # Limit bulk creation to reasonable timeframe (e.g., 3 months)
            if (end_date - start_date).days > 90:
                raise serializers.ValidationError('Bulk creation limited to 90 days maximum')
        
        if start_time and end_time:
            # Create datetime objects for comparison
            today = timezone.now().date()
            start_datetime = timezone.make_aware(datetime.combine(today, start_time))
            end_datetime = timezone.make_aware(datetime.combine(today, end_time))
            
            # Handle overnight shifts
            if end_time <= start_time:
                end_datetime += timedelta(days=1)
            
            duration = end_datetime - start_datetime
            if duration.total_seconds() > 24 * 3600:
                raise serializers.ValidationError('Shift duration cannot exceed 24 hours')
        
        weekdays = data.get('weekdays', [])
        if not weekdays:
            raise serializers.ValidationError('At least one weekday must be selected')
        
        return data


class SpreadsheetImportSerializer(serializers.Serializer):
    """Serializer for importing shifts from spreadsheet"""
    shifts = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of shift dictionaries from spreadsheet"
    )

    def validate_shifts(self, shifts):
        """Validate each shift in the list"""
        validated_shifts = []

        for i, shift_data in enumerate(shifts):
            try:
                # Validate required fields
                if 'employee' not in shift_data:
                    raise serializers.ValidationError(f"Shift {i+1}: employee is required")
                if 'date' not in shift_data:
                    raise serializers.ValidationError(f"Shift {i+1}: date is required")

                # Validate employee exists
                try:
                    employee = Employee.objects.get(id=shift_data['employee'])
                except Employee.DoesNotExist:
                    raise serializers.ValidationError(f"Shift {i+1}: employee not found")

                # Validate date format
                try:
                    from datetime import datetime
                    datetime.strptime(shift_data['date'], '%Y-%m-%d')
                except ValueError:
                    raise serializers.ValidationError(f"Shift {i+1}: invalid date format")

                # Validate times if provided
                if 'start_time' in shift_data and shift_data['start_time']:
                    try:
                        datetime.strptime(shift_data['start_time'], '%H:%M')
                    except ValueError:
                        raise serializers.ValidationError(f"Shift {i+1}: invalid start_time format")

                if 'end_time' in shift_data and shift_data['end_time']:
                    try:
                        datetime.strptime(shift_data['end_time'], '%H:%M')
                    except ValueError:
                        raise serializers.ValidationError(f"Shift {i+1}: invalid end_time format")

                validated_shifts.append(shift_data)

            except Exception as e:
                raise serializers.ValidationError(f"Shift {i+1}: {str(e)}")

        return validated_shifts


class ShiftTemplateSerializer(serializers.ModelSerializer):
    """Shift template serializer"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = ShiftTemplate
        fields = [
            'id', 'name', 'employee', 'employee_name', 'employee_id',
            'location', 'location_name', 'start_time', 'end_time',
            'recurrence_type', 'weekdays', 'effective_from', 'effective_until',
            'is_active', 'notes', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validate template data"""
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        effective_from = data.get('effective_from')
        effective_until = data.get('effective_until')
        
        if start_time and end_time:
            # For templates, we allow overnight shifts
            if start_time == end_time:
                raise serializers.ValidationError('Start time and end time cannot be the same')
        
        if effective_from and effective_until:
            if effective_until <= effective_from:
                raise serializers.ValidationError('Effective until date must be after effective from date')
        
        recurrence_type = data.get('recurrence_type')
        weekdays = data.get('weekdays', [])
        
        if recurrence_type == 'WEEKLY' and not weekdays:
            raise serializers.ValidationError('Weekdays must be specified for weekly recurrence')
        
        return data


class MyScheduleSerializer(serializers.Serializer):
    """Serializer for employee's schedule view"""
    date = serializers.DateField()
    shifts = ShiftSerializer(many=True, read_only=True)
    total_hours = serializers.FloatField(read_only=True)
    shift_count = serializers.IntegerField(read_only=True)


# Leave Management Serializers

class LeaveTypeSerializer(serializers.ModelSerializer):
    """Leave type serializer"""

    class Meta:
        model = LeaveType
        fields = [
            'id', 'name', 'display_name', 'description', 'is_paid',
            'requires_approval', 'max_consecutive_days', 'min_notice_days',
            'max_advance_days', 'annual_allocation', 'carry_over_allowed',
            'max_carry_over_days', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LeaveBalanceSerializer(serializers.ModelSerializer):
    """Leave balance serializer with calculated fields"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.display_name', read_only=True)
    available_days = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    total_allocated = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            'id', 'employee', 'employee_name', 'leave_type', 'leave_type_name',
            'year', 'allocated_days', 'used_days', 'pending_days', 'carried_over_days',
            'available_days', 'total_allocated', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee_name', 'leave_type_name', 'available_days', 'total_allocated', 'created_at', 'updated_at']


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Leave request serializer with validation"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.display_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    duration_days = serializers.IntegerField(read_only=True)
    can_be_cancelled = serializers.BooleanField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'employee_name', 'leave_type', 'leave_type_name',
            'start_date', 'end_date', 'days_requested', 'reason', 'notes',
            'status', 'submitted_at', 'approved_by', 'approved_by_name',
            'approved_at', 'rejection_reason', 'emergency_contact',
            'emergency_phone', 'attachment', 'duration_days', 'can_be_cancelled',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'employee', 'employee_name', 'leave_type_name', 'days_requested',
            'approved_by_name', 'duration_days', 'can_be_cancelled',
            'submitted_at', 'created_at', 'updated_at'
        ]

    def validate(self, data):
        """Validate leave request"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        leave_type = data.get('leave_type')
        employee = data.get('employee')

        # If employee is not in data, try to get it from context (for perform_create)
        if not employee and hasattr(self, 'context') and 'request' in self.context:
            request = self.context['request']
            if hasattr(request.user, 'employee_profile'):
                employee = request.user.employee_profile

        if start_date and end_date:
            if start_date > end_date:
                raise serializers.ValidationError("Start date cannot be after end date")

            # Check for overlapping leave requests
            if employee:
                overlapping = LeaveRequest.objects.filter(
                    employee=employee,
                    status__in=['PENDING', 'APPROVED'],
                    start_date__lte=end_date,
                    end_date__gte=start_date
                )

                # Exclude current instance if updating
                if self.instance:
                    overlapping = overlapping.exclude(id=self.instance.id)

                if overlapping.exists():
                    raise serializers.ValidationError("You have overlapping leave requests")

            # Check leave balance
            if employee and leave_type:
                days_requested = (end_date - start_date).days + 1
                try:
                    balance = LeaveBalance.objects.get(
                        employee=employee,
                        leave_type=leave_type,
                        year=start_date.year
                    )
                    if balance.available_days < days_requested:
                        raise serializers.ValidationError(
                            f"Insufficient leave balance. Available: {balance.available_days} days, Requested: {days_requested} days"
                        )
                except LeaveBalance.DoesNotExist:
                    # Create balance if it doesn't exist
                    LeaveBalance.objects.create(
                        employee=employee,
                        leave_type=leave_type,
                        year=start_date.year,
                        allocated_days=leave_type.annual_allocation
                    )

        return data

    def create(self, validated_data):
        """Create leave request and update balance"""
        leave_request = super().create(validated_data)
        leave_request._update_leave_balance('submit')
        return leave_request


class LeaveApprovalWorkflowSerializer(serializers.ModelSerializer):
    """Leave approval workflow serializer"""
    leave_type_name = serializers.CharField(source='leave_type.display_name', read_only=True)
    approver_names = serializers.SerializerMethodField()

    def get_approver_names(self, obj):
        return [user.get_full_name() for user in obj.approvers.all()]

    class Meta:
        model = LeaveApprovalWorkflow
        fields = [
            'id', 'leave_type', 'leave_type_name', 'min_days_threshold',
            'max_days_threshold', 'approvers', 'approver_names',
            'requires_all_approvers', 'auto_approve', 'auto_approve_conditions',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'leave_type_name', 'approver_names', 'created_at', 'updated_at']
