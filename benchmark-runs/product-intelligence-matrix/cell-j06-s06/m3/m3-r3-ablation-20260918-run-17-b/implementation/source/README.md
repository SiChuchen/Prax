# AURORA 变更时间轴 · cell-j06-s06

理解随时间演化的系统状态：**变更因果沿时间正方向可读**，时间游标下可检查任一时刻的状态快照。
（benchmark cell：understand × temporal-sequence · 主对象 change_set · 验收种子「时间结构与变更语义一致」）

## 运行

无构建、无依赖、无外部服务。直接双击打开 `index.html`（经典脚本，`file://` 协议可用），
或任选静态服务器：

```
pwsh: python -m http.server 8000   # 或 npx serve
打开 http://localhost:8000
```

页面加载完成即处于可用状态：数据内联于 `data.js`，首屏同步渲染，无加载态。

## 界面（单屏 · 三面板 Workspace）

| 区域 | 职责 |
|---|---|
| 变更时间轴（dominant） | 18 个变更事件按时间正序、按天分组；左轨因果连线恒指时间下游；行内含类型徽标、影响组件、起因/导致 chips |
| 事件检查器（primary） | 选中事件的字段级「前值 → 后值」明细与因果上下文，chips 可跳转并高亮整条因果链 |
| 状态快照（supporting） | 时间游标处全部组件字段值 = 游标前事件按序折叠（后者覆盖同字段）；选中事件的改动高亮 |
| 工具条（contextual） | 事件类型过滤（兼图例，glyph+label 双编码）、组件过滤 |

## 一致性保证（验收种子）

- 渲染前自检：因果边必须 `source.ts < target.ts`（时间正向）；每条变更的 `from` 必须
  等于折叠到该事件时的字段值（快照语义一致）。自检结果常驻头部
  （「自检 ✓ 18 事件 · 11 条因果边全部时间正向 · 22 处字段前值与折叠一致」），失败则显示错误横幅。
- 游标快照由 `stateAt(idx)` 纯函数折叠，任意时刻可机械复算。
- 过滤只影响可见性，不改变折叠输入（快照恒用全量事件序）。

## 键盘

`↑/↓`（或 `j/k`）选择事件 · `C` 游标对齐选中事件 · `Home/End` 游标起止 · `Esc` 取消选择。
Tab 停靠点：过滤 chips / 组件选择 / 重置 → 事件检查器（容器，`↑/↓←/→` 在因果 chips 间漫游，
`Enter` 激活）→ 时间游标滑杆与按钮 → 当前选中事件行（列表框漫游模式）。所有停靠点焦点可见。

## 深链参数

`#e10` 选中事件 · `#c=8` 设置游标（-1 = 窗口起点） · `#f=incident,rollback` 类型过滤。

## 结构

```
index.html   入口（三面板骨架）
styles.css   深色主题；分类色 3 槽位经校验器验证；状态色固定并恒以 icon+label 出现
data.js      内联数据集（组件/字段/事件/因果边）+ 不变式说明
app.js       自检、折叠、渲染、因果连线（SVG）、选中链高亮、过滤、游标、键盘
evidence/    真实浏览器截图（headless Chrome / CDP 交互取证）
```

设计过程走 Prax 门（frame/context/route/inspect/decide/sdir/reconcile/realize/prepare/validate），
会话 `ds_20260923212452_56b24745`，模式 greenfield · direct_code。
