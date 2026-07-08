param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [string]$ShortcutName = "QC-OMS Server.lnk"
)

$ErrorActionPreference = "Stop"

$StartScript = Join-Path $ProjectRoot "scripts\windows\start-qc-oms-server.ps1"
if (-not (Test-Path -LiteralPath $StartScript)) {
  throw "Start script not found: $StartScript"
}

$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder $ShortcutName
$PowerShell = Join-Path $PSHOME "powershell.exe"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $PowerShell
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartScript`" -ProjectRoot `"$ProjectRoot`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "Start Docker, local Supabase, and QC-OMS app for shared development."
$Shortcut.Save()

Write-Host "Installed startup shortcut: $ShortcutPath"
