#!/bin/bash

# WorkSync Production Deployment Script
# This script automates the deployment of WorkSync to a production server

set -e  # Exit on any error

# Configuration
APP_NAME="worksync"
APP_USER="worksync"
APP_DIR="/opt/worksync"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
LOG_DIR="/var/log/worksync"
RUN_DIR="/var/run/worksync"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if required commands exist
    local required_commands=("python3" "pip3" "node" "npm" "nginx" "systemctl" "git")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check Python version
    local python_version=$(python3 --version | cut -d' ' -f2)
    local major_version=$(echo $python_version | cut -d'.' -f1)
    local minor_version=$(echo $python_version | cut -d'.' -f2)
    
    if [[ $major_version -lt 3 ]] || [[ $major_version -eq 3 && $minor_version -lt 8 ]]; then
        error "Python 3.8 or higher is required. Found: $python_version"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local node_major=$(echo $node_version | cut -d'.' -f1)
    
    if [[ $node_major -lt 16 ]]; then
        error "Node.js 16 or higher is required. Found: $node_version"
        exit 1
    fi
    
    log "System requirements check passed"
}

# Create application user and directories
setup_user_and_directories() {
    log "Setting up user and directories..."
    
    # Create application user if it doesn't exist
    if ! id "$APP_USER" &>/dev/null; then
        sudo useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER"
        log "Created user: $APP_USER"
    fi
    
    # Create directories
    sudo mkdir -p "$APP_DIR" "$LOG_DIR" "$RUN_DIR"
    sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$LOG_DIR" "$RUN_DIR"
    sudo chmod 755 "$APP_DIR"
    sudo chmod 750 "$LOG_DIR" "$RUN_DIR"
    
    log "User and directories setup completed"
}

# Install system dependencies
install_system_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install required packages
    sudo apt install -y \
        python3-pip \
        python3-venv \
        python3-dev \
        build-essential \
        nginx \
        redis-server \
        supervisor \
        certbot \
        python3-certbot-nginx \
        git \
        curl \
        wget \
        unzip \
        sqlite3
    
    # Install Node.js (if not already installed)
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    log "System dependencies installed"
}

# Deploy backend
deploy_backend() {
    log "Deploying backend..."

    # Switch to app user
    sudo -u "$APP_USER" bash << EOF
        cd "$BACKEND_DIR"

        # Create virtual environment if it doesn't exist
        if [ ! -d "$VENV_DIR" ]; then
            python3 -m venv "$VENV_DIR"
        fi

        # Activate virtual environment
        source "$VENV_DIR/bin/activate"

        # Upgrade pip
        pip install --upgrade pip

        # Install Python dependencies (SQLite optimized)
        pip install -r requirements-production.txt
        pip install gunicorn

        # Check if .env.production exists
        if [ ! -f ".env.production" ]; then
            echo "WARNING: .env.production not found. Please create it from .env.production.template"
            exit 1
        fi

        # Ensure SQLite database directory exists and has proper permissions
        mkdir -p "\$(dirname "\$(python -c "from decouple import config; print(config('DATABASE_URL', 'sqlite:///\$PWD/db.sqlite3').split(':///')[-1])")")"

        # Run Django management commands
        export DJANGO_SETTINGS_MODULE=worksync.settings_production
        python manage.py collectstatic --noinput
        python manage.py migrate

        # Set proper permissions for SQLite database
        chmod 664 db.sqlite3 2>/dev/null || true

        # Create superuser if it doesn't exist
        python manage.py shell << PYTHON
import os
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
PYTHON
EOF

    log "Backend deployment completed"
}

# Deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    
    sudo -u "$APP_USER" bash << EOF
        cd "$FRONTEND_DIR"
        
        # Install Node.js dependencies
        npm ci --production
        
        # Build React application
        npm run build
EOF
    
    log "Frontend deployment completed"
}

# Setup systemd services
setup_systemd_services() {
    log "Setting up systemd services..."
    
    # Copy service files
    sudo cp "$BACKEND_DIR/deployment/systemd/"*.service /etc/systemd/system/
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable and start services
    local services=("worksync-django" "worksync-celery-worker" "worksync-celery-beat")
    for service in "${services[@]}"; do
        sudo systemctl enable "$service"
        sudo systemctl restart "$service"
        
        # Check if service is running
        if sudo systemctl is-active --quiet "$service"; then
            log "Service $service is running"
        else
            error "Service $service failed to start"
            sudo systemctl status "$service"
            exit 1
        fi
    done
    
    log "Systemd services setup completed"
}

# Setup Nginx
setup_nginx() {
    log "Setting up Nginx..."
    
    # Copy Nginx configuration
    sudo cp "$BACKEND_DIR/deployment/nginx/worksync.conf" /etc/nginx/sites-available/worksync
    
    # Create symlink if it doesn't exist
    if [ ! -L /etc/nginx/sites-enabled/worksync ]; then
        sudo ln -s /etc/nginx/sites-available/worksync /etc/nginx/sites-enabled/
    fi
    
    # Remove default site if it exists
    if [ -L /etc/nginx/sites-enabled/default ]; then
        sudo rm /etc/nginx/sites-enabled/default
    fi
    
    # Test Nginx configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        log "Nginx configuration updated and reloaded"
    else
        error "Nginx configuration test failed"
        exit 1
    fi
    
    log "Nginx setup completed"
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate..."
    
    # This is a placeholder - you'll need to customize based on your domain
    warning "SSL setup requires manual configuration"
    info "Run: sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
    
    log "SSL setup information provided"
}

# Main deployment function
main() {
    log "Starting WorkSync production deployment..."
    
    check_root
    check_requirements
    setup_user_and_directories
    install_system_dependencies
    deploy_backend
    deploy_frontend
    setup_systemd_services
    setup_nginx
    setup_ssl
    
    log "WorkSync deployment completed successfully!"
    info "Please update your .env.production file with your specific configuration"
    info "Don't forget to setup SSL certificates with: sudo certbot --nginx -d yourdomain.com"
    info "Monitor services with: sudo systemctl status worksync-django worksync-celery-worker worksync-celery-beat"
}

# Run main function
main "$@"
