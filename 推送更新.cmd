@echo off
title FURIX push to GitHub
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push.ps1"
if errorlevel 1 echo.
pause