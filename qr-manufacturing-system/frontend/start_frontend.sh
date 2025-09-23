#!/bin/bash
# Script to run the frontend for development

echo "🚀 Starting QR Manufacturing Frontend..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Check if .env exists, if not, create from example
if [ ! -f .env.local ] && [ -f .env ]; then
  echo "⚙️  Creating .env.local from .env..."
  cp .env .env.local
  echo "✅ Created .env.local - you may want to customize it for your environment"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the development server
echo "🌐 Starting development server..."
npm run dev