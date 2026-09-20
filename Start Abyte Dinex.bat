@echo off
setlocal

set "ROOT=D:\abyte-dinex"

:: Start Backend silently
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
"$p = New-Object System.Diagnostics.Process; $p.StartInfo.FileName = 'npm.cmd'; $p.StartInfo.Arguments = 'run start'; $p.StartInfo.WorkingDirectory = '%ROOT%\main-app\backend'; $p.StartInfo.UseShellExecute = $false; $p.StartInfo.CreateNoWindow = $true; $p.Start()"

timeout /t 5 /nobreak >nul

:: Start Frontend silently
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
"$p = New-Object System.Diagnostics.Process; $p.StartInfo.FileName = 'npm.cmd'; $p.StartInfo.Arguments = 'run dev'; $p.StartInfo.WorkingDirectory = '%ROOT%\main-app\frontend'; $p.StartInfo.UseShellExecute = $false; $p.StartInfo.CreateNoWindow = $true; $p.Start()"

timeout /t 5 /nobreak >nul

:: Start Printer Agent silently
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
"$p = New-Object System.Diagnostics.Process; $p.StartInfo.FileName = 'npm.cmd'; $p.StartInfo.Arguments = 'run start'; $p.StartInfo.WorkingDirectory = '%ROOT%\printer-agent'; $p.StartInfo.UseShellExecute = $false; $p.StartInfo.CreateNoWindow = $true; $p.Start()"

:: Wait for services
timeout /t 8 /nobreak >nul

:: Open Main App
start "" "http://localhost:5181"

timeout /t 3 /nobreak >nul

:: Open Printer Agent
start "" "http://localhost:3022"

exit