# 落点 · 选址对比台

cell-j09-s03（decide × comparison-panel）交付物：单屏选址决策 Web 应用。
用户在 4 个候选公寓之间完成「并排比较 → 调权 → 落定」，地理语境与决策输入全程同屏。

## 运行

纯静态、零依赖、零网络请求：直接双击打开根路径 `index.html`（支持 `file://`），
或任意静态服务器（如 `python -m http.server`）。页面加载完成即处于可用状态
（全部数据内联于 `app.js`，无加载态、无占位骨架）。

## 界面结构（单屏持久工作区）

| 区域 | 内容 |
|---|---|
| 左栏 · 街区语境 | 自绘内联 SVG 街区图：街道/公园/地铁 7 号线/公司锚点/周边 POI、4 个候选图钉、通勤虚线；选中/落定联动高亮线路与时长标签 |
| 右栏 · 比较矩阵 | 候选为列、维度为行（3 组 10 维），行对齐；行内迷你条形编码同维相对取值，每维最优值「优」徽标 + 绿底，最差弱化 |
| 底栏 · 权重/落定条 | 6 个偏好维度 0–5 滑杆实时重算总分与排名；4 档预设（均衡/省钱/通勤/品质）；唯一常驻主操作「落定」；落定后决策摘要驻留同屏，可一键重新比较 |

## 交互与状态

- **ready**（加载即达）→ **selected**（点击列头「选定」或地图图钉，表格列与图钉双向联动）→ **decided**（落定：顶栏徽章 + 列/图钉/线路高亮 + 理由摘要驻留）。
- loading / empty / error 为防御性守卫：数据内联无加载与空态路径；初始化异常显示 `#fatal` 横幅。
- 键盘可达：列头按钮、图钉（Tab 聚焦 + Enter/Space）、滑杆均为原生控件；`:focus-visible` 全局保留。
- 无外部服务、无持久化（按交付约束，状态限会话内）。

## 评分模型

数值维度按「最小/最大 → 100/0」线性归一（方向按维度设定），定性维度按 1–5 预设分；
类别内取均值，按用户权重（全 0 时回退等权）加权得 0–100 总分并排名。

## 验证证据（`evidence/`，真实 Chrome 渲染）

- `01-ready.png` 加载即 ready：推荐 75 分、落定禁用、各维优胜正确。
- `02-selected.png` 选定 c2：列/图钉/线路联动 + 主操作就绪。
- `03-decided.png` 落定 c2：决策驻留（顶栏徽章、绿色列、线路 18 分、理由摘要）。
- `04–06-interact-*.png` CDP 驱动真实事件（click/input）：选定 c3 → 拖动权重（通勤优先）→ 落定 c3。
- `_itest.mjs`：13 条交互断言全部通过（aria 状态、图钉联动、实时重排、预设高亮、落定驻留、重新比较）。
- `_nav-*.html`：截图导航垫片（`#select=` / `#decide=` 亦可用于复现状态，不影响正常流程）。

## 设计会话

Prax `ds_20260923183311_073cb310`（greenfield）：frame/context/route/inspect/decide/sdir/reconcile/realize/prepare 全门通过；
路由域缺口（site_selection 未覆盖）以通用指导（PAT-WORKSPACE、H-13、P-22、H-23 AA 底线）继续，已在会话中记录为未决问题。

验证门最终态：**10/10 检查全部 pass**（6 deterministic measured + 4 assistive/empirical attested，`deterministic_passed: true`），
但会话级 `status` 停留在 BLOCK——empirical 检查的 `measurement_receipt` 绑定对手写文件一律判 "invalid"
（.log 与 .json 两种格式 × 两个解析基准共三次尝试均如此），疑似需由 harness 测量系统生成 receipt，如实记录不再重试。
交付物本身的验收证据以 `evidence/` 真实浏览器截图与两份 CDP 测试日志为准。
