#!/bin/bash

# Script to create systemd service files for WorkSync on AlmaLinux
# Run this script as root after deploying the application

set -e

# Configuration
WORKSYNC_USER="worksync"
WORKSYNC_HOME="/opt/worksync"
APP_DIR="$WORKSYNC_HOME/app"
VENV_DIR="$WORKSYNC_HOME/venv"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Create Django/Gunicorn service
create_django_service() {
    log_info "Creating WorkSync Django service..."
    
    cat > /etc/systemd/system/worksync-django.service << EOF
[Unit]
Description=WorkSync Django Application Server
Documentation=https://github.com/yourusername/WorkSync
After=network.target redis.service
Wants=redis.service
Requires=redis.service

[Service]
Type=notify
User=$WORKSYNC_USER
Group=$WORKSYNC_USER
RuntimeDirectory=worksync
RuntimeDirectoryMode=755
WorkingDirectory=$APP_DIR/backend
Environment=DJANGO_SETTINGS_MODULE=worksync.settings_production
Environment=PYTHONPATH=$APP_DIR/backend
Environment=PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin

ExecStart=$VENV_DIR/bin/gunicorn worksync.wsgi:application -c gunicorn.conf.py
ExecReload=/bin/kill -s HUP \$MAINPID

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$WORKSYNC_HOME /var/log/worksync /var/run/worksync

# Process management
KillMode=mixed
TimeoutStopSec=30
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Django service created"
}

# Create Celery Worker service
create_celery_worker_service() {
    log_info "Creating WorkSync Celery Worker service..."
    
    cat > /etc/systemd/system/worksync-celery-worker.service << EOF
[Unit]
Description=WorkSync Celery Worker
Documentation=https://github.com/yourusername/WorkSync
After=network.target redis.service
Wants=redis.service
Requires=redis.service

[Service]
Type=forking
User=$WORKSYNC_USER
Group=$WORKSYNC_USER
RuntimeDirectory=worksync
RuntimeDirectoryMode=755
WorkingDirectory=$APP_DIR/backend
Environment=DJANGO_SETTINGS_MODULE=worksync.settings_production
Environment=PYTHONPATH=$APP_DIR/backend
Environment=PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin

ExecStart=$VENV_DIR/bin/celery -A worksync worker \\
    --loglevel=info \\
    --pidfile=/var/run/worksync/celery-worker.pid \\
    --logfile=/var/log/worksync/celery-worker.log \\
    --detach

ExecStop=/bin/kill -TERM \$MAINPID
ExecReload=/bin/kill -HUP \$MAINPID

PIDFile=/var/run/worksync/celery-worker.pid

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$WORKSYNC_HOME /var/log/worksync /var/run/worksync

# Process management
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Celery Worker service created"
}

# Create Celery Beat service
create_celery_beat_service() {
    log_info "Creating WorkSync Celery Beat service..."
    
    cat > /etc/systemd/system/worksync-celery-beat.service << EOF
[Unit]
Description=WorkSync Celery Beat Scheduler
Documentation=https://github.com/yourusername/WorkSync
After=network.target redis.service worksync-django.service
Wants=redis.service worksync-django.service
Requires=redis.service

[Service]
Type=forking
User=$WORKSYNC_USER
Group=$WORKSYNC_USER
RuntimeDirectory=worksync
RuntimeDirectoryMode=755
WorkingDirectory=$APP_DIR/backend
Environment=DJANGO_SETTINGS_MODULE=worksync.settings_production
Environment=PYTHONPATH=$APP_DIR/backend
Environment=PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin

ExecStart=$VENV_DIR/bin/celery -A worksync beat \\
    --loglevel=info \\
    --pidfile=/var/run/worksync/celery-beat.pid \\
    --logfile=/var/log/worksync/celery-beat.log \\
    --detach

ExecStop=/bin/kill -TERM \$MAINPID

PIDFile=/var/run/worksync/celery-beat.pid

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$WORKSYNC_HOME /var/log/worksync /var/run/worksync

# Process management
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Celery Beat service created"
}

# Create log rotation configuration
create_logrotate_config() {
    log_info "Creating log rotation configuration..."
    
    cat > /etc/logrotate.d/worksync << EOF
/var/log/worksync/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $WORKSYNC_USER $WORKSYNC_USER
    sharedscripts
    postrotate
        systemctl reload worksync-django worksync-celery-worker worksync-celery-beat
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Create backup script
create_backup_script() {
    log_info "Creating backup script..."
    
    cat > $WORKSYNC_HOME/backup.sh << 'EOF'
#!/bin/bash

# WorkSync Backup Script
BACKUP_DIR="/opt/worksync/backups"
APP_DIR="/opt/worksync/app"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
if [ -f "$APP_DIR/backend/db.sqlite3" ]; then
    cp "$APP_DIR/backend/db.sqlite3" "$BACKUP_DIR/db_$DATE.sqlite3"
    echo "Database backup created: db_$DATE.sqlite3"
fi

# Backup media files
if [ -d "$APP_DIR/backend/media" ]; then
    tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" -C "$APP_DIR/backend" media/
    echo "Media backup created: media_$DATE.tar.gz"
fi

# Backup configuration files
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" -C "$APP_DIR/backend" .env.production

# Clean old backups
find "$BACKUP_DIR" -name "*.sqlite3" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR"
echo "Old backups cleaned (older than $RETENTION_DAYS days)"
EOF
    
    chmod +x $WORKSYNC_HOME/backup.sh
    chown $WORKSYNC_USER:$WORKSYNC_USER $WORKSYNC_HOME/backup.sh
    
    log_success "Backup script created"
}

# Setup cron job for backups
setup_backup_cron() {
    log_info "Setting up backup cron job..."
    
    # Add backup job to worksync user's crontab (daily at 2 AM)
    (crontab -u $WORKSYNC_USER -l 2>/dev/null; echo "0 2 * * * $WORKSYNC_HOME/backup.sh >> /var/log/worksync/backup.log 2>&1") | crontab -u $WORKSYNC_USER -
    
    log_success "Backup cron job configured"
}

# Main function
main() {
    log_info "Creating systemd services for WorkSync..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        echo "This script must be run as root"
        exit 1
    fi
    
    # Create services
    create_django_service
    create_celery_worker_service
    create_celery_beat_service
    create_logrotate_config
    create_backup_script
    setup_backup_cron
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable services
    systemctl enable worksync-django worksync-celery-worker worksync-celery-beat
    
    log_success "All services created and enabled!"
    log_info "To start services, run:"
    log_info "  sudo systemctl start worksync-django"
    log_info "  sudo systemctl start worksync-celery-worker"
    log_info "  sudo systemctl start worksync-celery-beat"
    log_info ""
    log_info "To check status, run:"
    log_info "  sudo systemctl status worksync-django"
    log_info "  sudo systemctl status worksync-celery-worker"
    log_info "  sudo systemctl status worksync-celery-beat"
}

# Run main function
main "$@"
