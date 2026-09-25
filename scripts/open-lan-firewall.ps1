$ErrorActionPreference = "Stop"

$rules = @(
  @{ Name = "GOD'S EYE VIEW 5000"; Port = 5000 },
  @{ Name = "GOD'S EYE VIEW Mobile 6000"; Port = 6000 }
)

foreach ($rule in $rules) {
  netsh advfirewall firewall delete rule name="$($rule.Name)" | Out-Null
  netsh advfirewall firewall add rule name="$($rule.Name)" dir=in action=allow protocol=TCP localport=$($rule.Port) profile=private | Out-Null
  Write-Host "Opened TCP $($rule.Port) for Private network: $($rule.Name)"
}

Write-Host "Done. Use the PC Wi-Fi IP address from ipconfig, for example http://192.168.x.x:5000/"
