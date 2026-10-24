# 维度探针 Dimension Probe — cell-j13-s10 (explore × dimensional-space)

单页多维数据探索工具。对应基准格 `cell-j13-s10`：**explore × dimensional-space**，
主对象 dataset，验收种子「过滤/投影状态有归属且可回退」，成功标准「维度切换不重置认知」。

## 运行

无构建、零依赖、无外部服务：直接双击打开 `index.html`（`file://` 静态打开即可，
已用真实 Chrome headless 验证），或任意静态服务器：

```
index.html        入口（首屏即就绪，无加载态）
styles.css        设计令牌 + 布局（WCAG 2.2 AA 底线，见 tools/contrast-check.mjs）
data.js           Atlas-240 内联合成数据集（240 记录 × 9 维度，字面量，零请求）
app.js            全部逻辑（无框架，经典脚本，ES5 风格 IIFE）
tools/            数据生成器 / 真实浏览器证据驱动 / 对比度检查
evidence/         真实 Chrome 旅程截图 + 状态指纹 + 断言（evidence.json）
```

重新生成数据或证据（可选）：

```
node tools/gen-data.mjs       # 重新生成 data.js（seed 固定，输出确定）
node tools/contrast-check.mjs # AA 对比度回执（16 对 token 全部 ≥4.5:1）
node tools/evidence.mjs       # 启动 headless Chrome，跑完整用户旅程并出证据
node tools/measure.mjs        # prax-measure 规范回执（布局/对比度/焦点序/目标尺寸实测）
```

## 设计要点

- **维度切换不重置认知**：状态为单对象 `{projection, filters, colorBy, selection}`，
  子空间正交；切轴只写 `projection`，永不触碰 `filters/selection`（机制保证，非 UI 承诺）。
- **状态有归属且可回退**：每个动作生成带标签的不可变快照入探索轨迹（探索轨迹面板）；
  单击任意步骤一步恢复该完整状态；撤销/重做（Ctrl+Z / Ctrl+Shift+Z）同样可用；
  时间旅行后新动作按标准语义截断重做分支。
- **过滤/投影全内联可见**：活跃过滤、可见计数（可见 92/240）、轴绑定全部在屏呈现，
  不藏 tooltip；被过滤排除的记录以淡灰点保留在画布上（上下文不丢失）。
- **Overview → Filter → Detail**：散点画布（dominant）→ 维度/着色选择器 + 过滤轨 →
  选中记录全维度向量 inspector。
- **AA 底线（H-23）**：正文/次级文本 ≥12px；muted 文本用 slate-600 级（7.5:1），
  从不使用 slate-300/400 级文本；焦点环永不剥离（`:focus-visible` 2px 双色描边）；
  交互目标 ≥24px（按钮 28px、滑块 28px、chips 26px）。
- 键盘等价：全部控件原生可聚焦；画布 Tab 可达，方向键浏览记录、回车选中、Esc 取消；
  空态/选中/计数变更经 `aria-live` 播报。

## 真实浏览器证据

`evidence/evidence.json` 记录 headless Chrome（1680×1050）中 10 步真实输入旅程
（CDP 原生鼠标/键盘事件 + 真实 DOM 事件），每步含状态指纹与断言，全部通过、
零控制台错误。关键断言：

- S1 首屏即用：加载完成即 ready，240/240 可见，无加载态
- S5 维度切换保认知：切 Y 轴后 filter/selection/可见计数逐项不变
- S6/S7 回退：撤销两步后过滤保留；单击轨迹首步一步回到初始完整状态
- S8/S9 空态：过滤排空全部记录时显示引导，一键恢复
