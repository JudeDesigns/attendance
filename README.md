# WorkSync - Workforce Management System

A modern workforce management system built with Django REST Framework and React.

## 🚀 Features

- **Employee Management** - Complete employee lifecycle management
- **Time Tracking** - Clock in/out with location verification
- **Break Management** - Automated break tracking with compliance
- **Leave Management** - Request, approve, and track employee leave
- **Scheduling** - Advanced shift scheduling
- **Reporting** - Comprehensive attendance and overtime reports
- **Notifications** - Real-time notifications
- **Mobile Responsive** - Glassmorphism design

## 🛠 Technology Stack

**Backend:** Django 4.2.7, Django REST Framework, SQLite, Redis, Celery
**Frontend:** React 18, Tailwind CSS, React Query

## 📦 Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Production Build
```bash
cd frontend
npm run build
```

## 🌐 Production Deployment

Use the included deployment scripts:
- `deploy-almalinux.sh` - Automated deployment
- `systemd-services.sh` - System services
- `nginx-worksync.conf` - Nginx configuration

### Environment Setup
1. Copy `backend/.env.production` to `backend/.env`
2. Update configuration values:
   - Set secure `SECRET_KEY`
   - Update `ALLOWED_HOSTS`
   - Configure Redis URL
   - Set email/SMS credentials (optional)

## 📱 Access Points

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000/api/v1/
- **Admin:** http://localhost:8000/admin/

## 🔐 Default Credentials

Create admin user with: `python manage.py createsuperuser`

## 📄 License

MIT License
