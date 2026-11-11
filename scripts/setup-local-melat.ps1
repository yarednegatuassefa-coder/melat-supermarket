$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $repoRoot ".env"
if (Test-Path $envFile) { throw "root .env already exists. Refusing to overwrite credentials." }
$service = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if (-not $service) { throw "PostgreSQL 18 Windows service was not found." }
if ($service.Status -ne "Running") { Start-Service -Name "postgresql-x64-18" }
$pgReady = "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe"
if (-not (Test-Path $pgReady)) { throw "PostgreSQL 18 pg_isready.exe not found." }
& $pgReady -h localhost -p 5432
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL is not accepting connections." }
$dbPasswordSecure = Read-Host "Enter the existing melat_app PostgreSQL password" -AsSecureString
$ownerPasswordSecure = Read-Host "Create a unique initial Melat owner password (16+ characters)" -AsSecureString
$ownerUsername = Read-Host "Owner username (e.g. owner)"
$ownerFullName = Read-Host "Owner full name"
if ($ownerPasswordSecure.Length -lt 16) { throw "Owner password must be at least 16 characters." }
if ($ownerUsername -notmatch '^[a-zA-Z0-9._-]{3,80}$') { throw "Owner username format is invalid." }
$dbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPasswordSecure)
$ownerPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ownerPasswordSecure)
try {
  $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr)
  $ownerPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ownerPtr)
  $encodedDbPassword = [Uri]::EscapeDataString($dbPassword)
  @(
    "NODE_ENV=production",
    "PORT=4000",
    "APP_BASE_URL=http://localhost:4000",
    "COOKIE_SECURE=false",
    "DATABASE_URL=postgresql://melat_app:$encodedDbPassword@localhost:5432/melat",
    "DATABASE_SSL=false",
    "DB_POOL_MAX=5",
    "DATABASE_ADMIN_URL=",
    "BACKUP_AGE_RECIPIENT=",
    "BACKUP_OFFSITE_DIRECTORY=",
    "BACKUP_AGE_IDENTITY_FILE=",
    "OWNER_USERNAME=$ownerUsername",
    "OWNER_FULL_NAME=$ownerFullName",
    "OWNER_INITIAL_PASSWORD=$ownerPassword"
  ) | Set-Content -Path $envFile -Encoding UTF8
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ownerPtr)
  $dbPassword = $null; $ownerPassword = $null; $encodedDbPassword = $null
}
Push-Location $repoRoot
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed. No database migrations were run." }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed. No database migrations were run." }
  npm run db:migrate --workspace server
  if ($LASTEXITCODE -ne 0) { throw "Database migration failed. Review PostgreSQL errors before retrying." }
  npm run db:bootstrap --workspace server
  if ($LASTEXITCODE -ne 0) { throw "Owner bootstrap failed. Inspect app_users before retrying." }
  (Get-Content $envFile) -replace '^OWNER_INITIAL_PASSWORD=.*$', 'OWNER_INITIAL_PASSWORD=' | Set-Content -Path $envFile -Encoding UTF8
  $proc = Start-Process -FilePath "npm.cmd" -ArgumentList @("run","start","--workspace","server") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 3
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -TimeoutSec 8
    if ($health.status -ne "ok") { throw "API health check did not report ok." }
  } catch {
    Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
    throw "API did not pass its health check. Inspect the server process before retrying."
  }
  Start-Process "http://localhost:4000"
  Write-Output "Melat local API and UI are running at http://localhost:4000"
  Write-Output "Sign in using the owner credentials you just created."
  Write-Output "This is local-machine verification only. Do not expose it to the LAN; configure Caddy HTTPS before staff devices connect."
} finally { Pop-Location }
