@echo off
title MPLADS Sentinel Launcher
color 0B
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo ======================================================================
echo             MPLADS SENTINEL - SYSTEM LAUNCHER
echo   AI-Powered Audit & Anomaly Detection System for MPLADS Projects
echo ======================================================================
echo.

:: 1. Check Backend environment
echo [*] Checking Backend environment...
if not exist "%ROOT_DIR%backend\venv\Scripts\python.exe" (
    echo [!] Virtual environment not found. Creating backend\venv...
    cd /d "%ROOT_DIR%backend"
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+.
        pause
        exit /b 1
    )
    echo [*] Installing backend dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd /d "%ROOT_DIR%"
)

:: 2. Check Frontend environment
echo [*] Checking Frontend dependencies...
if not exist "%ROOT_DIR%frontend\node_modules" (
    echo [!] node_modules not found. Installing frontend dependencies...
    cd /d "%ROOT_DIR%frontend"
    call npm install
    cd /d "%ROOT_DIR%"
)

:: 3. Kill any existing instances on ports 8000 and 5173
echo [*] Clearing ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 4. Start Backend Server
echo [*] Starting Backend API Server (http://localhost:8000)...
start "MPLADS Sentinel - Backend (Port 8000)" cmd /c "cd /d ""%ROOT_DIR%backend"" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

:: 5. Start Frontend Server
echo [*] Starting Frontend UI Server (http://localhost:5173)...
start "MPLADS Sentinel - Frontend (Port 5173)" cmd /c "cd /d ""%ROOT_DIR%frontend"" && npm run dev"

:: 6. Wait briefly for servers to start
echo [*] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

:: 7. Open Browser
echo [*] Opening MPLADS Sentinel in default browser...
start http://localhost:5173

echo.
echo ======================================================================
echo                    SYSTEM RUNNING SUCCESSFULLY!
echo ======================================================================
echo  Frontend UI:  http://localhost:5173
echo  Backend API:  http://localhost:8000
echo  API Docs:     http://localhost:8000/docs
echo.
echo ----------------------------------------------------------------------
echo  Demo Credentials:
echo   - Admin:      admin          / Admin@1234
echo   - Ministry:   ministry_user  / Ministry@1234
echo   - State:      state_user     / State@1234
echo   - District:   district_user  / District@1234
echo   - MP:         mp_user        / Mp@12345
echo   - Public:     public_user    / Public@1234
echo ----------------------------------------------------------------------
echo.
echo Press any key to stop all services and close...
pause >nul

echo.
echo [*] Stopping MPLADS Sentinel services...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] All services stopped.
timeout /t 2 /nobreak >nul
