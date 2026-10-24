receipt — state_completeness

ready（step01 dataStatus=ready 无 spinner）、empty（step10 status=empty overlay=true，shots/10）、error（app.js init try/catch → data-status=error）；loading 为声明性状态：数据内联同步不可达=设计意图。产物：shots/01、shots/10、report.json、js/app.js。

