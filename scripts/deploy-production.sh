#!/bin/bash

# WorkSync Production Deployment Script
echo "🚀 Deploying WorkSync to Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Configuration
DEPLOY_USER=${DEPLOY_USER:-"worksync"}
DEPLOY_PATH=${DEPLOY_PATH:-"/opt/worksync"}
DOMAIN=${DOMAIN:-"localhost"}
SSL_EMAIL=${SSL_EMAIL:-"admin@example.com"}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root for security reasons."
        print_info "Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Install system dependencies
install_system_deps() {
    print_info "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install required packages
    sudo apt install -y \
        python3 \
        python3-pip \
        python3-venv \
        postgresql \
        postgresql-contrib \
        redis-server \
        nginx \
        supervisor \
        certbot \
        python3-certbot-nginx \
        git \
        curl
    
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    
    print_status "System dependencies installed"
}

# Setup PostgreSQL
setup_database() {
    print_info "Setting up PostgreSQL database..."
    
    # Create database user and database
    sudo -u postgres psql << EOF
CREATE USER worksync WITH PASSWORD 'secure_password_change_me';
CREATE DATABASE worksync OWNER worksync;
GRANT ALL PRIVILEGES ON DATABASE worksync TO worksync;
ALTER USER worksync CREATEDB;
\q
EOF
    
    print_status "PostgreSQL database configured"
    print_warning "Please change the default database password in production!"
}

# Setup application
setup_application() {
    print_info "Setting up WorkSync application..."
    
    # Create deployment directory
    sudo mkdir -p $DEPLOY_PATH
    sudo chown $USER:$USER $DEPLOY_PATH
    
    # Clone or copy application
    if [ -d ".git" ]; then
        print_info "Copying application files..."
        cp -r . $DEPLOY_PATH/
    else
        print_info "Application files should be copied to $DEPLOY_PATH"
    fi
    
    cd $DEPLOY_PATH
    
    # Setup backend
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn
    
    # Create production environment file
    cat > .env << EOF
DEBUG=False
SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
DATABASE_URL=postgresql://worksync:secure_password_change_me@localhost:5432/worksync
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=$DOMAIN,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://$DOMAIN,http://localhost:3000
CSRF_TRUSTED_ORIGINS=https://$DOMAIN
BR_DRIVER_APP_API_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
EOF
    
    # Create logs directory
    mkdir -p logs
    
    # Run migrations and setup
    python manage.py collectstatic --noinput
    python setup_database.py
    
    cd ..
    
    # Setup frontend
    cd frontend
    npm install
    npm run build
    
    cd ..
    
    print_status "Application setup completed"
}

# Setup Nginx
setup_nginx() {
    print_info "Configuring Nginx..."
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/worksync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend (React)
    location / {
        root $DEPLOY_PATH/frontend/build;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Increase timeout for long-running requests
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files
    location /static/ {
        alias $DEPLOY_PATH/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Media files
    location /media/ {
        alias $DEPLOY_PATH/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/worksync /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    sudo nginx -t
    sudo systemctl reload nginx
    
    print_status "Nginx configured"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    if [ "$DOMAIN" != "localhost" ]; then
        print_info "Setting up SSL certificate..."
        
        sudo certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive
        
        print_status "SSL certificate configured"
    else
        print_warning "Skipping SSL setup for localhost"
    fi
}

# Setup Supervisor
setup_supervisor() {
    print_info "Setting up Supervisor for process management..."
    
    # Gunicorn configuration
    sudo tee /etc/supervisor/conf.d/worksync-gunicorn.conf << EOF
[program:worksync-gunicorn]
command=$DEPLOY_PATH/backend/venv/bin/gunicorn worksync.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 300
directory=$DEPLOY_PATH/backend
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$DEPLOY_PATH/backend/logs/gunicorn.log
environment=PATH="$DEPLOY_PATH/backend/venv/bin"
EOF
    
    # Celery worker configuration
    sudo tee /etc/supervisor/conf.d/worksync-celery.conf << EOF
[program:worksync-celery]
command=$DEPLOY_PATH/backend/venv/bin/celery -A worksync worker -l info
directory=$DEPLOY_PATH/backend
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$DEPLOY_PATH/backend/logs/celery.log
environment=PATH="$DEPLOY_PATH/backend/venv/bin"
EOF
    
    # Celery beat configuration
    sudo tee /etc/supervisor/conf.d/worksync-celery-beat.conf << EOF
[program:worksync-celery-beat]
command=$DEPLOY_PATH/backend/venv/bin/celery -A worksync beat -l info
directory=$DEPLOY_PATH/backend
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$DEPLOY_PATH/backend/logs/celery-beat.log
environment=PATH="$DEPLOY_PATH/backend/venv/bin"
EOF
    
    # Reload supervisor
    sudo supervisorctl reread
    sudo supervisorctl update
    sudo supervisorctl start all
    
    print_status "Supervisor configured and services started"
}

# Setup firewall
setup_firewall() {
    print_info "Configuring firewall..."
    
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    
    print_status "Firewall configured"
}

# Main deployment function
main() {
    echo "🚀 WorkSync Production Deployment"
    echo "================================="
    echo
    
    print_info "Deployment configuration:"
    echo "  Domain: $DOMAIN"
    echo "  Deploy path: $DEPLOY_PATH"
    echo "  SSL email: $SSL_EMAIL"
    echo
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    
    check_root
    install_system_deps
    setup_database
    setup_application
    setup_nginx
    setup_ssl
    setup_supervisor
    setup_firewall
    
    echo
    echo "================================="
    print_status "WorkSync deployed successfully!"
    echo
    print_info "Access your application:"
    echo "  • Frontend: https://$DOMAIN"
    echo "  • Admin Panel: https://$DOMAIN/admin/"
    echo "  • API Documentation: https://$DOMAIN/api/docs/"
    echo
    print_info "Default admin credentials:"
    echo "  Username: admin"
    echo "  Password: WorkSync2024!"
    echo
    print_warning "Important security steps:"
    echo "1. Change the database password in $DEPLOY_PATH/backend/.env"
    echo "2. Update the admin password"
    echo "3. Configure Twilio credentials for SMS notifications"
    echo "4. Review and update all environment variables"
    echo "5. Set up regular backups"
    echo
    print_info "Service management:"
    echo "  • Check status: sudo supervisorctl status"
    echo "  • Restart services: sudo supervisorctl restart all"
    echo "  • View logs: tail -f $DEPLOY_PATH/backend/logs/*.log"
}

# Run main function
main "$@"
