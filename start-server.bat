@echo off
title Apex Rx Pharmacy Server
echo Starting Apex Rx Pharmacy Web Server on http://localhost:8080/ ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
