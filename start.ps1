# MPLADS Sentinel PowerShell Launcher
$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "             MPLADS SENTINEL - SYSTEM LAUNCHER (PowerShell)" -ForegroundColor Cyan
Write-Host "   AI-Powered Audit & Anomaly Detection System for MPLADS Projects" -ForegroundColor DarkCyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Check backend venv
$VenvPython = Join-Path $RootDir "backend\venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "[!] Virtual environment not found. Setting up backend venv..." -ForegroundColor Yellow
    Set-Location (Join-Path $RootDir "backend")
    python -m venv venv
    & (Join-Path $RootDir "backend\venv\Scripts\pip.exe") install -r requirements.txt
    Set-Location $RootDir
}

# Check frontend node_modules
$NodeModules = Join-Path $RootDir "frontend\node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "[!] Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $RootDir "frontend")
    npm install
    Set-Location $RootDir
}

# Free ports 8000 and 5173
Write-Host "[*] Freeing ports 8000 and 5173 if busy..." -ForegroundColor Gray
@(8000, 5173) | ForEach-Object {
    $port = $_
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $connections.OwningProcess | Select-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}

# Start Backend
Write-Host "[*] Starting Backend API Server (http://localhost:8000)..." -ForegroundColor Green
$backendCmd = "cd '$RootDir\backend'; .\venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

# Start Frontend
Write-Host "[*] Starting Frontend UI Server (http://localhost:5173)..." -ForegroundColor Green
$frontendCmd = "cd '$RootDir\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

# Wait and launch browser
Start-Sleep -Seconds 3
Write-Host "[*] Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  System is now up and running at http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend docs at http://localhost:8000/docs" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
