#!/bin/bash

# WorkSync Deployment Script for AlmaLinux VPS
# This script automates the deployment process for WorkSync on AlmaLinux

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKSYNC_USER="worksync"
WORKSYNC_HOME="/opt/worksync"
APP_DIR="$WORKSYNC_HOME/app"
VENV_DIR="$WORKSYNC_HOME/venv"
BACKEND_PORT="8002"
DOMAIN=""
SUBDOMAIN=""

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

get_user_input() {
    echo -e "${BLUE}WorkSync Deployment Configuration${NC}"
    echo "=================================="
    
    read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
    read -p "Enter subdomain for WorkSync (e.g., worksync): " SUBDOMAIN
    
    if [[ -z "$DOMAIN" ]]; then
        log_error "Domain name is required"
        exit 1
    fi
    
    if [[ -z "$SUBDOMAIN" ]]; then
        SUBDOMAIN="worksync"
    fi
    
    FULL_DOMAIN="$SUBDOMAIN.$DOMAIN"
    
    echo
    log_info "Configuration:"
    log_info "Domain: $DOMAIN"
    log_info "Full WorkSync URL: https://$FULL_DOMAIN"
    log_info "Backend Port: $BACKEND_PORT"
    echo
    
    read -p "Continue with this configuration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
}

check_port_availability() {
    log_info "Checking port availability..."
    
    if netstat -tlnp | grep -q ":$BACKEND_PORT "; then
        log_error "Port $BACKEND_PORT is already in use!"
        log_info "Please choose a different port or stop the service using this port"
        exit 1
    fi
    
    log_success "Port $BACKEND_PORT is available"
}

install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update system
    dnf update -y
    
    # Install required packages
    dnf install -y python3 python3-pip python3-devel python3-venv \
        nodejs npm git wget curl unzip sqlite \
        gcc gcc-c++ make openssl-devel libffi-devel \
        redis supervisor certbot python3-certbot-nginx
    
    # Install Node.js 18+ if needed
    if ! node --version | grep -q "v1[8-9]\|v[2-9][0-9]"; then
        log_info "Installing Node.js 18..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        dnf install -y nodejs
    fi
    
    # Start and enable Redis
    systemctl enable redis --now
    
    log_success "Dependencies installed"
}

create_user_and_directories() {
    log_info "Creating WorkSync user and directories..."
    
    # Create user if doesn't exist
    if ! id "$WORKSYNC_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$WORKSYNC_HOME" --create-home "$WORKSYNC_USER"
        log_success "Created user: $WORKSYNC_USER"
    else
        log_info "User $WORKSYNC_USER already exists"
    fi
    
    # Create directories
    mkdir -p "$WORKSYNC_HOME"/{logs,backups,media}
    mkdir -p /var/log/worksync
    mkdir -p /var/run/worksync
    
    # Set permissions
    chown -R "$WORKSYNC_USER:$WORKSYNC_USER" "$WORKSYNC_HOME" /var/log/worksync /var/run/worksync
    
    log_success "Directories created and configured"
}

clone_repository() {
    log_info "Cloning WorkSync repository..."
    
    if [[ -d "$APP_DIR" ]]; then
        log_warning "Application directory already exists. Updating..."
        sudo -u "$WORKSYNC_USER" bash -c "cd $APP_DIR && git pull origin main"
    else
        # Replace with your actual repository URL
        sudo -u "$WORKSYNC_USER" git clone https://github.com/yourusername/WorkSync.git "$APP_DIR"
    fi
    
    log_success "Repository cloned/updated"
}

setup_python_environment() {
    log_info "Setting up Python virtual environment..."
    
    # Create virtual environment
    sudo -u "$WORKSYNC_USER" python3 -m venv "$VENV_DIR"
    
    # Install Python dependencies
    sudo -u "$WORKSYNC_USER" bash -c "
        source $VENV_DIR/bin/activate
        pip install --upgrade pip
        pip install -r $APP_DIR/backend/requirements-production.txt
    "
    
    log_success "Python environment configured"
}

configure_environment() {
    log_info "Configuring environment variables..."
    
    # Generate secret key
    SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
    
    # Create environment file
    sudo -u "$WORKSYNC_USER" tee "$APP_DIR/backend/.env.production" > /dev/null << EOF
# Django Settings
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$DOMAIN,$FULL_DOMAIN,$(hostname -I | awk '{print $1}')

# Database (SQLite)
DATABASE_URL=sqlite:///$APP_DIR/backend/db.sqlite3

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379/3

# CORS Settings
CORS_ALLOWED_ORIGINS=https://$DOMAIN,https://$FULL_DOMAIN

# Security Settings
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# File Upload Limits
FILE_UPLOAD_MAX_MEMORY_SIZE=5242880
DATA_UPLOAD_MAX_MEMORY_SIZE=5242880
EOF
    
    # Secure the file
    chmod 600 "$APP_DIR/backend/.env.production"
    
    log_success "Environment configured"
}

setup_database() {
    log_info "Setting up database..."
    
    sudo -u "$WORKSYNC_USER" bash -c "
        cd $APP_DIR/backend
        source $VENV_DIR/bin/activate
        export DJANGO_SETTINGS_MODULE=worksync.settings_production
        python manage.py migrate
        python manage.py collectstatic --noinput
    "
    
    log_success "Database configured"
}

create_admin_user() {
    log_info "Creating admin user..."
    
    echo "Please create an admin user for WorkSync:"
    sudo -u "$WORKSYNC_USER" bash -c "
        cd $APP_DIR/backend
        source $VENV_DIR/bin/activate
        export DJANGO_SETTINGS_MODULE=worksync.settings_production
        python manage.py createsuperuser
    "
    
    log_success "Admin user created"
}

build_frontend() {
    log_info "Building frontend application..."
    
    sudo -u "$WORKSYNC_USER" bash -c "
        cd $APP_DIR/frontend
        npm ci --production
        REACT_APP_API_URL=https://$FULL_DOMAIN/api/v1 npm run build
    "
    
    # Copy built files for Nginx
    mkdir -p /var/www/worksync
    cp -r "$APP_DIR/frontend/build"/* /var/www/worksync/
    chown -R nginx:nginx /var/www/worksync
    
    log_success "Frontend built and deployed"
}

create_gunicorn_config() {
    log_info "Creating Gunicorn configuration..."
    
    sudo -u "$WORKSYNC_USER" tee "$APP_DIR/backend/gunicorn.conf.py" > /dev/null << EOF
import multiprocessing

# Server socket
bind = "127.0.0.1:$BACKEND_PORT"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Restart workers after this many requests
max_requests = 1000
max_requests_jitter = 100

# Logging
accesslog = "/var/log/worksync/gunicorn-access.log"
errorlog = "/var/log/worksync/gunicorn-error.log"
loglevel = "info"

# Process naming
proc_name = "worksync-gunicorn"

# Server mechanics
preload_app = True
daemon = False
pidfile = "/var/run/worksync/gunicorn.pid"
user = "$WORKSYNC_USER"
group = "$WORKSYNC_USER"

# SSL
forwarded_allow_ips = "*"
secure_scheme_headers = {
    'X-FORWARDED-PROTOCOL': 'ssl',
    'X-FORWARDED-PROTO': 'https',
    'X-FORWARDED-SSL': 'on'
}
EOF
    
    log_success "Gunicorn configuration created"
}

# Main execution
main() {
    log_info "Starting WorkSync deployment on AlmaLinux..."
    
    check_root
    get_user_input
    check_port_availability
    install_dependencies
    create_user_and_directories
    clone_repository
    setup_python_environment
    configure_environment
    setup_database
    create_admin_user
    build_frontend
    create_gunicorn_config
    
    log_success "WorkSync deployment completed!"
    log_info "Next steps:"
    log_info "1. Run: sudo systemctl start worksync-django"
    log_info "2. Configure Nginx (see ALMALINUX_VPS_DEPLOYMENT.md)"
    log_info "3. Set up SSL certificate with certbot"
    log_info "4. Access your application at: https://$FULL_DOMAIN"
}

# Run main function
main "$@"
