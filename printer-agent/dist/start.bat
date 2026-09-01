@echo off
title Abyte ERP Printer Agent v3.0

:: Kill existing on port 3001
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo  Starting Abyte ERP Printer Agent...
echo  UI: http://localhost:3001
echo  Press Ctrl+C to stop.
echo.

"%~dp0ABytePrinterAgent.exe"
pause
