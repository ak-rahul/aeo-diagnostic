@echo off
echo ===================================================
echo     Starting AEO Diagnostic (Full Stack)
echo ===================================================

echo [1/2] Starting FastAPI Backend on port 8000...
start cmd /k "title AEO Backend && cd backend && uvicorn main:app --reload --port 8000"

echo [2/2] Starting Vite Frontend on port 5173...
cd frontend
npm run dev
