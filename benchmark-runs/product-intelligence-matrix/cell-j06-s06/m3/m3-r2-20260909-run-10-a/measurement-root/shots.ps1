# 生成真实浏览器截图（无头 Chrome/Edge）— cell-j06-s06
# 用法：在项目根目录执行  powershell -ExecutionPolicy Bypass -File shots.ps1
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$out = Join-Path $root "shots"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$browsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)
$exe = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "未找到 Chrome/Edge，请把浏览器路径加进本脚本 `$browsers 列表" }
Write-Host "使用浏览器：$exe"

$base = "file:///" + ($root -replace '\\', '/') + "/index.html"

$shots = @(
  @{ n = "01-first-screen";        h = "" },
  @{ n = "02-incident-detail";     h = "#sel=c21&asof=29" },
  @{ n = "03-replay-mid-incident"; h = "#sel=c15&asof=15" },
  @{ n = "04-filtered-view";       h = "#sel=c13&asof=16&fc=paycore,notify,ledgerdb&ft=alert,report,recover" }
)

foreach ($s in $shots) {
  $png = Join-Path $out ($s.n + '.png')
  $url = $base + $s.h
  & $exe --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check `
    --user-data-dir="$env:TEMP\cs-headless-prof" --window-size=1680,950 --virtual-time-budget=3000 `
    --screenshot="$png" "$url" 2>$null | Out-Null
  if (Test-Path $png) { Write-Host "OK  $($s.n).png" } else { Write-Warning "失败：$($s.n).png" }
}
Write-Host "完成。截图目录：$out"
