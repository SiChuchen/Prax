# 证据采集脚本（可选运行 —— 需要任意具备 shell 的会话或人工执行）
# 应用本体不依赖本脚本：index.html 可直接以 file:// 静态打开（无模块、无请求）。
#
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File evidence\run.ps1
# 产物：evidence\shot-1-initial-file-open.png      —— file:// 直接打开的首屏初始态
#        evidence\shot-2-after-interaction.png     —— 过滤 + 切换投影 + 孤儿过滤器 + 行选中
#        evidence\shot-3-numeric-breakdown.png     —— 数值维度分箱投影 + 渠道细分堆叠
#        evidence\scenario3-dom.html               —— S1–S17 行为断言文本（真实浏览器执行）
#        evidence\scenario4-dom.html               —— N1–N4 断言文本

$ErrorActionPreference = "Continue"
$wd = "E:\codex-prj\ab-worktrees\pi-matrix\cell-j13-s10-b"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ud = "$wd\evidence\chrome-profile"
$urlRoot = "file:///" + ($wd -replace '\\', '/')
$common = @('--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',"--user-data-dir=$ud")

# --- Shot 1: file:// 直接静态打开（首屏初始态，同时验证静态打开约束） ---
& $chrome @common --window-size=1600,900 --virtual-time-budget=4000 `
  --screenshot="$wd\evidence\shot-1-initial-file-open.png" "$urlRoot/index.html" 2>$null | Out-Null
Write-Output "shot1 done"

# --- Shot 2: 交互后状态（S1–S17 断言后停留：过滤 + 投影切换 + 孤儿过滤器 + 行选中） ---
& $chrome @common --window-size=1600,900 --virtual-time-budget=8000 `
  --screenshot="$wd\evidence\shot-2-after-interaction.png" "$urlRoot/evidence/scenario3.html" 2>$null | Out-Null
Write-Output "shot2 done"

# --- Shot 3: 数值维度分箱投影 + 细分堆叠 ---
& $chrome @common --window-size=1600,900 --virtual-time-budget=8000 `
  --screenshot="$wd\evidence\shot-3-numeric-breakdown.png" "$urlRoot/evidence/scenario4.html" 2>$null | Out-Null
Write-Output "shot3 done"

# --- 行为断言文本（真实浏览器执行结果） ---
& $chrome @common --virtual-time-budget=8000 --dump-dom "$urlRoot/evidence/scenario3.html" 2>$null |
  Out-File -FilePath "$wd\evidence\scenario3-dom.html" -Encoding utf8
& $chrome @common --virtual-time-budget=8000 --dump-dom "$urlRoot/evidence/scenario4.html" 2>$null |
  Out-File -FilePath "$wd\evidence\scenario4-dom.html" -Encoding utf8
Write-Output "dom dumps done"
