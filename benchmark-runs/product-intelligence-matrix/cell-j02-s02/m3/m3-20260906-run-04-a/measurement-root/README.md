# LOCI — Open Collection Registry

Cell **j02-s02** · locate × open-collection · 主对象：dataset（item 束）

在约 1,700 条的开放数据集中三次交互内定位目标，且定位全程不丢上下文。

## 运行

纯静态，无构建、无网络、无外部服务：直接打开根目录 `index.html`（file:// 即可）。

```
index.html    布局壳
styles.css    设计系统
app.js        过滤/打分/渲染引擎 + URL hash 状态
gen.js        确定性数据生成（固定种子，1,728 条，Node 可加载验证）
evidence/     headless Chrome 截图与 DOM 断言（真实浏览器证据）
```

## 定位路径（≤3 次交互）

1. 首屏搜索框已聚焦（或按 `/`），输入词（交互 1）
2. 即时过滤 + 相关度排序，命中计数实时更新（无需交互）
3. 点击结果行（交互 2）→ 右侧详情打开；`↑/↓` + `Enter` 键盘同样可达

## 不丢上下文（验收种子）

- 详情在右栏展开，**结果列表、滚动位置、全部过滤器原样保留**
- 上下文条：面包屑（All collections / Domain / Category）+ 可移除的过滤 chips
- 详情内注明位置：`Match 41 of 1,728 in current view · list position preserved`
- `Show in list` 一键回到列表中的该行并闪烁定位
- 全部状态（查询、过滤、排序、选中项）持久化在 URL hash——刷新、后退/前进、分享链接均不丢

## 形状对应（open-collection 束）

| facet | 实现 |
|---|---|
| 基数 unbounded | 1,728 条 + 增量渲染（首批 80，滚动/按钮加载更多） |
| 层级性 medium | 8 域 × 4 类两级树，带计数 |
| 密度/维度 medium | 紧凑行 + Format / License / Access 三组 facet（跨组独立计数） |
| 易变性 medium | 更新时间 + 相对时间显示 + Recently updated 排序 |
| 空间性 none、比较 none | 无地图、无对比视图 |
