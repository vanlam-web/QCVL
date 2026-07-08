param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [string]$TaskName = "QC-OMS Server Watchdog",
  [int]$IntervalMinutes = 5
)

$ErrorActionPreference = "Stop"

$StartScript = Join-Path $ProjectRoot "scripts\windows\start-qc-oms-server.ps1"
if (-not (Test-Path -LiteralPath $StartScript)) {
  throw "Start script not found: $StartScript"
}

$TaskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartScript`" -ProjectRoot `"$ProjectRoot`""

schtasks.exe /Create /TN $TaskName /SC MINUTE /MO $IntervalMinutes /TR $TaskCommand /F
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create scheduled task: $TaskName"
}

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Interval: every $IntervalMinutes minutes"
