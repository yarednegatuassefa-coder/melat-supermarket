@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-local-melat.ps1"
if errorlevel 1 (
  echo.
  echo Melat setup did not complete. Read the error above before retrying.
  pause
  exit /b 1
)
echo.
pause
