param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackup,
  [Parameter(Mandatory=$true)][string]$RestoreDatabase
)
$ErrorActionPreference = "Stop"
if ($RestoreDatabase -ne "melat_restore_test") { throw "For safety, restore script only targets the isolated database named melat_restore_test." }
if (-not $env:DATABASE_ADMIN_URL) { throw "Set DATABASE_ADMIN_URL to a PostgreSQL administrator connection." }
if (-not $env:BACKUP_AGE_IDENTITY_FILE) { throw "Set BACKUP_AGE_IDENTITY_FILE to the private age identity file." }
$createdbCommand = Get-Command createdb -ErrorAction SilentlyContinue
$pgRestoreCommand = Get-Command pg_restore -ErrorAction SilentlyContinue
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
$createdb = if ($createdbCommand) { $createdbCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\createdb.exe" }
$pgRestore = if ($pgRestoreCommand) { $pgRestoreCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" }
$psql = if ($psqlCommand) { $psqlCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\psql.exe" }
if (-not (Get-Command age -ErrorAction SilentlyContinue) -or -not (Test-Path $createdb) -or -not (Test-Path $pgRestore) -or -not (Test-Path $psql)) { throw "age and PostgreSQL client tools are required." }
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
  $existing = & $psql "$env:DATABASE_ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$RestoreDatabase'"
  if ($existing -eq "1") { throw "melat_restore_test already exists. Inspect it and remove it manually before retrying; this script never drops databases." }
  & $createdb --maintenance-db="$env:DATABASE_ADMIN_URL" "$RestoreDatabase"
  if ($LASTEXITCODE -ne 0) { throw "Could not create isolated restore database." }
  $target = [System.Uri]$env:DATABASE_ADMIN_URL
  $builder = [System.UriBuilder]$target
  $builder.Path = "/$RestoreDatabase"
  & $pgRestore --exit-on-error --no-owner --no-acl --dbname="$($builder.Uri.AbsoluteUri)" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed. The isolated restore database may be incomplete; inspect it before removing it." }
  $verify = & $psql "$($builder.Uri.AbsoluteUri)" -tA -F "|" -c "SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM app_users),(SELECT count(*) FROM products),(SELECT count(*) FROM sales),(SELECT count(*) FROM journal_entries),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')"
  if ($LASTEXITCODE -ne 0) { throw "Post-restore verification query failed." }
  $values = $verify.Trim() -split '\\|'
  if ($values.Count -ne 6 -or [int]$values[0] -lt 12) { throw "Restored database is missing expected Melat migrations or core tables." }
  Write-Output "RESTORE TEST PASSED"
  Write-Output "Migrations: $($values[0]); users: $($values[1]); products: $($values[2]); sales: $($values[3]); journals: $($values[4]); public tables: $($values[5])"
  Write-Output "Inspect the restored database before using it. No production database was modified."
} finally {
  if (Test-Path $plain) { Remove-Item -Force $plain }
}
