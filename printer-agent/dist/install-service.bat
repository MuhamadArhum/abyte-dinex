@echo off
setlocal EnableDelayedExpansion
title Abyte ERP Printer Agent - Install

echo.
echo  ============================================
echo   Abyte ERP Printer Agent v3.0 - Installer
echo  ============================================
echo.

:: Check Admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Right-click this file and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

set "EXE_DIR=%~dp0"
if "%EXE_DIR:~-1%"=="\" set "EXE_DIR=%EXE_DIR:~0,-1%"
set "EXE_PATH=%EXE_DIR%\ABytePrinterAgent.exe"
set "TASK_NAME=ABytePrinterAgent"

echo  Folder : %EXE_DIR%
echo  EXE    : %EXE_PATH%
echo.

if not exist "%EXE_PATH%" (
    echo  [ERROR] ABytePrinterAgent.exe not found in this folder.
    pause
    exit /b 1
)
echo  EXE found                [OK]

:: Remove old task
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
    echo  Old task removed         [OK]
)

:: Stop any running instance
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Create VBScript to launch EXE silently (no console window)
set "VBS=%EXE_DIR%\start-agent.vbs"
echo Set WShell = CreateObject("WScript.Shell") > "%VBS%"
echo WShell.Run """%EXE_PATH%""", 0, False >> "%VBS%"

:: Register Windows startup task
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%VBS%\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
if %errorlevel% equ 0 (
    echo  Startup task created     [OK]
) else (
    echo  [WARNING] Could not create startup task - run start.bat manually
)

:: Start agent now
echo  Starting agent...
start "" /min wscript.exe "%VBS%"
timeout /t 3 /nobreak >nul

:: Verify
curl -s --max-time 5 http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo  Agent running on :3001   [OK]
    echo.
    echo  Opening UI in browser...
    start http://localhost:3001
) else (
    echo  [WARNING] Agent may still be starting...
    echo  Open: http://localhost:3001
)

echo.
echo  ============================================
echo   Installation Complete!
echo.
echo   UI        : http://localhost:3001
echo   Config    : %EXE_DIR%\config.json
echo   Logs      : %EXE_DIR%\agent.log
echo  ============================================
echo.
pause
