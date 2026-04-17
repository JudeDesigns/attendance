import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
from django.utils import timezone


def get_current_date():
    """Get current date for default values"""
    return timezone.now().date()


# All valid sub-admin permission keys
SUB_ADMIN_PERMISSIONS = [
    # Dashboard
    'view_dashboard',
    'force_clockout',
    # Employee Management
    'view_employees',
    'create_employees',
    'edit_employees',
    'manage_employee_status',
    'delete_employees',
    'edit_time_logs',
    'view_employee_status',
    'export_data',
    # Scheduling
    'view_schedule',
    'manage_schedule',
    # Leave
    'manage_leave',
    # Locations
    'manage_locations',
    # Reports
    'view_reports',
    'generate_reports',
    # Notifications
    'view_notifications',
    'manage_notification_templates',
    # Webhooks
    'manage_webhooks',
    # Settings
    'manage_payroll_settings',
    'manage_alert_settings',
]

# Permissions that implicitly require view_employees
PERMISSION_DEPENDENCIES = {
    'create_employees': ['view_employees'],
    'edit_employees': ['view_employees'],
    'manage_employee_status': ['view_employees'],
    'delete_employees': ['view_employees'],
    'edit_time_logs': ['view_employees'],
    'view_employee_status': ['view_employees'],
    'export_data': ['view_employees'],
    'view_schedule': ['view_employees'],
    'manage_schedule': ['view_employees', 'view_schedule'],
    'manage_leave': ['view_employees'],
    'generate_reports': ['view_reports'],
    'view_notifications': ['view_employees'],
    'manage_notification_templates': ['view_notifications', 'view_employees'],
}


class Role(models.Model):
    """Employee roles with permissions"""
    ROLE_CHOICES = [
        ('EMPLOYEE', 'Employee'),
        ('DRIVER', 'Driver'),
        ('SUB_ADMIN', 'Sub Administrator'),
        ('ADMIN', 'Administrator'),
        ('SUPER_ADMIN', 'Super Administrator'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=20, choices=ROLE_CHOICES, unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, help_text="List of permission strings")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.get_name_display()
    
    class Meta:
        db_table = 'roles'


class Employee(models.Model):
    """Extended user profile for employees"""
    EMPLOYMENT_STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('TERMINATED', 'Terminated'),
        ('ON_LEAVE', 'On Leave'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    employee_id = models.CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r'^[A-Z0-9-]+$', 'Employee ID must contain only uppercase letters, numbers, and hyphens')],
        help_text="Unique employee identifier (e.g., DRV-105)"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='employees')
    
    # Personal Information
    phone_number = models.CharField(
        max_length=15,
        validators=[RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed.")],
        blank=True
    )
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=15, blank=True)
    
    # Employment Information
    hire_date = models.DateField(default=get_current_date)
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES, default='ACTIVE')
    termination_date = models.DateField(null=True, blank=True)
    department = models.CharField(max_length=100, blank=True)
    job_title = models.CharField(max_length=100, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Settings
    timezone = models.CharField(
        max_length=50,
        default='America/Los_Angeles',
        help_text="Employee's timezone for shift scheduling and time display"
    )
    notification_preferences = models.JSONField(default=dict)

    # QR Code for employee identification
    qr_code_payload = models.CharField(
        max_length=255,
        blank=True,
        help_text="QR code payload for employee identification (auto-generated from employee_id)"
    )

    # Location QR Code Enforcement
    requires_location_qr = models.BooleanField(
        default=False,
        help_text="If True, this employee must use location QR codes for clock-in/out"
    )
    qr_enforcement_type = models.CharField(
        max_length=20,
        choices=[
            ('NONE', 'No Enforcement'),
            ('FIRST_CLOCK_IN', 'First Clock-In Only'),
            ('ALL_OPERATIONS', 'All Clock-In/Out Operations'),
        ],
        default='NONE',
        help_text="Level of QR code enforcement for this employee"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        # Auto-generate QR code payload if not set
        if not self.qr_code_payload and self.employee_id:
            self.qr_code_payload = f"EMP-{self.employee_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name() or self.user.username}"
    
    @property
    def full_name(self):
        return self.user.get_full_name() or self.user.username
    
    @property
    def is_driver(self):
        return self.role.name == 'DRIVER'
    
    @property
    def is_admin(self):
        return self.role.name in ['ADMIN', 'SUPER_ADMIN']

    @property
    def is_sub_admin(self):
        return self.role.name == 'SUB_ADMIN'

    @property
    def is_active_employee(self):
        return self.employment_status == 'ACTIVE'

    @property
    def current_status(self):
        """Get current employee status based on active time logs"""
        from apps.attendance.models import TimeLog
        active_log = TimeLog.objects.filter(
            employee=self,
            status='CLOCKED_IN'
        ).first()

        if active_log:
            return 'CLOCKED_IN'
        return 'CLOCKED_OUT'

    @property
    def is_clocked_in(self):
        """Check if employee is currently clocked in"""
        return self.current_status == 'CLOCKED_IN'

    def get_active_time_log(self):
        """Get the current active time log if any"""
        from apps.attendance.models import TimeLog
        return TimeLog.objects.filter(
            employee=self,
            status='CLOCKED_IN'
        ).first()

    def has_permission(self, permission):
        """Check if employee has a specific permission.
        Full admins always have all permissions.
        Sub-admins check against their SubAdminPermission record.
        """
        if self.is_admin:
            return True
        if self.is_sub_admin:
            try:
                return permission in self.sub_admin_permissions.permissions
            except SubAdminPermission.DoesNotExist:
                return False
        return False

    def get_all_permissions(self):
        """Get the full list of permissions for this employee.
        Full admins get ['*'] (wildcard). Sub-admins get their specific list.
        Regular employees get [].
        """
        if self.is_admin:
            return ['*']
        if self.is_sub_admin:
            try:
                return list(self.sub_admin_permissions.permissions)
            except SubAdminPermission.DoesNotExist:
                return []
        return []

    class Meta:
        db_table = 'employees'
        ordering = ['employee_id']
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['employment_status']),
            models.Index(fields=['role']),
        ]


class Location(models.Model):
    """Physical locations for clock-in/out with QR codes"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    address = models.TextField(blank=True)

    # GPS Coordinates
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)

    # QR Code for scanning
    qr_code_payload = models.CharField(
        max_length=255,
        unique=True,
        help_text="Unique identifier for QR code scanning (e.g., WH-MAIN-ENTRANCE-01)"
    )

    # Settings
    radius_meters = models.PositiveIntegerField(default=100, help_text="Allowed radius for GPS verification")
    is_active = models.BooleanField(default=True)
    requires_gps_verification = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.qr_code_payload})"
    
    class Meta:
        db_table = 'locations'
        ordering = ['name']


class SubAdminPermission(models.Model):
    """Granular permission set for sub-admin employees.
    Each sub-admin has exactly one SubAdminPermission record listing
    the permission keys they are allowed to use.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='sub_admin_permissions',
        help_text="The sub-admin employee this permission set belongs to"
    )
    permissions = models.JSONField(
        default=list,
        help_text="List of permission key strings (e.g. ['view_dashboard', 'manage_schedule'])"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_sub_admin_permissions',
        help_text="The admin user who created/last updated this permission set"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        """Validate that all permission keys are valid."""
        from django.core.exceptions import ValidationError
        if self.permissions:
            invalid = [p for p in self.permissions if p not in SUB_ADMIN_PERMISSIONS]
            if invalid:
                raise ValidationError(f"Invalid permission keys: {', '.join(invalid)}")

    def __str__(self):
        return f"Permissions for {self.employee.employee_id} ({len(self.permissions)} perms)"

    class Meta:
        db_table = 'sub_admin_permissions'
        verbose_name = 'Sub-Admin Permission'
        verbose_name_plural = 'Sub-Admin Permissions'
