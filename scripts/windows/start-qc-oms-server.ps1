param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [int]$AppPort = 3000
)

$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $ProjectRoot

$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "qc-oms-server.log"

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  Write-Output $line
  try {
    Add-Content -LiteralPath $LogFile -Value $line -ErrorAction Stop
  } catch {
    Write-Output "[$timestamp] Could not write to log file: $($_.Exception.Message)"
  }
}

function Test-PortListening {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Invoke-InProject {
  param([string]$Command)
  Push-Location -LiteralPath "$env:SystemDrive\"
  try {
    cmd.exe /d /s /c "pushd `"$ProjectRoot`" && $Command"
  } finally {
    Pop-Location
  }
}

Write-Log "Starting QC-OMS server from $ProjectRoot"

if (Test-PortListening -Port $AppPort) {
  Write-Log "Port $AppPort is already listening; QC-OMS app may already be running"
  exit 0
}

Write-Log "Starting QC-OMS app on 0.0.0.0:$AppPort"
$AppLogFile = Join-Path $LogDir "qc-oms-app.log"
Invoke-InProject "npm.cmd run dev:server" 2>&1 | Tee-Object -FilePath $AppLogFile -Append
