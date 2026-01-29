#!/bin/bash

# Fix Nginx Admin Route Conflict
# This script updates the Nginx configuration on the server to fix the /admin route conflict

set -e

echo "🔧 Fixing Nginx /admin route conflict..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on the server
if [ ! -f "/etc/nginx/conf.d/worksync.conf" ]; then
    echo -e "${RED}Error: This script must be run on the server (attendance.brfood.us)${NC}"
    echo "Please run: ssh mac@attendance.brfood.us 'bash -s' < fix-nginx-admin-route.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Backing up current Nginx config...${NC}"
sudo cp /etc/nginx/conf.d/worksync.conf /etc/nginx/conf.d/worksync.conf.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

echo -e "${YELLOW}Step 2: Checking for /admin/ location block...${NC}"
if grep -q "location /admin/" /etc/nginx/conf.d/worksync.conf; then
    echo -e "${RED}Found conflicting 'location /admin/' block${NC}"
    echo "This needs to be removed or changed to /django-admin/"
    echo ""
    
    echo -e "${YELLOW}Step 3: Removing/updating the conflicting block...${NC}"
    
    # Use sed to replace 'location /admin/' with 'location /django-admin/'
    # and update the proxy_pass accordingly
    sudo sed -i.tmp \
        -e 's|location /admin/|location /django-admin/|g' \
        -e 's|proxy_pass http://worksync_backend;|proxy_pass http://worksync_backend/admin/;|g' \
        /etc/nginx/conf.d/worksync.conf
    
    echo -e "${GREEN}✓ Updated location block from /admin/ to /django-admin/${NC}"
else
    echo -e "${GREEN}✓ No conflicting /admin/ block found${NC}"
fi
echo ""

echo -e "${YELLOW}Step 4: Testing Nginx configuration...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    echo "Restoring backup..."
    sudo cp /etc/nginx/conf.d/worksync.conf.backup.* /etc/nginx/conf.d/worksync.conf
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 5: Reloading Nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Fix completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "What changed:"
echo "  • Django admin moved from /admin/ to /django-admin/"
echo "  • React app's /admin route now works correctly"
echo ""
echo "Next steps:"
echo "  1. Clear your browser cache (Cmd+Shift+R or Ctrl+Shift+R)"
echo "  2. Navigate to https://attendance.brfood.us/admin"
echo "  3. Refresh the page - it should stay on the React admin dashboard"
echo ""
echo "If you need Django admin panel, access it at:"
echo "  https://attendance.brfood.us/django-admin/"
echo ""

