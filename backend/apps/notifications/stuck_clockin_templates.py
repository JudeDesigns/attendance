"""
Notification templates for stuck clock-in situations
"""

STUCK_CLOCKIN_TEMPLATES = {
    'stuck_clockin_employee': {
        'title': 'Clock-In Status Alert',
        'message': 'You have been clocked in for {hours_clocked_in} hours. Please verify your status.',
        'email_subject': 'Clock-In Status Alert - {hours_clocked_in} hours',
        'email_body': '''
Dear {employee_name},

Our system has detected that you have been clocked in for {hours_clocked_in} hours since {clock_in_time}.

{message}

If you have already finished work but forgot to clock out, please:
1. Log into WorkSync immediately
2. Clock out with the correct time
3. Add a note explaining the situation

If you are still working, please disregard this message.

For assistance, contact your admin or IT support.

Best regards,
WorkSync Team
        ''',
        'sms_message': 'WorkSync Alert: You have been clocked in for {hours_clocked_in}h. Please verify your clock-out status.',
        'variables': [
            'employee_name',
            'hours_clocked_in',
            'clock_in_time',
            'message',
            'severity'
        ]
    },
    
    'stuck_clockin_supervisor': {
        'title': 'Employee Stuck Clock-In Alert',
        'message': 'Employee {employee_name} ({employee_id}) has been clocked in for {hours_clocked_in} hours.',
        'email_subject': 'Stuck Clock-In Alert - {employee_name} ({hours_clocked_in}h)',
        'email_body': '''
Admin Alert: Stuck Clock-In Detected

Employee: {employee_name} ({employee_id})
Clock-In Time: {clock_in_time}
Hours Clocked In: {hours_clocked_in}
Severity Level: {severity}

{message}

Recommended Actions:
1. Contact the employee immediately
2. Verify their actual work status
3. Correct their time log if necessary
4. Remind them about proper clock-out procedures

This alert helps prevent payroll errors and ensures accurate time tracking.

Access WorkSync Admin Panel: [Admin Dashboard Link]

Best regards,
WorkSync System
        ''',
        'sms_message': 'WorkSync: {employee_name} stuck clocked-in for {hours_clocked_in}h. Please investigate.',
        'variables': [
            'employee_name',
            'employee_id',
            'hours_clocked_in',
            'clock_in_time',
            'severity',
            'message'
        ]
    },
    
    'auto_clockout_employee': {
        'title': 'Automatic Clock-Out Notification',
        'message': 'Your time has been automatically adjusted due to extended clock-in period.',
        'email_subject': 'Automatic Clock-Out - Time Adjusted',
        'email_body': '''
Dear {employee_name},

Your time record has been automatically adjusted due to an extended clock-in period.

Details:
- Clock-In Time: {clock_in_time}
- Auto Clock-Out Time: {clockout_time}
- Total Hours Clocked In: {hours_clocked_in}

This automatic adjustment was made to prevent payroll errors and ensure accurate time tracking.

If this adjustment is incorrect, please:
1. Contact your admin immediately
2. Provide the correct work hours
3. Submit a time correction request

Important: Please remember to clock out at the end of each work day to avoid future automatic adjustments.

Best regards,
WorkSync Team
        ''',
        'sms_message': 'WorkSync: Your time was auto-adjusted after {hours_clocked_in}h. Check email for details.',
        'variables': [
            'employee_name',
            'hours_clocked_in',
            'clock_in_time',
            'clockout_time'
        ]
    },
    
    'auto_clockout_supervisor': {
        'title': 'Employee Auto Clock-Out Notification',
        'message': 'Employee {employee_name} was automatically clocked out after {hours_clocked_in} hours.',
        'email_subject': 'Auto Clock-Out Performed - {employee_name}',
        'email_body': '''
Admin Notification: Automatic Clock-Out Performed

Employee: {employee_name} ({employee_id})
Original Clock-In: {clock_in_time}
Auto Clock-Out Time: {clockout_time}
Total Hours: {hours_clocked_in}

An automatic clock-out was performed to prevent payroll errors and system issues.

Required Actions:
1. Verify the employee's actual work hours
2. Adjust the time record if necessary
3. Discuss proper clock-out procedures with the employee
4. Document any corrections made

This automatic adjustment helps maintain accurate time tracking and prevents system issues.

Access the employee's time record: [Admin Dashboard Link]

Best regards,
WorkSync System
        ''',
        'sms_message': 'WorkSync: Auto-clocked out {employee_name} after {hours_clocked_in}h. Review needed.',
        'variables': [
            'employee_name',
            'employee_id',
            'hours_clocked_in',
            'clock_in_time',
            'clockout_time'
        ]
    },
    
    'daily_stuck_clockin_report': {
        'title': 'Daily Stuck Clock-In Report',
        'message': 'Daily summary of stuck clock-in incidents and resolutions.',
        'email_subject': 'Daily Stuck Clock-In Report - {date}',
        'email_body': '''
Daily Stuck Clock-In Report - {date}

Summary:
- Total Stuck Clock-Ins: {total_stuck}
- Warning Level: {warning_level}
- Critical Level: {critical_level}
- Auto Clock-Outs Performed: {auto_clockouts}

{details}

This report helps maintain accurate time tracking and identify patterns that may require process improvements.

Recommendations:
1. Review employees with frequent stuck clock-ins
2. Provide additional training on proper clock-out procedures
3. Consider implementing reminder systems
4. Monitor for system issues that may prevent clock-outs

Access full report: [Admin Dashboard Link]

Best regards,
WorkSync System
        ''',
        'variables': [
            'date',
            'total_stuck',
            'warning_level',
            'critical_level',
            'auto_clockouts',
            'details'
        ]
    }
}


def format_stuck_clockin_notification(template_key, context):
    """Format stuck clock-in notification using template and context"""
    if template_key not in STUCK_CLOCKIN_TEMPLATES:
        raise ValueError(f"Unknown template: {template_key}")
    
    template = STUCK_CLOCKIN_TEMPLATES[template_key]
    
    # Format timestamps
    if 'clock_in_time' in context:
        context['clock_in_time'] = context['clock_in_time'].strftime('%Y-%m-%d %H:%M')
    
    if 'clockout_time' in context:
        context['clockout_time'] = context['clockout_time'].strftime('%Y-%m-%d %H:%M')
    
    # Format severity level
    if 'severity' in context:
        severity_messages = {
            'WARNING': 'Warning - Extended clock-in detected',
            'CRITICAL': 'Critical - Immediate attention required',
            'CRITICAL_AUTO': 'Critical - Automatic action will be taken'
        }
        context['severity_message'] = severity_messages.get(context['severity'], context['severity'])
    
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


def get_severity_color(severity):
    """Get color code for severity level"""
    colors = {
        'WARNING': '#FFA500',  # Orange
        'CRITICAL': '#FF0000',  # Red
        'CRITICAL_AUTO': '#8B0000'  # Dark Red
    }
    return colors.get(severity, '#808080')  # Gray default


def format_stuck_clockin_dashboard_alert(stuck_employees):
    """Format stuck clock-in data for dashboard display"""
    if not stuck_employees:
        return "No stuck clock-ins detected."
    
    alert_html = "<div class='stuck-clockin-alerts'>"
    
    for employee in stuck_employees:
        severity_color = get_severity_color(employee['severity'])
        
        alert_html += f"""
        <div class='alert-item' style='border-left: 4px solid {severity_color}; padding: 10px; margin: 5px 0;'>
            <strong>{employee['employee_name']} ({employee['employee_id']})</strong><br>
            <span style='color: {severity_color};'>{employee['severity']}</span> - 
            Clocked in for {employee['hours_clocked_in']} hours<br>
            <small>Since: {employee['clock_in_time'].strftime('%Y-%m-%d %H:%M')}</small>
        </div>
        """
    
    alert_html += "</div>"
    return alert_html
