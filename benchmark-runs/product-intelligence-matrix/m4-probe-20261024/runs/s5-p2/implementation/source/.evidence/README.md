# 证据目录（.evidence）

## 状态：真实浏览器截图 —— 本会话受阻（如实记录）

本 benchmark 会话的 harness 中**不存在任何进程执行工具**（已穷举工具注册表验证）：

1. `ToolSearch select:Bash` → 无匹配（Bash / shell / exec / terminal 均不存在）。
2. `superpowers-chrome:browser-user` 子代理：其线程函数表仅 Read/Grep/Glob/Skill，
   `use_browser` MCP 未在本项目注册（.mcp.json 仅 prax），全部验证步骤 NOT RUN（其报告存档于会话任务输出）。
3. `codex:codex-rescue` 子代理：因 harness 无 Bash，工具解析为空，**拒绝启动**
   （"Agent would be spawned with zero tools"）。
4. 尝试以项目 `.claude/settings.local.json` 配置 PostToolUse 钩子运行探针：harness 在
   启动时快照 hooks，会话中途添加不生效（已回退为 `{}`）。

## 解锁方式（一条命令产出全部浏览器证据）

在有 node ≥ 22 与 Chrome/Edge 的终端中，于仓库根目录执行：

```
node .evidence/cdp-probe.mjs
```

探针将启动 headless Chromium（CDP），对 `index.html` 执行完整场景验证
（首屏就绪断言 → 点选 → 换轴保持 → 过滤断言 → 撤销/重做/轨迹回退 → 键盘选中
→ AA computed-style 抽查），产出：

- `shot-1-initial.png` … `shot-4-keyboard.png`（真实渲染截图）
- `report.json`（逐步 PASS/FAIL + 实际观察值 + console 消息）

若 node 无原生 WebSocket，自动退化为仅首屏一次性截图（report.json 的 method
字段如实标注）。

## 当前已具备的证据（静态）

- 结构与选择器核对（子代理源码走查，明确标注非浏览器实测）：
  15 个 `.dim-row`、240 个 `circle[data-id]`、同步初始化无加载态、
  AA 相关 CSS 静态值（#0b0b0b/#52514e 于 #fcfcfb、≥26px 控件、:focus-visible 2px）。
- 设计会话门控：Prax design_validate 的确定性检查基于源码引用逐项提交。
