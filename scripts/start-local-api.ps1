$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$service = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if (-not $service) { throw "PostgreSQL 18 service was not found." }
if ($service.Status -ne "Running") { Start-Service -Name "postgresql-x64-18" }
$pgReady = "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe"
$ready = $false
for ($i=0; $i -lt 30; $i++) {
  & $pgReady -h localhost -p 5432 *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "PostgreSQL did not become ready within 60 seconds." }
Set-Location $repoRoot
npm.cmd run start --workspace server
if ($LASTEXITCODE -ne 0) { throw "Melat API exited with code $LASTEXITCODE." }
