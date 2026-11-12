#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $repoRoot "server\.env"
$caddy = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $caddy) { throw "Caddy is not installed or is not on PATH. Install Caddy before enabling LAN access." }
if (-not (Test-Path $envFile)) { throw "Run scripts/setup-local-melat.ps1 first; server/.env was not found." }
$caddyfile = Join-Path $repoRoot "deploy\Caddyfile"
& $caddy.Source validate --config $caddyfile --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw "Caddyfile validation failed." }
& $caddy.Source trust
if ($LASTEXITCODE -ne 0) { throw "Could not install Caddy's local root certificate. Run this script elevated." }
$lines = Get-Content $envFile
$lines = $lines -replace '^APP_BASE_URL=.*$', 'APP_BASE_URL=https://melat.home.arpa'
$lines = $lines -replace '^COOKIE_SECURE=.*$', 'COOKIE_SECURE=true'
$lines = $lines -replace '^TRUST_PROXY=.*$', 'TRUST_PROXY=1'
$lines | Set-Content -Path $envFile -Encoding UTF8
& (Join-Path $PSScriptRoot "configure-lan-firewall.ps1")
$taskName = "Melat LAN HTTPS Proxy"
$action = New-ScheduledTaskAction -Execute $caddy.Source -Argument "run --config `"$caddyfile`" --adapter caddyfile" -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Local HTTPS reverse proxy for Melat POS; no public listener." -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
$apiTask = Get-ScheduledTask -TaskName "Melat Local API" -ErrorAction SilentlyContinue
if (-not $apiTask) { throw "Melat Local API scheduled task was not found. Run the installer again before enabling LAN access." }
Stop-ScheduledTask -TaskName "Melat Local API" -ErrorAction SilentlyContinue
$listener = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }
Start-ScheduledTask -TaskName "Melat Local API"
Write-Output "LAN HTTPS proxy and API restart requested. Verify the HTTPS health endpoint from a cashier terminal."
Write-Output "Staff devices must resolve melat.local to the store server's reserved LAN IP and trust Caddy's root certificate."
Write-Output "Caddy root certificate: $env:APPDATA\Caddy\pki\authorities\local\root.crt"
