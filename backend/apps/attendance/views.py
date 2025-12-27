"""
Attendance views with security, validation, and audit logging
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Avg, Count, Q, F
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import datetime, timedelta
from .models import TimeLog, Break
from apps.employees.models import Employee, Location
from apps.notifications.models import NotificationLog
from apps.notifications.services import notification_service
from .serializers import (
    TimeLogSerializer, TimeLogDetailSerializer, ClockInSerializer,
    ClockOutSerializer, QRCodeClockSerializer, AttendanceSummarySerializer,
    CurrentStatusSerializer, BreakSerializer, BreakStartSerializer, BreakEndSerializer
)
import logging

logger = logging.getLogger(__name__)


def create_attendance_notification(employee, event_type, message, time_log=None):
    """Helper function to create attendance notifications"""
    try:
        NotificationLog.objects.create(
            recipient=employee,
            notification_type='SYSTEM',
            event_type=event_type,
            subject=f'Attendance {event_type.replace("_", " ").title()}',
            message=message,
            recipient_address=employee.user.email,
            status='PENDING'
        )
        logger.info(f"Notification created for employee {employee.employee_id}: {event_type}")
    except Exception as e:
        logger.error(f"Failed to create notification for employee {employee.employee_id}: {str(e)}")


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


class TimeLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing time logs with comprehensive security and validation
    """
    queryset = TimeLog.objects.select_related(
        'employee__user', 'employee__role',
        'clock_in_location', 'clock_out_location'
    ).all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'employee', 'clock_in_method']
    search_fields = ['employee__employee_id', 'employee__user__first_name', 'employee__user__last_name']
    ordering_fields = ['clock_in_time', 'clock_out_time', 'created_at']
    ordering = ['-clock_in_time']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'retrieve':
            return TimeLogDetailSerializer
        return TimeLogSerializer
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        elif self.action in ['retrieve', 'list']:
            return [IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()

        # Anonymous users get no data
        if not self.request.user.is_authenticated:
            return queryset.none()

        # Non-admin users can only see their own time logs
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
                # Parse date and make it timezone-aware at start of day
                from django.utils import timezone
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if start.tzinfo is None:
                    start = timezone.make_aware(start)
                queryset = queryset.filter(clock_in_time__gte=start)
            except ValueError:
                pass

        if end_date:
            try:
                # Parse date and make it timezone-aware at end of day
                from django.utils import timezone
                from datetime import timedelta
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if end.tzinfo is None:
                    # Set to end of day (23:59:59.999999) to include all times on that date
                    end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
                    end = timezone.make_aware(end)
                queryset = queryset.filter(clock_in_time__lte=end)
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def clock_in(self, request):
        """Clock in endpoint with validation"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check employment status
        if employee.employment_status != 'ACTIVE':
            return Response(
                {'detail': 'Your employment status does not allow clock-in'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if employee has a scheduled shift that allows clock-in
        from apps.scheduling.models import Shift
        eligible_shift = Shift.get_clockin_eligible_shift(employee)
        # if not eligible_shift:
        #     return Response(
        #         {
        #             'detail': 'No scheduled shift found for clock-in. You can only clock in during scheduled shifts or within 15 minutes before shift start.',
        #             'requires_shift': True,
        #             'current_time': timezone.now().isoformat(),
        #         },
        #         status=status.HTTP_403_FORBIDDEN
        #     )

        # Check QR code enforcement
        if employee.requires_location_qr and employee.qr_enforcement_type != 'NONE':
            # Check if this is first clock-in of the day
            today = timezone.now().date()
            today_logs = TimeLog.objects.filter(
                employee=employee,
                clock_in_time__date=today
            ).exists()

            should_enforce_qr = False
            if employee.qr_enforcement_type == 'ALL_OPERATIONS':
                should_enforce_qr = True
            elif employee.qr_enforcement_type == 'FIRST_CLOCK_IN' and not today_logs:
                should_enforce_qr = True

            if should_enforce_qr:
                return Response(
                    {
                        'detail': 'You must use location QR code for clock-in',
                        'enforcement_type': employee.qr_enforcement_type,
                        'requires_qr': True
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = ClockInSerializer(data=request.data, context={'employee': employee})
        serializer.is_valid(raise_exception=True)
        
        # Get location if provided
        location = None
        if serializer.validated_data.get('location_id'):
            location = Location.objects.get(id=serializer.validated_data['location_id'])
        
        # Create time log
        time_log = TimeLog.objects.create(
            employee=employee,
            clock_in_time=timezone.now(),
            clock_in_location=location,
            clock_in_method=serializer.validated_data.get('method', 'PORTAL'),
            clock_in_latitude=serializer.validated_data.get('latitude'),
            clock_in_longitude=serializer.validated_data.get('longitude'),
            notes=serializer.validated_data.get('notes', ''),
            status='CLOCKED_IN'
        )
        
        logger.info(
            f"Clock-in: {employee.employee_id} at {time_log.clock_in_time} "
            f"via {time_log.clock_in_method}"
        )

        # Send automated notification
        notification_service.send_clock_in_notification(employee, time_log)

        response_serializer = TimeLogSerializer(time_log)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def clock_out(self, request):
        """Clock out endpoint with validation"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # CRITICAL FIX: Always allow clock-out if employee is clocked in
        # Shift enforcement should not prevent clock-out to avoid stuck sessions
        # Check if employee has a scheduled shift (for logging purposes only)
        from apps.scheduling.models import Shift
        eligible_shift = Shift.get_clockout_eligible_shift(employee)

        # Log if clocking out without scheduled shift (for compliance tracking)
        if not eligible_shift:
            logger.warning(
                f"Clock-out without scheduled shift: {employee.employee_id} at {timezone.now()}"
            )

        # Check QR code enforcement for clock-out
        if employee.requires_location_qr and employee.qr_enforcement_type == 'ALL_OPERATIONS':
            return Response(
                {
                    'detail': 'You must use location QR code for clock-out',
                    'enforcement_type': employee.qr_enforcement_type,
                    'requires_qr': True
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ClockOutSerializer(data=request.data, context={'employee': employee})
        serializer.is_valid(raise_exception=True)
        
        # Get the active time log from context
        time_log = serializer.context['active_log']
        
        # Get location if provided
        location = None
        if serializer.validated_data.get('location_id'):
            location = Location.objects.get(id=serializer.validated_data['location_id'])
        
        # Update time log
        time_log.clock_out_time = timezone.now()
        time_log.clock_out_location = location
        time_log.clock_out_method = serializer.validated_data.get('method', 'PORTAL')
        time_log.clock_out_latitude = serializer.validated_data.get('latitude')
        time_log.clock_out_longitude = serializer.validated_data.get('longitude')
        time_log.status = 'CLOCKED_OUT'
        
        # Append notes if provided
        if serializer.validated_data.get('notes'):
            if time_log.notes:
                time_log.notes += f"\n{serializer.validated_data['notes']}"
            else:
                time_log.notes = serializer.validated_data['notes']
        
        time_log.save()
        
        logger.info(
            f"Clock-out: {employee.employee_id} at {time_log.clock_out_time} "
            f"via {time_log.clock_out_method} - Duration: {time_log.duration_hours}h"
        )

        # Send automated notifications
        notification_service.send_clock_out_notification(employee, time_log)

        # Check for overtime and send alert if needed
        duration_hours = time_log.duration_hours or 0.0
        if duration_hours > 8:  # Standard 8-hour workday
            notification_service.send_overtime_alert(employee, duration_hours)

        response_serializer = TimeLogSerializer(time_log)
        return Response(response_serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def qr_scan(self, request):
        """QR code clock-in/out endpoint"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check employment status
        if employee.employment_status != 'ACTIVE':
            return Response(
                {'detail': 'Your employment status does not allow clock operations'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = QRCodeClockSerializer(data=request.data, context={'employee': employee})
        serializer.is_valid(raise_exception=True)

        action_type = serializer.validated_data['action']
        location = serializer.validated_data['location']
        notes = serializer.validated_data.get('notes', '')

        # Validate shift requirements for both clock in and clock out
        from apps.scheduling.models import Shift
        if action_type == 'clock_in':
            eligible_shift = Shift.get_clockin_eligible_shift(employee)
            # if not eligible_shift:
            #     return Response(
            #         {
            #             'detail': 'No scheduled shift found for clock-in. You can only clock in during scheduled shifts or within 15 minutes before shift start.',
            #             'requires_shift': True,
            #             'current_time': timezone.now().isoformat(),
            #         },
            #         status=status.HTTP_403_FORBIDDEN
            #     )
        else:  # clock_out
            # CRITICAL FIX: Always allow QR clock-out if employee is clocked in
            # Check if employee has a scheduled shift (for logging purposes only)
            eligible_shift = Shift.get_clockout_eligible_shift(employee)
            if not eligible_shift:
                logger.warning(
                    f"QR Clock-out without scheduled shift: {employee.employee_id} at {timezone.now()}"
                )

        if action_type == 'clock_in':
            # Create new time log
            time_log = TimeLog.objects.create(
                employee=employee,
                clock_in_time=timezone.now(),
                clock_in_location=location,
                clock_in_method='QR_CODE',
                notes=notes,
                status='CLOCKED_IN'
            )
            logger.info(f"QR Clock-in: {employee.employee_id} at {location.name}")
            # Send automated notification
            notification_service.send_clock_in_notification(employee, time_log)
            message = 'Successfully clocked in'
        else:
            # Update existing time log
            time_log = serializer.validated_data['active_log']
            time_log.clock_out_time = timezone.now()
            time_log.clock_out_location = location
            time_log.clock_out_method = 'QR_CODE'
            time_log.status = 'CLOCKED_OUT'
            if notes:
                time_log.notes = f"{time_log.notes}\n{notes}" if time_log.notes else notes
            time_log.save()
            logger.info(f"QR Clock-out: {employee.employee_id} at {location.name}")
            # Send automated notifications
            notification_service.send_clock_out_notification(employee, time_log)

            # Check for overtime
            duration_hours = time_log.duration_hours or 0.0
            if duration_hours > 8:
                notification_service.send_overtime_alert(employee, duration_hours)

            message = 'Successfully clocked out'
        
        response_serializer = TimeLogSerializer(time_log)
        return Response({
            'message': message,
            'time_log': response_serializer.data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def current_status(self, request):
        """Get current clock-in status"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()
        
        if active_log:
            duration = timezone.now() - active_log.clock_in_time
            duration_minutes = int(duration.total_seconds() / 60)
            duration_hours = round(duration_minutes / 60, 2)
            
            data = {
                'is_clocked_in': True,
                'clock_in_time': active_log.clock_in_time,
                'clock_in_location': active_log.clock_in_location.name if active_log.clock_in_location else None,
                'duration_minutes': duration_minutes,
                'duration_hours': duration_hours
            }
        else:
            data = {
                'is_clocked_in': False,
                'clock_in_time': None,
                'clock_in_location': None,
                'duration_minutes': None,
                'duration_hours': None
            }
        
        serializer = CurrentStatusSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def qr_enforcement_status(self, request):
        """Get QR code enforcement status for current user"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if QR is required for next operation
        today = timezone.now().date()
        today_logs = TimeLog.objects.filter(
            employee=employee,
            clock_in_time__date=today
        ).exists()

        # Determine if QR is required for clock-in
        requires_qr_for_clock_in = False
        requires_qr_for_clock_out = False

        if employee.requires_location_qr and employee.qr_enforcement_type != 'NONE':
            if employee.qr_enforcement_type == 'ALL_OPERATIONS':
                requires_qr_for_clock_in = True
                requires_qr_for_clock_out = True
            elif employee.qr_enforcement_type == 'FIRST_CLOCK_IN' and not today_logs:
                requires_qr_for_clock_in = True

        return Response({
            'requires_location_qr': employee.requires_location_qr,
            'qr_enforcement_type': employee.qr_enforcement_type,
            'requires_qr_for_clock_in': requires_qr_for_clock_in,
            'requires_qr_for_clock_out': requires_qr_for_clock_out,
            'has_clocked_in_today': today_logs
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def shift_status(self, request):
        """Get current shift status and eligibility for clock in/out"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        from apps.scheduling.models import Shift

        # Get current and upcoming shifts
        current_shift = Shift.get_current_shift(employee)
        upcoming_shift = Shift.get_upcoming_shift(employee, within_minutes=60)
        clockin_eligible_shift = Shift.get_clockin_eligible_shift(employee)
        # Note: clockout_eligible_shift removed - always allow clock-out if clocked in

        # Check current clock-in status
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        data = {
            'current_shift': None,
            'upcoming_shift': None,
            'can_clock_in': bool(clockin_eligible_shift and not active_log),
            'can_clock_out': bool(active_log),  # CRITICAL FIX: Always allow clock-out if clocked in
            'is_clocked_in': bool(active_log),
            'clock_in_time': active_log.clock_in_time if active_log else None,
            'clock_in_location': active_log.clock_in_location.name if active_log and active_log.clock_in_location else None,
            'duration_minutes': int((timezone.now() - active_log.clock_in_time).total_seconds() / 60) if active_log else None,
            'duration_hours': round((timezone.now() - active_log.clock_in_time).total_seconds() / 3600, 2) if active_log else None,
            'shift_enforcement_enabled': True,
            'current_time': timezone.now().isoformat(),
        }

        if current_shift:
            data['current_shift'] = {
                'id': str(current_shift.id),
                'start_time': current_shift.start_time.isoformat(),
                'end_time': current_shift.end_time.isoformat(),
                'location': current_shift.location,
                'is_current': current_shift.is_current,
            }

        if upcoming_shift:
            data['upcoming_shift'] = {
                'id': str(upcoming_shift.id),
                'start_time': upcoming_shift.start_time.isoformat(),
                'end_time': upcoming_shift.end_time.isoformat(),
                'location': upcoming_shift.location,
                'minutes_until_start': int((upcoming_shift.start_time - timezone.now()).total_seconds() / 60),
            }

        return Response(data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_logs(self, request):
        """Get current user's time logs"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query params
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        logs = TimeLog.objects.filter(
            employee=employee,
            clock_in_time__gte=start_date
        ).order_by('-clock_in_time')

        serializer = TimeLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def summary(self, request):
        """Get attendance summary for all employees"""
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = TimeLog.objects.filter(status='CLOCKED_OUT')

        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                queryset = queryset.filter(clock_in_time__gte=start)
            except ValueError:
                pass

        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                queryset = queryset.filter(clock_in_time__lte=end)
            except ValueError:
                pass

        # Aggregate data by employee
        summary_data = []
        employees = Employee.objects.filter(employment_status='ACTIVE')

        for employee in employees:
            employee_logs = queryset.filter(employee=employee)

            if employee_logs.exists():
                total_minutes = sum([log.duration_minutes for log in employee_logs if log.duration_minutes])
                total_hours = round(total_minutes / 60, 2) if total_minutes else 0

                # Count unique working days (not total entries)
                total_days = employee_logs.values('clock_in_time__date').distinct().count()
                avg_hours = round(total_hours / total_days, 2) if total_days else 0

                earliest = employee_logs.order_by('clock_in_time').first()
                latest = employee_logs.order_by('-clock_out_time').first()

                summary_data.append({
                    'employee_id': employee.employee_id,
                    'employee_name': employee.user.get_full_name(),
                    'total_days': total_days,
                    'total_hours': total_hours,
                    'average_hours_per_day': avg_hours,
                    'earliest_clock_in': earliest.clock_in_time if earliest else None,
                    'latest_clock_out': latest.clock_out_time if latest else None
                })

        serializer = AttendanceSummarySerializer(summary_data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def statistics(self, request):
        """Get attendance statistics"""
        today = timezone.localdate()

        # Today's stats
        today_clocked_in = TimeLog.objects.filter(
            clock_in_time__date=today,
            status='CLOCKED_IN'
        ).count()

        today_clocked_out = TimeLog.objects.filter(
            clock_in_time__date=today,
            status='CLOCKED_OUT'
        ).count()

        # This week's stats
        week_start = today - timedelta(days=today.weekday())
        week_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=week_start,
            status='CLOCKED_OUT'
        )

        week_total_minutes = sum([log.duration_minutes for log in week_logs if log.duration_minutes])
        week_total_hours = round(week_total_minutes / 60, 2) if week_total_minutes else 0

        # This month's stats
        month_start = today.replace(day=1)
        month_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=month_start,
            status='CLOCKED_OUT'
        )

        month_total_minutes = sum([log.duration_minutes for log in month_logs if log.duration_minutes])
        month_total_hours = round(month_total_minutes / 60, 2) if month_total_minutes else 0

        # Weekly breakdown for charts (last 7 days)
        weekly_breakdown = []
        for i in range(7):
            day = today - timedelta(days=6-i)  # Start from 6 days ago to today
            day_logs = TimeLog.objects.filter(
                clock_in_time__date=day,
                status='CLOCKED_OUT'
            )
            day_minutes = sum([log.duration_minutes for log in day_logs if log.duration_minutes])
            day_hours = round(day_minutes / 60, 2) if day_minutes else 0
            weekly_breakdown.append({
                'date': day.strftime('%Y-%m-%d'),
                'day_name': day.strftime('%a'),
                'hours': day_hours,
                'logs': day_logs.count()
            })

        # Monthly breakdown (last 4 weeks)
        monthly_breakdown = []
        for i in range(4):
            # Calculate start and end of each week
            # Start from current week and go backwards
            week_end_date = today - timedelta(days=today.weekday()) + timedelta(days=6) - timedelta(weeks=i)
            week_start_date = week_end_date - timedelta(days=6)
            
            week_logs_period = TimeLog.objects.filter(
                clock_in_time__date__gte=week_start_date,
                clock_in_time__date__lte=week_end_date,
                status='CLOCKED_OUT'
            )
            
            period_minutes = sum([log.duration_minutes for log in week_logs_period if log.duration_minutes])
            period_hours = round(period_minutes / 60, 2) if period_minutes else 0
            
            monthly_breakdown.append({
                'week_start': week_start_date.strftime('%Y-%m-%d'),
                'week_end': week_end_date.strftime('%Y-%m-%d'),
                'label': f"{week_start_date.strftime('%d %b')} - {week_end_date.strftime('%d %b')}",
                'hours': period_hours,
                'logs': week_logs_period.count()
            })
        
        # Reverse to show oldest to newest
        monthly_breakdown.reverse()

        return Response({
            'today': {
                'clocked_in': today_clocked_in,
                'clocked_out': today_clocked_out,
                'total': today_clocked_in + today_clocked_out
            },
            'this_week': {
                'total_logs': week_logs.count(),
                'total_hours': week_total_hours
            },
            'this_month': {
                'total_logs': month_logs.count(),
                'total_hours': month_total_hours
            },
            'weekly_breakdown': weekly_breakdown,
            'monthly_breakdown': monthly_breakdown
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def export(self, request):
        """Export employee time logs as detailed CSV timesheet"""
        import csv
        from django.http import HttpResponse
        from datetime import datetime, timedelta
        from apps.core.timezone_utils import convert_to_user_timezone

        # Get query parameters
        employee_id = request.query_params.get('employee_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Build queryset
        queryset = self.get_queryset().prefetch_related('breaks')

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        if start_date:
            try:
                start = datetime.fromisoformat(start_date)
                queryset = queryset.filter(clock_in_time__date__gte=start.date())
            except ValueError:
                pass

        if end_date:
            try:
                end = datetime.fromisoformat(end_date)
                queryset = queryset.filter(clock_in_time__date__lte=end.date())
            except ValueError:
                pass

        # Create CSV response
        response = HttpResponse(content_type='text/csv')

        # Generate filename
        if employee_id:
            try:
                employee = Employee.objects.get(id=employee_id)
                filename = f"{employee.user.first_name}_{employee.user.last_name}_timesheet"
            except Employee.DoesNotExist:
                filename = f"employee_{employee_id}_timesheet"
        else:
            filename = "all_employees_timesheet"

        if start_date and end_date:
            filename += f"_{start_date}_to_{end_date}"

        response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'

        # Write CSV data
        writer = csv.writer(response)
        
        # Define headers based on the user's requested format
        headers = [
            'Date', 'Day', 'Start Time', 'End Time', 'Total Hours',
            'Break 1 In', 'Break 1 Out', 'Break 1 Total',
            'Break 2 In', 'Break 2 Out', 'Break 2 Total',
            'Break 3 In', 'Break 3 Out', 'Break 3 Total',
            'Total Without Break', 'Finally Hours', '8 Hours', 'Over 8', 'Over 12'
        ]
        writer.writerow(headers)

        for log in queryset.order_by('clock_in_time'):
            # Convert main times to user's timezone
            clock_in = convert_to_user_timezone(log.clock_in_time, log.employee.user) if log.clock_in_time else None
            clock_out = convert_to_user_timezone(log.clock_out_time, log.employee.user) if log.clock_out_time else None
            
            # Basic info
            date_str = clock_in.strftime('%m/%d/%Y') if clock_in else ''
            day_str = clock_in.strftime('%A') if clock_in else ''
            start_time_str = clock_in.strftime('%H:%M') if clock_in else ''
            end_time_str = clock_out.strftime('%H:%M') if clock_out else ''
            
            # Gross Duration (Total Hours)
            gross_hours_decimal = 0.0
            gross_hours_str = ''
            if clock_in and clock_out:
                duration = clock_out - clock_in
                total_minutes = int(duration.total_seconds() / 60)
                h = total_minutes // 60
                m = total_minutes % 60
                gross_hours_str = f"{h}h {m}m"
                gross_hours_decimal = round(total_minutes / 60, 2)
            
            # Process Breaks
            breaks = list(log.breaks.all().order_by('start_time'))
            break_data = []
            total_deducted_minutes = 0
            
            # We support up to 3 breaks in the CSV
            for i in range(3):
                if i < len(breaks):
                    b = breaks[i]
                    b_start = convert_to_user_timezone(b.start_time, log.employee.user)
                    b_end = convert_to_user_timezone(b.end_time, log.employee.user) if b.end_time else None
                    
                    b_in = b_start.strftime('%H:%M') if b_start else ''
                    b_out = b_end.strftime('%H:%M') if b_end else ''
                    
                    b_total_str = ''
                    b_minutes = 0
                    if b_start and b_end:
                        b_duration = b_end - b_start
                        b_minutes = int(b_duration.total_seconds() / 60)
                        bh = b_minutes // 60
                        bm = b_minutes % 60
                        b_total_str = f"{bh}h {bm}m"
                    
                    break_data.extend([b_in, b_out, b_total_str])
                    
                    # Check if deducted (Lunch is typically deducted)
                    if b.break_type == 'LUNCH':
                        total_deducted_minutes += b_minutes
                else:
                    break_data.extend(['', '', ''])

            # Net Hours (Total Without Break)
            # Net = Gross - Deducted Breaks
            # Note: If gross is calculated from clock in to clock out, it includes the break time.
            # So we subtract the deducted break time.
            
            net_minutes = 0
            if clock_in and clock_out:
                total_minutes = int((clock_out - clock_in).total_seconds() / 60)
                net_minutes = total_minutes - total_deducted_minutes
            
            net_hours_str = ''
            finally_hours_decimal = 0.0
            
            if net_minutes > 0:
                nh = net_minutes // 60
                nm = net_minutes % 60
                net_hours_str = f"{nh}h {nm}m"
                finally_hours_decimal = round(net_minutes / 60, 2)
            
            # Overtime Calculations
            reg_hours = 0.0
            over_8 = 0.0
            over_12 = 0.0
            
            if finally_hours_decimal > 12:
                reg_hours = 8.0
                over_8 = 4.0
                over_12 = finally_hours_decimal - 12.0
            elif finally_hours_decimal > 8:
                reg_hours = 8.0
                over_8 = finally_hours_decimal - 8.0
                over_12 = 0.0
            else:
                reg_hours = finally_hours_decimal
                over_8 = 0.0
                over_12 = 0.0

            # Construct Row
            row = [
                date_str,
                day_str,
                start_time_str,
                end_time_str,
                gross_hours_str,
                *break_data, # Unpack the 9 break columns
                net_hours_str,
                f"{finally_hours_decimal:.2f}",
                f"{reg_hours:.2f}",
                f"{over_8:.2f}",
                f"{over_12:.2f}"
            ]
            writer.writerow(row)

        logger.info(f"Detailed timesheet exported by admin user {request.user.username}")
        return response


class BreakViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing employee breaks with security and validation
    """
    queryset = Break.objects.select_related(
        'time_log__employee__user', 'time_log__employee__role'
    ).all()
    serializer_class = BreakSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['break_type', 'time_log__employee']
    search_fields = ['time_log__employee__employee_id', 'time_log__employee__user__first_name', 'time_log__employee__user__last_name']
    ordering_fields = ['start_time', 'end_time', 'created_at']
    ordering = ['-start_time']

    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        elif self.action in ['retrieve', 'list']:
            return [IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()

        # Check if user is authenticated
        if not self.request.user.is_authenticated:
            return queryset.none()

        # Non-admin users can only see their own breaks
        if not self.request.user.is_staff:
            try:
                employee = Employee.objects.get(user=self.request.user)
                queryset = queryset.filter(time_log__employee=employee)
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





    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def start_break(self, request):
        """Start a new break"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check employment status
        if employee.employment_status != 'ACTIVE':
            return Response(
                {'detail': 'Your employment status does not allow break operations'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = BreakStartSerializer(data=request.data, context={'employee': employee})
        serializer.is_valid(raise_exception=True)

        # Get the active time log from context
        active_time_log = serializer.context['active_time_log']

        # Create break
        break_instance = Break.objects.create(
            time_log=active_time_log,
            break_type=serializer.validated_data['break_type'],
            start_time=timezone.now(),
            notes=serializer.validated_data.get('notes', '')
        )

        logger.info(
            f"Break started: {employee.employee_id} - {break_instance.get_break_type_display()} "
            f"at {break_instance.start_time}"
        )

        # Create notification
        message = f"Employee {employee.user.get_full_name()} started a {break_instance.get_break_type_display()} at {break_instance.start_time.strftime('%Y-%m-%d %H:%M:%S')}"
        create_attendance_notification(employee, 'break_started', message, active_time_log)

        response_serializer = BreakSerializer(break_instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def end_break(self, request, pk=None):
        """End an active break"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        break_instance = self.get_object()

        # Check if user owns this break or is admin
        if not request.user.is_staff and break_instance.time_log.employee != employee:
            return Response(
                {'detail': 'You can only end your own breaks'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if break is already ended
        if break_instance.end_time:
            return Response(
                {'detail': 'This break has already been ended'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = BreakEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # End the break
        break_instance.end_time = timezone.now()

        # Append notes if provided
        if serializer.validated_data.get('notes'):
            if break_instance.notes:
                break_instance.notes += f"\n{serializer.validated_data['notes']}"
            else:
                break_instance.notes = serializer.validated_data['notes']

        break_instance.save()

        logger.info(
            f"Break ended: {employee.employee_id} - {break_instance.get_break_type_display()} "
            f"at {break_instance.end_time} - Duration: {break_instance.duration_minutes}min"
        )

        # Create notification
        message = f"Employee {employee.user.get_full_name()} ended a {break_instance.get_break_type_display()} at {break_instance.end_time.strftime('%Y-%m-%d %H:%M:%S')}. Duration: {break_instance.duration_minutes} minutes"
        create_attendance_notification(employee, 'break_ended', message, break_instance.time_log)

        response_serializer = BreakSerializer(break_instance)
        return Response(response_serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_breaks(self, request):
        """Get current user's breaks"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query params
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        breaks = Break.objects.filter(
            time_log__employee=employee,
            start_time__gte=start_date
        ).order_by('-start_time')

        serializer = BreakSerializer(breaks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def active_break(self, request):
        """Get current user's active break if any"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find active time log
        active_time_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if not active_time_log:
            return Response({
                'has_active_break': False,
                'break': None
            })

        # Find active break
        active_break = Break.objects.filter(
            time_log=active_time_log,
            end_time__isnull=True
        ).first()

        if active_break:
            serializer = BreakSerializer(active_break)
            return Response({
                'has_active_break': True,
                'break': serializer.data
            })
        else:
            return Response({
                'has_active_break': False,
                'break': None
            })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def waive_break(self, request):
        """Waive required break with reason"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check employment status
        if employee.employment_status != 'ACTIVE':
            return Response(
                {'detail': 'Your employment status does not allow break operations'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get active time log
        active_time_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if not active_time_log:
            return Response(
                {'detail': 'You must be clocked in to waive a break'},
                status=status.HTTP_400_BAD_REQUEST
            )

        waiver_reason = request.data.get('reason', '').strip()
        if not waiver_reason:
            return Response(
                {'detail': 'Waiver reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use break compliance manager
        from .break_compliance import BreakComplianceManager
        compliance_manager = BreakComplianceManager()

        break_waiver = compliance_manager.record_break_waiver(
            employee, active_time_log, waiver_reason
        )

        if break_waiver:
            logger.info(f"Break waived by {employee.employee_id}: {waiver_reason}")
            return Response({
                'message': 'Break waiver recorded successfully',
                'waiver_id': break_waiver.id,
                'reason': waiver_reason,
                'timestamp': break_waiver.start_time
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(
                {'detail': 'Failed to record break waiver'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def decline_break_reminder(self, request):
        """Decline break reminder with reason"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get active time log
        active_time_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN'
        ).first()

        if not active_time_log:
            return Response(
                {'detail': 'You must be clocked in to decline break reminder'},
                status=status.HTTP_400_BAD_REQUEST
            )

        decline_reason = request.data.get('reason', '').strip()
        if not decline_reason:
            return Response(
                {'detail': 'Decline reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use break compliance manager
        from .break_compliance import BreakComplianceManager
        compliance_manager = BreakComplianceManager()

        success = compliance_manager.record_break_rejection(
            employee, active_time_log, decline_reason
        )

        if success:
            logger.info(f"Break reminder declined by {employee.employee_id}: {decline_reason}")
            return Response({
                'message': 'Break reminder decline recorded',
                'reason': decline_reason,
                'timestamp': timezone.now()
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'detail': 'Failed to record break decline'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def break_requirements(self, request):
        """Get current break requirements for logged-in employee"""
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Get active time log
            active_time_log = TimeLog.objects.filter(
                employee=employee,
                status='CLOCKED_IN'
            ).first()

            if not active_time_log:
                return Response({
                    'requires_break': False,
                    'reason': 'Not currently clocked in'
                })

            # Use break compliance manager
            from .break_compliance import BreakComplianceManager
            compliance_manager = BreakComplianceManager()

            requirements = compliance_manager.check_break_requirements(employee, active_time_log)

            # If break is required and this is a fresh check, trigger immediate notification
            if requirements['requires_break']:
                # Check if we haven't sent a notification recently (within last 10 minutes)
                last_reminder_time = active_time_log.break_reminder_sent_at
                current_time = timezone.now()

                should_send_notification = (
                    not last_reminder_time or
                    (current_time - last_reminder_time).total_seconds() > 600  # 10 minutes
                )

                if should_send_notification:
                    try:
                        from .break_compliance import send_immediate_break_notification
                        send_immediate_break_notification.delay(str(employee.id), str(active_time_log.id))

                        # Update the reminder timestamp
                        active_time_log.break_reminder_sent_at = current_time
                        active_time_log.break_reminder_count += 1
                        active_time_log.save()

                        requirements['notification_triggered'] = True
                    except Exception as e:
                        logger.error(f"Failed to send break notification: {str(e)}")
                        requirements['notification_error'] = str(e)

            return Response(requirements)
        except Exception as e:
            logger.error(f"Error in break_requirements: {str(e)}")
            return Response(
                {'detail': f'Error calculating break requirements: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def stuck_clockins(self, request):
        """Get dashboard data for stuck clock-ins (Admin only)"""
        from .stuck_clockin_monitor import StuckClockInManager

        manager = StuckClockInManager()
        dashboard_data = manager.get_stuck_clockin_dashboard_data()

        return Response(dashboard_data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def force_clockout(self, request):
        """Force clock-out for stuck employees (Admin only)"""
        employee_id = request.data.get('employee_id')
        clockout_time = request.data.get('clockout_time')
        reason = request.data.get('reason', 'Admin force clock-out')

        if not employee_id:
            return Response(
                {'detail': 'Employee ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee = Employee.objects.get(employee_id=employee_id)
        except Employee.DoesNotExist:
            return Response(
                {'detail': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find active time log
        active_log = TimeLog.objects.filter(
            employee=employee,
            status='CLOCKED_IN',
            clock_out_time__isnull=True
        ).first()

        if not active_log:
            return Response(
                {'detail': 'No active clock-in found for this employee'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse clockout time if provided
        if clockout_time:
            try:
                from django.utils.dateparse import parse_datetime
                parsed_time = parse_datetime(clockout_time)
                if not parsed_time:
                    raise ValueError("Invalid datetime format")
                clockout_time = parsed_time
            except ValueError:
                return Response(
                    {'detail': 'Invalid clockout_time format. Use ISO format.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Default to current time
            clockout_time = timezone.now()

        # Validate clockout time is after clock-in time
        if clockout_time <= active_log.clock_in_time:
            return Response(
                {'detail': 'Clock-out time must be after clock-in time'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Perform force clock-out
        with transaction.atomic():
            active_log.clock_out_time = clockout_time
            active_log.clock_out_method = 'ADMIN'
            active_log.status = 'CLOCKED_OUT'

            # Add admin note
            admin_note = f"\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] ADMIN FORCE CLOCK-OUT by {request.user.username}: {reason}"
            active_log.notes = (active_log.notes or "") + admin_note

            active_log.save()

        logger.info(f"Admin {request.user.username} force-clocked out {employee.employee_id}")

        return Response({
            'message': 'Employee successfully clocked out',
            'employee_id': employee.employee_id,
            'clockout_time': clockout_time,
            'duration_hours': active_log.duration_hours
        })

