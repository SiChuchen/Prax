"use strict";

/* =====================================================================
 * StructEd · 结构文档工作台
 * ---------------------------------------------------------------------
 * 设计核心：全文只有一份数据模型 doc = { title, blocks[] }。
 * 大纲、编辑器、预览三个视图全部由这份数据派生，任何编辑先改模型，
 * 再同步重绘三个视图 —— 因此“结构化编辑与预览一致”由构造保证。
 *
 * “编辑不破坏结构”由规则守卫（attempt）保证：
 *   R1 唯一 H1  —— 文档标题是独立字段，恒为全文唯一一级标题，不提供
 *                  任何能改变其级别的操作。
 *   R2 层级连续 —— 内容标题只有 H2/H3 两级；任何结构性操作（改类型、
 *                  移动、复制、插入、删除）先在副本上试运行并校验，
 *                  不满足 “标题级别 ≤ 前一个标题级别 + 1” 则整体拒绝。
 *   R3 标题非空 —— 空标题允许键入过程瞬时存在，但实时标记，
 *                  并在结构体检面板中列出。
 * =================================================================== */

/* ---------------- 常量与工具 ---------------- */

const STORAGE_KEY = "structed:doc:v1";

const TYPES = {
  h2:      { label: "章节 H2", group: "heading", level: 2 },
  h3:      { label: "小节 H3", group: "heading", level: 3 },
  p:       { label: "段落",     group: "text" },
  bullet:  { label: "列表项",   group: "list" },
  num:     { label: "编号项",   group: "list" },
  quote:   { label: "引用",     group: "text" },
  callout: { label: "提示框",   group: "callout" },
};

const PLACEHOLDER = {
  h2: "章节标题（如：背景与目标）",
  h3: "小节标题（如：场景一）",
  p: "输入正文，按 Enter 快速新建段落",
  bullet: "列表项内容",
  num: "编号项内容",
  quote: "引用的文字",
  callout: "要强调的提示内容",
};

const uid = () => "b" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clone = (o) => JSON.parse(JSON.stringify(o));
const isHeading = (b) => TYPES[b.type].group === "heading";

/* ---------------- 示例文档（首屏内联数据） ---------------- */

function makeSampleDoc() {
  const mk = (type, text) => ({ id: uid(), type, text });
  return {
    title: "「星云」协作白板 · 产品需求文档 v0.3",
    blocks: [
      mk("h2", "背景与目标"),
      mk("p", "远程团队在头脑风暴与评审环节缺少一块“可以一起动手”的画布。星云协作白板以低延迟同步为核心，让分布各地的成员在同一块板子上写字、贴便签、连线。"),
      mk("bullet", "目标：单板并发编辑 ≥ 50 人，操作同步延迟 P95 ≤ 120ms"),
      mk("bullet", "范围：白板编辑、便签、基础图形、模板市场（一期不含评论与历史版本）"),
      mk("bullet", "非目标：视频会议、第三方存储直传"),
      mk("h2", "核心场景"),
      mk("h3", "场景一：跨城市头脑风暴"),
      mk("p", "主持人从模板库新建“鱼骨图”板，成员扫码进入后各自贴便签；板面按区域自动聚合同一主题的便签。"),
      mk("h3", "场景二：迭代评审复盘"),
      mk("p", "评审结束后，将白板一键归档到项目空间，并生成只读快照链接供缺席者回看。"),
      mk("callout", "一期白板不承担审批流，评审结论请回填至需求单。"),
      mk("h2", "里程碑"),
      mk("num", "M1（第 4 周）：白板内核 + 便签，支持 10 人并发"),
      mk("num", "M2（第 8 周）：图形与模板市场，支持 30 人并发"),
      mk("num", "M3（第 12 周）：归档快照与权限加固，全量发布"),
      mk("h3", "待确认事项"),
      mk("p", "模板市场是否需要审核流，法务侧尚未给出结论，见风险登记册 R-07。"),
      mk("quote", "先做一秒钟内能看到对方光标移动的白板，再谈其它。"),
    ],
  };
}

/* ---------------- 状态 ---------------- */

let doc;                       // 唯一数据模型
let undoStack = [];
let redoStack = [];
let activeId = null;           // 当前聚焦块
let typingArmed = false;       // 连续键入期间只压一次撤销快照
let typingTimer = null;
let suppressToast = false;     // 自检时静默
let toastTimer = null;
let lastMsg = "就绪";

/* ---------------- 持久化（可选增强，失败静默） ---------------- */

function loadDoc() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && typeof d.title === "string" && Array.isArray(d.blocks)
        && d.blocks.every((b) => b && typeof b.id === "string" && typeof b.text === "string" && TYPES[b.type])) return d;
  } catch (e) { /* file:// 或隐私模式下可能不可用 */ }
  return null;
}

function saveDoc() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); } catch (e) { /* 忽略 */ }
}

/* ---------------- 结构校验（编辑器 / 预览 / 体检共用） ---------------- */

function validate(d) {
  const issues = [];
  if (!d.title.trim()) {
    issues.push({ rule: "empty-title", blocking: false, msg: "文档标题为空（标题是全文唯一的 H1）" });
  }
  let prev = 1; // 文档标题恒为 1 级
  d.blocks.forEach((b, i) => {
    if (!isHeading(b)) return;
    const lvl = TYPES[b.type].level;
    if (lvl > prev + 1) {
      issues.push({
        rule: "level-jump", blocking: true, blockId: b.id,
        msg: `第 ${i + 1} 块：${TYPES[b.type].label} 出现在 H${prev} 之后，层级跳跃（H${prev} → H${lvl}）`,
      });
    }
    if (!b.text.trim()) {
      issues.push({ rule: "empty-heading", blocking: false, blockId: b.id, msg: `第 ${i + 1} 块：标题文字为空` });
    }
    prev = lvl;
  });
  return issues;
}

/* 标题自动编号：h2 计 1、1、2…；h3 计 1.1、1.2…（仅派生展示用） */
function headingNumbers(d) {
  const map = new Map();
  let s = 0, t = 0;
  d.blocks.forEach((b) => {
    if (b.type === "h2") { s++; t = 0; map.set(b.id, String(s)); }
    else if (b.type === "h3") { t++; map.set(b.id, s + "." + t); }
  });
  return map;
}

/* ---------------- 守卫式修改入口 ---------------- */

/* 所有结构性操作先在副本上试运行：op 返回 {ok:false, reason} 可提前否决，
 * 否则跑结构校验，出现阻断级问题（层级跳跃）则整体拒绝并说明原因。 */
function attempt(op, { describe } = {}) {
  const trial = clone(doc);
  const verdict = op(trial);
  if (verdict && verdict.ok === false) {
    toast(verdict.reason, "warn");
    renderAll();
    return false;
  }
  const blocking = validate(trial).filter((i) => i.blocking);
  if (blocking.length) {
    toast("已阻止，" + blocking[0].msg, "warn");
    renderAll();
    return false;
  }
  pushUndo();
  typingArmed = false;
  clearTimeout(typingTimer);
  doc = trial;
  afterChange(describe || "已更新");
  return true;
}

function setType(id, type) {
  return attempt((trial) => {
    const b = trial.blocks.find((x) => x.id === id);
    if (!b) return { ok: false, reason: "块不存在" };
    b.type = type;
  }, { describe: `已转换为「${TYPES[type].label}」` });
}

function moveBlock(id, dir) {
  return attempt((trial) => {
    const i = trial.blocks.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= trial.blocks.length) return { ok: false, reason: "已到文档边界" };
    [trial.blocks[i], trial.blocks[j]] = [trial.blocks[j], trial.blocks[i]];
  }, { describe: dir < 0 ? "已上移一块" : "已下移一块" });
}

function duplicateBlock(id) {
  return attempt((trial) => {
    const i = trial.blocks.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false, reason: "块不存在" };
    trial.blocks.splice(i + 1, 0, { ...clone(trial.blocks[i]), id: uid() });
  }, { describe: "已复制一块" });
}

function insertAfter(id, type = "p") {
  let newId = null;
  const ok = attempt((trial) => {
    const i = id == null ? trial.blocks.length - 1 : trial.blocks.findIndex((x) => x.id === id);
    if (id != null && i < 0) return { ok: false, reason: "插入位置不存在" };
    const nb = { id: uid(), type, text: "" };
    trial.blocks.splice(i + 1, 0, nb);
    newId = nb.id;
  }, { describe: "已插入段落" });
  return ok ? newId : null;
}

function removeBlock(id) {
  return attempt((trial) => {
    const i = trial.blocks.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false, reason: "块不存在" };
    trial.blocks.splice(i, 1);
  }, { describe: "已删除一块" });
}

/* ---------------- 撤销 / 重做 ---------------- */

function pushUndo() {
  undoStack.push(clone(doc));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (!undoStack.length) return;
  const focusId = activeId;
  redoStack.push(clone(doc));
  doc = undoStack.pop();
  typingArmed = false;
  clearTimeout(typingTimer);
  afterChange("已撤销");
  if (focusId) focusBlock(focusId);
}

function redo() {
  if (!redoStack.length) return;
  const focusId = activeId;
  undoStack.push(clone(doc));
  doc = redoStack.pop();
  typingArmed = false;
  clearTimeout(typingTimer);
  afterChange("已重做");
  if (focusId) focusBlock(focusId);
}

/* 键入类修改：连续输入只压一次“键入前”快照 */
function noteEditSnapshot() {
  if (typingArmed) {
    clearTimeout(typingTimer);
  } else {
    pushUndo();
    typingArmed = true;
  }
  typingTimer = setTimeout(() => { typingArmed = false; }, 900);
}

function onBlockInput(id, value) {
  const b = doc.blocks.find((x) => x.id === id);
  if (!b || b.text === value) return;
  noteEditSnapshot();
  b.text = value;
  renderDerived();  // 文本编辑不动块结构，编辑器无需重绘（保住光标）
  saveDoc();
}

function onTitleInput(value) {
  if (doc.title === value) return;
  noteEditSnapshot();
  doc.title = value;
  const el = document.querySelector(".doc-title-input");
  if (el) el.classList.toggle("is-empty", !value.trim());
  renderDerived();
  saveDoc();
}

/* ---------------- 渲染：编辑器 ---------------- */

function grow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function placeCaretEnd(el) {
  el.focus();
  const n = el.value.length;
  try { el.setSelectionRange(n, n); } catch (e) { /* 非 受控元素时忽略 */ }
}

function focusBlock(id) {
  const ta = document.querySelector(`#editor textarea.block-text[data-id="${id}"]`);
  if (!ta) return;
  placeCaretEnd(ta);
  ta.scrollIntoView({ block: "nearest" });
}

function reveal(id) {
  activeId = id;
  renderEditor();
  focusBlock(id);
}

function setActive(id) {
  if (activeId === id) { syncOutlineActive(); return; }
  activeId = id;
  document.querySelectorAll("#editor .block-row").forEach((r) => {
    r.classList.toggle("active", r.dataset.id === id);
  });
  syncOutlineActive();
}

function toolBtn(label, title, onClick, disabled) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tool-btn";
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.disabled = !!disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function makeTypeSelect(b) {
  const sel = document.createElement("select");
  sel.className = "type-select";
  sel.title = "转换块类型（受结构规则保护）";
  sel.setAttribute("aria-label", "块类型");
  Object.entries(TYPES).forEach(([t, meta]) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = meta.label;
    sel.appendChild(o);
  });
  sel.value = b.type;
  sel.addEventListener("change", () => {
    const ok = setType(b.id, sel.value);
    if (!ok) sel.value = b.type; // 被守卫拒绝则回弹
  });
  return sel;
}

function renderEditor() {
  const host = document.getElementById("editor");
  host.textContent = "";

  // 唯一 H1：标题（独立字段，只可改文字，天然满足 R1）
  const title = document.createElement("textarea");
  title.className = "doc-title-input" + (doc.title.trim() ? "" : " is-empty");
  title.rows = 1;
  title.value = doc.title;
  title.placeholder = "输入文档标题…";
  title.setAttribute("aria-label", "文档标题（唯一的 H1）");
  title.addEventListener("input", () => { grow(title); onTitleInput(title.value); });
  title.addEventListener("focus", () => setActive("__title__"));
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      const first = document.querySelector("#editor textarea.block-text");
      if (first) placeCaretEnd(first);
    }
  });
  host.appendChild(title);

  doc.blocks.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "block-row t-" + b.type + (b.id === activeId ? " active" : "");
    row.dataset.id = b.id;
    if (isHeading(b) && !b.text.trim()) row.classList.add("is-empty-heading");

    const gutter = document.createElement("div");
    gutter.className = "block-gutter";
    gutter.textContent = String(i + 1);

    const main = document.createElement("div");
    main.className = "block-main";
    if (isHeading(b) && !b.text.trim()) {
      const flag = document.createElement("div");
      flag.className = "block-flag";
      flag.textContent = "⚠ 标题不能为空";
      main.appendChild(flag);
    }

    const ta = document.createElement("textarea");
    ta.className = "block-text";
    ta.rows = 1;
    ta.value = b.text;
    ta.dataset.id = b.id;
    ta.placeholder = PLACEHOLDER[b.type];
    ta.setAttribute("aria-label", `${TYPES[b.type].label} · 第 ${i + 1} 块`);
    ta.addEventListener("input", () => { grow(ta); onBlockInput(b.id, ta.value); });
    ta.addEventListener("focus", () => setActive(b.id));
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        const nid = insertAfter(b.id, "p");
        if (nid) reveal(nid);
      } else if (e.key === "Backspace" && ta.value === "") {
        e.preventDefault();
        const idx = doc.blocks.findIndex((x) => x.id === b.id);
        const prev = doc.blocks[idx - 1];
        if (prev) activeId = prev.id;
        if (removeBlock(b.id) && prev) { renderEditor(); focusBlock(prev.id); }
      }
    });
    main.appendChild(ta);

    const tools = document.createElement("div");
    tools.className = "block-tools";
    tools.appendChild(makeTypeSelect(b));
    tools.appendChild(toolBtn("↑", "上移", () => moveBlock(b.id, -1), i === 0));
    tools.appendChild(toolBtn("↓", "下移", () => moveBlock(b.id, +1), i === doc.blocks.length - 1));
    tools.appendChild(toolBtn("⧉", "复制本块", () => duplicateBlock(b.id)));
    tools.appendChild(toolBtn("＋", "在下方插入段落", () => { const nid = insertAfter(b.id, "p"); if (nid) reveal(nid); }));
    tools.appendChild(toolBtn("✕", "删除本块", () => removeBlock(b.id)));

    row.appendChild(gutter);
    row.appendChild(main);
    row.appendChild(tools);
    host.appendChild(row);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn ghost add-block";
  add.textContent = "＋ 添加段落";
  add.addEventListener("click", () => { const nid = insertAfter(null, "p"); if (nid) reveal(nid); });
  host.appendChild(add);

  host.querySelectorAll("textarea").forEach(grow);
}

/* ---------------- 渲染：大纲 ---------------- */

function outlineData(d) {
  const items = [{
    id: "__title__", lvl: 1, num: "H1",
    text: d.title.trim() || "（无标题）", isEmpty: !d.title.trim(),
  }];
  const nums = headingNumbers(d);
  d.blocks.forEach((b) => {
    if (b.type === "h2") items.push({ id: b.id, lvl: 2, num: nums.get(b.id), text: b.text, isEmpty: !b.text.trim() });
    if (b.type === "h3") items.push({ id: b.id, lvl: 3, num: nums.get(b.id), text: b.text, isEmpty: !b.text.trim() });
  });
  return items;
}

function renderOutline() {
  const host = document.getElementById("outline");
  host.textContent = "";
  const items = outlineData(doc);
  items.forEach((it) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `outline-item lvl-${it.lvl === 1 ? "title" : it.lvl}` + (it.isEmpty ? " is-empty" : "")
      + (it.id === activeId ? " active" : "");
    btn.dataset.blockId = it.id;
    const chip = document.createElement("span");
    chip.className = "num-chip";
    chip.textContent = it.num;
    const label = document.createElement("span");
    label.textContent = it.text.length > 26 ? it.text.slice(0, 26) + "…" : it.text;
    btn.appendChild(chip);
    btn.appendChild(label);
    btn.title = it.text;
    btn.addEventListener("click", () => {
      if (it.id === "__title__") {
        placeCaretEnd(document.querySelector(".doc-title-input"));
      } else {
        const ta = document.querySelector(`#editor textarea.block-text[data-id="${it.id}"]`);
        if (ta) { placeCaretEnd(ta); ta.scrollIntoView({ block: "center" }); }
      }
    });
    host.appendChild(btn);
  });
  if (items.length === 1) {
    const tip = document.createElement("div");
    tip.className = "outline-empty";
    tip.textContent = "暂无标题块 —— 把某个块转换为「章节 H2」即可出现在大纲里。";
    host.appendChild(tip);
  }
  syncOutlineActive();
}

function syncOutlineActive() {
  const items = document.querySelectorAll("#outline .outline-item");
  let hit = null;
  items.forEach((el) => {
    const on = el.dataset.blockId === activeId;
    el.classList.toggle("active", on);
    if (on) hit = el;
  });
  if (hit) hit.scrollIntoView({ block: "nearest" });
}

/* ---------------- 渲染：预览（与编辑器同源的派生视图） ---------------- */

function fillText(el, b) {
  const t = b.text.trim();
  if (t) {
    el.appendChild(document.createTextNode(t));
  } else {
    const empty = document.createElement("span");
    empty.className = "pv-empty";
    empty.textContent = TYPES[b.type].group === "heading" ? "（空标题）" : "（空）";
    el.appendChild(empty);
    el.appendChild(warnChip("空"));
  }
}

function warnChip(text) {
  const chip = document.createElement("span");
  chip.className = "pv-warn-chip";
  chip.textContent = "⚠ " + text;
  return chip;
}

function renderBlock(b, num) {
  let el;
  switch (b.type) {
    case "h2": case "h3": {
      el = document.createElement(b.type);
      const chip = document.createElement("span");
      chip.className = "num-chip";
      chip.textContent = num || "•";
      el.appendChild(chip);
      fillText(el, b);
      break;
    }
    case "p": {
      el = document.createElement("p");
      fillText(el, b);
      break;
    }
    case "quote": {
      el = document.createElement("blockquote");
      fillText(el, b);
      break;
    }
    case "callout": {
      el = document.createElement("div");
      el.className = "pv-callout";
      const icon = document.createElement("span");
      icon.className = "pv-callout-icon";
      icon.textContent = "ℹ";
      const body = document.createElement("div");
      body.className = "pv-callout-body";
      const strong = document.createElement("strong");
      strong.textContent = "提示 ";
      body.appendChild(strong);
      fillText(body, b);
      el.appendChild(icon);
      el.appendChild(body);
      break;
    }
    default: {
      el = document.createElement("p");
      fillText(el, b);
    }
  }
  el.dataset.node = "1";
  return el;
}

function renderPreview() {
  const host = document.getElementById("preview");
  host.textContent = "";
  const nums = headingNumbers(doc);

  const h1 = document.createElement("h1");
  h1.className = "pv-title";
  h1.dataset.node = "1";
  h1.appendChild(document.createTextNode(doc.title.trim() || "（无标题文档）"));
  if (!doc.title.trim()) h1.appendChild(warnChip("标题为空"));
  host.appendChild(h1);

  const meta = document.createElement("div");
  meta.className = "pv-meta";
  meta.textContent = `StructEd 实时预览 · ${doc.blocks.length} 个内容块 · 同步于 ${new Date().toTimeString().slice(0, 8)}`;
  host.appendChild(meta);

  if (doc.blocks.length === 0) {
    const p = document.createElement("p");
    p.className = "pv-empty";
    // 空态提示不属于模型节点，不计入一致性审计
    p.textContent = "文档正文为空 —— 回到编辑器添加内容块。";
    host.appendChild(p);
    return;
  }

  let i = 0;
  while (i < doc.blocks.length) {
    const b = doc.blocks[i];
    if (b.type === "bullet" || b.type === "num") {
      const list = document.createElement(b.type === "bullet" ? "ul" : "ol");
      while (i < doc.blocks.length && doc.blocks[i].type === b.type) {
        const li = document.createElement("li");
        li.dataset.node = "1";
        fillText(li, doc.blocks[i]);
        list.appendChild(li);
        i++;
      }
      list.dataset.node = "0"; // 列表容器本身不计节点，计数落在每个 li
      host.appendChild(list);
      continue;
    }
    host.appendChild(renderBlock(b, nums.get(b.id) || ""));
    i++;
  }
}

/* 一致性自检：模型节点数（正文块 + 唯一 H1）与预览 DOM 节点数必须相等 */
function auditConsistency() {
  const previewNodes = document.querySelectorAll("#preview [data-node='1']").length;
  const modelNodes = doc.blocks.length + 1;
  return { ok: previewNodes === modelNodes, modelNodes, previewNodes };
}

/* ---------------- 渲染：结构体检 / 状态栏 ---------------- */

function renderChecker() {
  const host = document.getElementById("checker");
  host.textContent = "";
  const issues = validate(doc);
  const audit = auditConsistency();

  if (issues.length === 0 && audit.ok) {
    const ok = document.createElement("div");
    ok.className = "checker-ok";
    ok.textContent = "✓ 结构有效：唯一 H1、层级连续、无空标题；编辑与预览一致。";
    host.appendChild(ok);
  } else {
    issues.forEach((iss) => {
      const box = document.createElement("div");
      box.className = "checker-issue";
      box.textContent = "⚠ " + iss.msg + (iss.blocking ? "（此类状态会被操作守卫直接拒绝）" : "");
      host.appendChild(box);
    });
    if (!audit.ok) {
      const box = document.createElement("div");
      box.className = "checker-issue";
      box.textContent = `⚠ 预览节点数（${audit.previewNodes}）与模型（${audit.modelNodes}）不一致！`;
      host.appendChild(box);
    }
  }

  const auditBox = document.createElement("div");
  auditBox.className = "checker-audit";

  const line1 = document.createElement("span");
  line1.textContent = "一致性自检（每次编辑后自动运行）";
  const line2 = document.createElement("span");
  line2.className = "mono";
  line2.innerHTML = `模型 ${audit.modelNodes} 节点 ↔ 预览 ${audit.previewNodes} 节点 `
    + (audit.ok ? `<span class="pass">一致 ✓</span>` : `<span class="fail">不一致 ✗</span>`);
  const path = ["H1", ...doc.blocks.filter(isHeading).map((b) => "H" + TYPES[b.type].level)].join(" → ");
  const line3 = document.createElement("span");
  line3.className = "mono";
  line3.textContent = "层级路径：" + path;

  auditBox.appendChild(line1);
  auditBox.appendChild(line2);
  auditBox.appendChild(line3);
  host.appendChild(auditBox);
}

function renderStatus() {
  const headings = doc.blocks.filter(isHeading).length;
  const chars = doc.blocks.reduce((n, b) => n + b.text.length, 0) + doc.title.length;
  document.getElementById("status-msg").textContent = lastMsg;
  document.getElementById("status-stats").textContent =
    `块 ${doc.blocks.length} · 标题 ${headings} · 字数 ${chars}`;
  const badge = document.getElementById("sync-badge");
  badge.innerHTML = `<span class="dot"></span>已同步 ${new Date().toTimeString().slice(0, 8)}`;
  document.getElementById("btn-undo").disabled = !undoStack.length;
  document.getElementById("btn-redo").disabled = !redoStack.length;
}

function renderDerived() {
  renderOutline();
  renderPreview();
  renderChecker();
  renderStatus();
}

function renderAll() {
  renderEditor();
  renderDerived();
}

function afterChange(msg, focusId) {
  if (focusId) activeId = focusId;
  if (msg) lastMsg = msg;
  renderAll();
  saveDoc();
}

/* ---------------- 导出 Markdown ---------------- */

function toMarkdown(d) {
  const lines = [];
  lines.push("# " + (d.title.trim() || "无标题"));
  let n = 0;
  d.blocks.forEach((b) => {
    const t = b.text.trim() || "（空）";
    if (b.type === "num") n++; else n = 0;
    switch (b.type) {
      case "h2": lines.push("", "## " + t); break;
      case "h3": lines.push("", "### " + t); break;
      case "p": lines.push("", t); break;
      case "bullet": lines.push("- " + t); break;
      case "num": lines.push(n + ". " + t); break;
      case "quote": lines.push("", "> " + t); break;
      case "callout": lines.push("", "> **提示** " + t); break;
    }
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function copyMarkdown() {
  const md = toMarkdown(doc);
  try {
    await navigator.clipboard.writeText(md);
    toast("Markdown 已复制到剪贴板", "ok");
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "Markdown 已复制" : "复制失败，请改用「导出 .md」", ok ? "ok" : "warn");
    } catch (e2) {
      toast("复制失败，请改用「导出 .md」", "warn");
    }
  }
}

function downloadMarkdown() {
  const blob = new Blob([toMarkdown(doc)], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = (doc.title.trim() || "document").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) + ".md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("已下载 " + a.download, "ok");
}

function resetDoc() {
  if (!confirm("恢复为内置示例文档？当前内容将被覆盖（可用 Ctrl+Z 撤销）。")) return;
  pushUndo();
  doc = makeSampleDoc();
  activeId = null;
  afterChange("已恢复内置示例文档");
}

/* ---------------- Toast ---------------- */

function toast(msg, kind) {
  if (suppressToast) return;
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (kind === "warn" ? " toast-warn" : kind === "ok" ? " toast-ok" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------------- 自检（打开 index.html#selftest 触发） ---------------- */

function runSelfTests() {
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, pass: true, info: "" }); }
    catch (e) { results.push({ name, pass: false, info: e.message }); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
  const quiet = (fn) => { suppressToast = true; try { return fn(); } finally { suppressToast = false; } };

  test("示例文档初始结构有效", () => {
    doc = makeSampleDoc();
    assert(validate(doc).length === 0, JSON.stringify(validate(doc)));
  });

  test("R2 拒绝：首块 H2 直接升级为 H3（H1→H3 跳级）", () => {
    doc = makeSampleDoc();
    const id = doc.blocks[0].id;
    const blocked = quiet(() => !setType(id, "h3"));
    assert(blocked, "跳级未被拦截");
    assert(doc.blocks[0].type === "h2", "被拒绝的操作修改了模型");
  });

  test("R2 拒绝：删除中间 H2 导致后续 H3 悬空", () => {
    doc = { title: "T", blocks: [
      { id: "a", type: "h2", text: "A" },
      { id: "b", type: "h3", text: "B" },
      { id: "c", type: "p", text: "c" },
    ] };
    const blocked = quiet(() => !removeBlock("a"));
    assert(blocked && doc.blocks.length === 3, "破坏性删除未被拦截");
  });

  test("R2 拒绝：H3 上移越过同级 H2", () => {
    doc = { title: "T", blocks: [
      { id: "a", type: "h2", text: "A" },
      { id: "b", type: "h3", text: "B" },
      { id: "c", type: "p", text: "c" },
    ] };
    const blocked = quiet(() => !moveBlock("b", -1));
    assert(blocked, "非法移动未被拦截");
    const allowed = quiet(() => moveBlock("b", +1));
    assert(allowed && validate(doc).every((x) => !x.blocking), "合法移动被误拦");
  });

  test("60 步随机守卫操作后结构仍有效", () => {
    doc = makeSampleDoc();
    const pool = ["h2", "h3", "p", "bullet", "num", "quote", "callout"];
    quiet(() => {
      for (let k = 0; k < 60; k++) {
        if (doc.blocks.length === 0) { insertAfter(null, "p"); continue; }
        const b = doc.blocks[Math.floor(Math.random() * doc.blocks.length)];
        switch (k % 4) {
          case 0: setType(b.id, pool[k % pool.length]); break;
          case 1: moveBlock(b.id, k % 2 ? 1 : -1); break;
          case 2: insertAfter(b.id, "p"); break;
          case 3: removeBlock(b.id); break;
        }
      }
    });
    const bad = validate(doc).filter((x) => x.blocking);
    assert(bad.length === 0, "出现层级破坏：" + (bad[0] && bad[0].msg));
  });

  test("编辑与预览一致（随机操作后节点数相等）", () => {
    renderAll();
    const a = auditConsistency();
    assert(a.ok, `模型 ${a.modelNodes} 节点 ≠ 预览 ${a.previewNodes} 节点`);
  });

  test("Markdown 导出与模型一致", () => {
    doc = makeSampleDoc();
    renderAll();
    const md = toMarkdown(doc);
    assert(md.startsWith("# " + doc.title), "标题行不符");
    assert(md.includes("## 背景与目标"), "缺 H2 行");
    assert(md.includes("### 场景一：跨城市头脑风暴"), "缺 H3 行");
    assert(md.includes("1. M1"), "编号列表不符");
    assert(md.includes("- 目标："), "无序列表不符");
    assert(md.includes("> **提示** "), "提示框不符");
  });

  renderAll();
  lastMsg = `自检完成：${results.filter((r) => r.pass).length}/${results.length} 通过`;
  console.table(results);
  renderSelfTestPanel(results);
  renderStatus();
  return results;
}

function renderSelfTestPanel(results) {
  const host = document.getElementById("checker");
  const box = document.createElement("div");
  box.className = "checker-audit";
  const head = document.createElement("span");
  const passed = results.filter((r) => r.pass).length;
  head.innerHTML = `内置自检：<span class="${passed === results.length ? "pass" : "fail"}">`
    + `${passed}/${results.length} 通过</span>`;
  box.appendChild(head);
  results.forEach((r) => {
    const line = document.createElement("span");
    line.className = "mono";
    line.textContent = `${r.pass ? "✓" : "✗"} ${r.name}` + (r.pass ? "" : " —— " + r.info);
    box.appendChild(line);
  });
  host.appendChild(box);
}

/* ---------------- 启动 ---------------- */

function wireHeader() {
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-redo").addEventListener("click", redo);
  document.getElementById("btn-copy-md").addEventListener("click", copyMarkdown);
  document.getElementById("btn-export-md").addEventListener("click", downloadMarkdown);
  document.getElementById("btn-reset").addEventListener("click", resetDoc);

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
  });
}

function init() {
  const stored = loadDoc();
  doc = stored || makeSampleDoc();
  lastMsg = stored ? "已恢复上次编辑内容" : "就绪 · 内置示例文档已随首屏就绪";
  wireHeader();
  renderAll();
  if (location.hash === "#selftest" || location.search.indexOf("selftest") >= 0) {
    runSelfTests();
  }
}

window.__structed = { runSelfTests, validate, toMarkdown, attempt, auditConsistency };
init();
