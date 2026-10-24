# 发布护航台 RunGuard — cell-j10-s09（complete × consequential-flow）

单页 Web 应用：引导用户**零失误走完**一条高后果流程（支付服务 v2.4.1 生产发布 runbook，
5 阶段 · 12 步 · 3 个不可逆操作），每个不可逆步骤都有**确认门 + 可真正走通的恢复路径**。

## 打开方式

直接双击打开根路径 `index.html`（file:// 静态直开，无需构建、无需服务器、无外部请求）。
或在任意静态服务器下打开（如 `python -m http.server` 后访问 `/`）。

页面加载完成即处于可用状态：runbook 数据以 JS 常量内联于 `data.js`，`app.js` 在 `DOMContentLoaded`
前同步完成初始化与首次渲染——**不存在加载态**（代码库无任何 spinner/skeleton 渲染路径）。

## 技术栈

原生 HTML / CSS / JavaScript（经典脚本，无框架、无构建、无 ES modules —— file:// 直开无 CORS 风险）。

| 文件 | 职责 |
|---|---|
| `index.html` | 入口骨架 |
| `data.js` | runbook 数据（内联、首屏就绪）：5 阶段 12 步、3 对 irrev/recovery 绑定 |
| `app.js` | 状态机 + 渲染（单一 state store；确认门 / 恢复中心 / 异常分支 / 审计） |
| `styles.css` | spacious 视觉系统（WCAG 2.2 AA 对比度、:focus-visible 焦点环） |

## 验收种子 → 实现

**不可逆步骤有恢复/确认路径**：

- **确认路径**：不可逆步骤（s7 `MIGRATE-2410` / s9 `CUTOVER-2410` / s11 `RETIRE-239`）
  需先勾完执行前确认项 → 打开确认门（后果清单 + 恢复预案预览）→ 键入步骤专属确认码 → 执行，全程落审计。
- **恢复路径**：执行前工作卡内可见恢复预案预览；执行后右侧**恢复中心**列出已执行未回滚项，
  可发起引导式回滚（回滚检查单 + 确认），多步骤按执行倒序；验证失败进入异常分支
  （重试 / 回滚最近不可逆操作 / 安全中止），禁止带病前行。
- **零失误走完全程**：结构性禁止跳步、检查项强制 n/m、验证门、全程时间戳审计、完成/安全中止总结卡。

## 会话状态

进度存于内存；另以 localStorage 同步恢复（刷新不丢进度，恢复是同步的、不产生加载态；
不可用时静默降级为内存态）。「重新开始」清空全部进度与审计（需确认）。

## 浏览器取证（真实浏览器截图）

`scripts/capture.js` 是零依赖的真实浏览器取证脚本（内置 CDP WebSocket 客户端，无需 npm install）：

```bash
node scripts/capture.js        # 需要本机 shell + Chrome/Edge
```

自动启动 headless Chromium，从 `file://` 打开本应用，走完三条路径并输出到 `evidence/`：
① 首屏就绪→检查门→确认门→执行不可逆→异常分支→回滚→安全中止；
② 重新开始→12 步全通→「✓ 零失误走完全程」+ 审计 JSON 导出；
③ Tab×5 键盘焦点环。共 9 张截图 + `assertions.json` + `capture-log.txt`。

> **本次交付的如实记录**：开发本应用的 harness 会话经穷尽验证**既无 shell 也无浏览器工具**
> （ToolSearch `select:` 全部命名变体、general-purpose 与 superpowers-chrome:browser-user
> 两类 subagent、Skill 授权路径均无 exec/browser 能力），故上述脚本**未能在会话内执行**，
> `evidence/` 下暂无截图产物。Prax validate 的 keyboard / hierarchy_review 两项据此如实标记
> inconclusive；其余 9 项检查（6 项 measured 全过 + 3 项 attested）已通过。在具备 shell 的
> 环境运行上面一条命令即可补齐全部视觉证据。

## Prax 设计会话

session `ds_20261024162025_fb317991`（greenfield），gate 全序列已通过：
frame → context → route → inspect → decide → sdir(0.2) → reconcile（0 gaps）→ realize（direct_code）
→ prepare → validate（plan → submit_evidence → evaluate；`deterministic_passed: true`）。

SDIR 0.2 内容已通过 `design_sdir(mode=validate)` lint（0 schema/semantic errors）；因 validate 模式
不落盘且变更工具在 VALIDATION 相被锁，该**已过审内容被原样转写**至
`.prax/design/sessions/ds_20261024162025_fb317991/screen.sdir.yaml`（文件内有 NOTE(transcription) 标注）。

## 预算（如实记录）

- wall-clock：约 90 分钟（其中约 25 分钟消耗于「无 shell/浏览器工具」的取证环境穷举与补救设计）
- token：约 0.66M / 1.2M 上限（详见会话记录）
