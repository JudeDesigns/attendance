# WorkSync Testing Coordinator Guide

## 📋 Overview

This guide helps you (the admin/coordinator) set up and manage the manual testing process for WorkSync.

---

## 🚀 Quick Start (5 Steps)

### **Step 1: Prepare Test Users**

**Option A: Use Existing Users**
```bash
# Check what users you have
python3 get_test_users.py
```

**Option B: Create New Test Users**
```bash
# Create standard test accounts
python3 create_test_users.py
```

This creates:
- `admin` - Admin user (password: password123)
- `test_driver` - Driver role (password: password123)
- `employee1` - Regular employee (password: password123)
- `employee2` - Second employee for data privacy testing (password: password123)

### **Step 2: Verify Test Environment**

```bash
# Restart backend to ensure latest code
sudo systemctl restart attendance-backend

# Check backend status
sudo systemctl status attendance-backend

# Check frontend is running
# Access http://your-server-ip/ in browser
```

### **Step 3: Prepare Test Data**

**Create Test Shifts** (so employees can clock in):
1. Login as admin
2. Go to Scheduling page
3. Create shifts for test employees for today/tomorrow
4. Set times like 9:00 AM - 5:00 PM (Los Angeles time)

**Verify Locations** (if using QR codes):
1. Go to Locations management
2. Ensure test locations exist
3. Generate/print QR codes if needed

### **Step 4: Distribute Testing Materials**

Share with testers:
1. **USER_TESTING_GUIDE.md** - Complete testing instructions
2. **TEST_USERS_QUICK_REFERENCE.md** - Quick reference (update with actual credentials)
3. **Test credentials** - Usernames and passwords
4. **Access URL** - Your WorkSync URL
5. **QR codes** - If QR enforcement is enabled

### **Step 5: Set Up Bug Tracking**

Create a shared document/spreadsheet with columns:
- Bug ID
- Reported By
- Date
- Severity (Critical/High/Medium/Low)
- Title
- Description
- Steps to Reproduce
- Status (New/In Progress/Fixed/Closed)
- Assigned To
- Notes

---

## 📊 Testing Phases

### **Phase 1: Smoke Testing (Day 1)**
**Goal**: Verify core features work

**Focus Areas**:
- Login/Logout
- Clock In/Out
- Basic navigation
- Admin access

**Testers**: 1-2 people  
**Duration**: 2-4 hours

### **Phase 2: Feature Testing (Day 2-3)**
**Goal**: Test all major features

**Focus Areas**:
- Break management
- Leave requests
- Shift scheduling
- Notifications
- Reports

**Testers**: 3-5 people  
**Duration**: 1-2 days

### **Phase 3: Data Privacy & Security (Day 3-4)**
**Goal**: Verify user isolation and security

**Focus Areas**:
- User data isolation
- Permission enforcement
- QR code security
- Session management

**Testers**: 2-3 people  
**Duration**: 4-8 hours

### **Phase 4: Edge Cases & Stress Testing (Day 4-5)**
**Goal**: Break the system

**Focus Areas**:
- Invalid inputs
- Concurrent users
- Long sessions
- Mobile devices
- Different browsers

**Testers**: All available  
**Duration**: 1-2 days

---

## 🎯 Critical Tests to Monitor

### **🔴 Must Pass Before Production**:

1. **Data Privacy**:
   - [ ] Users cannot see other users' data
   - [ ] Logout clears all cached data
   - [ ] Login shows only current user's data

2. **Timezone Handling**:
   - [ ] All times display in Los Angeles time (PST/PDT)
   - [ ] Shift times: 11AM-7PM stays 11AM-7PM (not converted)
   - [ ] Notification timestamps in PST/PDT

3. **Core Workflows**:
   - [ ] Clock in/out works reliably
   - [ ] Break notifications appear correctly
   - [ ] Leave requests can be submitted and approved

4. **Security**:
   - [ ] QR codes cannot be spoofed
   - [ ] Users cannot access unauthorized features
   - [ ] Session timeout works

---

## 🐛 Bug Triage Guidelines

### **Severity Levels**:

**Critical** (Fix immediately):
- System crashes
- Data loss or corruption
- Security vulnerabilities
- Data privacy breaches
- Core features completely broken

**High** (Fix before production):
- Major features not working
- Timezone issues
- Incorrect calculations
- Poor error handling

**Medium** (Fix if time permits):
- UI issues on mobile
- Confusing error messages
- Minor feature bugs
- Performance issues

**Low** (Post-launch):
- Cosmetic issues
- Minor UI improvements
- Nice-to-have features

---

## 📈 Daily Testing Checklist

### **Morning**:
- [ ] Verify backend is running
- [ ] Check frontend is accessible
- [ ] Review overnight bug reports
- [ ] Prioritize critical issues
- [ ] Brief testers on focus areas

### **During Testing**:
- [ ] Monitor bug reports
- [ ] Answer tester questions
- [ ] Reproduce reported bugs
- [ ] Categorize and prioritize bugs
- [ ] Communicate with development team

### **End of Day**:
- [ ] Review all bug reports
- [ ] Update bug tracking sheet
- [ ] Identify blockers for next day
- [ ] Plan fixes for critical issues
- [ ] Brief team on progress

---

## 🔧 Common Issues & Solutions

### **Issue: Testers can't login**
**Solution**:
```bash
# Reset password
python3 backend/manage.py changepassword <username>
```

### **Issue: Backend not responding**
**Solution**:
```bash
# Check status
sudo systemctl status attendance-backend

# Restart if needed
sudo systemctl restart attendance-backend

# Check logs
sudo journalctl -u attendance-backend -n 50
```

### **Issue: Frontend shows old data**
**Solution**:
- Have testers clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Try incognito/private mode

### **Issue: Times showing wrong timezone**
**Solution**:
- This is a bug - report it
- Check backend logs for timezone conversion
- Verify Django settings: `TIME_ZONE = 'America/Los_Angeles'`

### **Issue: QR scanner not working**
**Solution**:
- Check browser permissions for camera
- Try different browser
- Ensure HTTPS (required for camera access)
- Test on actual mobile device

---

## 📞 Support Resources

### **For Testers**:
- Testing guide: `USER_TESTING_GUIDE.md`
- Quick reference: `TEST_USERS_QUICK_REFERENCE.md`
- Your contact info: [Add your email/phone]

### **For You**:
- Backend logs: `sudo journalctl -u attendance-backend -f`
- Frontend logs: Browser console (F12)
- Database access: `python3 backend/manage.py dbshell`
- Django admin: `http://your-server/admin/`

---

## ✅ Testing Complete Checklist

Before declaring testing complete:

- [ ] All critical bugs fixed
- [ ] All high-priority bugs fixed or documented
- [ ] Data privacy verified (no user data leakage)
- [ ] Timezone handling verified (all times in PST/PDT)
- [ ] Core workflows tested by multiple users
- [ ] Mobile testing completed
- [ ] Edge cases tested
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation updated
- [ ] Known issues documented
- [ ] Testers debriefed
- [ ] Bug tracking sheet finalized
- [ ] Stakeholders informed

---

## 📝 Post-Testing Report Template

```markdown
# WorkSync Testing Report

**Testing Period**: [Start Date] - [End Date]  
**Testers**: [Number] testers  
**Test Accounts Used**: [List usernames]

## Summary
- Total bugs found: [Number]
- Critical: [Number]
- High: [Number]
- Medium: [Number]
- Low: [Number]

## Critical Issues
[List critical bugs and their status]

## High Priority Issues
[List high-priority bugs and their status]

## Test Coverage
- [x] Clock In/Out
- [x] Break Management
- [x] Leave Requests
- [x] Shift Scheduling
- [x] Data Privacy
- [x] Timezone Handling
- [x] Mobile Responsiveness
- [x] QR Code Scanning

## Recommendations
[Your recommendations for production readiness]

## Known Issues
[List of known issues going to production]

## Next Steps
[What needs to happen before/after launch]
```

---

## 🎉 Success Criteria

Testing is successful when:

1. ✅ All critical bugs are fixed
2. ✅ Core workflows work reliably
3. ✅ Data privacy is verified
4. ✅ Timezone handling is correct
5. ✅ Mobile experience is acceptable
6. ✅ Testers are confident in the system
7. ✅ Stakeholders approve for production

---

**Good luck with testing!** 🚀

Remember: The goal is to find and fix issues before users do. Every bug found in testing is a success!

