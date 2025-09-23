#!/bin/bash

echo "🚀 Starting QR Manufacturing Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "Starting Flask server..."
gunicorn --bind 0.0.0.0:5002 combined_backend_service:app