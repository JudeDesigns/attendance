"""
Break notification templates and management
"""

BREAK_NOTIFICATION_TEMPLATES = {
    'break_reminder': {
        'title': 'Break Reminder',
        'message': 'Hi {employee_name}, you have been working for {hours_worked} hours. {break_message}',
        'email_subject': 'Break Reminder - {hours_worked} hours worked',
        'email_body': '''
Dear {employee_name},

You have been working for {hours_worked} hours today. {break_message}

{compliance_message}

Please take your break when convenient, or if you need to waive this break, please use the WorkSync app to record your waiver with a reason.

Best regards,
WorkSync Team
        ''',
        'sms_message': 'WorkSync: Break reminder - {hours_worked}h worked. {break_message} Reply WAIVE with reason to waive.',
        'variables': [
            'employee_name',
            'hours_worked', 
            'break_message',
            'compliance_message'
        ]
    },
    
    'break_overdue': {
        'title': 'Overdue Break Alert',
        'message': 'URGENT: {employee_name}, your break is overdue. You have worked {hours_worked} hours without a required break.',
        'email_subject': 'URGENT: Overdue Break Alert - {hours_worked} hours',
        'email_body': '''
Dear {employee_name},

URGENT NOTICE: You have been working for {hours_worked} hours without taking your required break.

Labor regulations require that you take a break after working for extended periods. Please take your break immediately or contact your supervisor.

If you cannot take a break due to operational requirements, please use the WorkSync app to record a break waiver with a detailed reason.

This is important for both your wellbeing and regulatory compliance.

Best regards,
WorkSync Team
        ''',
        'sms_message': 'URGENT: Break overdue - {hours_worked}h worked. Take break now or waive with reason in app.',
        'variables': [
            'employee_name',
            'hours_worked'
        ]
    },
    
    'break_waived': {
        'title': 'Break Waived',
        'message': 'Break waived by {employee_name}. Reason: {waiver_reason}',
        'email_subject': 'Break Waived - {employee_name}',
        'email_body': '''
Break Waiver Notification

Employee: {employee_name} ({employee_id})
Date: {date}
Time: {time}
Hours Worked: {hours_worked}
Waiver Reason: {waiver_reason}

This waiver has been recorded for compliance purposes.
        ''',
        'variables': [
            'employee_name',
            'employee_id',
            'date',
            'time',
            'hours_worked',
            'waiver_reason'
        ]
    },
    
    'break_compliance_violation': {
        'title': 'Break Compliance Violation',
        'message': 'Compliance violation: {employee_name} worked {hours_worked} hours without required break or waiver.',
        'email_subject': 'Break Compliance Violation - {employee_name}',
        'email_body': '''
COMPLIANCE ALERT

Employee: {employee_name} ({employee_id})
Date: {date}
Hours Worked: {hours_worked}
Violation: Worked extended hours without taking required break or recording waiver

This violation has been logged and requires admin review.

Please follow up with the employee to ensure future compliance with break requirements.
        ''',
        'variables': [
            'employee_name',
            'employee_id', 
            'date',
            'hours_worked'
        ]
    }
}


def get_break_message(hours_worked, break_type):
    """Generate appropriate break message based on hours worked and break type"""
    if break_type == 'LUNCH':
        if hours_worked >= 6.5:
            return "You are required to take a lunch break. Please take your 30-minute lunch break now."
        else:
            return "It's time for your lunch break. Please take your 30-minute lunch break."
    elif break_type == 'SHORT':
        return "Consider taking a short 15-minute break to rest and recharge."
    else:
        return "Please consider taking a break."


def get_compliance_message(hours_worked, is_overdue=False):
    """Generate compliance message based on work hours"""
    if is_overdue:
        return "This break is now overdue and required by labor regulations."
    elif hours_worked >= 6:
        return "This break is required by labor regulations for shifts over 6 hours."
    else:
        return "Regular breaks help maintain productivity and wellbeing."


def format_break_notification(template_key, context):
    """Format break notification using template and context"""
    if template_key not in BREAK_NOTIFICATION_TEMPLATES:
        raise ValueError(f"Unknown template: {template_key}")
    
    template = BREAK_NOTIFICATION_TEMPLATES[template_key]
    
    # Add break-specific context
    if 'hours_worked' in context and 'break_type' in context:
        context['break_message'] = get_break_message(
            context['hours_worked'], 
            context['break_type']
        )
        context['compliance_message'] = get_compliance_message(
            context['hours_worked'],
            context.get('is_overdue', False)
        )
    
    # Format all template fields
    formatted = {}
    for field, content in template.items():
        if field == 'variables':
            continue
        try:
            formatted[field] = content.format(**context)
        except KeyError as e:
            # Handle missing variables gracefully
            formatted[field] = content
    
    return formatted
