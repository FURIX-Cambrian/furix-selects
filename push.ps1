# FURIX 推送更新：双击「推送更新.cmd」时真正干活的是这个脚本
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Write-Step($text) {
  Write-Host ''
  Write-Host ("=== " + $text + " ===") -ForegroundColor Cyan
}
function Fail($text) {
  Write-Host ''
  Write-Host $text -ForegroundColor Red
  exit 1
}
function Find-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $portable = 'D:\DSH\_tools\git\bin\git.exe'
  if (Test-Path -LiteralPath $portable) { return $portable }
  return $null
}

$git = Find-Git
if (-not $git) { Fail '没找到 git。装上 Git，或把便携版放到 D:\DSH\_tools\git 再试一次。' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
  Fail '这个文件夹不是 git 仓库，先按「发布到GitHub.md」初始化。'
}

& $git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Fail '还没绑定远端仓库。先按「发布到GitHub.md」把 origin 加好，再回来双击。'
}
$remote = (& $git remote get-url origin).Trim()

Write-Step '将要提交的改动'
& $git status --short
if ($LASTEXITCODE -ne 0) { Fail 'git status 执行失败。' }

$lines = @(& $git status --porcelain)
if ($lines.Count -eq 0) {
  Write-Host ''
  Write-Host '没有新改动，不需要提交。' -ForegroundColor Yellow
  exit 0
}

# 防呆：照片 / 视频不该进仓库（仓库会瞬间胖十倍）
$risky = @()
foreach ($line in $lines) {
  if ($line.Length -lt 4) { continue }
  $path = $line.Substring(3).Trim().Trim('"')
  if ($path -match '\.(jpe?g|png|tiff?|bmp|heic|heif|webp|cr[23]|nef|arw|raf|dng|orf|rw2|srw|pef|mp4|mov|avi|mkv)$') {
    $risky += $path
  }
}
if ($risky.Count -gt 0) {
  Write-Host ''
  Write-Host ("注意：这次会提交 " + $risky.Count + " 个照片/视频文件，仓库会变大。") -ForegroundColor Yellow
  $risky | Select-Object -First 8 | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor DarkGray }
  if ($risky.Count -gt 8) { Write-Host ("  …还有 " + ($risky.Count - 8) + " 个") -ForegroundColor DarkGray }
  $ok = Read-Host '确定要提交吗？（输入 y 继续，直接回车＝取消）'
  if ($ok -ne 'y' -and $ok -ne 'Y') {
    Write-Host '已取消，什么都没改。' -ForegroundColor Yellow
    exit 0
  }
}

$default = '更新 ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
Write-Host ''
$msg = Read-Host ("这次改了什么？（直接回车＝" + $default + "）")
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = $default }

Write-Step '提交'
& $git add -A
& $git commit -m $msg
if ($LASTEXITCODE -ne 0) { Fail '提交失败（原因见上面几行）。' }

Write-Step '推送到 GitHub'
& $git push
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '推送失败。第一次推送可能需要在弹出的窗口/浏览器里登录授权，授权完再双击一次。' -ForegroundColor Red
  exit 1
}
& $git push --tags 2>$null | Out-Null

Write-Host ''
Write-Host '推送完成。' -ForegroundColor Green
Write-Host ("仓库：" + $remote)
exit 0