# Struct · 结构化文档编辑器

cell-j08-s08（edit × single-document）：单一结构化文档的编辑应用。
成功标准：**编辑不破坏结构；结构化编辑与预览一致。**

## 运行

```powershell
npm install
npm run build      # 产物：dist/index.html（单文件，可直接双击以 file:// 打开）
npm run preview    # 或本地预览构建产物
npm run dev        # 开发模式
npm run verify     # 模型不变量验证（2000 次随机结构操作）
```

## 设计要点

- **结构保护（MC-1）**：所有编辑都经由带 guard 的封闭操作集（`src/model.js`
  的 `reduceDoc`）——章节按合法模板新增、删除有最小数量保护、移动是纯重排。
  不存在能产生非法骨架的操作；原始源码编辑被有意排除。
- **单一模型（MC-2）**：编辑器与预览是同一状态的两个纯视图，一致性由构造
  保证；点选章节时双向高亮 + 滚动定位，使"一致"随时可被检验。
- **混合防护（MC-3）**：骨架数量由 guard 硬保护；内容空缺（空标题/空条目）
  由实时校验软提示，顶栏"结构检查"与两侧窗格同步呈现。
- **可恢复（MC-5）**：每个操作进历史栈，Ctrl+Z / Ctrl+Y 撤销重做；重置也可撤销。
- **首屏即 ready**：示例文档内联在打包产物中，页面加载完成即处于可用状态，
  无加载态。

## 结构

```
index.html            入口（开发）
src/main.jsx          挂载
src/App.jsx           界面（顶栏 / 编辑窗格 / 预览窗格）
src/model.js          领域模型：操作 reducer、校验、统计、导出
src/styles.css        设计令牌与样式（WCAG 2.2 AA）
scripts/verify-model.mjs  模型不变量随机验证
dist/index.html       构建产物（单文件，静态可用）
```
