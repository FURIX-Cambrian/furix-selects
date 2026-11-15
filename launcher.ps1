$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$statePath = Join-Path $root '.server.json'

function Show-ErrorBox([string]$message) {
  if ($env:FURIX_NO_UI) {
    Write-Output $message
    return
  }
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($message, 'FURIX SELECTS', 'OK', 'Warning') | Out-Null
  } catch {
    Write-Host $message
  }
}

function Open-Browser([string]$url) {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($browser in $candidates) {
    if ($browser -and (Test-Path -LiteralPath $browser)) {
      Start-Process -FilePath $browser -ArgumentList @("--app=$url", "--window-size=1600,1000")
      return
    }
  }
  Start-Process $url
}

# Reuse a server that this launcher already started.
if (Test-Path -LiteralPath $statePath) {
  try {
    $info = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($info.pid -and $info.port) {
      $existing = Get-Process -Id $info.pid -ErrorAction SilentlyContinue
      if ($existing) {
        $url = "http://127.0.0.1:$($info.port)/index.html"
        if (-not $env:FURIX_NO_BROWSER) { Open-Browser $url }
        exit 0
      }
    }
  } catch {
    # stale state file, remove below
  }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

$python = $null
$pythonName = $null
foreach ($candidate in @('pythonw.exe', 'python.exe', 'py.exe')) {
  $command = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($command) {
    $python = $command.Source
    $pythonName = $candidate
    break
  }
}

if (-not $python) {
  Show-ErrorBox "Python was not found.`n`nOpening index.html directly. Folder access may be limited in this mode; Chrome or Edge is recommended."
  Start-Process (Join-Path $root 'index.html')
  exit 0
}

# Pick a free loopback port in a stable range.
$port = 0
for ($candidate = 8731; $candidate -lt 8800; $candidate++) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $listener.Start()
    $listener.Stop()
    $port = $candidate
    break
  } catch {
    # occupied, try next
  }
}

if (-not $port) {
  Show-ErrorBox "No free local port was found (8731-8799)."
  exit 1
}

$arguments = @()
if ($pythonName -eq 'py.exe') { $arguments += '-3' }
$arguments += @('-m', 'http.server', "$port", '--bind', '127.0.0.1')

$serverOut = Join-Path $root '.server.log'
$serverErr = Join-Path $root '.server.err.log'
$process = Start-Process -FilePath $python `
  -ArgumentList $arguments `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $serverOut `
  -RedirectStandardError $serverErr `
  -PassThru

$url = "http://127.0.0.1:$port/index.html"
@{
  pid = $process.Id
  port = $port
  url = $url
  started = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

$ready = $false
for ($i = 0; $i -lt 50; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 200
  }
}

if (-not $ready) {
  try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Show-ErrorBox "The local preview server did not start.`n`nYou can still open index.html directly, or run: python -m http.server 8731"
  exit 1
}

if (-not $env:FURIX_NO_BROWSER) {
  Open-Browser $url
}
