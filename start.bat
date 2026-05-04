@echo off
echo =========================================
echo  AEO Diagnostic
echo =========================================

REM ── Backend ───────────────────────────────
echo [1/3] Installing backend dependencies...
cd /d %~dp0backend
pip install -r requirements.txt --quiet

echo [2/3] Starting FastAPI backend on :8000...
start "AEO Backend" cmd /k "uvicorn main:app --reload --port 8000"

REM ── Frontend ──────────────────────────────
echo [3/3] Installing and starting frontend...
cd /d %~dp0frontend
call npm install --silent
start "AEO Frontend" cmd /k "npm run dev"

echo.
echo =========================================
echo  Backend:  http://localhost:8000/api/docs
echo  Frontend: http://localhost:5173
echo =========================================
echo  Add your OPENROUTER_API_KEY to .env
echo  Get a free key: https://openrouter.ai/keys
echo =========================================
