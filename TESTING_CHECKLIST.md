# WorkSync Testing Checklist

## Pre-Testing Setup

### Environment Preparation
- [ ] Backend virtual environment activated (`cd backend && source venv/bin/activate`)
- [ ] Backend server running on http://localhost:8000 (in activated venv)
- [ ] Frontend server running on http://localhost:3000
- [ ] Database populated with test data
- [ ] Redis server running (for WebSocket/Celery)
- [ ] Python dependencies installed in venv (`pip install -r requirements.txt`)
- [ ] Node.js dependencies installed (`npm install` in frontend/)
- [ ] Testing script dependencies installed (`pip install requests beautifulsoup4`)

### Test Data Requirements
- [ ] Admin user account (username: admin, password: admin123)
- [ ] Regular employee accounts
- [ ] Sample locations with QR codes
- [ ] Test shifts and schedules
- [ ] Sample time logs and attendance data

## Phase 1: Backend API Testing

### Authentication System
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Token verification
- [ ] Token refresh mechanism
- [ ] Logout functionality
- [ ] Permission-based access control

### Employee Management
- [ ] List all employees (GET /api/v1/employees/)
- [ ] Get employee profile (GET /api/v1/employees/me/)
- [ ] Create new employee (POST /api/v1/employees/) - Admin only
- [ ] Update employee information (PUT /api/v1/employees/{id}/) - Admin only
- [ ] Delete employee (DELETE /api/v1/employees/{id}/) - Admin only
- [ ] Employee statistics (GET /api/v1/employees/statistics/) - Admin only
- [ ] Role-based permissions enforcement

### Attendance System
- [ ] Get time logs (GET /api/v1/attendance/time-logs/)
- [ ] Current attendance status (GET /api/v1/attendance/time-logs/current_status/)
- [ ] Clock in (POST /api/v1/attendance/time-logs/clock_in/)
- [ ] Clock out (POST /api/v1/attendance/time-logs/clock_out/)
- [ ] Break management (start/end breaks)
- [ ] Location-based validation
- [ ] QR code validation
- [ ] Overtime calculations

### Scheduling System
- [ ] List shifts (GET /api/v1/scheduling/shifts/)
- [ ] Create shift (POST /api/v1/scheduling/shifts/) - Admin only
- [ ] Update shift (PUT /api/v1/scheduling/shifts/{id}/) - Admin only
- [ ] Delete shift (DELETE /api/v1/scheduling/shifts/{id}/) - Admin only
- [ ] Leave requests (GET /api/v1/scheduling/leave-requests/)
- [ ] Submit leave request (POST /api/v1/scheduling/leave-requests/)
- [ ] Approve/reject leave request - Admin only

### Notification System
- [ ] List notifications (GET /api/v1/notifications/)
- [ ] Mark notifications as read
- [ ] WebSocket connection establishment
- [ ] Real-time notification delivery
- [ ] Push notification subscriptions

### Location Management
- [ ] List locations (GET /api/v1/locations/)
- [ ] Create location (POST /api/v1/locations/) - Admin only
- [ ] Generate location QR codes
- [ ] QR code validation

### Reports System
- [ ] Attendance reports (GET /api/v1/reports/attendance/)
- [ ] Time tracking summaries
- [ ] Export functionality (Excel/CSV)
- [ ] Break compliance reports

## Phase 2: Frontend Component Testing

### Authentication Flow
- [ ] Login page renders correctly
- [ ] Login form validation
- [ ] Successful login redirects to dashboard
- [ ] Failed login shows error message
- [ ] Protected routes redirect to login when not authenticated
- [ ] Logout functionality works
- [ ] Token persistence across browser sessions

### Dashboard Components
- [ ] Admin dashboard loads with statistics
- [ ] Employee dashboard shows relevant information
- [ ] Real-time activity updates
- [ ] Quick action buttons functional
- [ ] Navigation menu works
- [ ] User profile information displayed

### Time Tracking Interface
- [ ] Clock in/out buttons work
- [ ] Current status displayed correctly
- [ ] QR code scanner opens and functions
- [ ] Break management UI works
- [ ] Time log history displays
- [ ] Filtering and pagination work

### Employee Management UI (Admin)
- [ ] Employee list loads and displays
- [ ] Search functionality works
- [ ] Employee creation form works
- [ ] Employee editing form works
- [ ] Role assignment interface
- [ ] Status management controls
- [ ] Bulk operations (if available)

### Scheduling Interface
- [ ] Schedule calendar view loads
- [ ] Shift creation/editing forms
- [ ] Leave request forms
- [ ] Schedule conflict warnings
- [ ] Recurring shift patterns

### Administrative Features
- [ ] Location management interface
- [ ] QR code generation and display
- [ ] Webhook configuration
- [ ] Notification settings
- [ ] Report generation interface
- [ ] Export functionality

### Mobile Responsiveness
- [ ] Login page on mobile devices
- [ ] Dashboard on mobile devices
- [ ] Navigation menu (hamburger menu)
- [ ] Clock in/out on mobile
- [ ] QR scanner on mobile devices
- [ ] Touch-friendly interface elements

## Phase 3: Integration Testing

### API-Frontend Integration
- [ ] Data flows correctly from backend to frontend
- [ ] Form submissions work properly
- [ ] Error messages display correctly
- [ ] Loading states show during API calls
- [ ] Pagination works with API responses
- [ ] Search and filtering integrate properly

### Real-time Features
- [ ] WebSocket connection establishes
- [ ] Real-time notifications appear
- [ ] Dashboard updates in real-time
- [ ] Connection recovery after network issues
- [ ] Multiple user sessions work correctly

### End-to-End Workflows
- [ ] Complete employee onboarding process
- [ ] Full clock in/out workflow with QR codes
- [ ] Leave request and approval workflow
- [ ] Shift scheduling and assignment
- [ ] Report generation and export
- [ ] Notification delivery and acknowledgment

## Phase 4: Performance and Security Testing

### Performance
- [ ] Page load times under 3 seconds
- [ ] API response times under 1 second
- [ ] Large dataset handling (1000+ employees)
- [ ] Concurrent user testing
- [ ] Mobile performance acceptable

### Security
- [ ] Authentication required for protected endpoints
- [ ] Role-based access control enforced
- [ ] Input validation prevents injection attacks
- [ ] Sensitive data not exposed in responses
- [ ] HTTPS enforced in production
- [ ] CORS properly configured

## Phase 5: Feature Completeness Analysis

### Missing Features
- [ ] Identify incomplete CRUD operations
- [ ] Find missing validation rules
- [ ] Locate broken business logic
- [ ] Discover incomplete error handling

### UI/UX Issues
- [ ] Inconsistent design elements
- [ ] Poor mobile experience
- [ ] Missing loading states
- [ ] Inadequate user feedback
- [ ] Accessibility issues

### Code Quality
- [ ] Missing error boundaries in React
- [ ] Incomplete API error handling
- [ ] Missing PropTypes or TypeScript
- [ ] Unused imports and code
- [ ] Performance bottlenecks

## Test Execution Commands

### Automated Testing (Recommended)
```bash
# Run all tests with automatic venv activation
cd testing_scripts
./activate_and_test.sh

# Individual test suites
./activate_and_test.sh --backend-only
./activate_and_test.sh --frontend-only
./activate_and_test.sh --analysis-only
./activate_and_test.sh --setup-only
```

### Manual Testing with Virtual Environment
```bash
# 1. Activate virtual environment
cd backend && source venv/bin/activate

# 2. Start backend (in activated venv)
python manage.py runserver &

# 3. Start frontend (in new terminal)
cd ../frontend && npm start &

# 4. Run tests (with venv activated)
cd ../testing_scripts
python run_comprehensive_tests.py

# Individual test suites (with venv activated)
python backend_api_tester.py --url http://localhost:8000
node frontend_component_tester.js http://localhost:3000
python feature_completeness_analyzer.py --project-root ..
```

### Manual Browser Testing
1. Ensure backend is running: `cd backend && source venv/bin/activate && python manage.py runserver`
2. Ensure frontend is running: `cd frontend && npm start`
3. Open browser to http://localhost:3000
4. Follow manual testing checklist below

## Success Criteria

### Backend API
- [ ] All endpoints respond with correct status codes
- [ ] Authentication and authorization work properly
- [ ] Data validation prevents invalid inputs
- [ ] Error responses are informative
- [ ] Performance meets requirements

### Frontend
- [ ] All pages render without errors
- [ ] User interactions work as expected
- [ ] Mobile interface is fully functional
- [ ] Real-time features work reliably
- [ ] Error handling provides clear feedback

### Integration
- [ ] Data flows correctly between systems
- [ ] Real-time features work across components
- [ ] End-to-end workflows complete successfully
- [ ] Performance is acceptable under load
- [ ] Security measures are effective

## Issue Reporting

### High Priority Issues
- Security vulnerabilities
- Data corruption risks
- Complete feature failures
- Authentication/authorization bypasses

### Medium Priority Issues
- UI/UX problems
- Performance issues
- Incomplete features
- Error handling gaps

### Low Priority Issues
- Cosmetic problems
- Minor usability issues
- Code quality improvements
- Documentation gaps
