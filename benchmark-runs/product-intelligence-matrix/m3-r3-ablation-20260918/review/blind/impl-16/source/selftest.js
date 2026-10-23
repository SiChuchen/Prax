/* 脉络 · 自检 —— 在真实浏览器中对已加载的应用执行交互全链路断言。
 * 打开 selftest.html 即自动运行；结果渲染到页面左上角面板，并写入 window.__SELFTEST__ 与 console。 */
"use strict";

window.addEventListener("load", () => {
  const R = [];
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
  const txt = el => (el ? el.textContent.trim() : "");

  function t(name, fn) {
    try { fn(); R.push({ name, pass: true, info: "" }); }
    catch (e) { R.push({ name, pass: false, info: String(e && e.message || e) }); }
  }
  const counts = () => ({
    focus: $$(".node-g.focus").length, hl: $$(".node-g.hl").length, dim: $$(".node-g.dim").length,
    trace: $$(".edge-g.trace").length, hlE: $$(".edge-g.hl").length,
  });

  /* 1. 首屏即用：无加载态，同步渲染 */
  t("首屏同步渲染：33 节点 / 58 关系图元", () => {
    assert($$(".node-g").length === 33, `node-g=${$$(".node-g").length}`);
    assert($$(".edge-g").length === 58, `edge-g=${$$(".edge-g").length}`);
    assert(txt($("#topstats")).includes("33 节点 · 58 关系 · 6 层"), txt($("#topstats")));
  });
  t("首屏面板 = 全局概览（无加载态文案）", () => {
    assert(txt($("#panel-body .pkick")) === "全局概览", txt($("#panel-body .pkick")));
    assert(!/加载|loading/i.test(document.body.textContent), "出现加载态文案");
  });
  t("数据完整性：边端点有效、无重复、类型与关键性计数", () => {
    assert(EDGES2.every(e => byId[e.f] && byId[e.t]), "存在未知端点");
    assert(new Set(EDGES2.map(e => e.id)).size === 58, "边 id 重复");
    const c = t => EDGES2.filter(e => e.type === t).length;
    assert(c("call") === 34 && c("event") === 8 && c("data") === 16, `call=${c("call")} event=${c("event")} data=${c("data")}`);
    assert(EDGES2.filter(e => e.crit === "P0").length === 27, "P0 计数不符");
  });
  t("闭包计算：订单 16/8，消息总线 18/0（环不重复计自身）", () => {
    assert(closureOut("order").size === 16, `order 依赖闭包=${closureOut("order").size}`);
    assert(closureIn("order").size === 8, `order 影响闭包=${closureIn("order").size}`);
    assert(closureIn("mq").size === 18, `mq 影响闭包=${closureIn("mq").size}`);
    assert(closureOut("mq").size === 0, "mq 不应有出边依赖");
  });

  /* 2. 聚焦：全局上下文保留 */
  t("点击聚焦 订单服务：8 直依 / 3 被依 / 16 / 8，面板为节点卡", () => {
    followTo("order");
    assert(txt($("#panel-body h2")) === "订单服务", txt($("#panel-body h2")));
    const v = $$("#panel-body .statrow b").map(b => b.textContent);
    assert(v.join(",") === "8,3,16,8", v.join(","));
  });
  t("高亮：1 聚焦 + 11 加亮 + 21 降暗 = 33，无任何节点被隐藏", () => {
    const c = counts();
    assert(c.focus === 1 && c.hl === 11 && c.dim === 21, JSON.stringify(c));
    assert($$(".node-g").every(g => getComputedStyle(g).display !== "none"), "存在 display:none 节点");
    assert(nodeG.product.classList.contains("dim"), "非相邻节点应处于降暗态（CSS 过渡后 opacity=0.13）");
    assert($("#graph").classList.contains("has-focus"), "svg 缺少 has-focus");
  });

  /* 3. 跟随：路径累计与方向语义 */
  t("跟随 订单→消息总线：路径累计、1 条跟随边、面包屑 ─▸", () => {
    $("#panel-body .rel[data-nid=\"mq\"]").click();
    assert(S.path.join(">") === "order>mq", S.path.join(">"));
    const crumbs = $$("#tracebar .crumb").map(b => b.textContent);
    assert(crumbs.join("|") === "订单服务|消息总线", crumbs.join("|"));
    assert(counts().trace === 1, `trace=${counts().trace}`);
    assert($(".crumb-sep").textContent === "─▸", $(".crumb-sep").textContent);
    assert(txt($(".crumb-meta")).includes("影响闭包 18"), txt($(".crumb-meta")));
  });
  t("逆方向跟随 消息总线←通知中心：分隔符 ◂─（真实依赖方向）", () => {
    followTo("notify");
    assert(S.path.length === 3, "路径长度应为 3");
    assert(counts().trace === 2, `trace=${counts().trace}`);
    const seps = $$(".crumb-sep").map(s => s.textContent);
    assert(seps.join("|") === "─▸|◂─", seps.join("|"));
  });
  t("面包屑回退：点击第一步 → 路径截断为前缀", () => {
    $$("#tracebar .crumb")[0].click();
    assert(S.path.length === 1 && S.path[0] === "order", S.path.join(">"));
  });

  /* 4. 透镜：闭包模式 */
  t("影响闭包（订单）：8 节点加亮；依赖闭包：16 节点加亮", () => {
    setMode("impact");
    let c = counts();
    assert(c.hl === 8 && c.focus === 1, `impact hl=${c.hl}`);
    assert($$('.modes button[data-mode="impact"]').classList.contains("on"), "模式按钮未同步");
    setMode("deps");
    c = counts();
    assert(c.hl === 16 && c.focus === 1, `deps hl=${c.hl}`);
    setMode("adj");
  });
  t("影响闭包（消息总线）：18 节点加亮（枢纽影响面）", () => {
    resetAll(); followTo("mq"); setMode("impact");
    const c = counts();
    assert(c.hl === 18 && c.focus === 1, `hl=${c.hl}`);
    assert(!nodeG.order.classList.contains("dim"), "订单服务应在消息总线的影响面内");
    setMode("adj"); resetAll();
  });

  /* 5. 关系是一等对象：选边不清空跟随路径 */
  t("选中关系 order~inventory：关系卡渲染，跟随路径保留", () => {
    followTo("order"); followTo("mq"); followTo("notify");
    $('.edge-g[data-eid="order~inventory"] .edge-hit').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert(S.selEdge === "order~inventory", `selEdge=${S.selEdge}`);
    assert(S.path.length === 3, "选边不应清空跟随路径");
    assert(txt($("#panel-body .pkick")).startsWith("关系 ·"), txt($("#panel-body .pkick")));
    assert(txt($("#panel-body")).includes("锁定库存") && txt($("#panel-body")).includes("gRPC"), "关系卡字段缺失");
    assert($$("#tracebar .crumb").length === 3, "面包屑应仍在");
  });

  /* 6. 搜索与重置 */
  t("搜索「库存」回车：跟随到 库存服务，路径重置为新路径", () => {
    resetAll();
    const inp = $("#search");
    inp.value = "库存";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    assert(!$("#search-drop").hidden, "下拉未出现");
    assert($("#search-drop").innerHTML.includes("库存服务"), "下拉缺少 库存服务");
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert(S.path.length === 1 && S.path[0] === "inventory", S.path.join(">"));
    assert(txt($("#panel-body h2")) === "库存服务", txt($("#panel-body h2")));
  });
  t("Esc 重置：回到全局概览，全部图元恢复正常", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    assert(S.path.length === 0 && S.selEdge === null, "状态未清空");
    assert(!$("#graph").classList.contains("has-focus"), "has-focus 未移除");
    assert($("#tracebar").hidden === true, "面包屑未隐藏");
    assert(counts().dim === 0 && counts().hl === 0 && counts().focus === 0, JSON.stringify(counts()));
    assert(txt($("#panel-body .pkick")) === "全局概览", "面板未回到概览");
  });

  /* 7. 深链与视图 */
  t("深链 #p=order>mq>notify：恢复三步跟随", () => {
    location.hash = "#p=order>mq>notify";
    parseHash();
    assert(S.path.join(">") === "order>mq>notify", S.path.join(">"));
    try { history.replaceState(null, "", location.pathname); } catch (_) { /* file:// 可能拒绝，不影响断言 */ }
    resetAll();
  });
  t("缩放与适应视图：viewBox 变化并可复位", () => {
    fitView();
    const w0 = VB.w;
    zoomCenter(1 / 1.25);   // 放大：viewBox 宽度缩小为 0.8 倍
    assert(Math.abs(VB.w - w0 * 0.8) < w0 * 0.01, `VB.w ${w0} → ${VB.w}`);
    fitView();
    assert(Math.abs(VB.w - w0) < 0.01, "fitView 未复位");
  });
  t("外部节点标记：4 个 ext 节点带虚线边框样式类", () => {
    assert($$(".node-g.ext").length === 4, `ext=${$$(".node-g.ext").length}`);
  });

  /* 汇总渲染 */
  const pass = R.filter(r => r.pass).length, total = R.length;
  window.__SELFTEST__ = { pass, total, failures: R.filter(r => !r.pass) };
  const st = document.createElement("style");
  st.textContent = `
    #selftest{position:fixed;top:68px;left:12px;z-index:200;width:480px;max-height:72vh;overflow:auto;
      background:rgba(13,21,38,.96);border:1px solid rgba(255,255,255,.12);border-radius:12px;
      padding:12px 14px;font:12px/1.6 Consolas,monospace;color:#eef3fb;box-shadow:0 12px 32px rgba(0,0,0,.5)}
    #selftest h2{font-size:13px;margin-bottom:8px;font-family:system-ui}
    #selftest .sum{font-weight:700;font-size:13px;margin-bottom:8px;font-family:system-ui}
    #selftest .ok{color:#6fd0a8}#selftest .bad{color:#ff9b9b}#selftest .info{color:#8b98ab}
    #selftest div.row{padding:1px 0;border-bottom:1px dashed rgba(255,255,255,.06)}`;
  document.head.appendChild(st);
  const box = document.createElement("div");
  box.id = "selftest";
  box.innerHTML = `<h2>自检 · 关系跟随全链路</h2>
    <div class="sum ${pass === total ? "ok" : "bad"}">${pass === total ? "✔ 全部通过" : "✘ 存在失败"} — ${pass}/${total}</div>` +
    R.map(r => `<div class="row"><span class="${r.pass ? "ok" : "bad"}">${r.pass ? "✔" : "✘"}</span> ${r.name}${r.pass ? "" : `<div class="info">↳ ${r.info}</div>`}</div>`).join("");
  document.body.appendChild(box);
  console.log(`[selftest] ${pass}/${total} PASS`, window.__SELFTEST__.failures);
});
