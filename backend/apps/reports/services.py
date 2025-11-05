"""
Report generation services for WorkSync
"""
import csv
import json
from datetime import datetime, timedelta
from django.db.models import Q, Count, Sum, Avg, F, Case, When, IntegerField
from django.utils import timezone
from django.http import HttpResponse
from apps.attendance.models import TimeLog, Break
from apps.employees.models import Employee
from apps.scheduling.models import Shift
from .models import ReportExecution
import logging

logger = logging.getLogger(__name__)


class ReportGenerator:
    """Base class for report generation"""
    
    def __init__(self, start_date, end_date, filters=None):
        self.start_date = start_date
        self.end_date = end_date
        self.filters = filters or {}
    
    def generate(self, format='CSV'):
        """Generate report in specified format"""
        data = self.get_data()
        
        if format == 'CSV':
            return self.to_csv(data)
        elif format == 'JSON':
            return self.to_json(data)
        elif format == 'PDF':
            return self.to_pdf(data)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def get_data(self):
        """Override in subclasses to return report data"""
        raise NotImplementedError
    
    def to_csv(self, data):
        """Convert data to CSV format"""
        if not data:
            return ""
        
        output = []
        if isinstance(data, list) and data:
            # Get headers from first item
            headers = list(data[0].keys())
            output.append(','.join(headers))
            
            # Add data rows
            for row in data:
                values = [str(row.get(header, '')) for header in headers]
                output.append(','.join(values))
        
        return '\n'.join(output)
    
    def to_json(self, data):
        """Convert data to JSON format"""
        return json.dumps(data, indent=2, default=str)
    
    def to_pdf(self, data):
        """Convert data to PDF format (placeholder)"""
        # TODO: Implement PDF generation using reportlab
        return "PDF generation not implemented yet"


class LateArrivalReportGenerator(ReportGenerator):
    """Generate late arrival reports"""
    
    def get_data(self):
        """Get late arrival data"""
        # Get all time logs in date range
        time_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=self.start_date,
            clock_in_time__date__lte=self.end_date,
            status='CLOCKED_OUT'
        ).select_related('employee__user', 'clock_in_location')
        
        # Apply filters
        if 'department' in self.filters:
            time_logs = time_logs.filter(employee__department=self.filters['department'])
        if 'employee_ids' in self.filters:
            time_logs = time_logs.filter(employee__employee_id__in=self.filters['employee_ids'])
        
        late_arrivals = []
        
        for log in time_logs:
            # Get scheduled shift for this date
            shift = Shift.objects.filter(
                employee=log.employee,
                start_time__date=log.clock_in_time.date()
            ).first()
            
            if shift:
                scheduled_time = shift.start_time.time()
                actual_time = log.clock_in_time.time()
                
                # Calculate if late (more than 5 minutes grace period)
                scheduled_datetime = datetime.combine(log.clock_in_time.date(), scheduled_time)
                actual_datetime = log.clock_in_time.replace(tzinfo=None)
                
                if actual_datetime > scheduled_datetime + timedelta(minutes=5):
                    minutes_late = int((actual_datetime - scheduled_datetime).total_seconds() / 60)
                    
                    late_arrivals.append({
                        'employee_id': log.employee.employee_id,
                        'employee_name': log.employee.user.get_full_name(),
                        'department': log.employee.department or '',
                        'date': log.clock_in_time.date(),
                        'scheduled_time': scheduled_time,
                        'actual_time': actual_time,
                        'minutes_late': minutes_late,
                        'location': log.clock_in_location.name if log.clock_in_location else ''
                    })
        
        return sorted(late_arrivals, key=lambda x: (x['date'], x['employee_id']))


class OvertimeReportGenerator(ReportGenerator):
    """Generate overtime reports"""
    
    def get_data(self):
        """Get overtime data"""
        # Get all completed time logs in date range
        time_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=self.start_date,
            clock_in_time__date__lte=self.end_date,
            status='CLOCKED_OUT'
        ).select_related('employee__user')
        
        # Apply filters
        if 'department' in self.filters:
            time_logs = time_logs.filter(employee__department=self.filters['department'])
        if 'employee_ids' in self.filters:
            time_logs = time_logs.filter(employee__employee_id__in=self.filters['employee_ids'])
        
        overtime_data = []
        
        for log in time_logs:
            if log.duration_hours and log.duration_hours > 8:
                regular_hours = 8.0
                overtime_hours = log.duration_hours - 8.0
                
                # Calculate overtime pay if hourly rate is available
                overtime_pay = None
                if log.employee.hourly_rate:
                    overtime_pay = float(log.employee.hourly_rate) * overtime_hours * 1.5  # 1.5x rate
                
                overtime_data.append({
                    'employee_id': log.employee.employee_id,
                    'employee_name': log.employee.user.get_full_name(),
                    'department': log.employee.department or '',
                    'date': log.clock_in_time.date(),
                    'regular_hours': regular_hours,
                    'overtime_hours': round(overtime_hours, 2),
                    'total_hours': log.duration_hours,
                    'hourly_rate': log.employee.hourly_rate,
                    'overtime_pay': round(overtime_pay, 2) if overtime_pay else None
                })
        
        return sorted(overtime_data, key=lambda x: (x['date'], x['employee_id']))


class DepartmentSummaryReportGenerator(ReportGenerator):
    """Generate department summary reports"""
    
    def get_data(self):
        """Get department summary data"""
        # Get all employees grouped by department
        departments = Employee.objects.filter(
            employment_status='ACTIVE'
        ).values('department').distinct()
        
        summary_data = []
        
        for dept in departments:
            department = dept['department'] or 'Unassigned'
            
            # Get employees in this department
            employees = Employee.objects.filter(
                employment_status='ACTIVE',
                department=department if department != 'Unassigned' else ''
            )
            
            # Get time logs for these employees in date range
            time_logs = TimeLog.objects.filter(
                employee__in=employees,
                clock_in_time__date__gte=self.start_date,
                clock_in_time__date__lte=self.end_date,
                status='CLOCKED_OUT'
            )
            
            # Calculate metrics
            total_hours = sum([log.duration_hours for log in time_logs if log.duration_hours]) or 0
            employee_count = employees.count()
            avg_hours = round(total_hours / employee_count, 2) if employee_count > 0 else 0
            
            # Count late arrivals (simplified - assumes 9 AM start)
            late_arrivals = time_logs.filter(
                clock_in_time__time__gt='09:05:00'
            ).count()
            
            # Count overtime hours
            overtime_hours = sum([
                log.duration_hours - 8 for log in time_logs 
                if log.duration_hours and log.duration_hours > 8
            ]) or 0
            
            # Calculate attendance rate (days worked vs expected days)
            expected_days = (self.end_date - self.start_date).days + 1
            actual_days = time_logs.values('clock_in_time__date').distinct().count()
            attendance_rate = round((actual_days / (expected_days * employee_count)) * 100, 2) if employee_count > 0 else 0
            
            summary_data.append({
                'department': department,
                'employee_count': employee_count,
                'total_hours': round(total_hours, 2),
                'average_hours_per_employee': avg_hours,
                'late_arrivals': late_arrivals,
                'overtime_hours': round(overtime_hours, 2),
                'attendance_rate': attendance_rate
            })
        
        return sorted(summary_data, key=lambda x: x['department'])


class AttendanceSummaryReportGenerator(ReportGenerator):
    """Generate attendance summary reports"""
    
    def get_data(self):
        """Get attendance summary data"""
        # Get all active employees
        employees = Employee.objects.filter(employment_status='ACTIVE')
        
        # Apply filters
        if 'department' in self.filters:
            employees = employees.filter(department=self.filters['department'])
        if 'employee_ids' in self.filters:
            employees = employees.filter(employee_id__in=self.filters['employee_ids'])
        
        summary_data = []
        
        for employee in employees:
            # Get time logs for this employee in date range
            time_logs = TimeLog.objects.filter(
                employee=employee,
                clock_in_time__date__gte=self.start_date,
                clock_in_time__date__lte=self.end_date,
                status='CLOCKED_OUT'
            )
            
            if time_logs.exists():
                total_hours = sum([log.duration_hours for log in time_logs if log.duration_hours]) or 0

                # Count unique working days (not total entries)
                total_days = time_logs.values('clock_in_time__date').distinct().count()
                avg_hours = round(total_hours / total_days, 2) if total_days > 0 else 0
                
                # Count late arrivals
                late_arrivals = time_logs.filter(
                    clock_in_time__time__gt='09:05:00'
                ).count()
                
                # Count overtime days
                overtime_days = time_logs.filter(
                    clock_in_time__date__in=[
                        log.clock_in_time.date() for log in time_logs 
                        if log.duration_hours and log.duration_hours > 8
                    ]
                ).values('clock_in_time__date').distinct().count()
                
                # Calculate break compliance rate
                break_compliance_rate = self._calculate_break_compliance_rate(employee, time_logs)
                
                summary_data.append({
                    'employee_id': employee.employee_id,
                    'employee_name': employee.user.get_full_name(),
                    'department': employee.department or '',
                    'total_days_worked': total_days,
                    'total_hours': round(total_hours, 2),
                    'average_hours_per_day': avg_hours,
                    'late_arrivals': late_arrivals,
                    'overtime_days': overtime_days,
                    'break_compliance_rate': break_compliance_rate
                })
        
        return sorted(summary_data, key=lambda x: x['employee_id'])

    def _calculate_break_compliance_rate(self, employee, time_logs):
        """Calculate break compliance rate for an employee"""
        from apps.attendance.models import Break

        if not time_logs.exists():
            return 0.0

        total_work_days = 0
        compliant_days = 0

        # Group time logs by date
        work_days = {}
        for log in time_logs:
            date = log.clock_in_time.date()
            if date not in work_days:
                work_days[date] = []
            work_days[date].append(log)

        for date, daily_logs in work_days.items():
            total_work_days += 1

            # Calculate total hours worked that day
            total_hours = sum([log.duration_hours for log in daily_logs if log.duration_hours]) or 0

            # Check if breaks were taken appropriately
            breaks_taken = Break.objects.filter(
                time_log__in=daily_logs,
                end_time__isnull=False  # Only completed breaks
            )

            # Basic compliance rules:
            # - If worked 6+ hours, should have taken at least one break of 30+ minutes
            # - If worked 4-6 hours, should have taken at least one break of 15+ minutes
            is_compliant = True

            if total_hours >= 6:
                # Need at least one 30+ minute break
                long_breaks = breaks_taken.filter(duration_minutes__gte=30)
                if not long_breaks.exists():
                    is_compliant = False
            elif total_hours >= 4:
                # Need at least one 15+ minute break
                short_breaks = breaks_taken.filter(duration_minutes__gte=15)
                if not short_breaks.exists():
                    is_compliant = False

            if is_compliant:
                compliant_days += 1

        if total_work_days == 0:
            return 0.0

        return round((compliant_days / total_work_days) * 100, 1)


def get_report_generator(report_type):
    """Factory function to get appropriate report generator"""
    generators = {
        'LATE_ARRIVAL': LateArrivalReportGenerator,
        'OVERTIME': OvertimeReportGenerator,
        'DEPARTMENT_SUMMARY': DepartmentSummaryReportGenerator,
        'ATTENDANCE_SUMMARY': AttendanceSummaryReportGenerator,
    }

    generator_class = generators.get(report_type)
    if not generator_class:
        raise ValueError(f"Unknown report type: {report_type}")

    return generator_class


def generate_report_file(execution_id):
    """Generate report file for a given execution"""
    try:
        execution = ReportExecution.objects.get(id=execution_id)
        execution.status = 'RUNNING'
        execution.started_at = timezone.now()
        execution.save()

        # Get report generator
        generator_class = get_report_generator(execution.template.report_type)
        generator = generator_class(
            execution.start_date,
            execution.end_date,
            execution.filters
        )

        # Generate report
        report_content = generator.generate(execution.template.format)

        # Save to file (simplified - in production, use proper file storage)
        import os
        from django.conf import settings

        reports_dir = os.path.join(settings.MEDIA_ROOT, 'reports')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"report_{execution.id}.{execution.template.format.lower()}"
        file_path = os.path.join(reports_dir, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        # Update execution
        execution.status = 'COMPLETED'
        execution.completed_at = timezone.now()
        execution.file_path = file_path
        execution.file_size = os.path.getsize(file_path)
        execution.record_count = len(generator.get_data()) if hasattr(generator, 'get_data') else 0
        execution.progress = 100
        execution.save()

        logger.info(f"Report generated successfully: {execution.id}")

    except Exception as e:
        logger.error(f"Report generation failed: {execution_id} - {str(e)}")
        execution.status = 'FAILED'
        execution.error_message = str(e)
        execution.completed_at = timezone.now()
        execution.save()
