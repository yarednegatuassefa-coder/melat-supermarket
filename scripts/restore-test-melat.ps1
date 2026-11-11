param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackup,
  [Parameter(Mandatory=$true)][string]$RestoreDatabase
)
$ErrorActionPreference = "Stop"
if ($RestoreDatabase -ne "melat_restore_test") { throw "Restore script only targets isolated database melat_restore_test." }
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
if (-not $env:DATABASE_ADMIN_URL) { throw "Set DATABASE_ADMIN_URL in the server/.env file." }
if (-not $env:BACKUP_AGE_IDENTITY_FILE) { throw "Set BACKUP_AGE_IDENTITY_FILE in the root .env file." }
$createdbCommand = Get-Command createdb -ErrorAction SilentlyContinue
$pgRestoreCommand = Get-Command pg_restore -ErrorAction SilentlyContinue
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
$createdb = if ($createdbCommand) { $createdbCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\createdb.exe" }
$pgRestore = if ($pgRestoreCommand) { $pgRestoreCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" }
$psql = if ($psqlCommand) { $psqlCommand.Source } else { "C:\Program Files\PostgreSQL\18\bin\psql.exe" }
if (-not (Get-Command age -ErrorAction SilentlyContinue) -or -not (Test-Path $createdb) -or -not (Test-Path $pgRestore) -or -not (Test-Path $psql)) { throw "age and PostgreSQL client tools are required." }
if (-not (Test-Path $EncryptedBackup)) { throw "Encrypted backup file not found." }
$expectedFile = "$EncryptedBackup.sha256"
if (-not (Test-Path $expectedFile)) { throw "Backup checksum file is missing." }
$expected = ((Get-Content $expectedFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 -Path $EncryptedBackup).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "Backup checksum verification failed." }
$plain = Join-Path $env:TEMP ("melat-restore-" + [guid]::NewGuid().ToString("N") + ".dump")
try {
  age --decrypt --identity $env:BACKUP_AGE_IDENTITY_FILE --output "$plain" "$EncryptedBackup"
  if ($LASTEXITCODE -ne 0) { throw "Backup decryption failed." }
  $existing = & $psql "$env:DATABASE_ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$RestoreDatabase'"
  if ($LASTEXITCODE -ne 0) { throw "Could not check restore database state." }
  if ($existing -eq "1") { throw "melat_restore_test already exists. Inspect and remove it manually before retrying." }
  & $createdb --maintenance-db="$env:DATABASE_ADMIN_URL" "$RestoreDatabase"
  if ($LASTEXITCODE -ne 0) { throw "Could not create isolated restore database." }
  $target = [System.Uri]$env:DATABASE_ADMIN_URL
  $builder = [System.UriBuilder]$target
  $builder.Path = "/$RestoreDatabase"
  & $pgRestore --exit-on-error --no-owner --no-acl --dbname="$($builder.Uri.AbsoluteUri)" "$plain"
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed. The isolated restore database may be incomplete; inspect it before removal." }
  $verify = & $psql "$($builder.Uri.AbsoluteUri)" -tA -F "|" -c "SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM app_users),(SELECT count(*) FROM products),(SELECT count(*) FROM sales),(SELECT count(*) FROM journal_entries),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'),(SELECT count(*) FROM schema_migrations WHERE version='014')"
  if ($LASTEXITCODE -ne 0) { throw "Post-restore verification query failed." }
  $values = $verify.Trim() -split '\|'
  if ($values.Count -ne 7 -or [int]$values[0] -lt 10 -or [int]$values[6] -ne 1) { throw "Restored database is missing the expected migration chain or core schema." }
  Write-Output "RESTORE TEST PASSED"
  Write-Output "Migrations: $($values[0]); users: $($values[1]); products: $($values[2]); sales: $($values[3]); journals: $($values[4]); public tables: $($values[5])"
  Write-Output "The isolated restored database is melat_restore_test. Production data was not modified."
} finally {
  if (Test-Path $plain) { Remove-Item -Force $plain }
}
