param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackup,
  [Parameter(Mandatory=$true)][string]$RestoreDatabase
)
$ErrorActionPreference = "Stop"
if ($RestoreDatabase -ne "melat_restore_test") { throw "For safety, restore script only targets the isolated database named melat_restore_test." }
if (-not $env:DATABASE_ADMIN_URL) { throw "Set DATABASE_ADMIN_URL to a PostgreSQL administrator connection." }
if (-not $env:BACKUP_AGE_IDENTITY_FILE) { throw "Set BACKUP_AGE_IDENTITY_FILE to the private age identity file." }
if (-not (Get-Command age -ErrorAction SilentlyContinue) -or -not (Get-Command createdb -ErrorAction SilentlyContinue) -or -not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "age, createdb and pg_restore are required." }
if (-not (Test-Path $EncryptedBackup)) { throw "Backup file not found." }
$expectedFile = "$EncryptedBackup.sha256"
if (Test-Path $expectedFile) {
  $expected = ((Get-Content $expectedFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $EncryptedBackup).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "Backup checksum verification failed." }
}
$plain = Join-Path $env:TEMP ("melat-restore-" + [guid]::NewGuid().ToString("N") + ".dump")
try {
  age --decrypt --identity $env:BACKUP_AGE_IDENTITY_FILE --output "$plain" "$EncryptedBackup"
  if ($LASTEXITCODE -ne 0) { throw "Backup decryption failed." }
  $existing = & psql "$env:DATABASE_ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$RestoreDatabase'"
  if ($existing -eq "1") { throw "melat_restore_test already exists. Inspect it and remove it manually before retrying; this script never drops databases." }
  createdb --maintenance-db="$env:DATABASE_ADMIN_URL" "$RestoreDatabase"
  if ($LASTEXITCODE -ne 0) { throw "Could not create isolated restore database." }
  $target = [System.Uri]$env:DATABASE_ADMIN_URL
  $builder = [System.UriBuilder]$target
  $builder.Path = "/$RestoreDatabase"
  pg_restore --exit-on-error --no-owner --no-acl --dbname="$($builder.Uri.AbsoluteUri)" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed. The isolated restore database may be incomplete; inspect it before removing it." }
  $count = & psql "$($builder.Uri.AbsoluteUri)" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
  Write-Output "RESTORE TEST PASSED. Restored public tables: $count"
  Write-Output "Inspect the restored database before using it. No production database was modified."
} finally {
  if (Test-Path $plain) { Remove-Item -Force $plain }
}
