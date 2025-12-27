# WorkSync User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Employee Features](#employee-features)
4. [Admin Features](#admin-features)
5. [Time Tracking](#time-tracking)
6. [Scheduling](#scheduling)
7. [Leave Management](#leave-management)
8. [Reports](#reports)
9. [Notifications](#notifications)
10. [Mobile Features](#mobile-features)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Logging In
1. Navigate to the WorkSync application URL
2. Enter your username and password
3. Click "Sign In"
4. You'll be redirected to your dashboard based on your role

### First Time Setup
- **Employees**: You'll see the Employee Dashboard with quick actions
- **Admins**: You'll be redirected to the Admin Dashboard automatically

---

## User Roles

WorkSync supports four user roles with different permissions:

### 1. Employee
- Basic time tracking (clock in/out)
- View personal schedule
- Request leave
- View personal time logs

### 2. Driver
- All Employee features
- Additional location-based permissions
- GPS verification for remote locations

### 3. Administrator
- All Employee features
- Manage employees and schedules
- Generate reports
- Approve leave requests
- Configure locations and notifications

### 4. Super Administrator
- All Administrator features
- Full system configuration
- Webhook management
- Advanced system settings

---

## Admin Features

### Admin Dashboard
Administrators have access to a comprehensive dashboard with:
- **Employee Status Overview**: Real-time status of all employees
- **Today's Activity**: Clock ins/outs and current active employees
- **Quick Stats**: Total employees, active shifts, pending requests
- **System Health**: Notifications and alerts

### Employee Management
#### Create New Employee
1. Navigate to **Employees** page
2. Click "Create Employee"
3. Fill out employee information:
   - Personal details (name, email, phone)
   - Employment information (ID, role, hire date)
   - Contact information
4. Assign role (Employee, Driver, Admin, Super Admin)
5. Save employee record

#### Manage Existing Employees
- **View Employee List**: See all employees with status
- **Edit Employee Details**: Update personal and employment info
- **Change Employee Status**: Active, Inactive, Terminated, On Leave
- **Delete vs Terminate**:
  - **Terminate**: Soft delete, preserves records
  - **Delete**: Permanent removal (use with caution)

#### Employee Status Dashboard
- **Real-time Status**: Who's clocked in/out right now
- **Employee Details**: Click any employee for detailed view
- **Quick Actions**: Clock in/out employees, view time logs
- **Status Filters**: Filter by Active, Clocked In, On Break, etc.

### Location Management
#### Create Locations
1. Go to **Locations** page
2. Click "Add Location"
3. Configure location settings:
   - Name and address
   - QR code generation
   - GPS coordinates (optional)
   - Radius for GPS verification
4. Set enforcement rules:
   - Require QR code for clock in/out
   - GPS verification requirements

#### QR Code Management
- **Generate QR Codes**: Automatic generation for each location
- **Print QR Codes**: Download printable versions
- **QR Code Enforcement**: Configure which locations require QR scanning

### Scheduling Management
#### Create Shifts
1. Navigate to **Admin Scheduling**
2. Click "Create Shift"
3. Set shift details:
   - Employee assignment
   - Date and time
   - Location
   - Notes
4. Publish shift to make it visible to employee

#### Shift Templates
- **Create Templates**: Recurring shift patterns
- **Weekly Schedules**: Set up regular weekly patterns
- **Bulk Scheduling**: Apply templates to multiple employees
- **Schedule Publishing**: Control when employees see schedules

#### Schedule Management Features
- **Drag & Drop**: Easy shift rearrangement
- **Conflict Detection**: Automatic overlap detection
- **Bulk Operations**: Mass schedule changes
- **Schedule Reports**: Export schedules for planning

---

## Employee Features

### Dashboard
The Employee Dashboard provides:
- **Welcome message** with current date
- **Current status** (Clocked In/Out)
- **Quick actions** for common tasks
- **Break management** tools
- **Today's hours** summary
- **This week's hours** summary

### Quick Actions
- **Quick Clock In**: Clock in directly from dashboard
- **View Schedule**: Check your upcoming shifts
- **Time Tracking**: View detailed time logs
- **Request Leave**: Submit leave requests

---

## Time Tracking

### Clock In/Out Methods

#### 1. Portal Clock In/Out
- Use the web interface to clock in/out
- Add optional notes for your time entry
- Available when not restricted to QR code locations

#### 2. QR Code Clock In/Out
- Scan location QR codes for precise location tracking
- Required for certain locations as configured by admin
- Ensures employees are at the correct work location

### Clock In Process
1. Go to **Clock In** page or use Quick Actions
2. Choose your method (Portal or QR Code)
3. Add notes if needed (optional)
4. Click "Clock In"
5. System validates:
   - You have a scheduled shift (if required)
   - You're within the allowed time window
   - Location requirements are met

### Clock Out Process
1. Navigate to Clock In page
2. Click "Clock Out" button
3. Add notes about your work session
4. System calculates total hours worked
5. Displays work duration summary

### Time Tracking Rules
- **Shift Compliance**: Must clock in during scheduled shifts or within 15 minutes before
- **Location Enforcement**: Some locations require QR code scanning
- **Break Tracking**: System monitors break compliance automatically
- **Overtime Detection**: Hours over 8 per day are flagged as overtime

---

## Break Management

### Automatic Break Tracking
- System monitors work hours for break compliance
- Sends reminders when breaks are due
- Tracks break waivers and rejections

### Break Actions
- **Take Break**: Clock out for break period
- **Waive Break**: Formally waive your break with reason
- **Break Reminders**: Receive notifications when breaks are due

### Compliance Features
- Regulatory compliance tracking
- Break rejection recording
- Automatic reporting for labor law compliance

---

## Scheduling

### View Your Schedule
1. Navigate to **Schedule** page
2. View shifts in calendar format
3. See shift details:
   - Start and end times
   - Location
   - Notes from scheduler
   - Published status

### Schedule Information
- **Current Shift**: Shows if you're currently scheduled
- **Upcoming Shifts**: Next scheduled work periods
- **Shift Templates**: Recurring schedule patterns
- **Clock-in Eligibility**: When you can clock in for each shift

---

## Leave Management

### Request Leave
1. Go to **Leave Management** page
2. Click "Request Leave"
3. Fill out the form:
   - Leave type (Vacation, Sick, Personal, etc.)
   - Start and end dates
   - Reason for leave
4. Submit request
5. Wait for admin approval

### Leave Types
- **Vacation**: Planned time off
- **Sick Leave**: Medical-related absence
- **Personal**: Personal matters
- **Emergency**: Unexpected situations
- **Bereavement**: Family-related leave
- **Jury Duty**: Legal obligations

### Leave Status Tracking
- **Pending**: Awaiting approval
- **Approved**: Leave has been approved
- **Rejected**: Leave request denied
- **Cancelled**: Request was cancelled

### Leave Management (Admin)
#### Approve/Reject Leave Requests
1. Go to **Admin Leave Management**
2. View pending requests
3. Review request details:
   - Employee information
   - Leave dates and type
   - Reason provided
4. Take action:
   - **Approve**: Grant the leave request
   - **Reject**: Deny with reason
   - **Request More Info**: Ask for clarification

#### Leave Policies
- **Leave Balances**: Track available leave per employee
- **Leave Types**: Configure different leave categories
- **Approval Workflow**: Set up approval chains
- **Leave Reports**: Generate leave usage reports

### Notification Management
#### Configure Notifications
1. Navigate to **Notification Settings**
2. Set up notification templates:
   - Clock in/out notifications
   - Break reminders
   - Shift assignments
   - Leave status updates
3. Configure delivery methods:
   - Push notifications
   - Email alerts
   - In-app notifications

#### Webhook Management
- **External Integrations**: Connect to third-party systems
- **Webhook Endpoints**: Configure external notification URLs
- **Event Triggers**: Set what events trigger webhooks
- **Delivery Monitoring**: Track webhook delivery success

---

## Reports

### Report Types
WorkSync provides several built-in report types:

#### Attendance Reports
- **Late Arrival Report**: Employees who arrived late
- **Overtime Report**: Hours worked beyond standard time
- **Attendance Summary**: Comprehensive attendance overview
- **Department Summary**: Attendance metrics by department

#### Compliance Reports
- **Break Compliance**: Break taking and waiver tracking
- **Schedule Compliance**: Adherence to scheduled shifts
- **Time Tracking Accuracy**: Clock in/out precision

#### Custom Reports
- **Flexible Parameters**: Configure date ranges, employees, departments
- **Multiple Formats**: CSV, PDF, JSON export options
- **Scheduled Reports**: Automatic report generation and delivery

### Generate Reports
1. Navigate to **Reports** page
2. Select report type
3. Configure parameters:
   - Date range
   - Employee selection
   - Department filters
   - Format preference
4. Generate report
5. Download or email results

### Scheduled Reports
- **Automated Generation**: Set up recurring reports
- **Email Delivery**: Automatic distribution to stakeholders
- **Report Templates**: Save frequently used configurations

---

## Mobile Features

### Progressive Web App (PWA)
- Install WorkSync as a mobile app
- Works offline for basic functions
- Push notifications for important updates

### Mobile-Optimized Features
- **Touch-friendly interface**: Large buttons and easy navigation
- **QR Code Scanner**: Built-in camera integration
- **GPS Verification**: Location-based clock in/out
- **Responsive Design**: Adapts to all screen sizes

### Offline Capabilities
- View recent time logs
- Check schedule (cached data)
- Queue clock in/out for when connection returns

---

## API Integration

### External API Access
WorkSync provides REST API endpoints for external integrations:

#### Authentication
- **API Keys**: Generate API keys for external systems
- **JWT Tokens**: Use JWT authentication for secure access
- **Rate Limiting**: API calls are rate-limited for security

#### Available Endpoints
- **Employee Management**: Create, update, retrieve employee data
- **Time Tracking**: Clock in/out via API
- **Schedule Access**: Retrieve and update schedules
- **Report Generation**: Generate reports programmatically

#### Webhook Integration
- **Real-time Events**: Receive notifications for system events
- **Custom Endpoints**: Configure your own webhook URLs
- **Event Filtering**: Choose which events to receive
- **Retry Logic**: Automatic retry for failed deliveries

### Third-Party Integrations
- **Payroll Systems**: Export time data for payroll processing
- **HR Systems**: Sync employee information
- **Accounting Software**: Integration with financial systems
- **Communication Tools**: Slack, Teams notifications

---

## Notifications

### Types of Notifications
- **Break Reminders**: When breaks are due
- **Shift Reminders**: Upcoming shift notifications
- **Leave Updates**: Status changes on leave requests
- **Schedule Changes**: When shifts are modified
- **Compliance Alerts**: Break and attendance violations

### Notification Channels
- **Push Notifications**: Real-time browser/mobile alerts
- **Email**: Important updates sent to your email
- **In-App**: Notifications within the WorkSync interface

---

## Troubleshooting

### Common Issues

#### Can't Clock In
**Possible Causes:**
- No scheduled shift found
- Outside allowed time window (15 minutes before shift)
- Location requires QR code scanning
- Already clocked in

**Solutions:**
- Check your schedule for active shifts
- Wait until within 15 minutes of shift start
- Use QR code method if required
- Contact admin if issues persist

#### QR Code Not Working
**Possible Causes:**
- Camera permissions not granted
- Poor lighting conditions
- Damaged or incorrect QR code

**Solutions:**
- Allow camera access in browser
- Ensure good lighting when scanning
- Try manual entry if available
- Contact admin for new QR code

#### Missing Hours
**Possible Causes:**
- Forgot to clock out
- System error during clock in/out
- Shift not properly scheduled

**Solutions:**
- Check time tracking page for incomplete entries
- Contact admin to correct time logs
- Ensure you clock out at end of shift

### Getting Help
- **Contact Admin**: Use in-app messaging or email
- **Check Status**: Use Employee Status dashboard
- **Review Logs**: Check Time Tracking page for history
- **System Status**: Admin can check for system issues

---

## Best Practices

### For Accurate Time Tracking
1. **Clock in promptly** when starting work
2. **Clock out immediately** when leaving
3. **Add notes** to explain any unusual circumstances
4. **Check your schedule** regularly for updates
5. **Take required breaks** to maintain compliance

### For Leave Requests
1. **Submit early** - give as much notice as possible
2. **Be specific** about dates and reasons
3. **Follow up** if no response within reasonable time
4. **Plan coverage** with team members when possible

### For Schedule Management
1. **Check schedule weekly** for any changes
2. **Set reminders** for shift start times
3. **Communicate conflicts** to admin immediately
4. **Update availability** when it changes

---

## Security Features

### Data Protection
- **Encrypted Storage**: All sensitive data is encrypted at rest
- **Secure Transmission**: HTTPS/TLS encryption for all communications
- **Access Logging**: All user actions are logged for audit trails
- **Data Backup**: Regular automated backups of all system data

### User Security
- **Strong Password Requirements**: Enforced password complexity
- **Session Management**: Automatic session timeout for security
- **Failed Login Protection**: Account lockout after failed attempts
- **Two-Factor Authentication**: Optional 2FA for enhanced security

### Privacy Compliance
- **Data Minimization**: Only collect necessary employee data
- **Access Controls**: Role-based access to sensitive information
- **Data Retention**: Configurable data retention policies
- **Export/Delete**: Employee data export and deletion capabilities

---

## System Administration

### User Management
- **Role Assignment**: Assign and modify user roles
- **Permission Management**: Fine-grained permission control
- **Bulk Operations**: Mass user updates and imports
- **Account Lifecycle**: User creation, modification, deactivation

### System Configuration
- **Company Settings**: Configure company-wide policies
- **Time Zone Settings**: Multi-timezone support
- **Notification Preferences**: System-wide notification settings
- **Integration Settings**: Configure external system connections

### Maintenance
- **Database Maintenance**: Regular database optimization
- **Log Management**: System log rotation and archival
- **Performance Monitoring**: System performance tracking
- **Update Management**: System updates and patches

---

## Frequently Asked Questions

### General Questions

**Q: How do I reset my password?**
A: Contact your system administrator to reset your password. Self-service password reset may be available depending on system configuration.

**Q: Can I use WorkSync on my mobile device?**
A: Yes! WorkSync is a Progressive Web App (PWA) that works on all devices. You can install it on your phone for a native app experience.

**Q: What browsers are supported?**
A: WorkSync works on all modern browsers including Chrome, Firefox, Safari, and Edge. For best experience, use the latest browser version.

### Time Tracking Questions

**Q: What if I forget to clock out?**
A: Contact your administrator to correct your time log. They can manually add your clock-out time.

**Q: Can I clock in early for my shift?**
A: You can clock in up to 15 minutes before your scheduled shift start time. Earlier clock-ins may require admin approval.

**Q: Why can't I clock in without a QR code?**
A: Some locations require QR code scanning for precise location verification. This is configured by your administrator.

### Leave Questions

**Q: How far in advance should I request leave?**
A: Submit leave requests as early as possible. Company policy may specify minimum notice requirements.

**Q: Can I cancel a leave request?**
A: Yes, you can cancel pending leave requests. Contact your administrator for approved requests that need cancellation.

### Technical Questions

**Q: The app isn't working properly. What should I do?**
A: Try refreshing your browser first. If issues persist, contact your system administrator with details about the problem.

**Q: Can I use WorkSync offline?**
A: Limited offline functionality is available. You can view recent data, but clock in/out requires an internet connection.

---

*This comprehensive guide covers all major features of WorkSync. For additional features, advanced configuration, or technical support, contact your system administrator.*
