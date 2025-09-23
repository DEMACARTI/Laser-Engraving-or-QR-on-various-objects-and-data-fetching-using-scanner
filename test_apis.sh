#!/bin/bash
echo "🧪 Testing API Endpoints"
echo "========================"

echo "Testing Combined Backend Service (Port 5002)..."
curl -s -w "Status: %{http_code}\n" "http://localhost:5002/items/manufactured?limit=2" | head -10

echo
echo "Testing Engraving Service (Port 8004)..."
curl -s -w "Status: %{http_code}\n" "http://localhost:8004/health" | head -5

echo
echo "Combined Backend Health..."
curl -s -w "Status: %{http_code}\n" "http://localhost:5002/health" | head -5