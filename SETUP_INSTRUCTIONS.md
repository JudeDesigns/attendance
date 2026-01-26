# WorkSync Testing Setup Instructions

## 📦 Testing Package Created

I've created a complete manual testing package for WorkSync. Here's what you have:

### **📚 Documentation Files**:

1. **TESTING_README.md** - Overview and quick start
2. **TESTING_COORDINATOR_GUIDE.md** - For you (the admin/coordinator)
3. **USER_TESTING_GUIDE.md** - For your testers (comprehensive)
4. **TEST_USERS_QUICK_REFERENCE.md** - Quick reference card for testers

### **🔧 Helper Scripts**:

5. **get_test_users.py** - List existing users
6. **create_test_users.py** - Create test accounts
7. **list_test_users.sh** - Bash script to list users

---

## 🚀 How to Get Started

### **Step 1: Check Your Current Users**

Since the Python scripts need the backend environment, use the Django admin panel instead:

1. **Access Django Admin**:
   ```
   http://your-server-ip/admin/
   ```

2. **Login** with your admin credentials

3. **Go to**: Authentication and Authorization → Users

4. **Note down** existing usernames that you can use for testing

### **Step 2: Create/Reset Test User Passwords**

For each user you want to use for testing:

```bash
# SSH into your server
ssh user@your-server

# Navigate to backend directory
cd /path/to/WorkSync/backend

# Reset password for a user
python3 manage.py changepassword <username>

# Example:
python3 manage.py changepassword admin
python3 manage.py changepassword test_driver
```

Set simple passwords like `password123` for testing (change after testing!).

### **Step 3: Create Test Shifts**

Your testers will need shifts to clock in:

1. **Login** to WorkSync as admin
2. **Go to** Scheduling page
3. **Create shifts** for test employees:
   - Date: Today or tomorrow
   - Time: 9:00 AM - 5:00 PM (Los Angeles time)
   - Assign to test employees

### **Step 4: Update Test Credentials Document**

Edit **TEST_USERS_QUICK_REFERENCE.md** and update the credentials table with your actual usernames and passwords.

### **Step 5: Distribute to Testers**

Share these files with your testers:
- ✅ **USER_TESTING_GUIDE.md** (main guide)
- ✅ **TEST_USERS_QUICK_REFERENCE.md** (with updated credentials)
- ✅ WorkSync URL
- ✅ QR codes (if using QR enforcement)

---

## 📋 Recommended Test Accounts

You should have at least these types of accounts:

| Type | Purpose | Minimum Count |
|------|---------|---------------|
| Admin | Full system access, scheduling, approvals | 1 |
| Employee/Driver | Regular employee testing | 2-3 |

**Why multiple employees?**
- Test data privacy (ensure users can't see each other's data)
- Test concurrent usage
- Test different roles/permissions

---

## 🎯 Critical Tests to Monitor

Make sure your testers focus on these:

### **1. Data Privacy** 🔴 CRITICAL
- Users must NOT see other users' data
- Test by logging in as User A, then logout and login as User B in same browser tab
- User B should NOT see any of User A's data

### **2. Timezone Handling** 🔴 CRITICAL
- All times must display in Los Angeles time (PST/PDT)
- Shift times: 11AM-7PM should stay 11AM-7PM (not convert to 8PM-4AM)
- Notification timestamps should show PST/PDT

### **3. Core Workflows** 🟡 HIGH
- Clock in/out must work reliably
- Break notifications must appear correctly
- Leave requests must be submittable and approvable

---

## 📝 Quick Testing Workflow

### **For You (Coordinator)**:

1. **Morning**:
   - Verify backend is running: `sudo systemctl status attendance-backend`
   - Check frontend is accessible
   - Review any overnight bug reports

2. **During Testing**:
   - Monitor bug reports
   - Answer tester questions
   - Reproduce critical bugs
   - Prioritize fixes

3. **End of Day**:
   - Review all bugs
   - Update bug tracking
   - Plan next day's focus

### **For Testers**:

1. **Start**: Read USER_TESTING_GUIDE.md
2. **Login**: Use provided test credentials
3. **Test**: Follow scenarios in the guide
4. **Report**: Use bug report template for any issues
5. **Verify**: Check timezone and data privacy

---

## 🐛 Bug Reporting

Testers should report bugs using this format:

```
BUG: [Short title]
SEVERITY: [Critical/High/Medium/Low]

STEPS TO REPRODUCE:
1. [First step]
2. [Second step]
3. [etc.]

EXPECTED: [What should happen]
ACTUAL: [What actually happened]

ACCOUNT: [Which test user]
BROWSER: [Chrome/Safari/etc.]
DEVICE: [Desktop/Mobile/Tablet]
```

---

## ✅ Success Criteria

Testing is complete when:

- ✅ All critical bugs fixed
- ✅ Data privacy verified (no user data leakage)
- ✅ Timezone handling verified (all times in PST/PDT)
- ✅ Core workflows tested and working
- ✅ Mobile experience acceptable
- ✅ All test scenarios completed

---

## 🆘 Common Issues & Solutions

### **Issue: Can't access Django admin**
**Solution**: 
```bash
# Create superuser if needed
cd backend
python3 manage.py createsuperuser
```

### **Issue: Backend not responding**
**Solution**:
```bash
sudo systemctl restart attendance-backend
sudo systemctl status attendance-backend
```

### **Issue: Testers see wrong timezone**
**Solution**: This is a bug - report it immediately. All times should be in Los Angeles time (PST/PDT).

### **Issue: Testers see other users' data**
**Solution**: This is a CRITICAL bug - stop testing and fix immediately.

---

## 📞 Next Steps

1. **Read**: TESTING_COORDINATOR_GUIDE.md (your main guide)
2. **Check**: Current users in Django admin
3. **Reset**: Passwords for test accounts
4. **Create**: Test shifts for today/tomorrow
5. **Update**: TEST_USERS_QUICK_REFERENCE.md with actual credentials
6. **Distribute**: USER_TESTING_GUIDE.md to testers
7. **Begin**: Start with basic smoke testing

---

## 📚 Document Reference

| Document | Audience | Purpose |
|----------|----------|---------|
| TESTING_README.md | Everyone | Overview |
| TESTING_COORDINATOR_GUIDE.md | You | Complete coordinator guide |
| USER_TESTING_GUIDE.md | Testers | Detailed test scenarios |
| TEST_USERS_QUICK_REFERENCE.md | Testers | Quick reference |
| SETUP_INSTRUCTIONS.md | You | This file - setup help |

---

**You're all set!** 🎉

Start with TESTING_COORDINATOR_GUIDE.md for your complete guide.

Good luck with testing!

