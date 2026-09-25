$ErrorActionPreference = "Stop"

$rules = @(
  "GOD'S EYE VIEW 5000",
  "GOD'S EYE VIEW Mobile 6000"
)

foreach ($name in $rules) {
  netsh advfirewall firewall delete rule name="$name" | Out-Null
  Write-Host "Removed firewall rule: $name"
}

Write-Host "Done."
