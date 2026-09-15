# 星脉 · 服务关系图谱 — 本地验证与截图脚本（真实浏览器证据生成器）
# 用法: powershell -ExecutionPolicy Bypass -File verify.ps1
# 产出: evidence\01-initial.png ~ 04-impact-all.png + DOM 断言报告（全部 PASS/FAIL 摘要）
# 依赖: 本机装有 Edge 或 Chrome（Windows 默认自带 Edge）；Node.js 可选（用于数据完整性检查）

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$evi  = Join-Path $root 'evidence'
New-Item -ItemType Directory -Force -Path $evi | Out-Null
$pass = 0; $fail = 0
function Check($name, $ok, $detail) {
  if ($ok) { $script:pass++ ; Write-Host ("  [PASS] {0} {1}" -f $name, $detail) -ForegroundColor Green }
  else     { $script:fail++ ; Write-Host ("  [FAIL] {0} {1}" -f $name, $detail) -ForegroundColor Red }
}

Write-Host "== 1. 浏览器探测 =="
$browsers = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Host "  [FAIL] 未找到 Edge/Chrome，无法生成浏览器证据" -ForegroundColor Red; exit 1 }
Check "browser" $true $browser

Write-Host "== 2. 数据完整性（Node 可选）=="
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $out = & node -e "global.window={};require(process.argv[1]);const g=window.GRAPH;const ids=new Set(g.nodes.map(n=>n.id));const bad=g.edges.filter(e=>!ids.has(e.s)||!ids.has(e.t));const dup=g.edges.length-new Set(g.edges.map(e=>e.s+'>'+e.t)).size;console.log(JSON.stringify({nodes:g.nodes.length,edges:g.edges.length,dangling:bad.length,dup:dup}))" (Join-Path $root 'data.js')
  Write-Host "  $out"
  $j = $out | ConvertFrom-Json
  Check "node-count"   ($j.nodes -eq 44)   "($($j.nodes))"
  Check "edge-count"   ($j.edges -eq 68)   "($($j.edges))"
  Check "no-dangling"  ($j.dangling -eq 0) ""
  Check "no-dup-edges" ($j.dup -eq 0)      ""
} else {
  Write-Host "  [SKIP] 未安装 node，跳过数据检查（浏览器 DOM 断言仍会执行）"
}

Write-Host "== 3. 真实浏览器截图 =="
$base = "file:///" + ($root -replace '\\','/') + "/index.html"
$shots = @(
  @{ f = "01-initial.png";      u = $base },
  @{ f = "02-follow-trail.png"; u = "$base#trail=order,inv" },
  @{ f = "03-radius3.png";      u = "$base#focus=price&r=3" },
  @{ f = "04-impact-all.png";   u = "$base#focus=pay&r=99" }
)
foreach ($s in $shots) {
  $out = Join-Path $evi $s.f
  $udd = Join-Path $env:TEMP ("hshot-" + [guid]::NewGuid().ToString('N').Substring(0,8))
  & $browser --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check `
    --user-data-dir="$udd" --window-size=1600,950 --virtual-time-budget=5000 `
    --screenshot="$out" $s.u 2>$null | Out-Null
  Start-Sleep -Milliseconds 400
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 20000)) { Check $s.f $true ("{0:N0} bytes" -f (Get-Item $out).Length) }
  else { Check $s.f $false "截图缺失或过小" }
  Remove-Item -Recurse -Force $udd -ErrorAction SilentlyContinue
}

Write-Host "== 4. DOM 渲染断言（--dump-dom）=="
$udd = Join-Path $env:TEMP ("hdom-" + [guid]::NewGuid().ToString('N').Substring(0,8))
$domFile = Join-Path $env:TEMP "xingmai-dom.html"
& $browser --headless=new --disable-gpu --no-first-run --user-data-dir="$udd" `
  --virtual-time-budget=5000 --dump-dom $base 2>$null | Out-File -Encoding utf8 $domFile
Start-Sleep -Milliseconds 400
$dom = Get-Content $domFile -Raw -Encoding utf8
Check "no-js-error"    ($dom -notmatch 'app-error') "（页面无 JS 错误横幅）"
Check "svg-viewbox"    ($dom -match 'viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"') ($Matches[0])
Check "panel-order"    ($dom -match '订单服务') ""
Check "panel-sections" (($dom -match '影响 · 谁依赖它') -and ($dom -match '依赖 · 它依赖谁')) ""
Check "header-stats"   (($dom -match '44</b> 节点') -and ($dom -match '68</b> 关系')) ""
Check "crumb-init"     ($dom -match '跟随路径') ""
$edgeCount = ([regex]::Matches($dom, 'class="edge[ "]')).Count
$nodeCount = ([regex]::Matches($dom, 'class="node[ "]')).Count
Check "edges-rendered" ($edgeCount -eq 68) "($edgeCount/68)"
Check "nodes-rendered" ($nodeCount -eq 44) "($nodeCount/44)"
Remove-Item -Recurse -Force $udd -ErrorAction SilentlyContinue

Write-Host ""
$color = 'Red'; if ($fail -eq 0) { $color = 'Green' }
Write-Host ("== 结果: {0} PASS / {1} FAIL — 截图在 {2} ==" -f $pass, $fail, $evi) -ForegroundColor $color
if ($fail -eq 0) { exit 0 } else { exit 2 }
