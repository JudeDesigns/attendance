# WorkSync User Testing Guide

## 📋 Purpose
This document guides manual testers through the WorkSync workforce management system to identify bugs and validate functionality before production deployment.

## 🎯 Testing Objectives
- Validate all employee workflows (clock in/out, breaks, leave requests)
- Verify admin workflows (scheduling, approvals, monitoring)
- Test data privacy and user isolation
- Identify UI/UX issues and edge cases
- Verify timezone handling (all times should display in Los Angeles/PST)

---

## 👥 Test User Accounts

### **IMPORTANT: Get Test Credentials from Admin**
Before starting, contact your system administrator to get:
1. **Employee/Driver test account credentials** (username & password)
2. **Admin test account credentials** (username & password)
3. **QR codes** for test locations (if QR enforcement is enabled)

### **Default Test Users** (if available in your database):
- **Admin User**: `admin` / (ask admin for password)
- **Test Driver**: `test_driver` / `password123`
- **Employee Users**: Check with admin for additional test accounts

### **Access URL**
- **Production**: `http://your-server-ip/` or your domain
- **Local**: `http://localhost:3000/`

---

## 🧪 Test Scenarios

### **SCENARIO 1: Employee Clock In/Out Workflow**

**Objective**: Test basic time tracking functionality

**Steps**:
1. **Login** as an employee/driver account
2. **Navigate** to "Clock In/Out" page
3. **Verify** you see your current shift information (if scheduled)
4. **Clock In**:
   - If QR required: Use QR scanner tab and scan location QR code
   - If portal allowed: Click "Clock In" button
5. **Verify**:
   - ✅ Success message appears
   - ✅ Status changes to "Clocked In"
   - ✅ Clock-in time displays in **Los Angeles time (PST/PDT)**
   - ✅ Timer shows hours worked
6. **Wait 2-3 minutes** (to accumulate some work time)
7. **Clock Out**:
   - If QR required: Scan QR code again
   - If portal allowed: Click "Clock Out" button
8. **Verify**:
   - ✅ Success message shows hours worked
   - ✅ Status changes to "Clocked Out"
   - ✅ Clock-out time displays in **Los Angeles time**

**What to Report**:
- ❌ Cannot clock in/out
- ❌ Times display in wrong timezone (should be PST/PDT, not UTC or your local time)
- ❌ QR scanner not working
- ❌ Error messages that don't make sense
- ❌ UI elements overlapping or broken on mobile

---

### **SCENARIO 2: Break Management**

**Objective**: Test break notification and break tracking

**Prerequisites**: Must be clocked in

**Steps**:
1. **Clock in** as employee
2. **Work for 1+ hours** (or ask admin to manually trigger break requirement)
3. **Verify Break Notification**:
   - ✅ After working required hours, break notification should appear
   - ✅ Notification shows break type (SHORT/LUNCH/LONG)
   - ✅ Shows hours worked
4. **Take Break**:
   - Click "Take Break Now" button
5. **Verify**:
   - ✅ Break status shows "On Break"
   - ✅ Break timer starts
   - ✅ Break button shows "On Break" status
6. **End Break**:
   - Click "End Break" button (in BreakManager or Dashboard)
7. **Verify**:
   - ✅ Break ends successfully
   - ✅ Status returns to "Clocked In"
   - ✅ Break duration recorded

**Alternative Actions to Test**:
- **Waive Break**: Click "Waive Break" → Enter reason → Submit
- **Remind Later**: Click "Remind Later" → Enter reason → Submit

**What to Report**:
- ❌ Break notification doesn't appear after working required hours
- ❌ Cannot start/end break
- ❌ Break times display in wrong timezone
- ❌ Break button shows wrong status
- ❌ Can take break when not clocked in (this is a bug!)

---

### **SCENARIO 3: Leave Request Workflow**

**Objective**: Test leave request submission and approval process

**Employee Steps**:
1. **Login** as employee
2. **Navigate** to "Leave Management" page
3. **Click** "Request Leave" button
4. **Fill out form**:
   - Leave Type: Select (e.g., "Vacation", "Sick Leave")
   - Start Date: Pick a future date
   - End Date: Pick end date (same or later)
   - Reason: Enter reason
5. **Submit** request
6. **Verify**:
   - ✅ Success message appears
   - ✅ Request appears in "My Requests" tab with "PENDING" status
   - ✅ Leave balance decreases (if applicable)

**Admin Steps**:
7. **Logout** employee, **Login** as admin
8. **Navigate** to "Leave Management" → "Pending Approvals" tab
9. **Verify**:
   - ✅ Employee's leave request appears
   - ✅ Shows employee name, dates, type, reason
10. **Approve** the request
11. **Verify**:
    - ✅ Status changes to "APPROVED"
    - ✅ Request removed from pending list

**Employee Verification**:
12. **Logout** admin, **Login** as employee again
13. **Check** "My Requests" tab
14. **Verify**:
    - ✅ Request status shows "APPROVED"
    - ✅ Dates display in correct timezone

**What to Report**:
- ❌ Cannot submit leave request
- ❌ Request doesn't appear for admin
- ❌ Approval doesn't update status
- ❌ Dates display in wrong timezone
- ❌ Leave balance calculation incorrect

---

### **SCENARIO 4: Admin Shift Scheduling**

**Objective**: Test shift creation and assignment

**Prerequisites**: Login as admin

**Steps**:
1. **Navigate** to "Scheduling" page
2. **Click** "Create Shift" or "Add Shift" button
3. **Fill out shift form**:
   - Employee: Select test employee
   - Date: Select date
   - Start Time: Enter time (e.g., 11:00 AM)
   - End Time: Enter time (e.g., 7:00 PM)
   - Location: Select location (if applicable)
4. **Submit** shift
5. **Verify**:
   - ✅ Shift appears in schedule
   - ✅ Times display as entered (11:00 AM - 7:00 PM in Los Angeles time)
   - ✅ **NOT** converted to different timezone (e.g., should NOT show 8:00 PM - 4:00 AM)

**Employee Verification**:
6. **Logout** admin, **Login** as the employee assigned to shift
7. **Navigate** to Dashboard or Clock In/Out page
8. **Verify**:
   - ✅ Shift information shows correct times (11:00 AM - 7:00 PM)
   - ✅ Can clock in during shift window
   - ✅ Cannot clock in outside shift window (unless within 15 min before)

**What to Report**:
- ❌ Shift times get converted to wrong timezone
- ❌ Employee cannot see their assigned shift
- ❌ Cannot clock in during valid shift time
- ❌ Can clock in when no shift scheduled (if shift enforcement is enabled)

---

### **SCENARIO 5: Data Privacy & User Isolation**

**Objective**: Verify users only see their own data

**CRITICAL TEST** - This tests the recent data privacy fix

**Steps**:
1. **Login** as Employee A
2. **Clock in** and work for 1+ hours to trigger break notification
3. **Verify** break notification appears for Employee A
4. **Note** the break notification details
5. **Logout** Employee A (in same browser tab)
6. **Login** as Employee B or Admin (in same browser tab)
7. **Verify**:
   - ✅ Employee A's break notification does NOT appear
   - ✅ Employee B/Admin sees only their own data
   - ✅ No data from Employee A is visible
8. **Check** Dashboard, Clock In/Out page, Notifications
9. **Verify**:
   - ✅ All data is specific to currently logged-in user
   - ✅ No "ghost" data from previous user

**What to Report**:
- ❌ **CRITICAL**: Can see other user's break notifications
- ❌ **CRITICAL**: Can see other user's clock in/out status
- ❌ **CRITICAL**: Can see other user's leave requests
- ❌ **CRITICAL**: Can see other user's notifications
- ❌ Any data leakage between users

---

### **SCENARIO 6: Notification System**

**Objective**: Test notification delivery and display

**Steps**:
1. **Login** as employee
2. **Trigger notifications** by:
   - Clocking in/out
   - Taking breaks
   - Submitting leave requests
   - Working long hours (break notifications)
3. **Check notification bell** (top right corner)
4. **Verify**:
   - ✅ Notification count shows unread notifications
   - ✅ Clicking bell shows notification list
   - ✅ Timestamps display in **Los Angeles time (PST/PDT)**
   - ✅ **NOT** in UTC or your local timezone
5. **Mark notification as read**
6. **Verify**:
   - ✅ Notification count decreases
   - ✅ Notification marked as read

**What to Report**:
- ❌ Notifications don't appear
- ❌ Timestamps display in wrong timezone (should be PST/PDT)
- ❌ Cannot mark as read
- ❌ Notification count incorrect

---

### **SCENARIO 7: Mobile Responsiveness**

**Objective**: Test mobile device compatibility

**Steps**:
1. **Access** WorkSync from mobile device or resize browser to mobile size
2. **Test all workflows** from Scenarios 1-6 on mobile
3. **Verify**:
   - ✅ All pages are readable and usable
   - ✅ Buttons are tappable (not too small)
   - ✅ Forms are easy to fill out
   - ✅ QR scanner works on mobile camera
   - ✅ No horizontal scrolling required
   - ✅ Navigation menu accessible

**What to Report**:
- ❌ Text too small to read
- ❌ Buttons too small to tap
- ❌ UI elements overlapping
- ❌ Forms difficult to use
- ❌ QR scanner not working on mobile
- ❌ Pages require horizontal scrolling

---

### **SCENARIO 8: Edge Cases & Error Handling**

**Objective**: Test system behavior in unusual situations

**Test Cases**:

**A. Double Clock-In Attempt**:
1. Clock in successfully
2. Try to clock in again
3. **Verify**: ✅ System prevents double clock-in with clear error message

**B. Clock Out Without Clock In**:
1. Ensure you're clocked out
2. Try to clock out
3. **Verify**: ✅ System prevents with clear error message

**C. Break Without Clock In**:
1. Ensure you're clocked out
2. Try to take a break
3. **Verify**: ✅ Break button disabled or shows error

**D. Invalid QR Code**:
1. Try to scan invalid/random QR code
2. **Verify**: ✅ System rejects with clear error message

**E. Leave Request for Past Date**:
1. Try to submit leave request for yesterday
2. **Verify**: ✅ System prevents or warns about past dates

**F. Overlapping Leave Requests**:
1. Submit leave request for specific dates
2. Try to submit another request for overlapping dates
3. **Verify**: ✅ System prevents or warns about overlap

**What to Report**:
- ❌ System allows invalid actions
- ❌ Error messages unclear or missing
- ❌ System crashes or freezes
- ❌ Data corruption from edge cases

---

## 📊 What to Look For (General)

### **✅ Good Signs**:
- Clear, helpful error messages
- Smooth transitions between pages
- Fast loading times
- Intuitive navigation
- Consistent design
- All times in Los Angeles timezone (PST/PDT)
- Data privacy maintained between users

### **❌ Red Flags (Report Immediately)**:
- **Data Privacy Issues**: Seeing other users' data
- **Timezone Issues**: Times displaying in UTC or wrong timezone
- **System Crashes**: White screen, infinite loading
- **Data Loss**: Information disappearing
- **Security Issues**: Accessing unauthorized features
- **Broken Core Features**: Cannot clock in/out, cannot submit requests

---

## 📝 How to Report Bugs

### **Bug Report Template**:

```
**Bug Title**: [Short description]

**Severity**: [Critical / High / Medium / Low]
- Critical: System crash, data loss, security issue
- High: Core feature broken
- Medium: Feature works but has issues
- Low: Minor UI issue

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**User Account**: [Which test account you were using]

**Browser/Device**: [Chrome on Windows / Safari on iPhone / etc.]

**Screenshots**: [Attach if possible]

**Additional Notes**: [Any other relevant information]
```

### **Where to Report**:
- **Email**: [Your admin's email]
- **Shared Document**: [Link to shared bug tracking sheet]
- **Slack/Teams**: [Your team channel]

---

## 🎯 Testing Checklist

Use this checklist to track your progress:

### **Employee Workflows**:
- [ ] Clock In (Portal)
- [ ] Clock In (QR Code)
- [ ] Clock Out (Portal)
- [ ] Clock Out (QR Code)
- [ ] Take Break
- [ ] End Break
- [ ] Waive Break
- [ ] Submit Leave Request
- [ ] Cancel Leave Request
- [ ] View Leave Balance
- [ ] View Notifications
- [ ] Mark Notifications as Read

### **Admin Workflows**:
- [ ] Create Shift
- [ ] Edit Shift
- [ ] Delete Shift
- [ ] View Employee Attendance
- [ ] Approve Leave Request
- [ ] Reject Leave Request
- [ ] View Reports
- [ ] Manage Employees

### **Data Privacy Tests**:
- [ ] User A data not visible to User B
- [ ] Break notifications user-specific
- [ ] Clock status user-specific
- [ ] Notifications user-specific
- [ ] Leave requests user-specific

### **Timezone Tests**:
- [ ] Shift times display correctly (PST/PDT)
- [ ] Clock in/out times display correctly
- [ ] Break times display correctly
- [ ] Notification timestamps display correctly
- [ ] Leave request dates display correctly

### **Mobile Tests**:
- [ ] All pages responsive on mobile
- [ ] QR scanner works on mobile
- [ ] Forms usable on mobile
- [ ] Navigation works on mobile

### **Edge Cases**:
- [ ] Double clock-in prevented
- [ ] Clock out without clock in prevented
- [ ] Break without clock in prevented
- [ ] Invalid QR code rejected
- [ ] Past date leave requests handled
- [ ] Overlapping leave requests handled

---

## 💡 Tips for Effective Testing

1. **Test in Different Browsers**: Chrome, Safari, Firefox, Edge
2. **Test on Different Devices**: Desktop, tablet, mobile phone
3. **Test at Different Times**: During shift hours, outside shift hours
4. **Test with Different Users**: Employee, driver, admin accounts
5. **Take Screenshots**: Especially for bugs and UI issues
6. **Note Timestamps**: Record when bugs occur
7. **Be Thorough**: Try to break things - that's the goal!
8. **Document Everything**: Even small issues can be important

---

## 🆘 Need Help?

If you encounter issues during testing:

1. **Check this guide** for expected behavior
2. **Try logging out and back in** (clears cache)
3. **Try a different browser** (isolates browser-specific issues)
4. **Contact admin** if you're blocked from testing
5. **Document the issue** even if you can't resolve it

---

## ✅ Testing Complete

Once you've completed all test scenarios:

1. **Submit your bug reports** using the template above
2. **Complete the testing checklist** and share with admin
3. **Provide overall feedback** on user experience
4. **Suggest improvements** based on your testing experience

**Thank you for helping make WorkSync better!** 🎉

---

**Document Version**: 1.0
**Last Updated**: 2026-01-26
**System**: WorkSync Workforce Management
**Timezone**: America/Los_Angeles (PST/PDT)

