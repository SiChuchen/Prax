# 发布关口 · Release Gate

**cell-j10-s09（complete × consequential-flow）**——一个帮助用户**零失误走完高后果流程**的单页 Web 应用。

用户任务是 *complete*（完成）一个高后果对象：一次生产发布（订单服务 order-service v2.4.0，变更单 CHG-8842）。流程含 3 个阶段、7 个步骤、21 个核验项，其中 **3 个不可逆步骤**（数据库迁移 / 全量切换 / 关闭归档）——每个不可逆步骤都有**确认门**（提交前）与**恢复点**（提交后），对应验收种子「不可逆步骤有恢复/确认路径」。

## 运行

零依赖、无构建。直接用浏览器打开根路径 `index.html` 即可（file:// 或任意静态服务器均可）：

```powershell
# 任选其一
start index.html
python -m http.server 8000   # 然后 http://localhost:8000/
```

页面加载完成即处于可用状态：初始流程数据以 JS 常量内联（`app.js` 顶部 `WORKFLOW`），脚本执行即同步完成首屏渲染，**没有加载态**。

## 零失误如何被保证

| 机制 | 拦截的错误 |
|---|---|
| 顺序锁：前置未完成则后继步骤锁定，详情区只读 | 跳步 |
| 核验清单：全部勾选才解锁主操作按钮 | 漏项 |
| 确认门（不可逆提交）：模态明示后果与将生成的恢复点，需勾选「我已理解」+ 输入步骤口令（`MIGRATE` / `CUTOVER` / `CLOSE`） | 误触不可逆动作 |
| 恢复点：不可逆提交成功**自动创建**提交前状态快照，右栏常驻可见 | 提交后无法回退 |
| 恢复确认：恢复动作本身也有确认门，回退写入执行记录；被更新的恢复点自动标记「已被取代」 | 恢复被滥用 / 无从追溯 |
| 执行记录：勾选、提交、恢复、重置全部留痕（时间戳） | 无法审计 |

## 交互

- 左栏：阶段 → 步骤导航器（锁定/当前/完成/已提交，⚠ 不可逆标识，恢复点标签）
- 中栏：当前步骤详情（背景说明、核验清单、后果与恢复预案、主操作）
- 右栏：恢复点台账（恢复路径常驻入口）+ 执行记录
- 键盘：Tab / ↑↓ 在步骤间移动（`focus-visible` 焦点环）、Space 勾选、Esc 关闭确认门、Enter 提交口令
- 「重启演练」可重置整个流程（需输入口令 `RESET`）

## 结构

```
index.html   静态骨架（语义地标：header/nav/main/aside/dialog）
styles.css   设计 token（CSS 变量）+ 组件样式，无外部字体/依赖
app.js       内联流程数据 + 状态机 + 渲染 + 事件委托
evidence/    真实浏览器（Edge headless, CDP）自动化走查的截图与 run.log
```

## 设计过程

本产品经 Prax 设计会话 `ds_20261025173453_6ecafa00`（greenfield）完成全部门禁并 **validate PASS（phase COMPLETE）**：
frame → context → route（PAT-LIST-DETAIL）→ inspect → decide（v0.2：wizard 表示 / spacious 密度 / 4 项 major choices）→ SDIR 0.2（含 representation / state_ownership / acceptance / complexity_budget）→ reconcile（6 项能力全部 frontend_composition，零 gap）→ realize（direct_code）→ prepare → validate（11/11 检查通过；Prax 自测回执 7/7 测量 PASS：对比度 / 焦点顺序 / 目标尺寸 / 溢出 / 碰撞 / 截断 / 最小字号）。
前置探索会话 `ds_20261025163914_5ea17139` 完成了路由与决策的首轮收敛及三轮真实浏览器测量修复（对比度、焦点顺序、目标尺寸、最小投影字号）。
