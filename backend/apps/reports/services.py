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


class DetailedTimesheetReportGenerator(ReportGenerator):
    """Generate detailed timesheet report matching user requirements"""

    @staticmethod
    def _to_la(dt):
        """Convert a datetime to America/Los_Angeles; return None if dt is None."""
        if dt is None:
            return None
        import pytz
        la_tz = pytz.timezone('America/Los_Angeles')
        if timezone.is_naive(dt):
            return la_tz.localize(dt)
        return dt.astimezone(la_tz)

    def _build_row(self, log):
        """Build a single timesheet row from a TimeLog entry"""
        clock_in_la = self._to_la(log.clock_in_time)
        clock_out_la = self._to_la(log.clock_out_time)

        date = clock_in_la.date()
        day_name = date.strftime('%A')
        start_time = clock_in_la.strftime('%H:%M')
        end_time = clock_out_la.strftime('%H:%M') if clock_out_la else ''

        # Strip seconds for calculation to exactly match the formatted HH:MM strings
        clock_in_min = clock_in_la.replace(second=0, microsecond=0)
        effective_end = clock_out_la or self._to_la(timezone.now())
        effective_end_min = effective_end.replace(second=0, microsecond=0)
        
        total_duration_minutes = int((effective_end_min - clock_in_min).total_seconds() // 60)
        total_hours_decimal = total_duration_minutes / 60.0

        # Format total hours as "Xh Ym"
        hours = total_duration_minutes // 60
        minutes = total_duration_minutes % 60
        total_hours_str = f"{hours}h {minutes}m"

        # Process breaks (up to 3)
        breaks = list(log.breaks.all().order_by('start_time'))
        break_data = {}
        total_all_break_minutes = 0   # Sum of ALL break time (for "Total Break" display)
        total_deducted_minutes = 0    # Only the deducted portion (for hours calculation)

        for i in range(3):
            prefix = f"break_{i+1}"
            if i < len(breaks):
                b = breaks[i]
                b_start_la = self._to_la(b.start_time)
                b_end_la = self._to_la(b.end_time)
                b_start = b_start_la.strftime('%H:%M') if b_start_la else ''
                b_end = b_end_la.strftime('%H:%M') if b_end_la else ''

                b_duration_str = ''
                if b.end_time:
                    b_start_min = b_start_la.replace(second=0, microsecond=0)
                    b_end_min = b_end_la.replace(second=0, microsecond=0)
                    b_minutes = int((b_end_min - b_start_min).total_seconds() // 60)
                    
                    total_all_break_minutes += b_minutes
                    # Deduction rules:
                    # - LUNCH (Break 2): fully deducted
                    # - SHORT (Break 1 & 3): first 10 min free, excess is deducted
                    if b.break_type == 'LUNCH':
                        total_deducted_minutes += b_minutes
                    elif b.break_type == 'SHORT' and b_minutes > 10:
                        total_deducted_minutes += (b_minutes - 10)
                    b_h = b_minutes // 60
                    b_m = b_minutes % 60
                    b_duration_str = f"{b_h:02d} {b_m:02d}"

                break_data[f'{prefix}_in'] = b_start
                break_data[f'{prefix}_out'] = b_end
                break_data[f'{prefix}_total'] = b_duration_str
            else:
                break_data[f'{prefix}_in'] = ''
                break_data[f'{prefix}_out'] = ''
                break_data[f'{prefix}_total'] = ''

        # Total break string (shows ALL break time, not just deducted)
        tb_h = total_all_break_minutes // 60
        tb_m = total_all_break_minutes % 60
        total_break_str = f"{tb_h:02d} {tb_m:02d}" if total_all_break_minutes > 0 else ''

        # Deducted break string (for "Total W/O Break" column)
        db_h = total_deducted_minutes // 60
        db_m = total_deducted_minutes % 60
        total_deducted_str = f"{db_h:02d} {db_m:02d}" if total_deducted_minutes > 0 else ''

        # Calculate final hours (Total - Deducted Breaks only)
        final_hours_decimal = total_hours_decimal - (total_deducted_minutes / 60.0)
        final_hours = round(final_hours_decimal, 2)

        # Calculate Net Hours string
        net_total_minutes = total_duration_minutes - total_deducted_minutes
        net_h = net_total_minutes // 60
        net_m = net_total_minutes % 60
        net_hours_str = f"{net_h}h {net_m}m"

        # Overtime calculations
        regular_hours = min(final_hours, 8.0)
        over_8 = max(0, final_hours - 8.0)
        over_12 = max(0, final_hours - 12.0)
        over_8_only = min(over_8, 4.0)

        # Hourly rate (safe for null)
        hourly_rate = float(log.employee.hourly_rate) if log.employee.hourly_rate else None

        return {
            'Employee Name': log.employee.user.get_full_name(),
            'Employee ID': str(log.employee.id),
            'Date': date.strftime('%m/%d/%Y'),
            'Day': day_name,
            'Start Time': start_time,
            'End Time': end_time,
            'Total Hours': total_hours_str,
            'Break 1 In': break_data['break_1_in'],
            'Break 1 Out': break_data['break_1_out'],
            'Break 1 Total': break_data['break_1_total'],
            'Break 2 In': break_data['break_2_in'],
            'Break 2 Out': break_data['break_2_out'],
            'Break 2 Total': break_data['break_2_total'],
            'Break 3 In': break_data['break_3_in'],
            'Break 3 Out': break_data['break_3_out'],
            'Break 3 Total': break_data['break_3_total'],
            'Total Break': total_break_str,
            'Total Without Break': net_hours_str,
            'Finally Hours': final_hours,
            '8 Hours': round(regular_hours, 2),
            'over 8': round(over_8_only, 2),
            'over 12': round(over_12, 2),
            'Hourly Rate': hourly_rate,
        }

    def _get_time_logs(self):
        """Get filtered time logs queryset (includes active sessions)"""
        time_logs = TimeLog.objects.filter(
            clock_in_time__date__gte=self.start_date,
            clock_in_time__date__lte=self.end_date,
            status__in=['CLOCKED_OUT', 'CLOCKED_IN']
        ).select_related('employee__user').prefetch_related('breaks')

        if 'department' in self.filters:
            time_logs = time_logs.filter(employee__department=self.filters['department'])
        if 'employee_ids' in self.filters:
            time_logs = time_logs.filter(employee__employee_id__in=self.filters['employee_ids'])

        return time_logs

    def get_data(self):
        """Get flat detailed timesheet data (used for CSV export)"""
        time_logs = self._get_time_logs()
        report_data = [self._build_row(log) for log in time_logs]
        return sorted(report_data, key=lambda x: (x['Employee Name'], datetime.strptime(x['Date'], '%m/%d/%Y')))

    def get_grouped_data(self):
        """Get employee-grouped timesheet data with per-employee summaries and pay calculations.

        Overtime rule (Sun→Sat payroll weeks, 40h cap):
          - Regular : min(week_total, 40h)  → 'Total 8 Hrs' pay
          - Over 8  : weekly OT ≤ 8h        → 'Total Over 8' pay
          - Over 12 : weekly OT > 8h        → 'Total Over 12' pay
        Per-row daily columns (8 Hours, over 8, over 12) are kept as-is.
        """
        time_logs = self._get_time_logs()
        rows = [self._build_row(log) for log in time_logs]
        rows = sorted(rows, key=lambda x: (x['Employee Name'], datetime.strptime(x['Date'], '%m/%d/%Y')))

        # Load configurable rate multipliers from CompanySettings
        from apps.notifications.models import CompanySettings
        settings = CompanySettings.get_settings()
        regular_multiplier = float(settings.regular_rate_multiplier)
        over_8_multiplier  = float(settings.overtime_8_multiplier)
        over_12_multiplier = float(settings.overtime_12_multiplier)

        # Helper: return the Sunday that opens the Sun→Sat payroll week
        def _week_sunday(date_obj):
            day_of_week = date_obj.weekday()           # Mon=0 … Sun=6
            days_since_sunday = (day_of_week + 1) % 7  # Sun=0, Mon=1 … Sat=6
            return date_obj - timedelta(days=days_since_sunday)

        # Group by employee
        from collections import OrderedDict, defaultdict
        employees = OrderedDict()
        for row in rows:
            emp_name = row['Employee Name']
            if emp_name not in employees:
                employees[emp_name] = {
                    'name': emp_name,
                    'hourly_rate': row['Hourly Rate'],
                    'rows': [],
                }
            employees[emp_name]['rows'].append(row)

        # Build per-employee summaries
        result = []
        for emp_name, emp_data in employees.items():
            emp_rows   = emp_data['rows']
            hourly_rate = emp_data['hourly_rate']

            # ── Group rows into Sun→Sat payroll weeks ─────────────────────
            week_groups = defaultdict(list)
            for row in emp_rows:
                date_obj   = datetime.strptime(row['Date'], '%m/%d/%Y').date()
                week_start = _week_sunday(date_obj)
                week_groups[week_start].append(row)

            # ── Apply 40h weekly cap; split OT into over-8 / over-12 ──────
            week_summaries = []
            grand_regular  = 0.0
            grand_over_8   = 0.0   # weekly OT ≤ 8 h
            grand_over_12  = 0.0   # weekly OT > 8 h
            grand_finally  = 0.0

            for week_start in sorted(week_groups.keys()):
                week_end   = week_start + timedelta(days=6)   # Saturday
                week_rows  = week_groups[week_start]
                wk_finally = sum(r['Finally Hours'] for r in week_rows)
                wk_regular = min(wk_finally, 40.0)
                wk_ot      = max(0.0, wk_finally - 40.0)
                wk_over_8  = min(wk_ot, 8.0)       # first 8h of OT
                wk_over_12 = max(0.0, wk_ot - 8.0)  # OT beyond 8h

                grand_regular += wk_regular
                grand_over_8  += wk_over_8
                grand_over_12 += wk_over_12
                grand_finally += wk_finally

                try:
                    week_label = (
                        f"{week_start.strftime('%b %-d')} – "
                        f"{week_end.strftime('%b %-d, %Y')}"
                    )
                except ValueError:
                    week_label = (
                        f"{week_start.strftime('%b %d')} – "
                        f"{week_end.strftime('%b %d, %Y')}"
                    )

                week_summaries.append({
                    'week_start':     week_start.isoformat(),
                    'week_label':     week_label,
                    'finally_hours':  round(wk_finally, 2),
                    'regular_hours':  round(wk_regular, 2),
                    'overtime_hours': round(wk_ot,      2),
                    'over_8_hours':   round(wk_over_8,  2),
                    'over_12_hours':  round(wk_over_12, 2),
                })

            grand_regular = round(grand_regular, 2)
            grand_over_8  = round(grand_over_8,  2)
            grand_over_12 = round(grand_over_12, 2)
            grand_finally = round(grand_finally, 2)

            # ── Pay calculations (weekly OT basis, original key names) ────
            if hourly_rate:
                total_8_hrs_pay   = round(grand_regular * hourly_rate * regular_multiplier, 2)
                total_over_8_pay  = round(grand_over_8  * hourly_rate * over_8_multiplier,  2)
                total_over_12_pay = round(grand_over_12 * hourly_rate * over_12_multiplier, 2)
                total_payment     = round(total_8_hrs_pay + total_over_8_pay + total_over_12_pay, 2)
            else:
                total_8_hrs_pay   = None
                total_over_8_pay  = None
                total_over_12_pay = None
                total_payment     = None

            grand_ot_total = round(grand_over_8 + grand_over_12, 2)

            result.append({
                'name':        emp_name,
                'hourly_rate': hourly_rate,
                'rows':        emp_rows,
                'summary': {
                    'total_finally_hours': grand_finally,
                    # Weekly-computed hour buckets (replace daily sums)
                    'total_8_hours':       grand_regular,   # regular (≤40h/wk)
                    'total_over_8':        grand_over_8,    # OT ≤ 8h per week
                    'total_over_12':       grand_over_12,   # OT > 8h per week
                    # Per-week breakdown (used by frontend for subtotal rows)
                    'weeks':               week_summaries,
                    # Brief OT note for display
                    'ot_note': (
                        f"{grand_regular}h reg (40h/wk cap) + {grand_ot_total}h OT"
                        if grand_ot_total > 0 else
                        f"{grand_regular}h reg (40h/wk cap)"
                    ),
                    # Original pay key names (restored)
                    'total_8_hrs_pay':    total_8_hrs_pay,
                    'total_over_8_pay':   total_over_8_pay,
                    'total_over_12_pay':  total_over_12_pay,
                    'total_payment':      total_payment,
                    'check': None,
                    'cash':  None,
                }
            })

        return result







def get_report_generator(report_type):
    """Factory function to get appropriate report generator"""
    generators = {
        'LATE_ARRIVAL': LateArrivalReportGenerator,
        'OVERTIME': OvertimeReportGenerator,
        'DEPARTMENT_SUMMARY': DepartmentSummaryReportGenerator,
        'ATTENDANCE_SUMMARY': AttendanceSummaryReportGenerator,
        'DETAILED_TIMESHEET': DetailedTimesheetReportGenerator,
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
