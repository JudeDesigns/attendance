# Bulk Shift Creation Fix

## 🐛 Problem

When using the "Bulk Create Shifts" feature in the admin scheduling page, it was failing with the error: **"Failed to create shifts"**

## 🔍 Root Causes

1. **Field Name Mismatch**: Frontend was sending `days_of_week` but backend expected `weekdays`
2. **Single vs Multiple Employees**: Backend only supported creating shifts for ONE employee at a time, but the UI allowed selecting multiple employees
3. **Day Numbering**: Frontend was using 1-7 (Mon=1, Sun=7) but backend expected 0-6 (Mon=0, Sun=6)

## ✅ Fixes Applied

### **Backend Changes** (`backend/apps/scheduling/`)

#### **1. Updated Serializer** (`serializers.py`)
Changed from single `employee` to multiple `employees`:

```python
class ShiftBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating shifts"""
    employees = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(employment_status='ACTIVE')),
        help_text="List of employee IDs to create shifts for"
    )
    # ... rest of fields
```

#### **2. Updated View** (`views.py`)
Modified `bulk_create` action to loop through multiple employees:

```python
@action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
@transaction.atomic
def bulk_create(self, request):
    """Bulk create shifts for recurring schedules - supports multiple employees"""
    # ... validation ...
    
    employees = data['employees']  # Now a list
    
    # Loop through each employee
    for employee in employees:
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.weekday() in weekdays:
                # Create shift for this employee on this date
                # ... shift creation logic ...
```

**Key improvements**:
- ✅ Supports multiple employees in one request
- ✅ Tracks conflicts and skips them (doesn't fail entire operation)
- ✅ Returns detailed response with created count and skipped conflicts
- ✅ Better logging with all employee IDs

### **Frontend Changes** (`frontend/src/pages/AdminScheduling.js`)

#### **1. Fixed Day Numbering**
Changed from 1-7 to 0-6 to match Python's `weekday()`:

```javascript
const [formData, setFormData] = useState({
  // ...
  days_of_week: [0, 1, 2, 3, 4], // Monday to Friday (0=Mon, 6=Sun)
  // ...
});
```

#### **2. Fixed Day Checkboxes**
Updated to use 0-based indexing:

```javascript
{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
  <input
    type="checkbox"
    checked={formData.days_of_week.includes(index)}  // Was: index + 1
    onChange={() => handleDayChange(index)}          // Was: index + 1
  />
))}
```

#### **3. Fixed Field Name Mapping**
Renamed `days_of_week` to `weekdays` when sending to backend:

```javascript
const handleBulkCreate = (bulkData) => {
  const { days_of_week, ...restData } = bulkData;
  
  const payload = {
    ...restData,
    weekdays: days_of_week,  // Rename for backend
  };
  
  bulkCreateMutation.mutate(payload);
};
```

#### **4. Improved Error Handling**
Better error messages from backend response:

```javascript
const bulkCreateMutation = useMutation(schedulingAPI.bulkCreateShifts, {
  onSuccess: (response) => {
    const message = response.data?.message || 'Shifts created successfully';
    toast.success(message);  // Shows: "Successfully created X shifts for Y employee(s)"
  },
  onError: (error) => {
    // Detailed error extraction
  },
});
```

## 📋 How It Works Now

1. **Admin selects multiple employees** from the checkbox list
2. **Sets date range** (start_date to end_date)
3. **Sets time range** (start_time to end_time)
4. **Selects days of week** (Mon-Sun checkboxes)
5. **Clicks "Create Shifts"**

**Backend processes**:
- Loops through each selected employee
- For each date in the range:
  - Checks if it's a selected weekday
  - Checks for conflicts
  - Creates shift if no conflict
  - Skips if conflict exists
- Returns summary: "Successfully created 15 shifts for 3 employee(s). Skipped 2 conflicting shifts."

## 🔄 Next Steps

**You need to restart the backend** to apply the changes:

```bash
sudo systemctl restart attendance-backend
sudo systemctl status attendance-backend
```

Then test the bulk create feature:
1. Go to Admin Scheduling page
2. Click "Bulk Create Shifts"
3. Select 2-3 employees
4. Set date range (e.g., next week)
5. Select Mon-Fri
6. Set times (e.g., 9:00 AM - 5:00 PM)
7. Click "Create Shifts"

**Expected result**: Success message showing how many shifts were created for how many employees.

## ✅ Testing Checklist

- [ ] Backend restarted successfully
- [ ] Can select multiple employees
- [ ] Can select specific days of week
- [ ] Shifts created for all selected employees
- [ ] Conflicts are skipped (not failed)
- [ ] Success message shows correct counts
- [ ] Shifts appear in the schedule view
- [ ] Times are in Los Angeles timezone (PST/PDT)

## 🎯 Benefits

1. **Faster scheduling**: Create a week's worth of shifts for multiple employees in one click
2. **Conflict handling**: Automatically skips conflicting shifts instead of failing
3. **Better feedback**: Clear success/error messages with counts
4. **Audit trail**: Logs all bulk operations with employee IDs

---

**Status**: ✅ Code changes complete, awaiting backend restart for testing

