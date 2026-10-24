# receipt: keyboard
headless Chrome 执行 test/harness.html：T7 在真实浏览器中合成 Ctrl+Z / Ctrl+Shift+Z 键事件，
断言状态轨迹游标后退/前进（结果行 PASS T7，TITLE=HARNESS 10/10 OK，DOM dump 存档 shots/dom.html）。
可见焦点以 CSS :focus-visible 2px 描边实现（WCAG 2.2 AA 基线声明，未单独截图验证）。
