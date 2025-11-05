"""
Scheduling views with security, permissions, and conflict detection
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Count, Q
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import datetime, timedelta, time
from .models import Shift, ShiftTemplate
from apps.employees.models import Employee, Location
from .serializers import (
    ShiftSerializer, ShiftCreateSerializer, ShiftUpdateSerializer,
    ShiftBulkCreateSerializer, ShiftTemplateSerializer, MyScheduleSerializer,
    SpreadsheetImportSerializer
)
import logging

logger = logging.getLogger(__name__)


class IsAdminUser(permissions.BasePermission):
    """Custom permission for admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow users to view their own data or admins to access all"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        if hasattr(obj, 'employee'):
            return obj.employee.user == request.user
        return False


class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shifts with comprehensive security and validation
    """
    queryset = Shift.objects.select_related(
        'employee__user', 'employee__role', 'created_by'
    ).all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employee', 'location', 'is_published']
    search_fields = ['employee__employee_id', 'employee__user__first_name', 'employee__user__last_name', 'notes']
    ordering_fields = ['start_time', 'end_time', 'created_at']
    ordering = ['-start_time']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return ShiftCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ShiftUpdateSerializer
        return ShiftSerializer
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_create']:
            return [IsAdminUser()]
        elif self.action in ['retrieve', 'list']:
            return [IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()
        
        # Non-admin users can only see their own shifts
        if not self.request.user.is_staff:
            try:
                employee = Employee.objects.get(user=self.request.user)
                queryset = queryset.filter(employee=employee)
            except Employee.DoesNotExist:
                queryset = queryset.none()
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                queryset = queryset.filter(start_time__gte=start)
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                queryset = queryset.filter(start_time__lte=end)
            except ValueError:
                pass
        
        return queryset
    
    def perform_create(self, serializer):
        """Create shift with audit logging"""
        shift = serializer.save(created_by=self.request.user)
        logger.info(
            f"Shift created: {shift.employee.employee_id} "
            f"from {shift.start_time} to {shift.end_time} "
            f"by user {self.request.user.username}"
        )
    
    def perform_update(self, serializer):
        """Update shift with audit logging"""
        shift = serializer.save()
        logger.info(
            f"Shift updated: {shift.employee.employee_id} "
            f"from {shift.start_time} to {shift.end_time} "
            f"by user {self.request.user.username}"
        )
    
    def perform_destroy(self, instance):
        """Delete shift with audit logging"""
        logger.warning(
            f"Shift deleted: {instance.employee.employee_id} "
            f"from {instance.start_time} to {instance.end_time} "
            f"by user {self.request.user.username}"
        )
        instance.delete()
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def bulk_create(self, request):
        """Bulk create shifts for recurring schedules"""
        serializer = ShiftBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        employee = data['employee']
        location = data.get('location')
        start_date = data['start_date']
        end_date = data['end_date']
        start_time = data['start_time']
        end_time = data['end_time']
        weekdays = data['weekdays']
        notes = data.get('notes', '')
        is_published = data.get('is_published', False)
        
        created_shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            # Check if current day is in the selected weekdays
            if current_date.weekday() in weekdays:
                # Create datetime objects for the shift
                shift_start = timezone.make_aware(
                    datetime.combine(current_date, start_time)
                )
                shift_end = timezone.make_aware(
                    datetime.combine(current_date, end_time)
                )
                
                # Handle overnight shifts
                if end_time <= start_time:
                    shift_end += timedelta(days=1)
                
                # Check for conflicts
                conflicting_shifts = Shift.objects.filter(
                    employee=employee,
                    start_time__lt=shift_end,
                    end_time__gt=shift_start
                )
                
                if not conflicting_shifts.exists():
                    shift = Shift.objects.create(
                        employee=employee,
                        location=location,
                        start_time=shift_start,
                        end_time=shift_end,
                        notes=notes,
                        is_published=is_published,
                        created_by=request.user
                    )
                    created_shifts.append(shift)
            
            current_date += timedelta(days=1)
        
        logger.info(
            f"Bulk shifts created: {len(created_shifts)} shifts for {employee.employee_id} "
            f"by user {request.user.username}"
        )
        
        response_serializer = ShiftSerializer(created_shifts, many=True)
        return Response({
            'message': f'Successfully created {len(created_shifts)} shifts',
            'shifts': response_serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def import_spreadsheet(self, request):
        """Import shifts from spreadsheet data"""
        serializer = SpreadsheetImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        shifts_data = serializer.validated_data['shifts']
        created_shifts = []
        errors = []

        for shift_data in shifts_data:
            try:
                # Create shift using the standard serializer
                shift_serializer = ShiftCreateSerializer(data=shift_data)
                if shift_serializer.is_valid():
                    shift = shift_serializer.save(created_by=request.user)
                    created_shifts.append(shift)
                else:
                    errors.append({
                        'shift_data': shift_data,
                        'errors': shift_serializer.errors
                    })
            except Exception as e:
                errors.append({
                    'shift_data': shift_data,
                    'error': str(e)
                })

        logger.info(
            f"Spreadsheet import completed: {len(created_shifts)} shifts created, "
            f"{len(errors)} errors by user {request.user.username}"
        )

        response_serializer = ShiftSerializer(created_shifts, many=True)
        return Response({
            'message': f'Import completed: {len(created_shifts)} shifts created, {len(errors)} errors',
            'created_shifts': response_serializer.data,
            'errors': errors,
            'success_count': len(created_shifts),
            'error_count': len(errors)
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_schedule(self, request):
        """Get current user's schedule"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date:
            # Default to current week
            today = timezone.now().date()
            start_date = today - timedelta(days=today.weekday())
        else:
            try:
                start_date = datetime.fromisoformat(start_date).date()
            except ValueError:
                return Response(
                    {'detail': 'Invalid start_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not end_date:
            # Default to end of week
            end_date = start_date + timedelta(days=6)
        else:
            try:
                end_date = datetime.fromisoformat(end_date).date()
            except ValueError:
                return Response(
                    {'detail': 'Invalid end_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Get shifts for the date range
        shifts = Shift.objects.filter(
            employee=employee,
            start_time__date__gte=start_date,
            start_time__date__lte=end_date,
            is_published=True
        ).order_by('start_time')

        serializer = ShiftSerializer(shifts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def conflicts(self, request):
        """Get shifts with scheduling conflicts"""
        conflicts = []

        # Find overlapping shifts for the same employee
        shifts = Shift.objects.select_related('employee').order_by('employee', 'start_time')

        for shift in shifts:
            overlapping = Shift.objects.filter(
                employee=shift.employee,
                start_time__lt=shift.end_time,
                end_time__gt=shift.start_time
            ).exclude(id=shift.id)

            if overlapping.exists():
                conflicts.append({
                    'shift': ShiftSerializer(shift).data,
                    'conflicts_with': ShiftSerializer(overlapping, many=True).data
                })

        return Response(conflicts)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def publish(self, request, pk=None):
        """Publish a shift to make it visible to the employee"""
        shift = self.get_object()
        shift.is_published = True
        shift.save()

        logger.info(
            f"Shift published: {shift.employee.employee_id} "
            f"from {shift.start_time} to {shift.end_time} "
            f"by user {request.user.username}"
        )

        return Response({'status': 'Shift published'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def unpublish(self, request, pk=None):
        """Unpublish a shift to hide it from the employee"""
        shift = self.get_object()
        shift.is_published = False
        shift.save()

        logger.info(
            f"Shift unpublished: {shift.employee.employee_id} "
            f"from {shift.start_time} to {shift.end_time} "
            f"by user {request.user.username}"
        )

        return Response({'status': 'Shift unpublished'})


class ShiftTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shift templates
    """
    queryset = ShiftTemplate.objects.select_related(
        'employee__user', 'created_by'
    ).all()
    serializer_class = ShiftTemplateSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employee', 'location', 'is_active', 'recurrence_type']
    search_fields = ['name', 'employee__employee_id', 'notes']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def perform_create(self, serializer):
        """Create template with audit logging"""
        template = serializer.save(created_by=self.request.user)
        logger.info(
            f"Shift template created: {template.name} for {template.employee.employee_id} "
            f"by user {self.request.user.username}"
        )

    def perform_update(self, serializer):
        """Update template with audit logging"""
        template = serializer.save()
        logger.info(
            f"Shift template updated: {template.name} for {template.employee.employee_id} "
            f"by user {self.request.user.username}"
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def generate_shifts(self, request, pk=None):
        """Generate shifts from template for a date range"""
        template = self.get_object()

        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')

        if not start_date or not end_date:
            return Response(
                {'detail': 'start_date and end_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_date = datetime.fromisoformat(start_date).date()
            end_date = datetime.fromisoformat(end_date).date()
        except ValueError:
            return Response(
                {'detail': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if end_date < start_date:
            return Response(
                {'detail': 'end_date must be after start_date'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_shifts = []
        current_date = start_date

        while current_date <= end_date:
            # Check if template is effective for this date
            if current_date < template.effective_from:
                current_date += timedelta(days=1)
                continue

            if template.effective_until and current_date > template.effective_until:
                break

            # Check if current day matches template recurrence
            should_create = False

            if template.recurrence_type == 'DAILY':
                should_create = True
            elif template.recurrence_type == 'WEEKLY':
                should_create = current_date.weekday() in template.weekdays
            elif template.recurrence_type == 'BIWEEKLY':
                # Calculate weeks since effective_from
                weeks_diff = (current_date - template.effective_from).days // 7
                should_create = (weeks_diff % 2 == 0) and (current_date.weekday() in template.weekdays)
            elif template.recurrence_type == 'MONTHLY':
                # Create on the same day of month as effective_from
                should_create = current_date.day == template.effective_from.day

            if should_create:
                # Create shift
                shift_start = timezone.make_aware(
                    datetime.combine(current_date, template.start_time)
                )
                shift_end = timezone.make_aware(
                    datetime.combine(current_date, template.end_time)
                )

                # Handle overnight shifts
                if template.end_time <= template.start_time:
                    shift_end += timedelta(days=1)

                # Check for conflicts
                conflicting_shifts = Shift.objects.filter(
                    employee=template.employee,
                    start_time__lt=shift_end,
                    end_time__gt=shift_start
                )

                if not conflicting_shifts.exists():
                    shift = Shift.objects.create(
                        employee=template.employee,
                        location=template.location,
                        start_time=shift_start,
                        end_time=shift_end,
                        notes=f"Generated from template: {template.name}",
                        is_published=False,  # Templates generate unpublished shifts
                        created_by=request.user
                    )
                    created_shifts.append(shift)

            current_date += timedelta(days=1)

        logger.info(
            f"Shifts generated from template: {len(created_shifts)} shifts "
            f"from {template.name} by user {request.user.username}"
        )

        response_serializer = ShiftSerializer(created_shifts, many=True)
        return Response({
            'message': f'Successfully generated {len(created_shifts)} shifts from template',
            'shifts': response_serializer.data
        }, status=status.HTTP_201_CREATED)
