@echo off
cd /d "%~dp0"
title Bagan Medical Hall Pharmacy Server
echo Starting Bagan Medical Hall Web Server on http://localhost:8080/ ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
