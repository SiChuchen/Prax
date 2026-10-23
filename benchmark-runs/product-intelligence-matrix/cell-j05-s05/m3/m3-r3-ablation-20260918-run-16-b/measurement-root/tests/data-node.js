/* 供 Node 单元测试使用的数据入口：以 window 全局承载，测试环境补一个 window 垫片后加载。 */
if (typeof window === "undefined") {
  global.window = {};
}
require("../js/data.js");
module.exports = window.GRAPH_DATA;
