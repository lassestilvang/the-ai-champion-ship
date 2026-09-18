#!/bin/bash

echo "🚀 Starting VoiceNote Development Environment"
echo "=============================================="

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start mock backend server
echo "🔧 Starting mock backend server on port 3001..."
node mock-server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend development server
echo "🎨 Starting frontend development server on port 3000..."
cd frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Development environment is ready!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:3001"
echo "📊 API Health: http://localhost:3001/api/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait