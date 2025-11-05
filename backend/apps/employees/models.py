import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
from django.utils import timezone


def get_current_date():
    """Get current date for default values"""
    return timezone.now().date()


class Role(models.Model):
    """Employee roles with permissions"""
    ROLE_CHOICES = [
        ('EMPLOYEE', 'Employee'),
        ('DRIVER', 'Driver'),
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
    timezone = models.CharField(max_length=50, default='UTC')
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
    def is_active_employee(self):
        return self.employment_status == 'ACTIVE'

    def has_permission(self, permission):
        """Check if employee has a specific permission"""
        return permission in self.role.permissions

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
