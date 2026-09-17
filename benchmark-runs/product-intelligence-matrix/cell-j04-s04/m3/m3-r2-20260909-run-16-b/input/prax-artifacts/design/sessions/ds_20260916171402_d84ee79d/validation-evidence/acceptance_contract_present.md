# acceptance_contract_present — receipt (pass)

screen.sdir.yaml carries 5 acceptance criteria:
1. 页面加载完成即满数据呈现，无骨架屏/加载态可被测得
2. 模拟流运行中，异常指标在异常条与网格瓦片两处均可在扫视内发现
3. 任一指标可打开检查器查看带时间戳的取值/状态变化历史（可追溯）
4. 持续 60s 更新后无布局跳动、无整屏重绘闪烁
5. 所有交互（选中/事件/暂停）均不改变瓦片网格位置
