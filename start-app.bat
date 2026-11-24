@echo off
cd /d "%~dp0"
echo Starting Bagan Medical Hall - Pharmacy POS & Accounting ERP...
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start "" node "%~dp0server.js"
) else (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1"
)
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/"
exit
