# 取证指引（browser evidence）

> 本工作区构建会话未挂载 shell / 浏览器执行工具（已经 ToolSearch select: 验证），
> 因此未随附真实浏览器截图。应用零依赖，以下命令可在任意 Windows 10 终端直接
> 复现并截图取证（Edge 内置于 Windows 10；Chrome 将 msedge 换成 chrome 即可）。

## 1. 首屏即用态（无加载态）

```powershell
msedge --headless=new --disable-gpu --window-size=1440,900 --screenshot="$PWD\shot-01-initial.png" "file:///$($PWD -replace '\\','/')/index.html"
```

预期：三栏布局一次成型 —— 左：7 个发布窗口时间轴（v2.8.0→v2.9.1）；中：最新窗口
v2.9.1 的 10 张服务卡片（legacy-report 灰显"已于 v2.9.0 下线"）；右：本窗口 3 项变更 +
因果链提示。顶栏绿色徽章：`✓ 时间-因果一致性校验通过 · 21 项变更 · 4 条因果链`
（该校验在每次加载时对因果序与修改 from 现场值做全量校验，失败即变红并列出控制台）。

## 2. 事故窗口的内联 diff（时间-语义一致）

```powershell
msedge --headless=new --disable-gpu --window-size=1440,900 --screenshot="$PWD\shot-02-incident.png" "file:///$($PWD -replace '\\','/')/index.html?w=2"
```

预期：中栏 order/notify 等卡片出现蓝色 `旧值 → 新值` 内联差异；左栏 w2 错误率
0.42% 标红，与 INC-2201 事故窗口对齐。

## 3. 因果链跨时间高亮（变更因果可读）

```powershell
msedge --headless=new --disable-gpu --window-size=1440,900 --screenshot="$PWD\shot-03-trace.png" "file:///$($PWD -replace '\\','/')/index.html?c=c05&trace=1"
```

预期：右栏展开因果链 c05(§v2.8.2)→{c08→c21, c09→c14→c20}，节点窗口时间严格递增；
中栏涉及的 4 张服务卡琥珀色高亮、其余压暗；左栏涉及窗口琥珀描边；顶部出现
"因果链追踪中 · 6 项变更 · 跨 4 个窗口"横幅。

## 4. 渲染后 DOM 验证（证明 JS 执行且无加载态）

```powershell
msedge --headless=new --disable-gpu --dump-dom "file:///$($PWD -replace '\\','/')/index.html" > dom-dump.html
Select-String -Path dom-dump.html -Pattern "一致性校验通过|tl-item|svc-name" | Select-Object -First 5
```

交互行为（点选变更、回放按钮、←/→/Esc）可在普通浏览器打开 index.html 手动复核；
深链参数 `?w=0..6&c=c01..c21&trace=1` 可直达任意交互态。
