"""
Leave management views for WorkSync
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .leave_models import LeaveType, LeaveBalance, LeaveRequest, LeaveApprovalWorkflow
from .serializers import (
    LeaveTypeSerializer, LeaveBalanceSerializer, LeaveRequestSerializer,
    LeaveApprovalWorkflowSerializer
)
from apps.employees.permissions import IsOwnerOrAdmin
import logging

logger = logging.getLogger(__name__)


class LeaveTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing leave types"""
    queryset = LeaveType.objects.filter(is_active=True)
    serializer_class = LeaveTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['name', 'is_paid', 'requires_approval']
    search_fields = ['display_name', 'description']
    ordering_fields = ['display_name', 'annual_allocation', 'created_at']
    ordering = ['display_name']

    def get_permissions(self):
        """Admin only for create, update, delete"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [permissions.IsAdminUser]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing leave balances"""
    queryset = LeaveBalance.objects.all()
    serializer_class = LeaveBalanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employee', 'leave_type', 'year']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'leave_type__display_name']
    ordering_fields = ['year', 'allocated_days', 'used_days', 'available_days']
    ordering = ['-year', 'leave_type__display_name']

    def get_queryset(self):
        """Filter balances based on user permissions"""
        user = self.request.user
        if user.is_staff:
            return LeaveBalance.objects.all()
        else:
            # Regular users can only see their own balances
            return LeaveBalance.objects.filter(employee__user=user)

    @action(detail=False, methods=['get'])
    def my_balances(self, request):
        """Get current user's leave balances"""
        try:
            employee = request.user.employee_profile
            current_year = timezone.now().year
            
            balances = LeaveBalance.objects.filter(
                employee=employee,
                year=current_year
            ).select_related('leave_type')
            
            serializer = self.get_serializer(balances, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching leave balances: {str(e)}")
            return Response(
                {'error': 'Unable to fetch leave balances'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def initialize_balances(self, request):
        """Initialize leave balances for all employees (Admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        year = request.data.get('year', timezone.now().year)
        created_count = 0
        
        try:
            from apps.employees.models import Employee
            employees = Employee.objects.filter(employment_status='ACTIVE')
            leave_types = LeaveType.objects.filter(is_active=True)
            
            for employee in employees:
                for leave_type in leave_types:
                    balance, created = LeaveBalance.objects.get_or_create(
                        employee=employee,
                        leave_type=leave_type,
                        year=year,
                        defaults={
                            'allocated_days': leave_type.annual_allocation,
                            'used_days': 0,
                            'pending_days': 0,
                            'carried_over_days': 0
                        }
                    )
                    if created:
                        created_count += 1
            
            return Response({
                'message': f'Initialized {created_count} leave balances for year {year}',
                'year': year,
                'created_count': created_count
            })
        except Exception as e:
            logger.error(f"Error initializing leave balances: {str(e)}")
            return Response(
                {'error': 'Failed to initialize leave balances'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def create_or_update_balance(self, request):
        """Create or update individual leave balance (Admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            from apps.employees.models import Employee

            employee_id = request.data.get('employee')
            leave_type_id = request.data.get('leave_type')
            year = request.data.get('year', timezone.now().year)
            allocated_days = request.data.get('allocated_days', 0)
            carried_over_days = request.data.get('carried_over_days', 0)

            # Validation
            if not employee_id or not leave_type_id:
                return Response(
                    {'error': 'Employee and leave type are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                employee = Employee.objects.get(id=employee_id)
                leave_type = LeaveType.objects.get(id=leave_type_id)
            except (Employee.DoesNotExist, LeaveType.DoesNotExist):
                return Response(
                    {'error': 'Invalid employee or leave type'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get or create the balance
            balance, created = LeaveBalance.objects.get_or_create(
                employee=employee,
                leave_type=leave_type,
                year=year,
                defaults={
                    'allocated_days': allocated_days,
                    'carried_over_days': carried_over_days,
                    'used_days': 0,
                    'pending_days': 0
                }
            )

            # If balance already exists, update only allocated and carried over days
            # Preserve used_days and pending_days
            if not created:
                balance.allocated_days = allocated_days
                balance.carried_over_days = carried_over_days
                balance.save()

            serializer = self.get_serializer(balance)

            return Response({
                'message': f'{"Created" if created else "Updated"} leave balance for {employee.user.get_full_name()}',
                'balance': serializer.data,
                'created': created
            })

        except Exception as e:
            logger.error(f"Error creating/updating leave balance: {str(e)}")
            return Response(
                {'error': 'Failed to create/update leave balance'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for managing leave requests"""
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['employee', 'leave_type', 'status', 'start_date', 'end_date']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'reason']
    ordering_fields = ['submitted_at', 'start_date', 'end_date', 'days_requested']
    ordering = ['-submitted_at']

    def get_queryset(self):
        """Filter requests based on user permissions"""
        user = self.request.user
        if user.is_staff:
            return LeaveRequest.objects.all()
        else:
            # Regular users can only see their own requests
            return LeaveRequest.objects.filter(employee__user=user)

    def perform_create(self, serializer):
        """Set employee to current user when creating"""
        employee = self.request.user.employee_profile
        serializer.save(employee=employee)

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's leave requests"""
        try:
            employee = request.user.employee_profile
            requests = LeaveRequest.objects.filter(employee=employee)
            
            # Apply filters
            status_filter = request.query_params.get('status')
            if status_filter:
                requests = requests.filter(status=status_filter)
            
            year = request.query_params.get('year')
            if year:
                requests = requests.filter(start_date__year=year)
            
            serializer = self.get_serializer(requests, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching leave requests: {str(e)}")
            return Response(
                {'error': 'Unable to fetch leave requests'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """Get leave requests pending approval (Admin/Manager only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            pending_requests = LeaveRequest.objects.filter(
                status='PENDING'
            ).select_related('employee__user', 'leave_type')
            
            serializer = self.get_serializer(pending_requests, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching pending approvals: {str(e)}")
            return Response(
                {'error': 'Unable to fetch pending approvals'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a leave request (Admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            leave_request = self.get_object()
            
            if leave_request.status != 'PENDING':
                return Response(
                    {'error': 'Only pending requests can be approved'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            leave_request.approve(request.user)
            
            serializer = self.get_serializer(leave_request)
            return Response({
                'message': 'Leave request approved successfully',
                'leave_request': serializer.data
            })
        except Exception as e:
            logger.error(f"Error approving leave request: {str(e)}")
            return Response(
                {'error': 'Failed to approve leave request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a leave request (Admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            leave_request = self.get_object()

            # Allow rejecting both PENDING and APPROVED requests
            if leave_request.status not in ['PENDING', 'APPROVED']:
                return Response(
                    {'error': 'Only pending or approved requests can be rejected'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            reason = request.data.get('reason', '')
            old_status = leave_request.status
            leave_request.reject(request.user, reason)

            # If we're rejecting an approved request, we need to restore the leave balance
            if old_status == 'APPROVED':
                leave_request._update_leave_balance('reject_approved')

            serializer = self.get_serializer(leave_request)
            return Response({
                'message': 'Leave request rejected',
                'leave_request': serializer.data
            })
        except Exception as e:
            logger.error(f"Error rejecting leave request: {str(e)}")
            return Response(
                {'error': 'Failed to reject leave request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a leave request"""
        try:
            leave_request = self.get_object()
            
            # Check permissions - owner or admin
            if not (request.user.is_staff or leave_request.employee.user == request.user):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if not leave_request.can_be_cancelled:
                return Response(
                    {'error': 'This leave request cannot be cancelled'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            leave_request.cancel()
            
            serializer = self.get_serializer(leave_request)
            return Response({
                'message': 'Leave request cancelled successfully',
                'leave_request': serializer.data
            })
        except Exception as e:
            logger.error(f"Error cancelling leave request: {str(e)}")
            return Response(
                {'error': 'Failed to cancel leave request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Get leave calendar data"""
        try:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            if not start_date or not end_date:
                return Response(
                    {'error': 'start_date and end_date parameters required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get approved leave requests in date range
            leave_requests = LeaveRequest.objects.filter(
                status='APPROVED',
                start_date__lte=end_date,
                end_date__gte=start_date
            ).select_related('employee__user', 'leave_type')
            
            # Format for calendar
            calendar_data = []
            for leave in leave_requests:
                calendar_data.append({
                    'id': str(leave.id),
                    'title': f"{leave.employee.user.get_full_name()} - {leave.leave_type.display_name}",
                    'start': leave.start_date.isoformat(),
                    'end': leave.end_date.isoformat(),
                    'employee': leave.employee.user.get_full_name(),
                    'leave_type': leave.leave_type.display_name,
                    'days': leave.days_requested,
                    'color': self._get_leave_color(leave.leave_type.name)
                })
            
            return Response(calendar_data)
        except Exception as e:
            logger.error(f"Error fetching leave calendar: {str(e)}")
            return Response(
                {'error': 'Unable to fetch leave calendar'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_leave_color(self, leave_type):
        """Get color for leave type in calendar"""
        colors = {
            'ANNUAL': '#3B82F6',      # Blue
            'SICK': '#EF4444',        # Red
            'PERSONAL': '#10B981',    # Green
            'MATERNITY': '#F59E0B',   # Yellow
            'PATERNITY': '#8B5CF6',   # Purple
            'BEREAVEMENT': '#6B7280', # Gray
            'STUDY': '#06B6D4',       # Cyan
            'UNPAID': '#F97316',      # Orange
            'COMPENSATORY': '#84CC16', # Lime
            'OTHER': '#64748B'        # Slate
        }
        return colors.get(leave_type, '#64748B')


class LeaveApprovalWorkflowViewSet(viewsets.ModelViewSet):
    """ViewSet for managing leave approval workflows"""
    queryset = LeaveApprovalWorkflow.objects.filter(is_active=True)
    serializer_class = LeaveApprovalWorkflowSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['leave_type', 'auto_approve']
    ordering_fields = ['leave_type', 'min_days_threshold']
    ordering = ['leave_type', 'min_days_threshold']
