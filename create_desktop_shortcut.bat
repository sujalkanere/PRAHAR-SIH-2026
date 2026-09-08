@echo off
title Create Desktop Shortcut
echo [*] Creating Desktop Shortcut for MPLADS Sentinel...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'MPLADS Sentinel.lnk')); $s.TargetPath = '%~dp0start.bat'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Launch MPLADS Sentinel (AI Anomaly Detection System)'; $s.Save()"

if %errorlevel% equ 0 (
    echo [OK] Shortcut 'MPLADS Sentinel' created successfully on your Desktop!
) else (
    echo [ERROR] Failed to create Desktop shortcut.
)
timeout /t 3 /nobreak >nul
