from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django import forms
from .models import Role, Employee, Location
from apps.core.timezone_utils import TIMEZONE_CHOICES


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'is_active', 'created_at']
    list_filter = ['name', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['name']


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'address', 'qr_code_payload', 'is_active', 'requires_gps_verification']
    list_filter = ['is_active', 'requires_gps_verification']
    search_fields = ['name', 'address', 'qr_code_payload']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['name']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'address', 'is_active')
        }),
        ('QR Code', {
            'fields': ('qr_code_payload',)
        }),
        ('GPS Settings', {
            'fields': ('latitude', 'longitude', 'radius_meters', 'requires_gps_verification')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


class EmployeeInline(admin.StackedInline):
    model = Employee
    can_delete = False
    verbose_name_plural = 'Employee Profile'
    fields = [
        'employee_id', 'role', 'employment_status', 'hire_date',
        'phone_number', 'address', 'date_of_birth',
        'emergency_contact_name', 'emergency_contact_phone',
        'department', 'job_title', 'hourly_rate',
        'timezone', 'requires_location_qr', 'qr_enforcement_type'
    ]


class UserAdmin(BaseUserAdmin):
    inlines = (EmployeeInline,)


class EmployeeAdminForm(forms.ModelForm):
    """Custom form for Employee admin with timezone choices"""
    timezone = forms.ChoiceField(
        choices=TIMEZONE_CHOICES,
        initial='UTC',
        help_text="Employee's timezone for shift scheduling and time display"
    )

    class Meta:
        model = Employee
        fields = '__all__'


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    form = EmployeeAdminForm
    list_display = [
        'employee_id', 'get_full_name', 'get_email', 'role', 
        'employment_status', 'requires_location_qr', 'qr_enforcement_type', 'hire_date'
    ]
    list_filter = [
        'employment_status', 'role', 'requires_location_qr', 'qr_enforcement_type', 'hire_date'
    ]
    search_fields = [
        'employee_id', 'user__first_name', 'user__last_name', 
        'user__email', 'user__username'
    ]
    readonly_fields = ['id', 'qr_code_payload', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('User Account', {
            'fields': ('user',)
        }),
        ('Employee Information', {
            'fields': ('employee_id', 'role', 'employment_status', 'hire_date')
        }),
        ('Personal Information', {
            'fields': (
                'phone_number', 'address', 'date_of_birth',
                'emergency_contact_name', 'emergency_contact_phone'
            )
        }),
        ('Work Information', {
            'fields': ('department', 'job_title', 'hourly_rate')
        }),
        ('Clock-In/Out Settings', {
            'fields': ('requires_location_qr', 'qr_enforcement_type'),
            'description': 'Configure QR code enforcement for this employee'
        }),
        ('QR Code', {
            'fields': ('qr_code_payload',),
            'classes': ('collapse',)
        }),
        ('Settings', {
            'fields': ('timezone', 'notification_preferences'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Full Name'
    
    def get_email(self, obj):
        return obj.user.email
    get_email.short_description = 'Email'


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)
