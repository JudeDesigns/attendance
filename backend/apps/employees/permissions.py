"""
Custom permissions for employee management
"""
from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Permission that allows access only to admin users.
    """

    def has_permission(self, request, view):
        """Check if user is admin"""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.is_staff
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission that allows access to owners of an object or admin users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user is owner or admin"""
        # Admin users have full access
        if request.user.is_staff:
            return True
        
        # Check if user is the owner based on different object types
        if hasattr(obj, 'user'):
            # For objects with direct user relationship
            return obj.user == request.user
        elif hasattr(obj, 'employee') and hasattr(obj.employee, 'user'):
            # For objects with employee relationship
            return obj.employee.user == request.user
        elif hasattr(obj, 'employee_profile'):
            # For user objects with employee_profile
            return obj == request.user
        
        # Default to False if no ownership can be determined
        return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission that allows read access to authenticated users,
    but write access only to admin users.
    """
    
    def has_permission(self, request, view):
        """Check permissions at view level"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions for authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admin users
        return request.user.is_staff


class IsEmployeeOwner(permissions.BasePermission):
    """
    Permission that allows access only to the employee who owns the record.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has employee profile"""
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'employee_profile')
        )
    
    def has_object_permission(self, request, view, obj):
        """Check if user owns the employee record"""
        if request.user.is_staff:
            return True
        
        # Check various ways the user might own this object
        if hasattr(obj, 'employee'):
            return obj.employee.user == request.user
        elif hasattr(obj, 'user'):
            return obj.user == request.user
        
        return False


class CanManageEmployees(permissions.BasePermission):
    """
    Permission for users who can manage employees (HR, Admin, Managers).
    """
    
    def has_permission(self, request, view):
        """Check if user can manage employees"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin users can always manage employees
        if request.user.is_staff:
            return True
        
        # Check if user has employee profile with management permissions
        if hasattr(request.user, 'employee_profile'):
            employee = request.user.employee_profile
            # Check if user is in HR or management role
            return employee.role in ['HR', 'MANAGER', 'ADMIN']
        
        return False


class CanApproveLeave(permissions.BasePermission):
    """
    Permission for users who can approve leave requests.
    """
    
    def has_permission(self, request, view):
        """Check if user can approve leave"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin users can always approve leave
        if request.user.is_staff:
            return True
        
        # Check if user has employee profile with approval permissions
        if hasattr(request.user, 'employee_profile'):
            employee = request.user.employee_profile
            # Check if user is in a role that can approve leave
            return employee.role in ['HR', 'MANAGER', 'SUPERVISOR', 'ADMIN']
        
        return False


class CanViewReports(permissions.BasePermission):
    """
    Permission for users who can view reports.
    """
    
    def has_permission(self, request, view):
        """Check if user can view reports"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin users can always view reports
        if request.user.is_staff:
            return True
        
        # Check if user has employee profile with reporting permissions
        if hasattr(request.user, 'employee_profile'):
            employee = request.user.employee_profile
            # Check if user is in a role that can view reports
            return employee.role in ['HR', 'MANAGER', 'SUPERVISOR', 'ADMIN']
        
        return False


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission that allows owners to edit their own data,
    but only read access to others.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions"""
        # Read permissions for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Admin users have full access
        if request.user.is_staff:
            return True
        
        # Write permissions only for owners
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'employee') and hasattr(obj.employee, 'user'):
            return obj.employee.user == request.user
        
        return False
