"""
Break Compliance Management System
Handles break reminders, waivers, and compliance tracking
"""
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from celery import shared_task
import logging

from .models import TimeLog, Break
from apps.employees.models import Employee
from apps.notifications.services import NotificationService

logger = logging.getLogger('worksync.break_compliance')


class BreakComplianceManager:
    """Manages break compliance rules and notifications"""
    
    def __init__(self):
        self.notification_service = NotificationService()
    
    def check_break_requirements(self, employee, time_log):
        """Legacy method name - use get_break_requirements instead"""
        return self.get_break_requirements(employee, time_log)

    def get_break_requirements(self, employee, time_log=None):
        """
        Check if employee needs a break based on work hours
        Returns dict with break requirement info
        """
        # If no time_log provided, get the current active one
        if not time_log:
            from .models import TimeLog
            time_log = TimeLog.objects.filter(
                employee=employee,
                status='CLOCKED_IN'
            ).first()

        if not time_log:
            return {
                'requires_break': False,
                'can_take_manual_break': False,
                'reason': 'Employee not currently clocked in'
            }

        if not time_log.clock_in_time:
            return {
                'requires_break': False,
                'can_take_manual_break': False,
                'reason': 'No clock-in time recorded'
            }
        
        # Calculate hours worked so far
        current_time = timezone.now()
        hours_worked = (current_time - time_log.clock_in_time).total_seconds() / 3600
        
        # Check if employee has already taken required breaks
        existing_breaks = Break.objects.filter(
            time_log=time_log,
            break_type='LUNCH'
        ).count()
        
        # Break requirements based on hours worked
        requirements = {
            'requires_break': False,
            'break_type': None,
            'hours_worked': round(hours_worked, 2),
            'reason': '',
            'is_overdue': False,
            'can_take_manual_break': hours_worked >= 1.0  # Allow manual breaks after 1 hour
        }
        
        # Short break recommended after 2 hours (FIXED: was 3 hours)
        if hours_worked >= 2.0:
            short_breaks = Break.objects.filter(
                time_log=time_log,
                break_type='SHORT'
            ).count()

            if short_breaks == 0:
                requirements.update({
                    'requires_break': True,
                    'break_type': 'SHORT',
                    'reason': 'Short break recommended after 2 hours of work',
                    'is_overdue': hours_worked >= 2.5  # Overdue after 2.5 hours
                })

        # Lunch break required after 4 hours (FIXED: was 6 hours)
        elif hours_worked >= 4.0 and existing_breaks == 0:
            requirements.update({
                'requires_break': True,
                'break_type': 'LUNCH',
                'reason': 'Lunch break required after 4 hours of work',
                'is_overdue': hours_worked >= 5.0  # Overdue after 5 hours
            })
        
        return requirements
    
    def send_break_reminder(self, employee, time_log, break_requirements):
        """Send break reminder notification to employee"""
        try:
            context = {
                'hours_worked': break_requirements['hours_worked'],
                'break_type': break_requirements['break_type'],
                'is_overdue': break_requirements['is_overdue'],
                'is_followup': break_requirements.get('is_followup', False),
                'urgency': break_requirements.get('urgency', 'NORMAL'),
                'reason': break_requirements['reason']
            }

            # Determine notification type
            if context['is_followup']:
                notification_type = 'break_followup'
                message = f"URGENT: Break reminder - You still haven't taken your required {context['break_type'].lower()} break after {context['hours_worked']} hours of work."
            elif context['is_overdue']:
                notification_type = 'break_overdue'
                message = f"OVERDUE: Your {context['break_type'].lower()} break is overdue. You've worked {context['hours_worked']} hours."
            else:
                notification_type = 'break_reminder'
                message = f"Break time! You've worked {context['hours_worked']} hours. Time for your {context['break_type'].lower()} break."

            # Send notification using the notification service
            result = self.notification_service.send_notification(
                employee.user,
                title="Break Reminder" if not context['is_followup'] else "URGENT: Break Reminder",
                message=message,
                notification_type=notification_type,
                priority='HIGH' if context['is_followup'] or context['is_overdue'] else 'NORMAL'
            )

            logger.info(
                f"Break reminder sent to {employee.employee_id}: "
                f"{break_requirements['break_type']} after {break_requirements['hours_worked']} hours "
                f"(Type: {notification_type})"
            )

            return result

        except Exception as e:
            logger.error(f"Error sending break reminder to {employee.employee_id}: {str(e)}")
            return False
    
    def record_break_waiver(self, employee, time_log, waiver_reason):
        """Record that employee waived their break"""
        try:
            with transaction.atomic():
                # Create a waived break record
                break_waiver = Break.objects.create(
                    time_log=time_log,
                    break_type='LUNCH',  # Assuming lunch break waiver
                    start_time=timezone.now(),
                    end_time=timezone.now(),  # Immediately ended
                    notes=f"WAIVED: {waiver_reason}"
                )
                
                # If using the enhanced model with compliance fields
                if hasattr(break_waiver, 'was_waived'):
                    break_waiver.was_waived = True
                    break_waiver.waiver_reason = waiver_reason
                    break_waiver.is_compliant = True  # Waiver makes it compliant
                    break_waiver.save()
                
                logger.info(
                    f"Break waiver recorded for {employee.employee_id}: {waiver_reason}"
                )
                
                return break_waiver
                
        except Exception as e:
            logger.error(f"Error recording break waiver for {employee.employee_id}: {str(e)}")
            return None
    
    def record_break_rejection(self, employee, time_log, rejection_reason):
        """Record that employee rejected/declined break reminder"""
        try:
            # Create a note in the time log about break rejection
            current_notes = time_log.notes or ""
            rejection_note = f"\n[{timezone.now().strftime('%H:%M')}] Break reminder declined: {rejection_reason}"
            time_log.notes = current_notes + rejection_note
            time_log.save()
            
            logger.info(
                f"Break rejection recorded for {employee.employee_id}: {rejection_reason}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error recording break rejection for {employee.employee_id}: {str(e)}")
            return False
    
    def get_compliance_status(self, employee, date=None):
        """Get break compliance status for employee on given date"""
        if not date:
            date = timezone.now().date()
        
        # Get time logs for the date
        time_logs = TimeLog.objects.filter(
            employee=employee,
            clock_in_time__date=date
        )
        
        compliance_data = []
        
        for time_log in time_logs:
            if not time_log.duration_hours:
                continue  # Skip incomplete logs
            
            breaks_taken = Break.objects.filter(time_log=time_log)
            
            status = {
                'time_log_id': time_log.id,
                'shift_duration': time_log.duration_hours,
                'breaks_required': time_log.duration_hours >= 6,
                'breaks_taken': breaks_taken.count(),
                'lunch_break_taken': breaks_taken.filter(break_type='LUNCH').exists(),
                'breaks_waived': breaks_taken.filter(notes__icontains='WAIVED').count(),
                'is_compliant': True,
                'compliance_notes': []
            }
            
            # Check compliance
            if status['breaks_required'] and not status['lunch_break_taken'] and status['breaks_waived'] == 0:
                status['is_compliant'] = False
                status['compliance_notes'].append('Required lunch break not taken or waived')
            
            compliance_data.append(status)
        
        return compliance_data


# Celery Tasks for Break Compliance
@shared_task
def check_break_reminders():
    """
    Periodic task to check all active employees for break reminders
    Runs every 30 minutes during business hours
    """
    try:
        compliance_manager = BreakComplianceManager()
        
        # Get all currently clocked-in employees
        active_logs = TimeLog.objects.filter(
            status='CLOCKED_IN',
            clock_in_time__isnull=False
        ).select_related('employee')
        
        reminders_sent = 0
        
        for time_log in active_logs:
            employee = time_log.employee
            
            # Skip if employee is on break
            if Break.objects.filter(time_log=time_log, end_time__isnull=True).exists():
                continue
            
            # Check break requirements
            requirements = compliance_manager.check_break_requirements(employee, time_log)
            
            if requirements['requires_break']:
                # Check if we've already sent a reminder recently (within last hour)
                last_reminder_time = time_log.break_reminder_sent_at
                current_time = timezone.now()

                should_send_reminder = (
                    not last_reminder_time or
                    (current_time - last_reminder_time).total_seconds() > 3600 or  # 1 hour
                    requirements['is_overdue']
                )

                if should_send_reminder:
                    # For overdue breaks, send urgent notification
                    if requirements['is_overdue']:
                        requirements['urgency'] = 'HIGH'

                    # Send reminder
                    success = compliance_manager.send_break_reminder(
                        employee, time_log, requirements
                    )

                    if success:
                        # Update reminder tracking fields
                        time_log.break_reminder_sent_at = current_time
                        time_log.break_reminder_count += 1

                        # Also update notes for backward compatibility
                        current_notes = time_log.notes or ""
                        reminder_note = f"\n[{current_time.strftime('%H:%M')}] Break reminder sent: {requirements['reason']}"
                        time_log.notes = current_notes + reminder_note
                        time_log.save()

                        reminders_sent += 1
        
        logger.info(f"Break reminder check completed. Sent {reminders_sent} reminders.")
        
    except Exception as e:
        logger.error(f"Error in break reminder check: {str(e)}")


@shared_task
def send_immediate_break_notification(employee_id, time_log_id):
    """
    Send immediate break notification when break time is reached
    """
    try:
        from apps.employees.models import Employee

        employee = Employee.objects.get(id=employee_id)
        time_log = TimeLog.objects.get(id=time_log_id)

        compliance_manager = BreakComplianceManager()
        requirements = compliance_manager.check_break_requirements(employee, time_log)

        if requirements['requires_break']:
            # Send immediate notification
            success = compliance_manager.send_break_reminder(
                employee, time_log, requirements
            )

            if success:
                # Schedule 5-minute follow-up
                send_break_followup_notification.apply_async(
                    args=[employee_id, time_log_id],
                    countdown=5 * 60  # 5 minutes
                )

                logger.info(f"Immediate break notification sent to {employee.employee_id}")
                return True

    except Exception as e:
        logger.error(f"Error sending immediate break notification: {str(e)}")
        return False


@shared_task
def send_break_followup_notification(employee_id, time_log_id):
    """
    Send follow-up break notification after 5 minutes if no action taken
    """
    try:
        from apps.employees.models import Employee

        employee = Employee.objects.get(id=employee_id)
        time_log = TimeLog.objects.get(id=time_log_id)

        # Check if employee is still clocked in and hasn't taken break
        if (time_log.status == 'CLOCKED_IN' and
            not Break.objects.filter(time_log=time_log, end_time__isnull=True).exists()):

            compliance_manager = BreakComplianceManager()
            requirements = compliance_manager.check_break_requirements(employee, time_log)

            if requirements['requires_break']:
                # Send urgent follow-up notification
                requirements['is_followup'] = True
                requirements['urgency'] = 'HIGH'

                success = compliance_manager.send_break_reminder(
                    employee, time_log, requirements
                )

                if success:
                    logger.info(f"Follow-up break notification sent to {employee.employee_id}")
                    return True

    except Exception as e:
        logger.error(f"Error sending follow-up break notification: {str(e)}")
        return False


@shared_task
def generate_break_compliance_report(date=None):
    """
    Generate daily break compliance report
    """
    try:
        if not date:
            date = timezone.now().date()
        
        compliance_manager = BreakComplianceManager()
        
        # Get all active employees
        employees = Employee.objects.filter(employment_status='ACTIVE')
        
        compliance_summary = {
            'date': date.isoformat(),
            'total_employees': employees.count(),
            'employees_worked': 0,
            'compliant_employees': 0,
            'non_compliant_employees': 0,
            'break_waivers': 0,
            'details': []
        }
        
        for employee in employees:
            compliance_data = compliance_manager.get_compliance_status(employee, date)
            
            if compliance_data:  # Employee worked on this date
                compliance_summary['employees_worked'] += 1
                
                employee_compliant = all(status['is_compliant'] for status in compliance_data)
                
                if employee_compliant:
                    compliance_summary['compliant_employees'] += 1
                else:
                    compliance_summary['non_compliant_employees'] += 1
                
                # Count waivers
                waivers = sum(status['breaks_waived'] for status in compliance_data)
                compliance_summary['break_waivers'] += waivers
                
                compliance_summary['details'].append({
                    'employee_id': employee.employee_id,
                    'employee_name': employee.full_name,
                    'is_compliant': employee_compliant,
                    'shifts': compliance_data
                })
        
        logger.info(f"Break compliance report generated for {date}: {compliance_summary['compliant_employees']}/{compliance_summary['employees_worked']} compliant")
        
        return compliance_summary
        
    except Exception as e:
        logger.error(f"Error generating break compliance report: {str(e)}")
        return None
