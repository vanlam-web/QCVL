param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [string]$UserName = "$env:COMPUTERNAME\Admin",
  [string]$Password,
  [string]$LocalLauncherDir = "C:\QC-OMS-Autostart"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Password)) {
  throw "Pass -Password to create background scheduled tasks."
}

$StartScript = Join-Path $ProjectRoot "scripts\windows\start-qc-oms-server.ps1"
if (-not (Test-Path -LiteralPath $StartScript)) {
  throw "Start script not found: $StartScript"
}

New-Item -ItemType Directory -Force -Path $LocalLauncherDir | Out-Null
$Launcher = Join-Path $LocalLauncherDir "start-qc-oms-server-local.ps1"

@"
`$ErrorActionPreference = "Stop"
`$ProjectRoot = "$ProjectRoot"
`$Script = Join-Path `$ProjectRoot "scripts\windows\start-qc-oms-server.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File `$Script -ProjectRoot `$ProjectRoot
exit `$LASTEXITCODE
"@ | Set-Content -LiteralPath $Launcher -Encoding ASCII

$TaskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Launcher`""

schtasks.exe /Delete /TN "QC-OMS Server Boot" /F 2>$null
schtasks.exe /Delete /TN "QC-OMS Server Watchdog" /F 2>$null

schtasks.exe /Create /TN "QC-OMS Server Boot" /SC ONSTART /DELAY 0002:00 /TR $TaskCommand /RU $UserName /RP $Password /RL HIGHEST /F
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create QC-OMS Server Boot task."
}

schtasks.exe /Create /TN "QC-OMS Server Watchdog" /SC MINUTE /MO 5 /TR $TaskCommand /RU $UserName /RP $Password /RL HIGHEST /F
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create QC-OMS Server Watchdog task."
}

Write-Host "Installed background tasks for $UserName"
Write-Host "Launcher: $Launcher"
