# WorkSync Manual Testing Package

## 📦 What's Included

This testing package contains everything you need to conduct comprehensive manual testing of the WorkSync workforce management system.

---

## 📚 Documents Overview

### **For Testing Coordinator (You)**:

1. **TESTING_COORDINATOR_GUIDE.md** ⭐ START HERE
   - Complete setup instructions
   - Testing phase planning
   - Bug triage guidelines
   - Daily checklists
   - Troubleshooting guide

### **For Testers**:

2. **USER_TESTING_GUIDE.md** ⭐ MAIN TESTING GUIDE
   - Detailed test scenarios
   - Step-by-step instructions
   - Expected behaviors
   - Bug reporting template
   - Complete testing checklist

3. **TEST_USERS_QUICK_REFERENCE.md** 📋 QUICK REFERENCE
   - Test account credentials
   - Quick test workflows
   - Common issues checklist
   - Quick bug report format

### **Helper Scripts**:

4. **get_test_users.py** 🔍
   - Lists all users in database
   - Shows user details and roles
   - Identifies missing test accounts

5. **create_test_users.py** 👥
   - Creates standard test accounts
   - Sets up test passwords
   - Creates employee profiles

---

## 🚀 Quick Start (For Coordinator)

### **Step 1: Set Up Test Users** (5 minutes)

```bash
# Option A: Check existing users
python3 get_test_users.py

# Option B: Create new test users
python3 create_test_users.py
```

### **Step 2: Prepare Test Environment** (10 minutes)

```bash
# Restart backend
sudo systemctl restart attendance-backend

# Verify it's running
sudo systemctl status attendance-backend
```

**In the admin panel**:
- Create test shifts for today/tomorrow
- Verify locations exist (if using QR codes)
- Check that test employees have proper roles

### **Step 3: Distribute Materials** (5 minutes)

Share with testers:
- ✅ USER_TESTING_GUIDE.md
- ✅ TEST_USERS_QUICK_REFERENCE.md (update with actual credentials)
- ✅ Test account credentials
- ✅ WorkSync access URL
- ✅ QR codes (if applicable)

### **Step 4: Brief Testers** (15 minutes)

- Explain testing objectives
- Walk through USER_TESTING_GUIDE.md
- Show how to report bugs
- Answer questions
- Assign test scenarios

### **Step 5: Monitor & Support** (Ongoing)

- Review bug reports as they come in
- Answer tester questions
- Reproduce and prioritize bugs
- Communicate with development team

---

## 🎯 Testing Priorities

### **Priority 1: Critical Features** (Must work)
- ✅ Login/Logout
- ✅ Clock In/Out
- ✅ Data privacy (users can't see each other's data)
- ✅ Timezone handling (all times in Los Angeles PST/PDT)

### **Priority 2: Core Workflows** (Should work)
- ✅ Break management
- ✅ Leave requests and approvals
- ✅ Shift scheduling
- ✅ Notifications

### **Priority 3: Edge Cases** (Nice to verify)
- ✅ Mobile responsiveness
- ✅ Error handling
- ✅ QR code security
- ✅ Concurrent users

---

## 📊 Recommended Testing Schedule

### **Day 1: Setup & Smoke Testing**
- Morning: Set up test users and environment
- Afternoon: Basic smoke testing (login, navigation, clock in/out)
- Testers: 1-2 people

### **Day 2-3: Feature Testing**
- Test all major features systematically
- Focus on employee and admin workflows
- Testers: 3-5 people

### **Day 3-4: Data Privacy & Security**
- Test user isolation
- Verify timezone handling
- Test QR code security
- Testers: 2-3 people

### **Day 4-5: Edge Cases & Polish**
- Mobile testing
- Different browsers
- Stress testing
- Edge cases
- Testers: All available

---

## 🐛 Bug Severity Guide

**Critical** 🔴 (Fix immediately):
- System crashes or data loss
- Security vulnerabilities
- Data privacy breaches
- Core features completely broken

**High** 🟡 (Fix before production):
- Major features not working correctly
- Timezone issues
- Incorrect calculations

**Medium** 🟢 (Fix if time permits):
- UI issues
- Minor feature bugs
- Confusing error messages

**Low** ⚪ (Post-launch):
- Cosmetic issues
- Minor improvements

---

## 📝 Test Account Credentials

**⚠️ Update this section with your actual credentials**

After running `create_test_users.py`, you'll have:

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| admin | password123 | Admin | Full system access |
| test_driver | password123 | Driver | Employee testing |
| employee1 | password123 | Employee | Primary employee testing |
| employee2 | password123 | Employee | Data privacy testing |

**Access URL**: http://[your-server-ip]/ or https://[your-domain]/

---

## ✅ Success Criteria

Testing is complete when:

1. ✅ All critical bugs are fixed
2. ✅ Core workflows tested and working
3. ✅ Data privacy verified (no user data leakage)
4. ✅ Timezone handling verified (all times in PST/PDT)
5. ✅ Mobile experience acceptable
6. ✅ All test scenarios completed
7. ✅ Bug tracking sheet finalized
8. ✅ Stakeholders approve for production

---

## 🆘 Need Help?

### **Common Issues**:

**Testers can't login**:
```bash
python3 backend/manage.py changepassword <username>
```

**Backend not responding**:
```bash
sudo systemctl restart attendance-backend
sudo journalctl -u attendance-backend -n 50
```

**Frontend shows old data**:
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Try incognito mode

**Times showing wrong timezone**:
- This is a bug - report it immediately
- Should always show Los Angeles time (PST/PDT)

---

## 📞 Support Contacts

**System Administrator**: [Your contact info]  
**Bug Reports**: [Email or shared document link]  
**Questions**: [Slack/Teams channel]

---

## 🎉 Ready to Start?

1. **Coordinator**: Read TESTING_COORDINATOR_GUIDE.md
2. **Run**: `python3 create_test_users.py` (if needed)
3. **Verify**: Backend and frontend are running
4. **Distribute**: USER_TESTING_GUIDE.md to testers
5. **Begin**: Start with Scenario 1 (Clock In/Out)

---

**Good luck with testing!** 🚀

Every bug found in testing is a bug that won't affect real users. Happy testing!

---

**Package Version**: 1.0  
**Created**: 2026-01-26  
**System**: WorkSync Workforce Management  
**Timezone**: America/Los_Angeles (PST/PDT)

