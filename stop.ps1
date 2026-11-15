$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$statePath = Join-Path $root '.server.json'

if (-not (Test-Path -LiteralPath $statePath)) {
  exit 0
}

$info = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($info.pid) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($info.pid)"
  if ($process -and $process.CommandLine -and $process.CommandLine -match 'http\.server') {
    Stop-Process -Id $info.pid -Force
  }
}

Remove-Item -LiteralPath $statePath -Force
Remove-Item -LiteralPath (Join-Path $root '.server.log') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $root '.server.err.log') -Force -ErrorAction SilentlyContinue
