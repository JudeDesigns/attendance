# WorkSync Testing Scripts

This directory contains comprehensive testing tools for the WorkSync workforce management system.

## Overview

The testing framework provides automated and manual testing capabilities for:
- **Backend API Testing** - Django REST API endpoints
- **Frontend Component Testing** - React components and user interactions  
- **Feature Completeness Analysis** - Code analysis for missing functionality
- **Integration Testing** - End-to-end workflow validation

## Quick Start

### Option 1: Automated Script (Recommended)
```bash
# Run the automated testing script (handles venv activation)
./activate_and_test.sh

# Or run specific test suites
./activate_and_test.sh --backend-only
./activate_and_test.sh --frontend-only
./activate_and_test.sh --analysis-only
./activate_and_test.sh --setup-only
```

### Option 2: Manual Setup
```bash
# 1. Activate the backend virtual environment
cd ../backend
source venv/bin/activate

# 2. Setup test environment
cd ../testing_scripts
python setup_test_environment.py

# 3. Start backend server (in activated venv)
cd ../backend
python manage.py runserver &

# 4. Start frontend server (in new terminal)
cd ../frontend && npm start &

# 5. Run comprehensive tests (with venv activated)
cd ../testing_scripts
python run_comprehensive_tests.py
```

## Testing Scripts

### `setup_test_environment.py`
Prepares the testing environment by:
- Checking dependencies
- Setting up database with test data
- Creating test user accounts
- Installing testing dependencies

**Test Accounts Created:**
- Admin: `admin` / `admin123`
- Employee: `testuser1` / `testpass123`
- Driver: `testdriver1` / `testpass123`
- Manager: `testmanager1` / `testpass123`

### `backend_api_tester.py`
Automated testing of Django REST API endpoints:
- Authentication system
- Employee management
- Attendance tracking
- Scheduling system
- Notification system
- Location management

**Usage:**
```bash
python3 backend_api_tester.py --url http://localhost:8000
```

**Output:** `api_test_results.json`

### `frontend_component_tester.js`
Automated browser testing of React components:
- Login page functionality
- Dashboard components
- Mobile responsiveness
- User interactions
- Error handling

**Requirements:** Node.js, puppeteer
**Usage:**
```bash
node frontend_component_tester.js http://localhost:3000
```

**Output:** `frontend_test_results.json` + screenshots in `screenshots/`

### `feature_completeness_analyzer.py`
Static code analysis to identify:
- Incomplete models and views
- Missing error handling
- Security issues
- Code quality problems

**Usage:**
```bash
python3 feature_completeness_analyzer.py --project-root ..
```

**Output:** `feature_completeness_analysis.json`

### `break_button_tester.py` 🔘 **NEW - CRITICAL ISSUE TESTER**
Specifically tests the break button functionality issues you reported:
- Tests why break button is always greyed out
- Validates break requirements API response structure
- Checks break compliance logic timing
- Identifies critical break functionality problems
- Tests break button enable/disable conditions

**Usage:**
```bash
python3 break_button_tester.py
```

**Output:** `break_button_test_results.json`

**🚨 This addresses the specific issue where break buttons don't display properly!**

### `run_comprehensive_tests.py`
Orchestrates all testing phases and generates consolidated reports:
- Checks service availability
- Runs all test suites
- Generates comprehensive report
- Provides actionable recommendations

**Usage:**
```bash
python3 run_comprehensive_tests.py \
  --backend-url http://localhost:8000 \
  --frontend-url http://localhost:3000
```

**Output:** `comprehensive_test_report_YYYYMMDD_HHMMSS.json`

## Test Results

### Backend API Results
- **Passed Tests**: Endpoints working correctly
- **Failed Tests**: Issues requiring attention
- **Error Tests**: Critical failures
- **Response Times**: Performance metrics

### Frontend Component Results
- **Component Rendering**: UI elements display correctly
- **User Interactions**: Buttons, forms, navigation work
- **Responsive Design**: Mobile compatibility
- **Error Handling**: Graceful error management

### Feature Analysis Results
- **Missing Features**: Incomplete functionality
- **Code Issues**: Quality and security problems
- **Recommendations**: Prioritized improvement suggestions

## Manual Testing

Use `../TESTING_CHECKLIST.md` for comprehensive manual testing:
- Step-by-step testing procedures
- Success criteria for each feature
- Issue reporting guidelines

## Common Issues & Solutions

### Virtual Environment Issues
```bash
# If venv doesn't exist, create it
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Backend Not Starting
```bash
cd ../backend
source venv/bin/activate  # Important!
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Not Starting
```bash
cd ../frontend
npm install
npm start
```

### Database Issues
```bash
cd ../backend
source venv/bin/activate  # Important!
python manage.py migrate
cd ../testing_scripts
python setup_test_environment.py
```

### Testing Dependencies Missing
```bash
# Activate venv first
cd ../backend && source venv/bin/activate

# Python dependencies (in venv)
pip install requests beautifulsoup4

# Node.js dependencies
cd ../testing_scripts
npm install
```

### Permission Issues
```bash
# Make the script executable
chmod +x activate_and_test.sh
```

## Test Data

The setup script creates:
- **4 test user accounts** with different roles
- **2 test locations** with QR codes
- **Sample roles** (Admin, Employee, Driver)
- **Basic configuration** for testing

## Continuous Integration

For CI/CD integration:
```bash
# Headless testing
export PUPPETEER_ARGS="--headless --no-sandbox"
python3 run_comprehensive_tests.py
```

## Contributing

When adding new features:
1. Update relevant test scripts
2. Add test cases to checklist
3. Update expected results
4. Document new test procedures

## Support

For issues with testing:
1. Check service availability (backend/frontend running)
2. Verify test data exists
3. Check console output for specific errors
4. Review generated test reports for details
