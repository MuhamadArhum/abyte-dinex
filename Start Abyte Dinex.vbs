Set WshShell = CreateObject("WScript.Shell")

ROOT = "D:\abyte-dinex"

' Backend
WshShell.Run "cmd /c cd /d """ & ROOT & "\main-app\backend"" && npm.cmd run start", 0, False

WScript.Sleep 5000

' Frontend
WshShell.Run "cmd /c cd /d """ & ROOT & "\main-app\frontend"" && npm.cmd run dev", 0, False

WScript.Sleep 5000

' Printer Agent
WshShell.Run "cmd /c cd /d """ & ROOT & "\printer-agent"" && npm.cmd run start", 0, False

WScript.Sleep 8000

' Open Abyte Dinex
WshShell.Run "http://localhost:5181", 1, False

WScript.Sleep 3000

' Open Printer Agent
WshShell.Run "http://localhost:3022", 1, False