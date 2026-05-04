#!/bin/bash
set -e

echo "========================================="
echo " AEO Diagnostic"
echo "========================================="

# Build Frontend
echo "[1/3] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Install Backend deps
echo "[2/3] Installing backend dependencies..."
cd backend
pip install -r requirements.txt

# Start Gunicorn server with Uvicorn workers
echo "[3/3] Starting backend..."
export PORT=${PORT:-8000}
exec uvicorn main:app --host 0.0.0.0 --port $PORT
