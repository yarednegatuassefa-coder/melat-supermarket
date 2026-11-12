@echo off
setlocal
fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission for PostgreSQL and scheduled-task setup...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-local-melat.ps1"
if errorlevel 1 (
  echo.
  echo Melat setup did not complete. Read the error above before retrying.
  pause
  exit /b 1
)
echo.
echo Local Melat setup passed its database and schema health checks.
pause
