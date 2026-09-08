@echo off
title Stop MPLADS Sentinel
color 0C
echo ======================================================================
echo             STOPPING MPLADS SENTINEL SERVICES
echo ======================================================================
echo.

echo [*] Terminating Backend on Port 8000...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Terminating Frontend on Port 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [OK] All MPLADS Sentinel services have been stopped.
timeout /t 2 /nobreak >nul
