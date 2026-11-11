# Run from an elevated PowerShell window on the dedicated Melat server.
$ErrorActionPreference = "Stop"
$rules = @(
  @{Name="Melat - block direct API"; Port="4000"; Action="Block"},
  @{Name="Melat - block PostgreSQL"; Port="5432"; Action="Block"}
)
foreach ($rule in $rules) {
  Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action $rule.Action -Profile Any | Out-Null
}
Get-NetFirewallRule -DisplayName "Melat - allow LAN HTTPS" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName "Melat - allow LAN HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -RemoteAddress LocalSubnet -Action Allow -Profile Private,Domain | Out-Null
Write-Output "Inbound API and PostgreSQL ports are blocked. HTTPS is allowed only from the local subnet on Private/Domain profiles."
Write-Warning "Verify Windows network profile is Private or Domain, Caddy is installed, and router/firewall rules do not expose ports publicly."
