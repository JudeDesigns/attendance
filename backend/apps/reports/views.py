"""
Reports views for WorkSync
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from django.utils import timezone
from django.db.models import Count, Sum, Avg
from datetime import datetime, timedelta
from .models import ReportTemplate, ReportExecution, ReportSchedule
from .serializers import (
    ReportTemplateSerializer, ReportExecutionSerializer, ReportScheduleSerializer,
    ReportGenerationSerializer, LateArrivalReportSerializer, OvertimeReportSerializer,
    DepartmentSummarySerializer, AttendanceSummaryReportSerializer, ReportStatsSerializer
)
from .services import get_report_generator, generate_report_file
import logging
import os

logger = logging.getLogger(__name__)


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report templates"""
    queryset = ReportTemplate.objects.all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter templates based on user permissions"""
        queryset = super().get_queryset()
        
        # Non-admin users can only see active templates
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by when creating template"""
        serializer.save(created_by=self.request.user)


class ReportExecutionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report executions"""
    queryset = ReportExecution.objects.all()
    serializer_class = ReportExecutionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter executions based on user permissions"""
        queryset = super().get_queryset()
        
        # Non-admin users can only see their own executions
        if not self.request.user.is_staff:
            queryset = queryset.filter(requested_by=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set requested_by when creating execution"""
        serializer.save(requested_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download generated report file"""
        execution = self.get_object()
        
        if execution.status != 'COMPLETED':
            return Response(
                {'detail': 'Report is not ready for download'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if execution.is_expired:
            return Response(
                {'detail': 'Report file has expired'},
                status=status.HTTP_410_GONE
            )
        
        if not execution.file_path or not os.path.exists(execution.file_path):
            return Response(
                {'detail': 'Report file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Serve file
        with open(execution.file_path, 'rb') as f:
            response = HttpResponse(f.read())
            
        # Set appropriate content type
        if execution.template.format == 'CSV':
            response['Content-Type'] = 'text/csv'
        elif execution.template.format == 'JSON':
            response['Content-Type'] = 'application/json'
        elif execution.template.format == 'PDF':
            response['Content-Type'] = 'application/pdf'
        
        filename = f"{execution.template.name}_{execution.start_date}_{execution.end_date}.{execution.template.format.lower()}"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response


class ReportScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report schedules"""
    queryset = ReportSchedule.objects.all()
    serializer_class = ReportScheduleSerializer
    permission_classes = [permissions.IsAdminUser]
    
    def perform_create(self, serializer):
        """Set created_by when creating schedule"""
        serializer.save(created_by=self.request.user)


class ReportsViewSet(viewsets.ViewSet):
    """ViewSet for report generation and analytics"""
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a report on-demand"""
        serializer = ReportGenerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Get template
        try:
            template = ReportTemplate.objects.get(id=data['template_id'])
        except ReportTemplate.DoesNotExist:
            return Response(
                {'detail': 'Report template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create execution record
        execution = ReportExecution.objects.create(
            template=template,
            start_date=data['start_date'],
            end_date=data['end_date'],
            filters=data.get('filters', {}),
            requested_by=request.user
        )
        
        # Generate report asynchronously (in production, use Celery)
        try:
            generate_report_file(execution.id)
        except Exception as e:
            logger.error(f"Report generation failed: {str(e)}")
            return Response(
                {'detail': 'Report generation failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'execution_id': execution.id,
            'status': 'COMPLETED',
            'message': 'Report generated successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def late_arrivals(self, request):
        """Get late arrival report data"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
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
        
        # Get filters
        filters = {}
        if request.query_params.get('department'):
            filters['department'] = request.query_params.get('department')
        
        # Generate report
        generator = get_report_generator('LATE_ARRIVAL')(start_date, end_date, filters)
        data = generator.get_data()
        
        serializer = LateArrivalReportSerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overtime(self, request):
        """Get overtime report data"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
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
        
        # Get filters
        filters = {}
        if request.query_params.get('department'):
            filters['department'] = request.query_params.get('department')
        
        # Generate report
        generator = get_report_generator('OVERTIME')(start_date, end_date, filters)
        data = generator.get_data()
        
        serializer = OvertimeReportSerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def department_summary(self, request):
        """Get department summary report data"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
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
        
        # Generate report
        generator = get_report_generator('DEPARTMENT_SUMMARY')(start_date, end_date)
        data = generator.get_data()
        
        serializer = DepartmentSummarySerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def attendance_summary(self, request):
        """Get attendance summary report data"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
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
        
        # Get filters
        filters = {}
        if request.query_params.get('department'):
            filters['department'] = request.query_params.get('department')
        
        # Generate report
        generator = get_report_generator('ATTENDANCE_SUMMARY')(start_date, end_date, filters)
        data = generator.get_data()
        
        serializer = AttendanceSummaryReportSerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser])
    def stats(self, request):
        """Get report statistics"""
        # Calculate statistics
        total_reports = ReportExecution.objects.count()
        
        # Reports this month
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        reports_this_month = ReportExecution.objects.filter(
            created_at__gte=month_start
        ).count()
        
        # Most popular report type
        popular_type = ReportTemplate.objects.annotate(
            execution_count=Count('executions')
        ).order_by('-execution_count').first()
        
        most_popular_type = popular_type.get_report_type_display() if popular_type else 'None'
        
        # Average generation time
        completed_executions = ReportExecution.objects.filter(
            status='COMPLETED',
            started_at__isnull=False,
            completed_at__isnull=False
        )
        
        avg_time = 0
        if completed_executions.exists():
            total_time = sum([
                (exec.completed_at - exec.started_at).total_seconds()
                for exec in completed_executions
            ])
            avg_time = total_time / completed_executions.count()
        
        # Total file size
        total_file_size = ReportExecution.objects.filter(
            status='COMPLETED',
            file_size__isnull=False
        ).aggregate(total=Sum('file_size'))['total'] or 0
        
        # Active schedules
        active_schedules = ReportSchedule.objects.filter(is_active=True).count()
        
        data = {
            'total_reports': total_reports,
            'reports_this_month': reports_this_month,
            'most_popular_type': most_popular_type,
            'average_generation_time': round(avg_time, 2),
            'total_file_size': total_file_size,
            'active_schedules': active_schedules
        }
        
        serializer = ReportStatsSerializer(data)
        return Response(serializer.data)
