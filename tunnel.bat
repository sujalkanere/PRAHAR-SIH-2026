@echo off
title Cloudflare Public Tunnel - MPLADS Sentinel
cd /d "%~dp0"
echo ======================================================================
echo           Starting Free Cloudflare Public Tunnel
echo ======================================================================

if not exist "%~dp0cloudflared.exe" (
    echo [*] cloudflared.exe not found. Downloading Cloudflare Tunnel binary...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if not exist "%~dp0cloudflared.exe" (
        echo [ERROR] Failed to download cloudflared.exe. Please download it manually.
        pause
        exit /b 1
    )
    echo [OK] cloudflared.exe downloaded successfully.
)

echo [*] Forwarding http://localhost:5173 to public HTTPS URL...
.\cloudflared.exe tunnel --url http://localhost:5173
pause
