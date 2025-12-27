#!/bin/bash

# Attendance Application Deployment Script
# This script helps deploy the Attendance application to your AlmaLinux server

set -e  # Exit on any error

# Configuration
SERVER_USER="your-username"
SERVER_HOST="your-server-ip"
SERVER_PATH="/var/www/attendance"
DOMAIN="attendance.brfood.us"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Attendance Application Deployment Script${NC}"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the WorkSync project root directory${NC}"
    exit 1
fi

# Step 1: Build frontend for production
echo -e "${YELLOW}📦 Building frontend for production...${NC}"
cd frontend
npm install
REACT_APP_API_URL=https://${DOMAIN}/api/v1 npm run build
cd ..

# Step 2: Prepare backend
echo -e "${YELLOW}🐍 Preparing backend...${NC}"
cd backend
# Create requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    echo "Creating requirements.txt..."
    pip freeze > requirements.txt
fi
cd ..

# Step 3: Create deployment package
echo -e "${YELLOW}📋 Creating deployment package...${NC}"
TEMP_DIR=$(mktemp -d)
PACKAGE_NAME="attendance-$(date +%Y%m%d-%H%M%S).tar.gz"

# Copy files to temp directory
cp -r backend frontend DEPLOYMENT_GUIDE.md "$TEMP_DIR/"
cp .gitignore "$TEMP_DIR/"

# Remove development files
rm -rf "$TEMP_DIR/backend/venv"
rm -rf "$TEMP_DIR/backend/__pycache__"
rm -rf "$TEMP_DIR/backend/db.sqlite3"
rm -rf "$TEMP_DIR/frontend/node_modules"
rm -rf "$TEMP_DIR/frontend/.git"

# Create package
cd "$TEMP_DIR"
tar -czf "$PACKAGE_NAME" .
mv "$PACKAGE_NAME" "$OLDPWD/"
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Deployment package created: ${PACKAGE_NAME}${NC}"

# Step 4: Upload to server (optional)
read -p "Do you want to upload to server now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📤 Uploading to server...${NC}"
    
    # Check if server details are configured
    if [ "$SERVER_USER" = "your-username" ] || [ "$SERVER_HOST" = "your-server-ip" ]; then
        echo -e "${RED}❌ Please configure SERVER_USER and SERVER_HOST in this script first${NC}"
        exit 1
    fi
    
    # Upload package
    scp "$PACKAGE_NAME" "$SERVER_USER@$SERVER_HOST:/tmp/"
    
    # Extract on server
    ssh "$SERVER_USER@$SERVER_HOST" "
        sudo mkdir -p $SERVER_PATH
        sudo tar -xzf /tmp/$PACKAGE_NAME -C $SERVER_PATH
        sudo chown -R www-data:www-data $SERVER_PATH
        rm /tmp/$PACKAGE_NAME
    "
    
    echo -e "${GREEN}✅ Files uploaded to server${NC}"
    echo -e "${YELLOW}📋 Next steps on server:${NC}"
    echo "1. SSH to your server: ssh $SERVER_USER@$SERVER_HOST"
    echo "2. Follow the DEPLOYMENT_GUIDE.md in $SERVER_PATH"
    echo "3. Configure environment variables"
    echo "4. Set up systemd services"
    echo "5. Configure Nginx"
else
    echo -e "${YELLOW}📋 Manual deployment:${NC}"
    echo "1. Upload $PACKAGE_NAME to your server"
    echo "2. Extract to $SERVER_PATH"
    echo "3. Follow the DEPLOYMENT_GUIDE.md"
fi

# Step 5: Cleanup
read -p "Remove deployment package? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    rm "$PACKAGE_NAME"
    echo -e "${GREEN}✅ Cleanup completed${NC}"
fi

echo -e "${GREEN}🎉 Deployment preparation completed!${NC}"
echo ""
echo -e "${YELLOW}📋 Important reminders:${NC}"
echo "• Update .env.production with your actual values"
echo "• Configure SSL certificates"
echo "• Create Django superuser after deployment"
echo "• Test the application thoroughly"
echo "• Set up monitoring and backups"
echo ""
echo -e "${GREEN}🌐 Your app will be available at: https://${DOMAIN}${NC}"
