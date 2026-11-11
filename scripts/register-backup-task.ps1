$ErrorActionPreference = "Stop"
$backupScript = Join-Path $PSScriptRoot "backup-melat.ps1"
if (-not (Test-Path $backupScript)) { throw "Backup script not found." }
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$trigger = New-ScheduledTaskTrigger -Daily -At "8:00 PM"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Melat Encrypted PostgreSQL Backup" -Action $action -Trigger $trigger -Settings $settings -Description "Creates encrypted Melat PostgreSQL backup and copies it to configured offsite storage." -Force | Out-Null
Write-Output "Daily 8:00 PM backup task registered for the current Windows user."
Write-Output "The user must be logged in for the task to run with this default security context."
