"""
Employee serializers with security and validation
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Role, Employee, Location
import re


class RoleSerializer(serializers.ModelSerializer):
    """Role serializer with basic validation"""
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate_name(self, value):
        """Validate role name"""
        if not value or not value.strip():
            raise serializers.ValidationError("Role name cannot be empty")
        if len(value) > 50:
            raise serializers.ValidationError("Role name cannot exceed 50 characters")
        # Only allow alphanumeric, spaces, and hyphens
        if not re.match(r'^[a-zA-Z0-9\s\-]+$', value):
            raise serializers.ValidationError("Role name can only contain letters, numbers, spaces, and hyphens")
        return value.strip()


class UserSerializer(serializers.ModelSerializer):
    """User serializer for employee management"""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active']
        read_only_fields = ['id']
    
    def validate_email(self, value):
        """Validate email format and uniqueness"""
        if not value:
            raise serializers.ValidationError("Email is required")
        
        # Check if email already exists (excluding current user in update)
        user_id = self.instance.id if self.instance else None
        if User.objects.filter(email=value).exclude(id=user_id).exists():
            raise serializers.ValidationError("A user with this email already exists")
        
        return value.lower()
    
    def validate_username(self, value):
        """Validate username"""
        if not value or not value.strip():
            raise serializers.ValidationError("Username cannot be empty")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters")
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, and underscores")
        return value


class LocationSerializer(serializers.ModelSerializer):
    """Location serializer with QR code validation"""

    class Meta:
        model = Location
        fields = [
            'id', 'name', 'description', 'address', 'qr_code_payload',
            'latitude', 'longitude', 'radius_meters', 'is_active',
            'requires_gps_verification', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """Validate location name"""
        if not value or not value.strip():
            raise serializers.ValidationError("Location name cannot be empty")
        return value.strip()

    def validate_qr_code_payload(self, value):
        """Validate QR code payload uniqueness"""
        if not value or not value.strip():
            raise serializers.ValidationError("QR code payload cannot be empty")

        # Check uniqueness (excluding current location in update)
        location_id = self.instance.id if self.instance else None
        if Location.objects.filter(qr_code_payload=value).exclude(id=location_id).exists():
            raise serializers.ValidationError("A location with this QR code payload already exists")

        return value.strip()


class EmployeeSerializer(serializers.ModelSerializer):
    """Employee serializer with nested user data"""
    user = UserSerializer(read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'user', 'employee_id', 'role', 'role_name', 'location_name',
            'employment_status', 'hire_date', 'requires_location_qr', 'qr_enforcement_type',
            'phone_number', 'address', 'date_of_birth', 'emergency_contact_name', 
            'emergency_contact_phone', 'department', 'job_title', 'hourly_rate',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_employee_id(self, value):
        """Validate employee ID format and uniqueness"""
        if not value or not value.strip():
            raise serializers.ValidationError("Employee ID cannot be empty")
        
        # Check uniqueness (excluding current employee in update)
        employee_id = self.instance.id if self.instance else None
        if Employee.objects.filter(employee_id=value).exclude(id=employee_id).exists():
            raise serializers.ValidationError("An employee with this ID already exists")
        
        return value.strip()
    
    def validate_role(self, value):
        """Validate role exists and is valid"""
        if not value:
            raise serializers.ValidationError("Role is required")
        return value


class EmployeeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new employees with user account"""
    username = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    first_name = serializers.CharField(write_only=True, required=True)
    last_name = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = Employee
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'employee_id', 'role', 'employment_status', 'hire_date',
            'requires_location_qr', 'qr_enforcement_type',
            'phone_number', 'address', 'date_of_birth', 'emergency_contact_name', 
            'emergency_contact_phone', 'department', 'job_title', 'hourly_rate'
        ]
        read_only_fields = ['id']
    
    def validate_username(self, value):
        """Validate username uniqueness"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters")
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, and underscores")
        return value
    
    def validate_email(self, value):
        """Validate email uniqueness"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists")
        return value.lower()
    
    def validate_password(self, value):
        """Validate password strength"""
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value
    
    def validate_employee_id(self, value):
        """Validate employee ID uniqueness"""
        if Employee.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("An employee with this ID already exists")
        return value.strip()
    
    def create(self, validated_data):
        """Create user and employee in a transaction"""
        # Extract user data
        username = validated_data.pop('username')
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        first_name = validated_data.pop('first_name')
        last_name = validated_data.pop('last_name')
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create employee
        employee = Employee.objects.create(user=user, **validated_data)
        
        return employee


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating employee information"""
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'role', 'employment_status',
            'hire_date', 'first_name', 'last_name', 'email',
            'requires_location_qr', 'qr_enforcement_type', 'hourly_rate',
            'phone_number', 'address', 'date_of_birth', 'emergency_contact_name', 
            'emergency_contact_phone', 'department', 'job_title'
        ]
        read_only_fields = ['id']
    
    def validate_email(self, value):
        """Validate email uniqueness"""
        if value:
            user_id = self.instance.user.id
            if User.objects.filter(email=value).exclude(id=user_id).exists():
                raise serializers.ValidationError("A user with this email already exists")
        return value.lower() if value else value
    
    def update(self, instance, validated_data):
        """Update employee and user information"""
        # Extract user fields
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        
        # Update user fields if provided
        if first_name is not None:
            instance.user.first_name = first_name
        if last_name is not None:
            instance.user.last_name = last_name
        if email is not None:
            instance.user.email = email
        
        if first_name or last_name or email:
            instance.user.save()
        
        # Update employee fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """Detailed employee serializer with all related information"""
    user = UserSerializer(read_only=True)
    role = RoleSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'user', 'employee_id', 'role',
            'employment_status', 'hire_date', 'requires_location_qr', 'qr_enforcement_type',
            'timezone', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

