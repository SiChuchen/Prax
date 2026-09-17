# ============================================================
# PulseWall 证据采集脚本（一键）
# 用法: powershell -ExecutionPolicy Bypass -File evidence\collect.ps1
# 依赖: Windows 10+ 自带 Edge（或 Chrome）；node 可选；python 可选
# 产出: evidence\*.png 截图 + evidence\*.txt 文本证据(JSON)
# ============================================================
$ErrorActionPreference = 'Continue'
$ev    = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj  = Split-Path -Parent $ev
Set-Location $proj
Write-Host "=== PulseWall evidence collection ==="
Write-Host "project: $proj"

if (-not (Test-Path $ev)) { New-Item -ItemType Directory -Path $ev | Out-Null }

function Head($m) { Write-Host "`n--- $m ---" }

# ---------- 0. JS 语法检查（可选） ----------
Head "node --check"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  node --check (Join-Path $proj 'js\stream.js') 2>&1 | Tee-Object -FilePath "$ev\node-check.log"
  node --check (Join-Path $proj 'js\app.js')    2>&1 | Tee-Object -FilePath "$ev\node-check.log" -Append
  Write-Host "node --check done (see evidence\node-check.log)"
} else { Write-Host "node not found — skipped" }

# ---------- 1. 本地静态服务（python 可用则用 http，否则 file://） ----------
$base = $null
$py = Get-Command python -ErrorAction SilentlyContinue
$serverPid = $null
if ($py) {
  $p = Start-Process $py.Source -ArgumentList '-m','http.server','8137','--directory',$proj -WindowStyle Hidden -PassThru
  $serverPid = $p.Id
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:8137/index.html' -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $base = 'http://localhost:8137' }
  } catch { }
}
if (-not $base) { $base = 'file:///' + ($proj -replace '\\','/') }
Write-Host "base url: $base/index.html"

# ---------- 2. 浏览器定位（Edge 优先，Chrome 兜底） ----------
$browser = $null
foreach ($c in @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)) { if (Test-Path $c) { $browser = $c; break } }
if (-not $browser) { Write-Host "FATAL: no Edge/Chrome found"; if ($serverPid) { Stop-Process -Id $serverPid -Force }; exit 1 }
Write-Host "browser: $browser"

function Shot($scenario, $out, $budget) {
  $url = "$base/index.html" + $(if ($scenario) { "?scenario=$scenario" } else { '' })
  & $browser --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 `
    --virtual-time-budget=$budget --screenshot="$out" $url 2>$null | Out-Null
  if (Test-Path $out) { Write-Host ("OK  " + $out) } else { Write-Host ("FAIL " + $out) }
}
function Dump($scenario, $out, $budget) {
  $url = "$base/index.html" + $(if ($scenario) { "?scenario=$scenario" } else { '' })
  $dom = & $browser --headless=new --disable-gpu --virtual-time-budget=$budget --dump-dom $url 2>$null
  $dom | Out-File -FilePath $out -Encoding utf8
  $m = Select-String -Path $out -Pattern 'id="__evidence[^"]*"[^>]*>(\{.*?\})' -AllMatches
  if ($m) { foreach ($x in $m.Matches) { Write-Host ("EVIDENCE " + $x.Groups[1].Value) } }
  else { Write-Host "WARN no __evidence JSON in $out" }
}

# ---------- 3. 首屏 + 异常显著（加载即满数据，预置异常） ----------
Head "01 first screen / inline seed / anomaly strip"
Shot  $null '01-initial-anomaly.png' 9000
Dump  'boot' "$ev\boot.json.txt" 9000

# ---------- 4. 可追溯（检查器 + 带时间戳历史） ----------
Head "02 inspector traceability"
Shot  'inspect' "$ev\02-inspector-history.png" 9000
Dump  'inspect' "$ev\inspect.json.txt" 9000

# ---------- 5. 暂停态 ----------
Head "04 paused"
Shot  'paused' "$ev\04-paused.png" 6000
Dump  'paused' "$ev\paused.json.txt" 6000

# ---------- 6. 事件流过滤 ----------
Head "feed filter"
Dump  'filter' "$ev\filter.json.txt" 7000

# ---------- 7. 稳定性（30s 前后瓦片坐标零位移） ----------
Head "stability R1(10s) vs R2(42s)"
Dump  'stability' "$ev\stability-r1.json.txt" 12000
Shot  'stability' "$ev\06-stability-t2.png" 48000
Dump  'stability' "$ev\stability.json.txt" 48000

# ---------- 8. 真实键盘旅程（有头窗口 + OS 级按键） ----------
Head "keyboard journey (real keys)"
try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
  $prof = Join-Path $ev '.kbprofile'
  $p = Start-Process $browser -ArgumentList "--user-data-dir=$prof",'--new-window','--window-size=1500,960',"--app=$base/index.html" -PassThru
  Start-Sleep -Seconds 7
  $ws = New-Object -ComObject WScript.Shell
  [void]$ws.AppActivate($p.Id)
  Start-Sleep -Milliseconds 600
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}{TAB}{TAB}')   # btn-pause → btn-inject → 第一张瓦片
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')            # 选中 → 检查器打开
  Start-Sleep -Seconds 2
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$ev\03-keyboard-selection.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "OK  03-keyboard-selection.png"
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')              # 关闭检查器
  Start-Sleep -Seconds 1
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$ev\03b-keyboard-closed.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "OK  03b-keyboard-closed.png"
  Start-Sleep -Milliseconds 500
  & taskkill /PID $p.Id /T /F 2>$null | Out-Null
  Start-Sleep -Seconds 1
  if (Test-Path $prof) { Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue }
} catch { Write-Host ("keyboard journey failed: " + $_.Exception.Message) }

# ---------- 9. 收尾 ----------
Head "cleanup"
if ($serverPid) { Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue; Write-Host "server stopped" }
Head "artifacts"
Get-ChildItem $ev -File | ForEach-Object { Write-Host ("{0,10}  {1}" -f $_.Length, $_.Name) }
Write-Host "`n=== done ==="
