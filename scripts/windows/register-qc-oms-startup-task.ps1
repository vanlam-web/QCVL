param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [string]$TaskName = "QC-OMS Server"
)

$ErrorActionPreference = "Stop"

$StartScript = Join-Path $ProjectRoot "scripts\windows\start-qc-oms-server.ps1"
if (-not (Test-Path -LiteralPath $StartScript)) {
  throw "Start script not found: $StartScript"
}

$PowerShell = Join-Path $PSHOME "powershell.exe"
$Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -ProjectRoot `"$ProjectRoot`""

$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments -WorkingDirectory $ProjectRoot
$AtStartup = New-ScheduledTaskTrigger -AtStartup
$AtLogon = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger @($AtStartup, $AtLogon) `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Start Docker, local Supabase, and QC-OMS app for shared development." `
  -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Start script: $StartScript"
