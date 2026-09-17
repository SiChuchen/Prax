# PulseWall · 指标值班墙（cell-j04-s04）

监控 **易变指标流** 的单页 Web 应用：高密度指标墙 + 异常聚拢条 + 变化追溯。
对应基准格：`monitor × volatile-evidence-stream`（many / low-relationality / medium-hierarchy /
high-temporality / high-density / high-volatility / low-uncertainty / no-comparison）。

## 运行

零依赖、零构建。任选其一：

- 直接双击打开 `index.html`（file:// 即可，全部脚本为普通 script，无 ES Module）
- 或起本地静态服务：`python -m http.server 8000` 后访问 <http://localhost:8000/>

页面加载完成即处于可用状态：24 个指标 × 90 采样点历史 + 既有事件随首屏内联生成
（确定性种子），**没有加载态**。加载后本地模拟流以 1Hz 持续推进，无任何外部服务。

## 一屏结构（PAT-LIST-DETAIL-INSPECTOR）

| 区域 | 作用 |
|---|---|
| 状态头 | 时钟、流心跳（1Hz）、暂停/恢复、注入异常 |
| 异常聚拢条 | 当前警告/严重指标按严重度排序聚合，扫视第一落点；全部正常时收敛为安静摘要 |
| 指标墙（dominant） | 4 域 × 6 指标固定瓦片网格：名称、当前值、60s Δ、sparkline、状态色边 |
| 检查器（选中时） | 大图走势（含警告/严重阈值带）、带时间戳的取值与状态跃迁历史 |
| 事件流 | 跨指标时间倒序事件（进入警告/升至严重/恢复正常/人工注入），可点击定位来源指标 |

## 验收种子如何被满足

- **异常在扫视内发现**：状态色彩编码（绿/琥珀/红）+ 顶部异常条聚拢，两处显著性通道，
  无需逐格扫描；加载即预置一个漂移中的异常（服务层·队列积压）。
- **指标变化可追溯**：点击任意瓦片/事件/异常条 → 检查器展示带时间戳的
  取值历史与状态跃迁链；事件流提供跨指标证据序列。
- **无闪烁噪声**：瓦片位置恒定不重排（异常只变色不加位移）；数值原位更新，
  仅超过噪声底的变化触发 500ms 短高亮后完全静止；状态机带滞回 + 最短驻留
  （升级即时、恢复需连续 3 拍确认 + ≥5s 驻留），杜绝阈值抖动。

## 操作

- 鼠标：点瓦片/异常条/事件 → 选中；`✕` 关闭检查器
- 键盘：`Tab` 移动焦点 → `Enter` 选中；`Esc` 关闭检查器；
  `Space` 暂停/恢复（焦点不在按钮时）
- `⚡ 注入异常`：向随机正常指标注入突刺/漂移（走与自然异常完全相同的检测管线）

## 代码

```
index.html      结构（5 区域语义标注）
css/style.css   暗色 wallboard 主题（状态四色 token，compact 密度）
js/stream.js    模拟流引擎：确定性 PRNG、24 指标、种子历史、
                滞回状态机、事件生成、异常注入、停流看门狗
js/app.js       视图：一次构建的固定网格、原位更新、异常条、
                检查器、事件流、键盘与暂停控制
```

不涉及后端、账号、持久化；不部署到任何外部服务。

## 浏览器证据采集（一键）

构建会话的执行环境没有可用的 shell/浏览器工具，截图证据未能当场采集。
补齐只需一条命令（任何有 PowerShell 的环境，Edge/Chrome 即可，无需联网）：

```powershell
powershell -ExecutionPolicy Bypass -File evidence\collect.ps1
```

产出（`evidence/` 目录）：首屏满数据与异常条截图、检查器追溯截图、暂停态截图、
键盘旅程截图（OS 级真实按键）、30s 前后瓦片坐标零位移对比 JSON（`STABILITY_PASS/FAIL`）、
boot/inspect/paused/filter 场景的 `__evidence` JSON dump。

另外：项目 `.mcp.json` 已注册 chrome MCP（superpowers-chrome 插件的本地 MCP server），
新开会话加载后可直接交互式驱动浏览器取证。`?scenario=boot|inspect|paused|filter|stability`
查询参数仅用于自动化取证，不影响正常使用。
