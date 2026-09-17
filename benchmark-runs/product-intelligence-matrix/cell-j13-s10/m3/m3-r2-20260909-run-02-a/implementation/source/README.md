# 星穹棱镜 Prism · 系外行星多维探索台

cell-j13-s10（explore × dimensional-space）交付物。纯静态单页应用，无构建、无外部服务、无后端。

## 打开

浏览器直接打开根目录 `index.html`（file:// 即可，双击亦可用）。

- 页面加载完成即处于可用状态：460 颗系外行星（300 个恒星系统）由确定性种子
  （`js/data.js`，mulberry32, seed=20260902）**同步**生成，随首屏就绪，无任何加载态。
- 布局：左侧维度货架 · 中部散点主屏 · 右侧认知锚点/详情 · 底部状态归属条。

## 验证

1. **页内自检**：打开 `index.html?selftest=1` → 页面浮层运行 13 条断言并显示
   通过数。覆盖：数据完备性、过滤语义、**维度切换不重置认知（选中/过滤保持）**、
   **过滤状态归属（维度名+谓词+来源标签）**、撤销/重做/时间线跳转回退。
2. **交互状态取证**：打开 `index.html?demo=1&lens=近温样本` → 自动执行一段真实
   交互（直方图区间过滤 + 类别勾选 + 框选 14 条 + 固定 2 条 + Y 轴切至地球相似度
   + 展开历史抽屉），供截图取证。
3. **截图命令**（无头 Edge；Chrome 同理替换路径）：

```
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1680,1000 --screenshot=shots\01-initial.png "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j13-s10-a/index.html"
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1680,1000 --virtual-time-budget=3000 --screenshot=shots\02-demo.png "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j13-s10-a/index.html?demo=1&lens=近温样本"
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1680,1000 --virtual-time-budget=3000 --screenshot=shots\03-selftest.png "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j13-s10-a/index.html?selftest=1"
```

## 设计 ↔ 验收对照

| 简报要求 | 实现 |
|---|---|
| 用户任务：explore × 多维数据 | 14 个维度（11 数值 + 3 类别 + 星座⊃天区层级）× 460 条记录的散点探索台 |
| 成功标准：维度切换不重置认知 | 切换 X/Y 轴时：选中集、固定集、全部过滤**原样保持**；被过滤遮蔽的选中记录以虚线幽灵点留在图上，右栏标注"被遮蔽仍保留" |
| 验收种子：过滤/投影状态有归属 | 底部归属条逐条列出投影 chips（X/Y/颜色/大小）与过滤 chips，每个过滤标明 **维度+谓词+来源**（直方图框选 / 类别勾选），汇总行显示显示数/过滤数/视角名 |
| 验收种子：…且可回退 | 每次过滤/投影变更加入**状态历史**：撤销(Ctrl+Z)/重做(Ctrl+Y)/历史抽屉点击任意节点回退。选中与固定为认知锚点，刻意不入历史、不随回退重置 |
| 形状：unbounded / 高维 / 高密度 | 维度货架全维度常驻可见，数值维自带 30-bin 直方图，深色高密度布局 |

## 文件

```
index.html      结构
css/style.css   样式（深色高密度）
js/data.js      确定性数据层（同步生成，无加载态）
js/state.js     状态/历史/归属条/锚点/自检
js/shelf.js     维度货架（直方图框选过滤、轴指派、类别勾选）
js/plot.js      散点主屏（自动对数轴、框选、幽灵点、图例）
```
