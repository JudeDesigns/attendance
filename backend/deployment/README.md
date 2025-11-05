# WorkSync Production Deployment Guide

This guide covers deploying WorkSync to a production server with proper security, monitoring, and performance optimizations.

## 🚀 Quick Start

1. **Clone the repository** on your production server
2. **Copy and configure** `.env.production` from the template
3. **Run the deployment script**: `./deployment/deploy.sh`
4. **Configure SSL certificates** with Let's Encrypt
5. **Monitor services** and logs

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or newer (recommended)
- **RAM**: Minimum 2GB, recommended 4GB+
- **Storage**: Minimum 10GB free space
- **Network**: Public IP address and domain name

### Required Software
- Python 3.8+
- Node.js 16+
- SQLite 3+ (included with Python, perfect for WorkSync)
- Redis 6+
- Nginx
- Certbot (for SSL certificates)
- PostgreSQL 12+ (optional, only if you need advanced features)

## 🔧 Manual Deployment Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv python3-dev build-essential \
    nginx redis-server supervisor certbot python3-certbot-nginx \
    git curl wget unzip sqlite3

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Create Application User

```bash
# Create worksync user
sudo useradd --system --shell /bin/bash --home-dir /opt/worksync --create-home worksync

# Create required directories
sudo mkdir -p /var/log/worksync /var/run/worksync
sudo chown -R worksync:worksync /opt/worksync /var/log/worksync /var/run/worksync
```

### 3. Deploy Application Code

```bash
# Clone repository
sudo -u worksync git clone https://github.com/yourusername/WorkSync.git /opt/worksync
cd /opt/worksync

# Set up Python virtual environment
sudo -u worksync python3 -m venv backend/venv
sudo -u worksync bash -c "source backend/venv/bin/activate && pip install -r backend/requirements-production.txt"
```

### 4. Configure Environment

```bash
# Copy and edit environment file
sudo -u worksync cp backend/.env.production.template backend/.env.production
sudo -u worksync nano backend/.env.production
```

**Required environment variables:**
```env
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=sqlite:///opt/worksync/backend/db.sqlite3
REDIS_URL=redis://127.0.0.1:6379/0
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 5. Database Setup

**For SQLite (Recommended):**
```bash
# SQLite database will be created automatically during migration
# Ensure proper permissions
sudo chown worksync:worksync /opt/worksync/backend/
sudo chmod 755 /opt/worksync/backend/
```

**For PostgreSQL (Optional):**
```bash
# Only if you need PostgreSQL instead of SQLite
sudo -u postgres psql << EOF
CREATE DATABASE worksync_production;
CREATE USER worksync_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE worksync_production TO worksync_user;
ALTER USER worksync_user CREATEDB;
\q
EOF
```

**Run Django migrations:**
```bash
sudo -u worksync bash -c "
    cd /opt/worksync/backend && 
    source venv/bin/activate && 
    export DJANGO_SETTINGS_MODULE=worksync.settings_production && 
    python manage.py migrate &&
    python manage.py collectstatic --noinput &&
    python manage.py createsuperuser
"
```

### 6. Build Frontend

```bash
sudo -u worksync bash -c "
    cd /opt/worksync/frontend && 
    npm ci --production && 
    npm run build
"
```

### 7. Configure Services

**Copy systemd service files:**
```bash
sudo cp /opt/worksync/backend/deployment/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

**Enable and start services:**
```bash
sudo systemctl enable worksync-django worksync-celery-worker worksync-celery-beat
sudo systemctl start worksync-django worksync-celery-worker worksync-celery-beat
```

### 8. Configure Nginx

```bash
# Copy Nginx configuration
sudo cp /opt/worksync/backend/deployment/nginx/worksync.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/worksync.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Setup SSL Certificate

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🔒 Security Configuration

### Firewall Setup
```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Additional Security Measures
1. **Change default SSH port**
2. **Disable root login**
3. **Set up fail2ban**
4. **Configure automatic security updates**
5. **Regular security audits**

## 📊 Monitoring and Logging

### Service Status
```bash
# Check service status
sudo systemctl status worksync-django worksync-celery-worker worksync-celery-beat nginx redis

# View logs
sudo journalctl -u worksync-django -f
sudo tail -f /var/log/worksync/gunicorn-error.log
sudo tail -f /var/log/nginx/worksync-error.log
```

### Health Check
```bash
# Test health endpoint
curl https://yourdomain.com/health/
```

### Log Rotation
```bash
# Configure logrotate
sudo tee /etc/logrotate.d/worksync << EOF
/var/log/worksync/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 worksync worksync
    postrotate
        systemctl reload worksync-django
    endscript
}
EOF
```

## 🔄 Maintenance

### Updates
```bash
# Update application code
sudo -u worksync bash -c "
    cd /opt/worksync && 
    git pull origin main &&
    source backend/venv/bin/activate &&
    pip install -r backend/requirements-production.txt &&
    cd backend &&
    export DJANGO_SETTINGS_MODULE=worksync.settings_production &&
    python manage.py migrate &&
    python manage.py collectstatic --noinput
"

# Restart services
sudo systemctl restart worksync-django worksync-celery-worker worksync-celery-beat
```

### Backup
```bash
# SQLite database backup (recommended)
sudo -u worksync cp /opt/worksync/backend/db.sqlite3 /opt/worksync/backup_$(date +%Y%m%d_%H%M%S).sqlite3

# Alternative: SQLite dump backup
sudo -u worksync sqlite3 /opt/worksync/backend/db.sqlite3 .dump > backup_$(date +%Y%m%d_%H%M%S).sql

# Media files backup
tar -czf media_backup_$(date +%Y%m%d_%H%M%S).tar.gz /opt/worksync/backend/media/

# Complete backup script
sudo -u worksync bash -c "
    cd /opt/worksync/backend
    backup_dir=/opt/worksync/backups/\$(date +%Y%m%d_%H%M%S)
    mkdir -p \$backup_dir
    cp db.sqlite3 \$backup_dir/
    tar -czf \$backup_dir/media.tar.gz media/
    echo 'Backup completed: \$backup_dir'
"
```

## 🚨 Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   sudo systemctl status worksync-django
   sudo journalctl -u worksync-django -n 50
   ```

2. **Database connection errors**
   - For SQLite: Check file permissions: `ls -la /opt/worksync/backend/db.sqlite3`
   - Ensure directory is writable: `sudo chown -R worksync:worksync /opt/worksync/backend/`
   - Test SQLite: `sudo -u worksync sqlite3 /opt/worksync/backend/db.sqlite3 ".tables"`
   - For PostgreSQL: Check service: `sudo systemctl status postgresql`

3. **Static files not loading**
   ```bash
   sudo -u worksync bash -c "
       cd /opt/worksync/backend &&
       source venv/bin/activate &&
       python manage.py collectstatic --noinput
   "
   ```

4. **Celery tasks not processing**
   ```bash
   sudo systemctl status worksync-celery-worker
   redis-cli ping
   ```

### Performance Tuning

1. **Gunicorn workers**: Adjust based on CPU cores (2 × cores + 1)
2. **Database connections**: Configure PostgreSQL connection pooling
3. **Redis memory**: Monitor Redis memory usage
4. **Nginx caching**: Enable appropriate caching headers

## 📞 Support

For deployment issues:
1. Check the logs first
2. Verify all environment variables are set
3. Ensure all services are running
4. Test network connectivity
5. Review security settings

## 🔗 Useful Commands

```bash
# Service management
sudo systemctl {start|stop|restart|status} worksync-django
sudo systemctl {start|stop|restart|status} worksync-celery-worker
sudo systemctl {start|stop|restart|status} worksync-celery-beat

# Log monitoring
sudo tail -f /var/log/worksync/gunicorn-error.log
sudo tail -f /var/log/nginx/worksync-error.log
sudo journalctl -u worksync-django -f

# Database operations
sudo -u postgres psql worksync_production
sudo -u worksync bash -c "cd /opt/worksync/backend && source venv/bin/activate && python manage.py shell"

# Redis operations
redis-cli
redis-cli monitor
```
