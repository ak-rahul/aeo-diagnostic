@echo off
echo ===================================================
echo     Starting AEO Diagnostic
echo ===================================================

echo [*] Checking Backend Dependencies...
cd backend
pip install -r requirements.txt -q
cd ..

echo [*] Checking Frontend Dependencies...
cd frontend
call npm install --silent
cd ..

echo [*] Starting FastAPI Backend on port 8000...
start cmd /k "title AEO Backend && cd backend && uvicorn main:app --reload --port 8000"

echo [*] Starting Vite Frontend on port 5173...
cd frontend
npm run dev
