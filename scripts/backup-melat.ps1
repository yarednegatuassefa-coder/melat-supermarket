param(
  [string]$BackupDirectory = (Join-Path $PSScriptRoot "..\backups")
)
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $repoRoot "server\.env"
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^([A-Z0-9_]+)=(.*)$') {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1,$value.Length-2) }
      [Environment]::SetEnvironmentVariable($matches[1],$value,"Process")
    }
  }
}
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required in the server/.env file." }
if (-not $env:BACKUP_AGE_RECIPIENT) { throw "Set BACKUP_AGE_RECIPIENT in the root .env file. Plaintext backups are not retained." }
$pgDumpCommand = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestoreCommand = Get-Command pg_restore -ErrorAction SilentlyContinue
$pgDump = if ($pgDumpCommand) { $pgDumpCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" }
$pgRestore = if ($pgRestoreCommand) { $pgRestoreCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" }
if (-not (Test-Path $pgDump) -or -not (Test-Path $pgRestore)) { throw "pg_dump.exe and pg_restore.exe are required." }
if (-not (Get-Command age -ErrorAction SilentlyContinue)) { throw "age is required for encrypted backups." }
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$plain = Join-Path $BackupDirectory "melat-$stamp.dump"
$encrypted = "$plain.age"
try {
  & $pgDump --format=custom --no-owner --no-acl --file="$plain" "$env:DATABASE_URL"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
  & $pgRestore --list "$plain" *> $null
  if ($LASTEXITCODE -ne 0) { throw "The generated PostgreSQL dump failed archive validation." }
  age --encrypt --recipient $env:BACKUP_AGE_RECIPIENT --output "$encrypted" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "age encryption failed with exit code $LASTEXITCODE." }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $encrypted).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $encrypted)" | Set-Content -Encoding ascii "$encrypted.sha256"
  Remove-Item -Force "$plain"
  if ($env:BACKUP_OFFSITE_DIRECTORY) {
    New-Item -ItemType Directory -Force -Path $env:BACKUP_OFFSITE_DIRECTORY | Out-Null
    $checksumFile = "$encrypted.sha256"
    Copy-Item -Force -Path @($encrypted,$checksumFile) -Destination $env:BACKUP_OFFSITE_DIRECTORY
    if (-not (Test-Path (Join-Path $env:BACKUP_OFFSITE_DIRECTORY (Split-Path -Leaf $encrypted))) -or -not (Test-Path (Join-Path $env:BACKUP_OFFSITE_DIRECTORY (Split-Path -Leaf $checksumFile)))) { throw "Offsite backup copy verification failed." }
    Write-Output "Encrypted backup and checksum copied to offsite storage and verified."
  } else {
    Write-Warning "No offsite destination configured. Copy both encrypted files to independent offsite storage."
  }
  Write-Output "Encrypted backup: $encrypted"
  Write-Output "SHA256: $hash"
} catch {
  if (Test-Path $plain) { Remove-Item -Force $plain }
  throw
}
