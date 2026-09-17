# 证据状态说明（如实记录）

## 现状

**本工作区当前不含 PNG 截图。** 构建本应用的 agent 会话没有任何执行原语：

- 会话工具注册表中不存在 Bash / 终端工具（`ToolSearch select:Bash` 与全部
  关键词检索均无结果）；
- 委派子代理全部继承同一受限工具集：`general-purpose`（tools:*）自证无 shell；
  `codex:codex-rescue`（声明 Tools: Bash）在生成时被框架拒绝（`unrecognized [Bash]`）；
  `superpowers-chrome:browser-user` 的 `use_browser` MCP 工具未绑定；
- 因此 headless Chrome / Edge 无法被启动，真实浏览器截图无法在本会话产生。
  以上排查过程由独立子代理穷举完成并复核。

诚实边界：本目录内的**功能与视觉结论仅经过静态源码核验**（逐状态 diff 见下），
未经真实浏览器渲染确认。不虚构任何截图。

## 补采方式（一条命令）

```powershell
powershell -ExecutionPolicy Bypass -File .\capture-evidence.ps1
```

将用本机 Chrome/Edge headless 生成 8 张 1680×1000 截图到本目录。

## 预期状态断言（供补采后 diff）

| # | 文件 | URL hash | 预期 |
|---|---|---|---|
| 1 | 01-initial-ready.png | （无） | 默认聚焦 dws_trade：白圈焦点 + 5 个上游青圈 + 8 个下游橙圈，其余 10 节点弱化；检查器显示对象详情与影响半径统计（2 跳列高亮）；徽标「高亮 14 节点 · 15 关系」 |
| 2 | 02-follow-trail.png | `#p=dws_trade.m_gmv.bi_trade&d=1` | 面包屑 3 枚 chip（末枚 current）；焦点 bi_trade（叶子）：仅 1 跳上游 m_gmv 青圈；下方列表显示「无 1 跳下游」空态文案 |
| 3 | 03-full-chain.png | `#p=dws_trade&d=a` | 「全链路」分段按钮高亮；影响半径卡片全链列高亮（此图 2 跳已覆盖全链：14 节点 · 15 关系） |
| 4 | 04-edge-detail.png | `#p=dws_trade&e=e15` | e15 = m_gmv→dws_trade（派生计算 ⚑）金色加粗 + 标签；两端虚线圈；其余 opacity 0.3；检查器为关系详情（两端卡片 + 类型/关键度/说明） |
| 5 | 05-home-empty.png | `#h=1` | 全图原样无弱化；检查器为全景引导 + 枢纽列表 + 键盘说明；面包屑「未聚焦」；徽标「全部可见」 |
| 6 | 06-error-state.png | `#p=no_such_node` | 红色错误框「未找到对象 no_such_node」；图回退全量可见 |
| 7 | 07-type-filter.png | `#p=svc_rec&d=2&off=call,derive` | 33 条边中 10 条（call+derive）隐藏；chip「调用依赖」「派生计算」划线半透明；svc_rec 无可见关系（列表空态） |
| 8 | 08-kbd-search-focus.png | `#p=dws_trade&d=2&kb=1` | 同 1，且搜索框获得焦点环（青色描边 + 辉光） |

## 静态核验已确认（源码级）

- 24 节点 / 33 关系全部常驻渲染；聚焦态非相关元素 opacity 0.12（弱化不移除）；
  节点坐标在跟随过程中不重算（orientation invariants）。
- 同步初始化（app.js 末尾 `layout(); buildGraph(); renderLegend(); apply(init);`），
  无任何 loading UI——首屏即 ready。
- 全部 8 个 hash 状态在代码层路径唯一、无 JS 运行时错误源（无 fetch/网络依赖，
  所有 getElementById 目标存在于 index.html）。
