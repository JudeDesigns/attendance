from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Shift, ShiftTemplate
from .leave_models import LeaveType, LeaveBalance, LeaveRequest, LeaveApprovalWorkflow


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['employee_name', 'employee_id', 'start_time', 'end_time', 'duration_hours', 'location', 'is_published', 'created_at']
    list_filter = ['is_published', 'location', 'start_time', 'created_at']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'employee__employee_id', 'location', 'notes']
    readonly_fields = ['id', 'duration_minutes', 'duration_hours', 'is_current', 'is_past', 'is_future', 'created_at', 'updated_at']
    date_hierarchy = 'start_time'
    list_per_page = 50

    fieldsets = (
        ('Shift Details', {
            'fields': ('employee', 'start_time', 'end_time', 'location', 'is_published')
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_by'),
            'classes': ('collapse',)
        }),
        ('Calculated Fields', {
            'fields': ('duration_minutes', 'duration_hours', 'is_current', 'is_past', 'is_future'),
            'classes': ('collapse',),
            'description': 'Read-only calculated fields'
        }),
        ('System Information', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}".strip() or obj.employee.user.username
    employee_name.short_description = 'Employee Name'
    employee_name.admin_order_field = 'employee__user__first_name'

    def employee_id(self, obj):
        return obj.employee.employee_id
    employee_id.short_description = 'Employee ID'
    employee_id.admin_order_field = 'employee__employee_id'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('employee__user', 'created_by')

    def save_model(self, request, obj, form, change):
        """Override save to set created_by for new shifts"""
        if not change:  # New shift
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ShiftTemplate)
class ShiftTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'employee_name', 'employee_id', 'start_time', 'end_time', 'recurrence_type', 'is_active', 'effective_from']
    list_filter = ['is_active', 'recurrence_type', 'effective_from', 'created_at']
    search_fields = ['name', 'employee__user__first_name', 'employee__user__last_name', 'employee__employee_id', 'notes']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'effective_from'

    fieldsets = (
        ('Template Details', {
            'fields': ('name', 'employee', 'location', 'is_active')
        }),
        ('Time Settings', {
            'fields': ('start_time', 'end_time')
        }),
        ('Recurrence Settings', {
            'fields': ('recurrence_type', 'weekdays', 'effective_from', 'effective_until')
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_by'),
            'classes': ('collapse',)
        }),
        ('System Information', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}".strip() or obj.employee.user.username
    employee_name.short_description = 'Employee Name'
    employee_name.admin_order_field = 'employee__user__first_name'

    def employee_id(self, obj):
        return obj.employee.employee_id
    employee_id.short_description = 'Employee ID'
    employee_id.admin_order_field = 'employee__employee_id'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('employee__user', 'created_by')

    def save_model(self, request, obj, form, change):
        """Override save to set created_by for new templates"""
        if not change:  # New template
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'name', 'annual_allocation', 'is_paid', 'requires_approval', 'carry_over_allowed', 'is_active']
    list_filter = ['is_paid', 'requires_approval', 'carry_over_allowed', 'is_active']
    search_fields = ['display_name', 'name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'display_name', 'description', 'is_active')
        }),
        ('Leave Configuration', {
            'fields': ('is_paid', 'requires_approval', 'max_consecutive_days', 'min_notice_days', 'max_advance_days')
        }),
        ('Annual Allocation', {
            'fields': ('annual_allocation', 'carry_over_allowed', 'max_carry_over_days'),
            'description': 'Configure how many days are allocated annually and carry-over rules.'
        }),
        ('System Information', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ['employee_name', 'employee_id', 'leave_type_name', 'year', 'allocated_days', 'used_days', 'pending_days', 'available_days_display', 'carried_over_days']
    list_filter = ['year', 'leave_type', 'employee__employment_status']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'employee__employee_id', 'leave_type__display_name']
    list_editable = ['allocated_days', 'carried_over_days']
    list_per_page = 50
    
    fieldsets = (
        ('Employee & Leave Type', {
            'fields': ('employee', 'leave_type', 'year')
        }),
        ('Balance Details', {
            'fields': ('allocated_days', 'used_days', 'pending_days', 'carried_over_days'),
            'description': 'Manually adjust leave balances. Used and pending days are automatically updated by the system.'
        }),
        ('Calculated Fields', {
            'fields': ('available_days_display',),
            'classes': ('collapse',),
            'description': 'Read-only calculated fields'
        })
    )
    
    readonly_fields = ['available_days_display']
    
    def employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}".strip() or obj.employee.user.username
    employee_name.short_description = 'Employee Name'
    employee_name.admin_order_field = 'employee__user__first_name'
    
    def employee_id(self, obj):
        return obj.employee.employee_id
    employee_id.short_description = 'Employee ID'
    employee_id.admin_order_field = 'employee__employee_id'
    
    def leave_type_name(self, obj):
        return obj.leave_type.display_name
    leave_type_name.short_description = 'Leave Type'
    leave_type_name.admin_order_field = 'leave_type__display_name'
    
    def available_days_display(self, obj):
        available = obj.available_days
        color = 'green' if available > 0 else 'red' if available < 0 else 'orange'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} days</span>',
            color,
            available
        )
    available_days_display.short_description = 'Available Days'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('employee__user', 'leave_type')
    
    def save_model(self, request, obj, form, change):
        """Override save to ensure balance calculations are correct"""
        super().save_model(request, obj, form, change)
        # You could add custom logic here if needed


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['employee_name', 'leave_type_name', 'start_date', 'end_date', 'days_requested', 'status', 'created_at']
    list_filter = ['status', 'leave_type', 'start_date', 'created_at']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'employee__employee_id', 'reason']
    readonly_fields = ['id', 'days_requested', 'created_at', 'updated_at', 'approved_at', 'approved_by']
    date_hierarchy = 'start_date'

    fieldsets = (
        ('Request Details', {
            'fields': ('employee', 'leave_type', 'start_date', 'end_date', 'days_requested')
        }),
        ('Request Information', {
            'fields': ('reason', 'notes', 'status')
        }),
        ('Emergency Contact', {
            'fields': ('emergency_contact', 'emergency_phone'),
            'classes': ('collapse',)
        }),
        ('Approval Information', {
            'fields': ('approved_by', 'approved_at', 'rejection_reason'),
            'classes': ('collapse',)
        }),
        ('System Information', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}".strip() or obj.employee.user.username
    employee_name.short_description = 'Employee'
    employee_name.admin_order_field = 'employee__user__first_name'
    
    def leave_type_name(self, obj):
        return obj.leave_type.display_name
    leave_type_name.short_description = 'Leave Type'
    leave_type_name.admin_order_field = 'leave_type__display_name'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('employee__user', 'leave_type', 'approved_by')


@admin.register(LeaveApprovalWorkflow)
class LeaveApprovalWorkflowAdmin(admin.ModelAdmin):
    list_display = ['leave_type_name', 'min_days_threshold', 'max_days_threshold', 'requires_all_approvers', 'auto_approve', 'is_active']
    list_filter = ['leave_type', 'requires_all_approvers', 'auto_approve', 'is_active']
    search_fields = ['leave_type__display_name']
    filter_horizontal = ['approvers']
    
    fieldsets = (
        ('Workflow Configuration', {
            'fields': ('leave_type', 'min_days_threshold', 'max_days_threshold', 'is_active')
        }),
        ('Approval Settings', {
            'fields': ('approvers', 'requires_all_approvers', 'auto_approve', 'auto_approve_conditions')
        }),
        ('System Information', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def leave_type_name(self, obj):
        return obj.leave_type.display_name
    leave_type_name.short_description = 'Leave Type'
    leave_type_name.admin_order_field = 'leave_type__display_name'


# Custom admin site configuration
admin.site.site_header = "WorkSync Leave Management"
admin.site.site_title = "WorkSync Admin"
admin.site.index_title = "Leave Management Administration"
