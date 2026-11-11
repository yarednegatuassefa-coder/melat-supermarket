param(
  [string]$BackupDirectory = "$PSScriptRoot\..\..\backups"
)
$ErrorActionPreference = "Stop"
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required." }
if (-not $env:BACKUP_AGE_RECIPIENT) { throw "Set BACKUP_AGE_RECIPIENT to an age public recipient. Plaintext backups are not retained." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump is not on PATH. Install PostgreSQL client tools." }
if (-not (Get-Command age -ErrorAction SilentlyContinue)) { throw "age is required for encrypted backups." }
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$plain = Join-Path $BackupDirectory "melat-$stamp.dump"
$encrypted = "$plain.age"
try {
  pg_dump --format=custom --no-owner --no-acl --file="$plain" "$env:DATABASE_URL"
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
