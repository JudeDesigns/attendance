# Attendance Application - AlmaLinux Production Deployment Guide

## 🚀 Overview
This guide will help you deploy the Attendance application to your AlmaLinux server with Nginx, alongside your existing Python and Next.js applications without breaking them.

**Domain**: `attendance.brfood.us`
**Server**: AlmaLinux with Nginx
**Existing Apps**: Python app + Next.js/Prisma/PostgreSQL app

## 📋 Prerequisites

### System Requirements
- AlmaLinux server with root/sudo access
- Nginx already installed and configured
- Python 3.8+ available
- Node.js 16+ available
- Domain `attendance.brfood.us` pointing to your server

### Existing Applications Safety
This deployment uses:
- **Different ports**: Backend (8002), Frontend (3002)
- **Separate directories**: `/var/www/attendance/`
- **Isolated services**: `attendance-backend.service`, `attendance-frontend.service`
- **Separate Nginx config**: `/etc/nginx/sites-available/attendance.brfood.us`

## 🔧 Step 1: Server Preparation

```bash
# Update system
sudo dnf update -y

# Install required packages
sudo dnf install -y python3 python3-pip python3-venv nodejs npm git

# Create application directory
sudo mkdir -p /var/www/attendance
sudo chown $USER:$USER /var/www/attendance
```

## 📦 Step 2: Upload Application

```bash
# Navigate to application directory
cd /var/www/attendance

# Upload your application files (choose one method):

# Method 1: Git clone (if you have a repository)
git clone https://github.com/yourusername/attendance.git .

# Method 2: SCP from local machine
# From your local machine:
# scp -r /Users/mac/code_projects/WorkSync/* user@your-server:/var/www/attendance/

# Method 3: rsync (recommended)
# From your local machine:
# rsync -avz --exclude 'node_modules' --exclude 'venv' --exclude '.git' \
#   /Users/mac/code_projects/WorkSync/ user@your-server:/var/www/attendance/
```

## 🐍 Step 3: Backend Setup

```bash
cd /var/www/attendance/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create production environment file
cp .env.example .env.production
```

### Configure Production Environment
Edit `/var/www/attendance/backend/.env.production`:

```bash
# Django Settings
DEBUG=False
SECRET_KEY=your-super-secret-key-here-change-this
ALLOWED_HOSTS=attendance.brfood.us,your-server-ip

# Database (SQLite for simplicity)
DATABASE_URL=sqlite:///var/www/attendance/backend/db.sqlite3

# Security
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# CORS
CORS_ALLOWED_ORIGINS=https://attendance.brfood.us
CORS_ALLOW_CREDENTIALS=True

# Static files
STATIC_ROOT=/var/www/attendance/backend/staticfiles
MEDIA_ROOT=/var/www/attendance/backend/media
```

### Initialize Database
```bash
# Copy environment file
cp .env.production .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

## ⚛️ Step 4: Frontend Setup

```bash
cd /var/www/attendance/frontend

# Install dependencies
npm install

# Create production environment
echo "REACT_APP_API_URL=https://attendance.brfood.us/api/v1" > .env.production

# Build for production
npm run build
```

## 🔧 Step 5: Create Systemd Services

### Backend Service
Create `/etc/systemd/system/attendance-backend.service`:

```ini
[Unit]
Description=Attendance Backend (Django)
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/var/www/attendance/backend
Environment=PATH=/var/www/attendance/backend/venv/bin
ExecStart=/var/www/attendance/backend/venv/bin/gunicorn \
    --workers 3 \
    --bind 127.0.0.1:8002 \
    --timeout 120 \
    --access-logfile /var/log/attendance/access.log \
    --error-logfile /var/log/attendance/error.log \
    core.wsgi:application
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Frontend Service
Create `/etc/systemd/system/attendance-frontend.service`:

```ini
[Unit]
Description=Attendance Frontend (React)
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/var/www/attendance/frontend
ExecStart=/usr/bin/npx serve -s build -l 3002
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Setup Services
```bash
# Create log directory
sudo mkdir -p /var/log/attendance
sudo chown www-data:www-data /var/log/attendance

# Set permissions
sudo chown -R www-data:www-data /var/www/attendance

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable attendance-backend attendance-frontend
sudo systemctl start attendance-backend attendance-frontend

# Check status
sudo systemctl status attendance-backend attendance-frontend
```

## 🌐 Step 6: Nginx Configuration

Create `/etc/nginx/sites-available/attendance.brfood.us`:

```nginx
server {
    listen 80;
    server_name attendance.brfood.us;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name attendance.brfood.us;

    # SSL Configuration (use your existing SSL setup method)
    ssl_certificate /path/to/your/ssl/certificate.crt;
    ssl_certificate_key /path/to/your/ssl/private.key;

    # SSL Security Headers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend (React App)
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;

        # CORS headers for API
        add_header Access-Control-Allow-Origin "https://attendance.brfood.us" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
        add_header Access-Control-Allow-Credentials "true" always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /var/www/attendance/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /var/www/attendance/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Logging
    access_log /var/log/nginx/attendance.access.log;
    error_log /var/log/nginx/attendance.error.log;
}
```

### Enable Site
```bash
# Enable the site (if using sites-enabled structure)
sudo ln -s /etc/nginx/sites-available/attendance.brfood.us /etc/nginx/sites-enabled/

# Or if using conf.d structure, move the file:
# sudo mv /etc/nginx/sites-available/attendance.brfood.us /etc/nginx/conf.d/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx (this won't break existing sites)
sudo systemctl reload nginx
```

## 🔒 Step 7: SSL Certificate

### Option 1: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo dnf install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d attendance.brfood.us

# Auto-renewal
sudo systemctl enable --now certbot-renew.timer
```

### Option 2: Use Existing SSL Setup
If you already have SSL certificates, update the nginx config paths:
```nginx
ssl_certificate /path/to/your/existing/certificate.crt;
ssl_certificate_key /path/to/your/existing/private.key;
```

## 🔍 Step 8: Verification & Testing

```bash
# Check all services are running
sudo systemctl status attendance-backend attendance-frontend nginx

# Check logs if there are issues
sudo journalctl -u attendance-backend -f
sudo journalctl -u attendance-frontend -f
sudo tail -f /var/log/nginx/attendance.error.log

# Test the application
curl -I https://attendance.brfood.us
curl -I https://attendance.brfood.us/api/v1/
```

## 🚨 Troubleshooting

### Common Issues:

1. **Port conflicts**: Ensure ports 8002 and 3002 are not used by other apps
2. **Permission issues**: Check file ownership with `sudo chown -R www-data:www-data /var/www/attendance`
3. **Firewall**: Ensure ports 80 and 443 are open
4. **SELinux**: If enabled, may need configuration: `sudo setsebool -P httpd_can_network_connect 1`

### Service Management:
```bash
# Restart services
sudo systemctl restart attendance-backend attendance-frontend

# View logs
sudo journalctl -u attendance-backend --since "1 hour ago"
sudo journalctl -u attendance-frontend --since "1 hour ago"

# Stop services (if needed)
sudo systemctl stop attendance-backend attendance-frontend
```

## ✅ Final Checklist

- [ ] Application files uploaded to `/var/www/attendance/`
- [ ] Backend virtual environment created and dependencies installed
- [ ] Frontend built for production
- [ ] Environment variables configured
- [ ] Database migrated and superuser created
- [ ] Systemd services created and running
- [ ] Nginx configuration added and tested
- [ ] SSL certificate installed
- [ ] Application accessible at `https://attendance.brfood.us`
- [ ] Existing applications still working

## 🎉 Success!

Your Attendance application should now be running at `https://attendance.brfood.us` without affecting your existing applications!

**Login**: Use the superuser credentials you created during setup.

**Next Steps**:
- Set up regular backups
- Configure monitoring
- Set up log rotation
- Consider setting up a staging environment
