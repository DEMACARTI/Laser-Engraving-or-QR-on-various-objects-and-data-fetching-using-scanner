#!/bin/bash
# Simple Service Starter for QR Manufacturing System

echo "🚀 Starting QR Manufacturing System Services..."
echo "=============================================="

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:5002 | xargs kill -9 2>/dev/null || true
lsof -ti:8004 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait for ports to be freed
sleep 2

# Navigate to project root
cd /Users/dakshrathore/Laser-Engraving-or-QR-on-various-objects-and-data-fetching-using-scanner-main

# Start Combined Backend Service (Port 5002)
echo "🌐 Starting Combined Backend Service on port 5002..."
./.venv/bin/python qr-manufacturing-system/combined_backend_service.py &
BACKEND_PID=$!

# Wait a moment
sleep 3

# Start Engraving Service (Port 8004)
echo "⚡ Starting Engraving Service on port 8004..."
cd qr-manufacturing-system/services/engraving-service
PYTHONPATH=. ../../../.venv/bin/python main_updated.py &
ENGRAVING_PID=$!

# Go back to root
cd /Users/dakshrathore/Laser-Engraving-or-QR-on-various-objects-and-data-fetching-using-scanner-main

echo ""
echo "✅ Services Started!"
echo "   Combined Backend: PID $BACKEND_PID (Port 5002)"
echo "   Engraving Service: PID $ENGRAVING_PID (Port 8004)"
echo ""
echo "🌍 Service URLs:"
echo "   Backend API: http://localhost:5002"
echo "   Engraving API: http://localhost:8004"
echo ""
echo "📋 API Endpoints:"
echo "   Health: http://localhost:5002/health"
echo "   Items: http://localhost:5002/items/manufactured"
echo ""
echo "🎯 Frontend should now work correctly!"
echo ""


