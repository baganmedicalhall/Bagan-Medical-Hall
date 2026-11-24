@echo off
cd /d "%~dp0"
title Bagan Medical Hall Pharmacy Server
echo Starting Bagan Medical Hall Web Server on http://localhost:8080/ ...
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node "%~dp0server.js"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
)
pause
