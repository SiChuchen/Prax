# 切换指挥台 · Cutover Console

**cell-j10-s09（complete × consequential-flow）**：单一高后果流程的零失误执行台。
主对象：workflow（生产数据库迁移切换 runbook，CHG-2026-0912）。
用户任务：**complete** —— 零失误走完全程；验收种子：**不可逆步骤有恢复/确认路径**。

## 打开方式（零依赖，无构建）

直接双击打开根路径 `index.html`（file:// 协议即可），或任意静态服务器托管本目录。
纯原生 HTML/CSS/JS：非 ES module、无 CDN、无外链、无 fetch —— 初始数据内联于 `js/data.js`，
页面加载完成即为可用状态（无加载态、无骨架屏）。

```
index.html          入口（主屏 1 个）
css/app.css         token 化样式（spacious 低密度）
js/data.js          内联运行数据（4 阶段 · 12 步骤 · 24 检查项 · 3 个不可逆步骤）
js/app.js           运行时（状态机 / 渲染 / 护栏 / 恢复向导）
_evidence-driver/   取证驱动器（非产品代码，见下文「浏览器取证」）
```

## 零失误主线（对应验收种子）

- **向导式强制推进**：前序步骤未完成则后序锁定；漏检提交、越序点击、确认码错误一律被
  **护栏拦截**（红幅提示 + toast + 头部计数 + 执行日志留痕），拦截不产生任何状态变更。
- **确认路径**（S7/S8/S12 不可逆步骤）：提交前弹出确认对话框 —— 后果说明 + 恢复路径摘要 +
  手动输入确认码（`GO-NEWDB` / `UNFREEZE-OK` / `RETIRE-OLD`），错码不生效。
- **恢复路径**（同三个不可逆步骤）：右栏检查器常驻展示恢复程序与恢复窗口（15 分钟 / 30 分钟 /
  24 小时，演示语义倒计时）；执行后可启动**恢复向导**（回滚检查项 + 恢复确认码 `RECOVER`），
  完成后该步骤回到待执行态、其后步骤重新锁定，全程留痕。
- **完成凭证**：12/12 步后出现「全程零失误完成」凭证（步骤 / 检查项 / 不可逆确认 / 恢复演练 /
  护栏拦截统计 + 拦截记录或「全程零拦截」空态），支持日志导出（.json 下载）与复制。
- **键盘可达**：全部交互为原生 button/input/checkbox，`:focus-visible` 焦点框可见，Esc 关闭模态，
  模态内 Enter 提交。

## 浏览器取证（真实浏览器截图程序）

本仓库交付环境的执行会话中没有可用的 shell / 浏览器工具，因此**未生成任何截图，
本 README 不做任何视觉断言**。取证已脚本化：`_evidence-driver/driver.html` 以 iframe 加载应用、
用真实 DOM 事件驱动到目标状态（不做状态注入），左上角徽标实时显示 JS 错误与结束态摘要。

在装有 Chrome/Edge 的机器上逐条执行（PowerShell，`$B` 为浏览器路径）：

```powershell
$B = "C:\Program Files\Google\Chrome\Application\chrome.exe"  # 或 msedge.exe
$O = "E:\codex-prj\ab-worktrees\pi-matrix\cell-j10-s09-b\evidence"
$P = "file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j10-s09-b"
mkdir $O -Force
# 01 首屏（无参数直开应用）
& $B --headless=new --disable-gpu --hide-scrollbars --window-size=1600,1000 --screenshot="$O\01-first-paint.png" "$P/index.html"
# 02–08 驱动器各状态（case 见 _evidence-driver/driver.html 注释）
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=12000 --screenshot="$O\02-guard-locked-step.png"   "$P/_evidence-driver/driver.html?case=2"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=25000 --screenshot="$O\03-confirm-modal.png"      "$P/_evidence-driver/driver.html?case=3"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=30000 --screenshot="$O\04-guard-wrong-code.png"   "$P/_evidence-driver/driver.html?case=4"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=40000 --screenshot="$O\05-recovery-wizard.png"    "$P/_evidence-driver/driver.html?case=5"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=50000 --screenshot="$O\06-recovered-state.png"    "$P/_evidence-driver/driver.html?case=6"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=60000 --screenshot="$O\07-completion.png"         "$P/_evidence-driver/driver.html?case=7"
& $B --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1600,1000 --virtual-time-budget=15000 --screenshot="$O\08-keyboard-focus.png"     "$P/_evidence-driver/driver.html?case=8"
```

判读要点：① `01` 应直接呈现完整控制台（无加载指示）；② `02/04` 徽标含 `guard=护栏拦截 N（N≥1）`；
③ `06` 徽标应显示 `step=流量切换至新库 | modal=closed | done=7/12 步`（S7 已回滚待执行、S8–S12 重锁）；
④ `07` 徽标应显示 `(completion view)`；⑤ 任何一张出现红色徽标 `JS错误!` 即为失败。
（旧版浏览器不支持 `--headless=new` 时改用 `--headless`。）

## 验证状态（如实记录）

- 静态核验：`index.html` 挂载点 id 与运行时一一对应；`app.js` / `data.js` 逐行走查
  （括号闭合、事件委托路径、状态机迁移、模态 `[hidden]` 样式覆盖问题已修复）。
- 运行时核验：见上方取证程序 —— 交付会话环境无法执行浏览器，该部分**待执行**，
  driver 的 8 个 case 即为最小回归集。
- Prax 设计会话：`ds_20260908185319_49573e7a`（greenfield；frame → context → route → inspect →
  decide → sdir → reconcile → realize(direct_code) → prepare → validate 全门序留痕于 `.prax/`）。

## 预算

wall-clock 与 token 见最终交付报告；超出即停的约定未被触发。
