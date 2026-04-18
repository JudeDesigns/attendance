"""
Employee views with security, permissions, and audit logging
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Role, Employee, Location
from .serializers import (
    RoleSerializer, EmployeeSerializer, EmployeeCreateSerializer,
    EmployeeUpdateSerializer, EmployeeDetailSerializer, LocationSerializer
)
import logging

logger = logging.getLogger(__name__)


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow admin users to access.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class HasEmployeePermission(permissions.BasePermission):
    """
    Permission to allow admins full access, or sub-admins if they have granular permissions.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if request.user.is_staff:
            return True
            
        # Check sub-admin permissions
        try:
            profile = request.user.employee_profile
            if profile.role.name != 'SUB_ADMIN':
                return False
                
            perms = profile.sub_admin_permissions.permissions
            
            if view.action == 'create':
                return 'create_employees' in perms
            elif view.action in ['update', 'partial_update']:
                return 'edit_employees' in perms
            elif view.action == 'destroy':
                return 'delete_employees' in perms
            elif view.action in ['activate', 'deactivate', 'terminate']:
                return 'manage_employee_status' in perms
            
            return False
        except Exception:
            return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to allow users to view/edit their own data or admins to access all.
    """
    def has_object_permission(self, request, view, obj):
        # Admin users can access everything
        if request.user.is_staff:
            return True
        
        # Users can only access their own employee record
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        return False


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing roles.
    Only admin users can create/update/delete roles.
    All authenticated users can view roles.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_permissions(self):
        """
        Admin-only for create, update, delete
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Log role creation"""
        role = serializer.save()
        logger.info(f"Role created: {role.name} by user {self.request.user.username}")
    
    def perform_update(self, serializer):
        """Log role update"""
        role = serializer.save()
        logger.info(f"Role updated: {role.name} by user {self.request.user.username}")
    
    def perform_destroy(self, instance):
        """Prevent deletion of roles with active employees"""
        if Employee.objects.filter(role=instance, employment_status='ACTIVE').exists():
            raise serializers.ValidationError(
                "Cannot delete role with active employees. Please reassign employees first."
            )
        logger.warning(f"Role deleted: {instance.name} by user {self.request.user.username}")
        instance.delete()


class LocationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing locations.
    Admin users can manage locations.
    All authenticated users can view locations.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'address']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_permissions(self):
        """
        Admin-only for create, update, delete
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """Filter active locations for non-admin users"""
        queryset = super().get_queryset()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset
    
    def perform_create(self, serializer):
        """Log location creation"""
        location = serializer.save()
        logger.info(f"Location created: {location.name} by user {self.request.user.username}")
    
    def perform_update(self, serializer):
        """Log location update"""
        location = serializer.save()
        logger.info(f"Location updated: {location.name} by user {self.request.user.username}")
    
    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        """Get QR code for location"""
        location = self.get_object()
        return Response({
            'location_id': str(location.id),
            'location_name': location.name,
            'qr_code': location.qr_code
        })


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing employees.
    Implements role-based access control and audit logging.
    """
    queryset = Employee.objects.select_related('user', 'role').all()
    pagination_class = None  # Return ALL employees - frontend needs the full list
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employment_status', 'role']
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['employee_id', 'hire_date', 'created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return EmployeeCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return EmployeeUpdateSerializer
        elif self.action == 'retrieve':
            return EmployeeDetailSerializer
        return EmployeeSerializer
    
    def get_permissions(self):
        """
        Admin-only for create, update, delete
        Users can view their own profile
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [HasEmployeePermission()]
        elif self.action in ['retrieve', 'me']:
            return [IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()
        
        # Non-admin users can only see active employees
        if not self.request.user.is_staff:
            queryset = queryset.filter(employment_status='ACTIVE')
            
            # Sub-admins should not see ADMIN or SUPER_ADMIN level accounts
            if hasattr(self.request.user, 'employee_profile') and self.request.user.employee_profile.role.name == 'SUB_ADMIN':
                queryset = queryset.exclude(role__name__in=['ADMIN', 'SUPER_ADMIN'])
        
        return queryset
    
    def _check_role_escalation(self, serializer):
        """Prevent non-staff users from assigning admin roles"""
        if not self.request.user.is_staff:
            role = serializer.validated_data.get('role')
            if role and role.name in ['ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN']:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to assign or update to this role.")

    @transaction.atomic
    def perform_create(self, serializer):
        self._check_role_escalation(serializer)
        """Create employee with audit logging"""
        employee = serializer.save()
        logger.info(
            f"Employee created: {employee.employee_id} ({employee.user.username}) "
            f"by user {self.request.user.username}"
        )
    
    @transaction.atomic
    def perform_update(self, serializer):
        if 'role' in serializer.validated_data:
            self._check_role_escalation(serializer)
            
        instance = serializer.instance
        old_role = instance.role
        
        """Update employee with audit logging"""
        employee = serializer.save()
        
        # Handle Sub-Admin promotions/demotions
        if 'role' in serializer.validated_data:
            new_role = employee.role
            # If promoted to SUB_ADMIN, create empty permissions if they don't exist
            if new_role.name == 'SUB_ADMIN' and (not old_role or old_role.name != 'SUB_ADMIN'):
                from apps.employees.models import SubAdminPermission
                SubAdminPermission.objects.get_or_create(employee=employee, defaults={'permissions': []})
            
            # If demoted FROM SUB_ADMIN to something else, remove permissions
            elif old_role and old_role.name == 'SUB_ADMIN' and new_role.name != 'SUB_ADMIN':
                from apps.employees.models import SubAdminPermission
                SubAdminPermission.objects.filter(employee=employee).delete()

        logger.info(
            f"Employee updated: {employee.employee_id} ({employee.user.username}) "
            f"by user {self.request.user.username}"
        )
    
    def perform_destroy(self, instance):
        """
        Hard delete: Actually delete the employee and associated user account
        """
        user_to_delete = instance.user
        employee_id = instance.employee_id
        username = user_to_delete.username

        logger.warning(
            f"Employee deleted: {employee_id} ({username}) "
            f"by user {self.request.user.username}"
        )

        # Delete the employee record first (this will cascade properly)
        instance.delete()

        # Delete the associated user account
        user_to_delete.delete()
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """Get current user's employee profile"""
        try:
            employee = Employee.objects.select_related('user', 'role').get(user=request.user)
            serializer = EmployeeDetailSerializer(employee)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found for this user.'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], permission_classes=[HasEmployeePermission])
    def activate(self, request, pk=None):
        """Activate an employee account"""
        employee = self.get_object()
        employee.employment_status = 'ACTIVE'
        employee.user.is_active = True
        employee.save()
        employee.user.save()
        logger.info(f"Employee activated: {employee.employee_id} by user {request.user.username}")
        return Response({'status': 'Employee activated'})
    
    @action(detail=True, methods=['post'], permission_classes=[HasEmployeePermission])
    def deactivate(self, request, pk=None):
        """Deactivate an employee account"""
        employee = self.get_object()
        employee.employment_status = 'INACTIVE'
        employee.user.is_active = False
        employee.save()
        employee.user.save()
        logger.info(f"Employee deactivated: {employee.employee_id} by user {request.user.username}")
        return Response({'status': 'Employee deactivated'})

    @action(detail=True, methods=['post'], permission_classes=[HasEmployeePermission])
    def terminate(self, request, pk=None):
        """Terminate an employee (soft delete - keeps records but marks as terminated)"""
        employee = self.get_object()
        employee.employment_status = 'TERMINATED'
        employee.user.is_active = False
        employee.save()
        employee.user.save()
        logger.warning(
            f"Employee terminated: {employee.employee_id} ({employee.user.username}) "
            f"by user {request.user.username}"
        )
        return Response({'status': 'Employee terminated'})
    
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def status(self, request, pk=None):
        """Get employee's current clock-in status"""
        employee = self.get_object()

        # Check permission - users can only view their own status, admins/sub-admins can view all
        is_admin_or_sub = request.user.is_staff
        if not is_admin_or_sub:
            try:
                profile = request.user.employee_profile
                if profile.is_sub_admin and profile.has_permission('view_employee_status'):
                    is_admin_or_sub = True
            except Exception:
                pass
        if not is_admin_or_sub and employee.user != request.user:
            return Response(
                {'detail': 'You do not have permission to view this employee status'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Import here to avoid circular import
        from apps.attendance.models import TimeLog

        # Get latest time log
        latest_log = TimeLog.objects.filter(
            employee=employee
        ).order_by('-clock_in_time').first()

        if latest_log and latest_log.status == 'CLOCKED_IN':
            duration_seconds = (timezone.now() - latest_log.clock_in_time).total_seconds()
            return Response({
                'current_status': 'CLOCKED_IN',
                'clock_in_time': latest_log.clock_in_time,
                'clock_in_location': latest_log.clock_in_location.name if latest_log.clock_in_location else None,
                'duration_minutes': int(duration_seconds / 60),
                'duration_hours': round(duration_seconds / 3600, 2)
            })
        else:
            return Response({
                'current_status': 'CLOCKED_OUT',
                'last_clock_out': latest_log.clock_out_time if latest_log and latest_log.clock_out_time else None
            })

    # Individual employee QR code endpoints removed - no longer supported
    # Only location QR codes are used for clock-in/out verification

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def statistics(self, request):
        """Get employee statistics"""
        total = Employee.objects.count()
        active = Employee.objects.filter(employment_status='ACTIVE').count()
        inactive = Employee.objects.filter(employment_status='INACTIVE').count()
        terminated = Employee.objects.filter(employment_status='TERMINATED').count()

        return Response({
            'total': total,
            'active': active,
            'inactive': inactive,
            'terminated': terminated
        })


class SubAdminViewSet(viewsets.ModelViewSet):
    """
    ViewSet specifically for managing sub-admins and their permissions.
    Only full admins are allowed to use this.
    """
    permission_classes = [IsAdminUser]  # Only FULL admins can manage sub-admins
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employment_status']
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['employee_id', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """Only return employees with the SUB_ADMIN role."""
        return Employee.objects.select_related(
            'user', 'role', 'sub_admin_permissions'
        ).filter(role__name='SUB_ADMIN')

    def get_serializer_class(self):
        from .serializers import SubAdminSerializer, SubAdminCreateSerializer, SubAdminUpdateSerializer
        if self.action == 'create':
            return SubAdminCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SubAdminUpdateSerializer
        return SubAdminSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        """Create sub-admin and force role to SUB_ADMIN"""
        role, _ = Role.objects.get_or_create(
            name='SUB_ADMIN',
            defaults={'description': 'Granular Sub Administrator'}
        )
        serializer.save(role=role)
        logger.info(
            f"Sub-admin created by user {self.request.user.username}"
        )

    def perform_destroy(self, instance):
        """Instead of hard deleting, we might just want to demote them, 
        but ModelViewSet destroy expects deletion. We will do a full hard delete."""
        logger.warning(
            f"Sub-admin deleted: {instance.employee_id} "
            f"by admin {self.request.user.username}"
        )
        user_to_delete = instance.user
        instance.delete()
        user_to_delete.delete()

