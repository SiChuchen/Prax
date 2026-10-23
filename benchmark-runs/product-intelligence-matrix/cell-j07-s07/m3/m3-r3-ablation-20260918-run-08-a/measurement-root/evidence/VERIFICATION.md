# 验证记录 — cell-j07-s07 · Locus 落位画布

日期：2026-09-19 · 全部证据来自真实 Chrome（headless, CDP 可信输入事件），无模拟断言。

## 运行方式

```powershell
python -m http.server 8321          # 静态服务（file:// 打开 index.html 同样可运行）
node tools\cdp-verify.mjs           # 22 项端到端断言 + 4 张截图，raw CDP，无外部依赖
```

`tools/cdp-verify.mjs`：启动隔离 profile 的 headless Chrome → `Input.dispatchKeyEvent /
dispatchMouseEvent` 发送**可信**键盘/鼠标事件 → `Runtime.evaluate` 读 DOM 断言 →
`Page.captureScreenshot` 存图。

## 结果：22 passed, 0 failed（最终运行原始输出见下方）

| 组 | 断言 | 结果 |
|---|---|---|
| A1 | 首屏即就绪：3 区 / 9 对象内联渲染、无加载态、状态栏「未选中」 | ✅ |
| A2 | `Tab` 循环选择：选中「竞品扫描笔记」 | ✅ |
| A3 | `→` 栅格步进 +20px；`Shift+→` 微调 +1px（60→80→81） | ✅ |
| A4 | `N` 创建并进入编辑、toast「已创建」、字符未漏进编辑器 | ✅ |
| A5 | 编辑态 `Ctrl+2` 提交编辑并落位→就位区 (580,60)、toast「落位 →」 | ✅ |
| A6 | `Ctrl+Z` ×2：先回滚落位、再删除新建对象 | ✅ |
| A7 | 删除→`Ctrl+Z` 撤销→`Ctrl+Y` 重做（8→9→8） | ✅ |
| A8 | 双击空白创建（鼠标路径）→`Esc` 取消→删除 | ✅ |
| A9 | 鼠标拖拽「竞品扫描笔记」→定稿区：类/徽标变 zone-locked、toast 落位提示 | ✅ |
| A10 | 空格+拖拽平移画布；滚轮缩放；`0` 复位 100%；`1` 适应全部（三区完整在视口内） | ✅ |
| A11 | `?` 开帮助面板（含「落位改区 Ctrl+1/2/3」行）、`Esc` 关闭 | ✅ |
| A12 | 全程无控制台错误 | ✅ |

## 截图（evidence/）

- `01-initial.png` — 首屏：三区 + 9 对象（像素校验：sky/amber/emerald 三色系齐全，无遮罩）
- `02-help.png` — `?` 帮助面板（校验：区色被遮罩压暗为 0）
- `03-after-rezone.png` — `N` + `Ctrl+2` 后对象落位就位区（琥珀区）
- `04-after-drag.png` — 拖拽落位定稿区后（emerald 色素占比最高，与落点一致）

## 活体测试揪出并修复的真实 bug

1. **`#help` 遮罩拦截全部点击**：作者样式 `#help{display:flex}` 覆盖 UA 的
   `[hidden]{display:none}`，帮助面板一直隐形盖在页面上。修复：`#help[hidden]{display:none}`。
2. **世界坐标偏移**：`#world{left:-600px;top:-400px}` 使实际屏幕映射与
   `screenToWorld` 假设相差 (600,400)，拖放落区判定/双击创建点/框选全部错位。
   修复：`#world` 归零并扩大画布（8000×6000）。
3. **`N` 把字符 "n" 打进刚打开的编辑器**：单键快捷键未 `preventDefault`。修复：
   单键快捷键统一吞默认行为。
4. **工具栏按钮抢焦点**：点击按钮后快捷键失效。修复：按钮点击后 `blur()`。
5. 编辑态下 `Ctrl+2` 被吞 → 改为「先提交编辑再放行修饰键组合」。

## 说明

- `?help=1` 为深链参数（分享/测试用），非必需。
- 键盘等价物全表见应用内 `?` 面板或 README。
