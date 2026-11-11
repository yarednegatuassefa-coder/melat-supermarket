param(
  [string]$BackupDirectory = "$PSScriptRoot\..\backups"
)
$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\server\.env"
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^([A-Z0-9_]+)=(.*) { throw "DATABASE_URL is required." }
if (-not $env:BACKUP_AGE_RECIPIENT) { throw "Set BACKUP_AGE_RECIPIENT to an age public recipient. Plaintext backups are not retained." }
$pgDumpCommand = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgDump = if ($pgDumpCommand) { $pgDumpCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" }
if (-not (Test-Path $pgDump)) { throw "pg_dump.exe was not found. Install PostgreSQL client tools." }
if (-not (Get-Command age -ErrorAction SilentlyContinue)) { throw "age is required for encrypted backups." }
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$plain = Join-Path $BackupDirectory "melat-$stamp.dump"
$encrypted = "$plain.age"
try {
  & $pgDump --format=custom --no-owner --no-acl --file="$plain" "$env:DATABASE_URL"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
  age --encrypt --recipient $env:BACKUP_AGE_RECIPIENT --output "$encrypted" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "age encryption failed with exit code $LASTEXITCODE." }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $encrypted).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $encrypted)" | Set-Content -Encoding ascii "$encrypted.sha256"
  Remove-Item -Force "$plain"
  Write-Output "Encrypted backup created: $encrypted"
  Write-Output "SHA256: $hash"
  if ($env:BACKUP_OFFSITE_DIRECTORY) {
    New-Item -ItemType Directory -Force -Path $env:BACKUP_OFFSITE_DIRECTORY | Out-Null
    Copy-Item -Force $encrypted "$env:BACKUP_OFFSITE_DIRECTORY"
    Copy-Item -Force "$encrypted.sha256" "$env:BACKUP_OFFSITE_DIRECTORY"
    Write-Output "Encrypted backup and checksum copied to configured offsite target."
  } else {
    Write-Warning "No BACKUP_OFFSITE_DIRECTORY configured. Copy the encrypted backup and checksum to independent offsite storage."
  }
} catch {
  if (Test-Path $plain) { Remove-Item -Force $plain }
  throw
}
) { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") }
  }
}
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required." }
if (-not $env:BACKUP_AGE_RECIPIENT) { throw "Set BACKUP_AGE_RECIPIENT to an age public recipient. Plaintext backups are not retained." }
$pgDumpCommand = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgDump = if ($pgDumpCommand) { $pgDumpCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" }
if (-not (Test-Path $pgDump)) { throw "pg_dump.exe was not found. Install PostgreSQL client tools." }
if (-not (Get-Command age -ErrorAction SilentlyContinue)) { throw "age is required for encrypted backups." }
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$plain = Join-Path $BackupDirectory "melat-$stamp.dump"
$encrypted = "$plain.age"
try {
  & $pgDump --format=custom --no-owner --no-acl --file="$plain" "$env:DATABASE_URL"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
  age --encrypt --recipient $env:BACKUP_AGE_RECIPIENT --output "$encrypted" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "age encryption failed with exit code $LASTEXITCODE." }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $encrypted).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $encrypted)" | Set-Content -Encoding ascii "$encrypted.sha256"
  Remove-Item -Force "$plain"
  Write-Output "Encrypted backup created: $encrypted"
  Write-Output "SHA256: $hash"
} catch {
  if (Test-Path $plain) { Remove-Item -Force $plain }
  throw
}
