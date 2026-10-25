# ============================================================
# evidence/run-screenshots.ps1 — 方案 B 一键执行脚本
# 用法（PowerShell）：
#   powershell -ExecutionPolicy Bypass -File "E:\codex-prj\ab-worktrees\pi-matrix-m5p1\s3-e0\evidence\run-screenshots.ps1"
# 产出：evidence\shot-<at>.png 共 7 张（1440x900）
# ============================================================
$ErrorActionPreference = "Stop"

$root   = "E:\codex-prj\ab-worktrees\pi-matrix-m5p1\s3-e0"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$port   = 8437
$base   = "http://127.0.0.1:$port"
$shots  = @("initial","s01-done","gate","gate-error","executed","rolled-back","completed")

if (-not (Test-Path $chrome)) { throw "chrome.exe not found at: $chrome" }
if (-not (Test-Path (Join-Path $root "evidence\drive.html"))) { throw "drive.html not found" }

# --- 1) 静态服务器（端口已被占用则复用） ---
$alreadyUp = $false
try {
  $r = Invoke-WebRequest -UseBasicParsing "$base/index.html" -TimeoutSec 2
  if ($r.StatusCode -eq 200) { $alreadyUp = $true }
} catch {}
if (-not $alreadyUp) {
  Start-Process -WindowStyle Hidden python -ArgumentList '-m','http.server',"$port",'--bind','127.0.0.1' -WorkingDirectory $root
  Write-Host "server starting on $base ..."
}

# --- 2) 等待 200 ---
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing "$base/index.html" -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $ok) { throw "static server did not come up on $base" }
Write-Host "server up: $base (reused=$alreadyUp)"

# --- 3) 逐场景截图（Chrome headless，GUI 子系统不阻塞，用 Start-Process -Wait） ---
$profileDir = Join-Path $env:TEMP "chrome-headless-shots"
foreach ($at in $shots) {
  $out = Join-Path $root "evidence\shot-$at.png"
  if (Test-Path $out) { Remove-Item $out -Force }
  $cargs = @(
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--window-size=1440,900','--virtual-time-budget=8000',
    "--user-data-dir=$profileDir",
    "--screenshot=$out",
    "$base/evidence/drive.html?at=$at"
  )
  $p = Start-Process -FilePath $chrome -ArgumentList $cargs -Wait -PassThru -WindowStyle Hidden
  if ($p.ExitCode -ne 0) { Write-Warning "chrome exit code $($p.ExitCode) for $at" }
  if (-not (Test-Path $out)) { throw "screenshot not produced: $out" }
  Write-Host ("OK  {0}  ({1} bytes)" -f $out, (Get-Item $out).Length)
}

Write-Host ""
Write-Host "Done. 7 screenshots in $root\evidence"
Write-Host "Note: python http.server on port $port left running (per brief: 保持运行无妨)."
Write-Host "      To stop it later: Get-NetTCPConnection -LocalPort $port | Select -Expand OwningProcess | %% { Stop-Process -Id \$_ }"
