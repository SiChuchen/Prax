# 证据补采脚本（真实浏览器截图）
# 用法（PowerShell，需本机装有 Chrome 或 Edge）：
#   powershell -ExecutionPolicy Bypass -File .\capture-evidence.ps1
# 产物：evidence\01-initial-ready.png … 08-kbd-search-focus.png

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$evd = Join-Path $root "evidence"
New-Item -ItemType Directory -Force -Path $evd | Out-Null

$browsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Error "未找到 Chrome/Edge，请修改 `$browsers 路径"; exit 1 }
Write-Host "Browser: $browser"

$base = "file:///" + ($root -replace "\\", "/").TrimStart("/") + "/index.html"

$shots = @(
  @{ f = "01-initial-ready.png";     h = "" },
  @{ f = "02-follow-trail.png";      h = "#p=dws_trade.m_gmv.bi_trade&d=1" },
  @{ f = "03-full-chain.png";        h = "#p=dws_trade&d=a" },
  @{ f = "04-edge-detail.png";       h = "#p=dws_trade&e=e15" },
  @{ f = "05-home-empty.png";        h = "#h=1" },
  @{ f = "06-error-state.png";       h = "#p=no_such_node" },
  @{ f = "07-type-filter.png";       h = "#p=svc_rec&d=2&off=call,derive" },
  @{ f = "08-kbd-search-focus.png";  h = "#p=dws_trade&d=2&kb=1" }
)

foreach ($s in $shots) {
  $url = $base + $s.h
  $out = Join-Path $evd $s.f
  & $browser --headless=new --disable-gpu --hide-scrollbars --window-size=1680,1000 --virtual-time-budget=2500 --screenshot="$out" $url 2>$null
  if (-not (Test-Path $out) -or (Get-Item $out).Length -lt 30000) {
    & $browser --headless --disable-gpu --hide-scrollbars --window-size=1680,1000 --virtual-time-budget=2500 --screenshot="$out" $url 2>$null
  }
  if (Test-Path $out) { Write-Host ("OK  {0}  {1} KB" -f $s.f, [math]::Round((Get-Item $out).Length / 1KB)) }
  else { Write-Warning "FAIL $($s.f)" }
}
Write-Host "Done → $evd"
