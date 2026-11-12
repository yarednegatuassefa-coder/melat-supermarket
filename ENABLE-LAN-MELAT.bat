@echo off
setlocal
fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission to configure the store LAN firewall and HTTPS proxy...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\enable-lan-access.ps1"
if errorlevel 1 (
  echo.
  echo LAN HTTPS setup did not complete. Read the error above before retrying.
  pause
  exit /b 1
)
echo.
echo LAN HTTPS proxy setup completed. Restart the Melat Local API task as instructed.
pause
