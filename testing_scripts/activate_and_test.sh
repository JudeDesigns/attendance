#!/bin/bash

# WorkSync Testing Script with Virtual Environment
# This script activates the backend venv and runs comprehensive tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 WorkSync Testing with Virtual Environment${NC}"
echo "=================================================="

# Get the project root (parent of testing_scripts)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PATH="$PROJECT_ROOT/backend"
VENV_PATH="$BACKEND_PATH/venv"
TESTING_SCRIPTS_PATH="$PROJECT_ROOT/testing_scripts"

echo "Project Root: $PROJECT_ROOT"
echo "Backend Path: $BACKEND_PATH"
echo "Virtual Environment: $VENV_PATH"

# Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${RED}❌ Virtual environment not found at $VENV_PATH${NC}"
    echo "Please create the virtual environment first:"
    echo "  cd $BACKEND_PATH"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Check if activation script exists
if [ ! -f "$VENV_PATH/bin/activate" ]; then
    echo -e "${RED}❌ Virtual environment activation script not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Virtual environment found${NC}"

# Activate virtual environment
echo -e "${YELLOW}🔧 Activating virtual environment...${NC}"
source "$VENV_PATH/bin/activate"

# Verify activation
if [ "$VIRTUAL_ENV" != "$VENV_PATH" ]; then
    echo -e "${RED}❌ Failed to activate virtual environment${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Virtual environment activated: $VIRTUAL_ENV${NC}"

# Check if required packages are installed
echo -e "${YELLOW}🔍 Checking Python dependencies...${NC}"
python -c "import django, rest_framework" 2>/dev/null || {
    echo -e "${RED}❌ Required packages not found in virtual environment${NC}"
    echo "Installing requirements..."
    pip install -r "$BACKEND_PATH/requirements.txt"
}

echo -e "${GREEN}✅ Python dependencies available${NC}"

# Check if backend services are running
echo -e "${YELLOW}🔍 Checking backend service...${NC}"
if curl -s http://localhost:8000/api/v1/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend service is running${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Backend service not running${NC}"
    echo "To start backend: cd $BACKEND_PATH && python manage.py runserver"
    BACKEND_RUNNING=false
fi

# Check if frontend services are running
echo -e "${YELLOW}🔍 Checking frontend service...${NC}"
if curl -s http://localhost:3000/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend service is running${NC}"
    FRONTEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Frontend service not running${NC}"
    echo "To start frontend: cd $PROJECT_ROOT/frontend && npm start"
    FRONTEND_RUNNING=false
fi

# Change to testing scripts directory
cd "$TESTING_SCRIPTS_PATH"

# Parse command line arguments
SETUP_ONLY=false
BACKEND_ONLY=false
FRONTEND_ONLY=false
ANALYSIS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --analysis-only)
            ANALYSIS_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--setup-only|--backend-only|--frontend-only|--analysis-only]"
            exit 1
            ;;
    esac
done

# Run setup if requested or if it's the first time
if [ "$SETUP_ONLY" = true ] || [ ! -f "$PROJECT_ROOT/test_environment_ready" ]; then
    echo -e "${BLUE}📋 Setting up test environment...${NC}"
    python setup_test_environment.py --project-root "$PROJECT_ROOT"
    
    if [ $? -eq 0 ]; then
        touch "$PROJECT_ROOT/test_environment_ready"
        echo -e "${GREEN}✅ Test environment setup complete${NC}"
    else
        echo -e "${RED}❌ Test environment setup failed${NC}"
        exit 1
    fi
    
    if [ "$SETUP_ONLY" = true ]; then
        echo -e "${GREEN}🎉 Setup complete! You can now run tests.${NC}"
        exit 0
    fi
fi

# Run specific test suites based on arguments
if [ "$BACKEND_ONLY" = true ]; then
    if [ "$BACKEND_RUNNING" = true ]; then
        echo -e "${BLUE}🧪 Running backend tests only...${NC}"
        python backend_api_tester.py --url http://localhost:8000
    else
        echo -e "${RED}❌ Cannot run backend tests - backend service not running${NC}"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    if [ "$FRONTEND_RUNNING" = true ]; then
        echo -e "${BLUE}🧪 Running frontend tests only...${NC}"
        node frontend_component_tester.js http://localhost:3000
    else
        echo -e "${RED}❌ Cannot run frontend tests - frontend service not running${NC}"
        exit 1
    fi
elif [ "$ANALYSIS_ONLY" = true ]; then
    echo -e "${BLUE}🧪 Running feature analysis only...${NC}"
    python feature_completeness_analyzer.py --project-root "$PROJECT_ROOT"
else
    # Run comprehensive tests
    echo -e "${BLUE}🧪 Running comprehensive tests...${NC}"
    python run_comprehensive_tests.py \
        --project-root "$PROJECT_ROOT" \
        --backend-url http://localhost:8000 \
        --frontend-url http://localhost:3000
fi

echo -e "${GREEN}🎉 Testing complete!${NC}"
echo "Check the generated JSON files for detailed results."

# Deactivate virtual environment
deactivate
