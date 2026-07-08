param(
  [string]$ProjectRoot = "\\192.168.1.188\AI\QC-OMS",
  [int]$DockerTimeoutSeconds = 180,
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

function Test-SupabaseApi {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:54321/rest/v1/" -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
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

$dockerDesktop = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
if (Test-Path -LiteralPath $dockerDesktop) {
  Write-Log "Starting Docker Desktop if needed"
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden -ErrorAction SilentlyContinue
} else {
  Write-Log "Docker Desktop executable was not found at $dockerDesktop"
}

Write-Log "Waiting for Docker to become ready"
$deadline = (Get-Date).AddSeconds($DockerTimeoutSeconds)
do {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Log "Docker is ready"
    break
  }

  Start-Sleep -Seconds 5
} while ((Get-Date) -lt $deadline)

if ($LASTEXITCODE -ne 0) {
  throw "Docker did not become ready within $DockerTimeoutSeconds seconds"
}

if (Test-SupabaseApi) {
  Write-Log "Supabase API is already responding"
} else {
  Write-Log "Starting local Supabase"
  Invoke-InProject "npx.cmd supabase start" 2>&1 | Tee-Object -FilePath $LogFile -Append
  if ($LASTEXITCODE -ne 0 -and -not (Test-SupabaseApi)) {
    throw "Supabase failed to start"
  }
}

if (Test-PortListening -Port $AppPort) {
  Write-Log "Port $AppPort is already listening; QC-OMS app may already be running"
  exit 0
}

Write-Log "Starting QC-OMS app on 0.0.0.0:$AppPort"
$AppLogFile = Join-Path $LogDir "qc-oms-app.log"
Invoke-InProject "npm.cmd run dev:server" 2>&1 | Tee-Object -FilePath $AppLogFile -Append
