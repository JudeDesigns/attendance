#!/bin/bash

# WorkSync Development Server Startup Script
echo "🚀 Starting WorkSync development servers..."

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping development servers..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start Redis (if not running)
if ! pgrep -x "redis-server" > /dev/null; then
    echo "🔴 Starting Redis server..."
    redis-server --daemonize yes
fi

# Start PostgreSQL (if not running)
if ! pgrep -x "postgres" > /dev/null; then
    echo "🐘 Starting PostgreSQL..."
    # This command varies by system, adjust as needed
    # brew services start postgresql  # macOS with Homebrew
    # sudo systemctl start postgresql  # Linux with systemd
fi

# Start Django backend
echo "🐍 Starting Django backend server..."
cd backend
source venv/bin/activate
python manage.py runserver 8000 &
BACKEND_PID=$!
cd ..

# Start Celery worker
echo "🔄 Starting Celery worker..."
cd backend
celery -A worksync worker -l info &
CELERY_PID=$!
cd ..

# Start React frontend
echo "⚛️  Starting React frontend server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "✅ All servers started!"
echo "📚 API Documentation: http://localhost:8000/api/docs/"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Django Admin: http://localhost:8000/admin/"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for all background processes
wait
