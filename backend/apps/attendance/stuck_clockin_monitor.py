"""
Stuck Clock-In Monitoring System
Prevents and detects employees who remain clocked in for extended periods
"""
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from celery import shared_task
import logging

from .models import TimeLog
from apps.employees.models import Employee
from apps.notifications.services import NotificationService

logger = logging.getLogger('worksync.stuck_clockin')


class StuckClockInManager:
    """Manages detection and resolution of stuck clock-in states"""
    
    def __init__(self):
        self.notification_service = NotificationService()
        # Configuration thresholds
        self.WARNING_HOURS = 12  # Send warning after 12 hours
        self.CRITICAL_HOURS = 24  # Send critical alert after 24 hours
        self.AUTO_CLOCKOUT_HOURS = 48  # Auto clock-out after 48 hours
    
    def find_stuck_clockins(self):
        """Find all employees with potentially stuck clock-in states"""
        current_time = timezone.now()
        
        # Find all active clock-ins
        active_logs = TimeLog.objects.filter(
            status='CLOCKED_IN',
            clock_out_time__isnull=True
        ).select_related('employee', 'employee__user')
        
        stuck_logs = []
        
        for log in active_logs:
            hours_clocked_in = (current_time - log.clock_in_time).total_seconds() / 3600
            
            if hours_clocked_in >= self.WARNING_HOURS:
                stuck_logs.append({
                    'time_log': log,
                    'employee': log.employee,
                    'hours_clocked_in': round(hours_clocked_in, 1),
                    'severity': self._get_severity(hours_clocked_in),
                    'clock_in_time': log.clock_in_time,
                    'needs_action': hours_clocked_in >= self.AUTO_CLOCKOUT_HOURS
                })
        
        return stuck_logs
    
    def _get_severity(self, hours):
        """Determine severity level based on hours clocked in"""
        if hours >= self.AUTO_CLOCKOUT_HOURS:
            return 'CRITICAL_AUTO'
        elif hours >= self.CRITICAL_HOURS:
            return 'CRITICAL'
        elif hours >= self.WARNING_HOURS:
            return 'WARNING'
        return 'NORMAL'
    
    def send_stuck_clockin_alerts(self, stuck_logs):
        """Send alerts for stuck clock-in situations"""
        alerts_sent = 0
        
        for stuck_info in stuck_logs:
            employee = stuck_info['employee']
            hours = stuck_info['hours_clocked_in']
            severity = stuck_info['severity']
            
            try:
                # Send alert to employee
                self._send_employee_alert(employee, hours, severity)
                
                # Send alert to admin users
                self._send_admin_alert(employee, hours, severity)
                
                # Log the alert
                self._log_stuck_clockin_alert(stuck_info)
                
                alerts_sent += 1
                
            except Exception as e:
                logger.error(f"Error sending stuck clock-in alert for {employee.employee_id}: {str(e)}")
        
        return alerts_sent
    
    def _send_employee_alert(self, employee, hours, severity):
        """Send alert to the employee"""
        if severity == 'WARNING':
            message = f"You have been clocked in for {hours} hours. Please verify your clock-out status."
        elif severity == 'CRITICAL':
            message = f"URGENT: You have been clocked in for {hours} hours. Please clock out immediately or contact your supervisor."
        else:  # CRITICAL_AUTO
            message = f"CRITICAL: You have been clocked in for {hours} hours. Your time will be automatically adjusted."
        
        # Send notification (email, SMS, push notification)
        self.notification_service.send_stuck_clockin_notification(
            'stuck_clockin_employee',
            employee,
            {
                'employee_name': employee.full_name,
                'hours_clocked_in': hours,
                'severity': severity,
                'message': message,
                'clock_in_time': employee.time_logs.filter(status='CLOCKED_IN').first().clock_in_time
            }
        )
    
    def _send_admin_alert(self, employee, hours, severity):
        """Send alert to admin users"""
        # Get admin users only (simplified for Admin/Employee system)
        admins = Employee.objects.filter(
            role__name='Admin'
        )
        
        message = f"Employee {employee.full_name} ({employee.employee_id}) has been clocked in for {hours} hours."

        for admin in admins:
            self.notification_service.send_stuck_clockin_notification(
                'stuck_clockin_supervisor',
                admin,
                {
                    'employee_name': employee.full_name,
                    'employee_id': employee.employee_id,
                    'hours_clocked_in': hours,
                    'severity': severity,
                    'clock_in_time': employee.time_logs.filter(status='CLOCKED_IN').first().clock_in_time,
                    'message': message
                }
            )
    
    def _log_stuck_clockin_alert(self, stuck_info):
        """Log the stuck clock-in alert for audit purposes"""
        time_log = stuck_info['time_log']
        current_notes = time_log.notes or ""
        
        alert_note = f"\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] STUCK CLOCK-IN ALERT: {stuck_info['hours_clocked_in']} hours - {stuck_info['severity']}"
        time_log.notes = current_notes + alert_note
        time_log.save()
    
    def auto_clockout_stuck_employees(self, stuck_logs):
        """Automatically clock out employees who have been stuck for too long"""
        auto_clockouts = 0
        
        for stuck_info in stuck_logs:
            if stuck_info['needs_action']:
                try:
                    self._perform_auto_clockout(stuck_info)
                    auto_clockouts += 1
                except Exception as e:
                    logger.error(f"Error auto-clocking out {stuck_info['employee'].employee_id}: {str(e)}")
        
        return auto_clockouts
    
    def _perform_auto_clockout(self, stuck_info):
        """Perform automatic clock-out for stuck employee"""
        time_log = stuck_info['time_log']
        employee = stuck_info['employee']
        
        with transaction.atomic():
            # Calculate reasonable clock-out time (end of business day)
            clock_in_date = time_log.clock_in_time.date()
            
            # Assume 8-hour workday + 1 hour for lunch
            estimated_clockout = time_log.clock_in_time + timedelta(hours=9)
            
            # If it's been more than 2 days, use end of first day
            if stuck_info['hours_clocked_in'] > 48:
                estimated_clockout = time_log.clock_in_time.replace(hour=17, minute=0, second=0, microsecond=0)
                if estimated_clockout <= time_log.clock_in_time:
                    estimated_clockout += timedelta(hours=8)  # 8-hour shift
            
            # Update time log
            time_log.clock_out_time = estimated_clockout
            time_log.clock_out_method = 'ADMIN'
            time_log.status = 'CLOCKED_OUT'
            
            # Add detailed notes
            auto_note = f"\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] AUTO CLOCK-OUT: Employee was clocked in for {stuck_info['hours_clocked_in']} hours. Automatically clocked out by system."
            time_log.notes = (time_log.notes or "") + auto_note
            
            time_log.save()
            
            logger.info(f"Auto-clocked out {employee.employee_id} after {stuck_info['hours_clocked_in']} hours")
            
            # Send notification about auto clock-out
            self._send_auto_clockout_notification(employee, stuck_info, estimated_clockout)
    
    def _send_auto_clockout_notification(self, employee, stuck_info, clockout_time):
        """Send notification about automatic clock-out"""
        # Notify employee
        self.notification_service.send_notification(
            'auto_clockout_employee',
            employee,
            {
                'hours_clocked_in': stuck_info['hours_clocked_in'],
                'clockout_time': clockout_time,
                'clock_in_time': stuck_info['clock_in_time']
            }
        )
        
        # Notify admins
        admins = Employee.objects.filter(
            role__name='Admin'
        )

        for admin in admins:
            self.notification_service.send_notification(
                'auto_clockout_supervisor',
                admin,
                {
                    'employee_name': employee.full_name,
                    'employee_id': employee.employee_id,
                    'hours_clocked_in': stuck_info['hours_clocked_in'],
                    'clockout_time': clockout_time,
                    'clock_in_time': stuck_info['clock_in_time']
                }
            )
    
    def get_stuck_clockin_dashboard_data(self):
        """Get dashboard data for stuck clock-ins"""
        stuck_logs = self.find_stuck_clockins()
        
        return {
            'total_stuck': len(stuck_logs),
            'warning_level': len([log for log in stuck_logs if log['severity'] == 'WARNING']),
            'critical_level': len([log for log in stuck_logs if log['severity'] == 'CRITICAL']),
            'auto_clockout_needed': len([log for log in stuck_logs if log['needs_action']]),
            'stuck_employees': [
                {
                    'employee_id': log['employee'].employee_id,
                    'employee_name': log['employee'].full_name,
                    'hours_clocked_in': log['hours_clocked_in'],
                    'clock_in_time': log['clock_in_time'],
                    'severity': log['severity']
                }
                for log in stuck_logs
            ]
        }


# Celery Tasks
@shared_task
def monitor_stuck_clockins():
    """
    Periodic task to monitor and handle stuck clock-in situations
    Runs every hour during business hours
    """
    try:
        manager = StuckClockInManager()
        
        # Find stuck clock-ins
        stuck_logs = manager.find_stuck_clockins()
        
        if not stuck_logs:
            logger.info("No stuck clock-ins detected")
            return
        
        logger.info(f"Found {len(stuck_logs)} stuck clock-ins")
        
        # Send alerts
        alerts_sent = manager.send_stuck_clockin_alerts(stuck_logs)
        
        # Auto clock-out if necessary
        auto_clockouts = manager.auto_clockout_stuck_employees(stuck_logs)
        
        logger.info(f"Stuck clock-in monitoring complete: {alerts_sent} alerts sent, {auto_clockouts} auto clock-outs")
        
        return {
            'stuck_clockins_found': len(stuck_logs),
            'alerts_sent': alerts_sent,
            'auto_clockouts': auto_clockouts
        }
        
    except Exception as e:
        logger.error(f"Error in stuck clock-in monitoring: {str(e)}")
        raise


@shared_task
def generate_stuck_clockin_report():
    """
    Generate daily report of stuck clock-in incidents
    """
    try:
        manager = StuckClockInManager()
        dashboard_data = manager.get_stuck_clockin_dashboard_data()
        
        # Log the report
        logger.info(f"Stuck clock-in report: {dashboard_data}")
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Error generating stuck clock-in report: {str(e)}")
        return None
