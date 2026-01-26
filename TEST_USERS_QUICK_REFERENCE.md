# WorkSync Test Users - Quick Reference Card

## 🔐 Test Account Credentials

**⚠️ IMPORTANT**: Contact your system administrator to get the actual test account credentials before starting testing.

### **Typical Test Accounts**:

| Role | Username | Password | Purpose |
|------|----------|----------|---------|
| Admin | `admin` | *Ask Admin* | Full system access, scheduling, approvals |
| Driver 1 | `test_driver` | *Ask Admin* | Employee with driver role |
| Employee 1 | `employee1` | *Ask Admin* | Regular employee account |
| Employee 2 | `employee2` | *Ask Admin* | Second employee for data privacy testing |

---

## 🌐 Access URLs

- **Production**: `http://[your-server-ip]/` or `https://[your-domain]/`
- **Local Development**: `http://localhost:3000/`

---

## 📱 Quick Test Workflows

### **1. Basic Clock In/Out** (5 minutes)
```
1. Login as employee
2. Go to "Clock In/Out" page
3. Click "Clock In" button
4. Wait 2 minutes
5. Click "Clock Out" button
6. Verify times are in Los Angeles timezone (PST/PDT)
```

### **2. Break Management** (10 minutes)
```
1. Login as employee
2. Clock in
3. Wait for break notification (or ask admin to trigger)
4. Click "Take Break Now"
5. Wait 1 minute
6. Click "End Break"
7. Verify break recorded correctly
```

### **3. Leave Request** (5 minutes)
```
Employee:
1. Login as employee
2. Go to "Leave Management"
3. Click "Request Leave"
4. Fill form and submit
5. Verify request shows as "PENDING"

Admin:
6. Logout, login as admin
7. Go to "Leave Management" → "Pending Approvals"
8. Approve the request
9. Verify status changes to "APPROVED"
```

### **4. Data Privacy Test** (5 minutes) ⚠️ CRITICAL
```
1. Login as Employee A
2. Clock in and trigger break notification
3. Note what data you see
4. Logout (same browser tab)
5. Login as Employee B (same browser tab)
6. Verify you DON'T see Employee A's data
7. Report if you see any data from Employee A
```

---

## 🐛 Common Issues to Watch For

### **🔴 Critical (Report Immediately)**:
- [ ] Can see other users' data after logout/login
- [ ] System crashes or white screen
- [ ] Cannot clock in/out at all
- [ ] Data disappears or gets corrupted

### **🟡 High Priority**:
- [ ] Times display in wrong timezone (should be PST/PDT, not UTC)
- [ ] Break notifications don't appear
- [ ] Leave requests don't get approved
- [ ] QR scanner doesn't work

### **🟢 Medium Priority**:
- [ ] UI elements overlap on mobile
- [ ] Error messages unclear
- [ ] Slow loading times
- [ ] Minor visual glitches

---

## ✅ Quick Verification Checklist

After each test, verify:
- ✅ **Timezone**: All times show Los Angeles time (PST/PDT)
- ✅ **Privacy**: Only see your own data
- ✅ **Success Messages**: Clear confirmation of actions
- ✅ **Error Handling**: Clear error messages when something fails
- ✅ **Mobile**: Works on phone/tablet

---

## 📝 Quick Bug Report Format

```
BUG: [Short title]
SEVERITY: [Critical/High/Medium/Low]
STEPS:
1. [What you did]
2. [What happened]
EXPECTED: [What should happen]
ACCOUNT: [Which test user]
BROWSER: [Chrome/Safari/etc.]
```

---

## 💡 Pro Tips

1. **Test in same browser tab**: Logout and login as different users in the same tab to test data privacy
2. **Check timestamps**: All times should be in Los Angeles timezone (PST/PDT)
3. **Try to break it**: The goal is to find bugs, so try unusual actions
4. **Take screenshots**: Especially for visual bugs
5. **Test on mobile**: Many users will access from phones

---

## 🆘 Stuck? Try This:

1. **Logout and login again** (clears cache)
2. **Try different browser** (Chrome, Safari, Firefox)
3. **Check if you're using correct test account**
4. **Contact admin** for help or new test credentials
5. **Document the issue** even if you can't proceed

---

## 📞 Contact

**System Administrator**: [Your admin's contact info]  
**Bug Reports**: [Email or shared document link]  
**Questions**: [Slack/Teams channel or email]

---

**Happy Testing! 🎉**

Remember: Finding bugs is success, not failure. Every bug you find makes the system better!

