"""
Authentication serializers
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken


class UserSerializer(serializers.ModelSerializer):
    """User serializer with employee profile"""
    employee_profile = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    is_driver = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'employee_profile', 'is_admin', 'is_driver']
        read_only_fields = ['id']

    def get_employee_profile(self, obj):
        """Get employee profile data"""
        try:
            employee = obj.employee_profile
            return {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'role': {
                    'id': str(employee.role.id),
                    'name': employee.role.name,
                    'description': employee.role.description
                },
                'employment_status': employee.employment_status,
                'hire_date': employee.hire_date.isoformat() if employee.hire_date else None
            }
        except Exception:
            return None

    def get_is_admin(self, obj):
        """Check if user is admin"""
        return obj.is_staff or obj.is_superuser

    def get_is_driver(self, obj):
        """Check if user is driver"""
        try:
            return obj.employee_profile.role.name.lower() == 'driver'
        except Exception:
            return False


class LoginSerializer(serializers.Serializer):
    """Login serializer"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if not user.is_active:
                    raise serializers.ValidationError('User account is disabled.')
                data['user'] = user
                return data
            else:
                raise serializers.ValidationError('Unable to log in with provided credentials.')
        else:
            raise serializers.ValidationError('Must include "username" and "password".')


class TokenSerializer(serializers.Serializer):
    """Token response serializer"""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class ProfileSerializer(serializers.ModelSerializer):
    """User profile serializer with full employee data"""
    employee_profile = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    is_driver = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'employee_profile', 'is_admin', 'is_driver']

    def get_employee_profile(self, obj):
        """Get complete employee profile data"""
        try:
            employee = obj.employee_profile
            return {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'role': {
                    'id': str(employee.role.id),
                    'name': employee.role.name,
                    'description': employee.role.description
                },
                'employment_status': employee.employment_status,
                'hire_date': employee.hire_date.isoformat() if employee.hire_date else None
            }
        except Exception:
            return None

    def get_is_admin(self, obj):
        """Check if user is admin"""
        return obj.is_staff or obj.is_superuser

    def get_is_driver(self, obj):
        """Check if user is driver"""
        try:
            return obj.employee_profile.role.name.lower() == 'driver'
        except Exception:
            return False

