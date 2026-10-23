// Struct 的领域模型：唯一状态源。
// 所有编辑都经由带 guard 的结构操作（MC-1）：不存在能产生非法骨架的操作；
// 预览、校验、导出全部从同一模型推导（MC-2），一致性由构造保证。
// 本文件保持纯函数、不依赖 React，可在 Node 下直接做不变量验证。

let idCounter = 1;
const newId = (prefix) => `${prefix}-${idCounter++}`;

export const SECTION_KINDS = {
  text: { label: "正文", hint: "标题 + 段落" },
  facts: { label: "要点", hint: "标题 + 键值表" },
  list: { label: "清单", hint: "标题 + 条目" },
  callout: { label: "提示", hint: "标题 + 高亮说明" },
};

export const DOC_TYPES = { release: "更新说明", spec: "产品规格", policy: "使用指南" };
export const STATUSES = { draft: "草稿", review: "评审中", published: "已发布" };

// 新章节一律以“完整合法”的模板落盘：新增即合法，不会产生残缺结构。
export function makeSection(kind) {
  const id = newId("sec");
  switch (kind) {
    case "text":
      return { id, kind, heading: "新的正文段落", paragraphs: ["在此输入段落内容。"] };
    case "facts":
      return { id, kind, heading: "新的要点表", pairs: [{ k: "新的字段", v: "待填写" }] };
    case "list":
      return { id, kind, heading: "新的清单", items: ["新的条目"] };
    case "callout":
      return { id, kind, heading: "新的提示", note: "在此输入需要强调的说明。" };
    default:
      throw new Error(`unknown section kind: ${kind}`);
  }
}

// 首屏内联的示例文档（更新说明）。
export function initialDocument() {
  const mk = (kind, payload) => ({ id: newId("sec"), kind, ...payload });
  return {
    title: "Aurora 笔记 2.4 更新说明",
    meta: {
      docType: "release",
      status: "review",
      version: "2.4.0",
      date: "2026-09-24",
      author: "Aurora 产品团队",
    },
    sections: [
      mk("facts", {
        heading: "版本速览",
        pairs: [
          { k: "发布日期", v: "2026-09-24" },
          { k: "版本号", v: "2.4.0" },
          { k: "目标渠道", v: "全量灰度" },
        ],
      }),
      mk("list", {
        heading: "新增功能",
        items: ["块编辑器支持拖拽排序", "离线草稿自动保存", "全新的模板中心"],
      }),
      mk("text", {
        heading: "体验改进",
        paragraphs: [
          "编辑器冷启动速度提升约 40%，长文档滚动更顺滑，卡顿明显减少。",
          "目录面板现在会跟随光标自动展开所在章节，改稿时定位更快。",
        ],
      }),
      mk("callout", {
        heading: "升级须知",
        note: "本次升级包含数据格式迁移，预计 10 秒内完成；迁移期间请勿关闭应用。",
      }),
      mk("list", {
        heading: "已知问题",
        items: ["部分旧模板的封面图在新版式中会被裁切，将在 2.4.1 补丁修复。"],
      }),
    ],
  };
}

const mapSection = (doc, id, fn) => ({
  ...doc,
  sections: doc.sections.map((s) => (s.id === id ? fn(s) : s)),
});

const guardedRemove = (arr, i, fn) => (arr.length <= 1 ? arr : arr.filter((_, k) => k !== i));

// 结构操作 reducer：唯一的改动入口（guard 失败时返回原引用，历史不推进）。
export function reduceDoc(doc, a) {
  switch (a.t) {
    case "title":
      return { ...doc, title: a.v };
    case "meta":
      return { ...doc, meta: { ...doc.meta, [a.k]: a.v } };
    case "heading":
      return mapSection(doc, a.id, (s) => ({ ...s, heading: a.v }));
    case "note":
      return mapSection(doc, a.id, (s) => ({ ...s, note: a.v }));
    case "para":
      return mapSection(doc, a.id, (s) => ({
        ...s,
        paragraphs: s.paragraphs.map((p, i) => (i === a.i ? a.v : p)),
      }));
    case "paraAdd":
      return mapSection(doc, a.id, (s) => ({ ...s, paragraphs: [...s.paragraphs, "新的段落。"] }));
    case "paraDel":
      return mapSection(doc, a.id, (s) => ({ ...s, paragraphs: guardedRemove(s.paragraphs, a.i) }));
    case "item":
      return mapSection(doc, a.id, (s) => ({
        ...s,
        items: s.items.map((p, i) => (i === a.i ? a.v : p)),
      }));
    case "itemAdd":
      return mapSection(doc, a.id, (s) => ({ ...s, items: [...s.items, "新的条目"] }));
    case "itemDel":
      return mapSection(doc, a.id, (s) => ({ ...s, items: guardedRemove(s.items, a.i) }));
    case "pair":
      return mapSection(doc, a.id, (s) => ({
        ...s,
        pairs: s.pairs.map((p, i) => (i === a.i ? { ...p, [a.f]: a.v } : p)),
      }));
    case "pairAdd":
      return mapSection(doc, a.id, (s) => ({ ...s, pairs: [...s.pairs, { k: "新的字段", v: "待填写" }] }));
    case "pairDel":
      return mapSection(doc, a.id, (s) => ({ ...s, pairs: guardedRemove(s.pairs, a.i) }));
    case "secAdd": {
      const arr = [...doc.sections];
      const at = Math.max(0, Math.min(a.at ?? arr.length, arr.length));
      arr.splice(at, 0, makeSection(a.kind));
      return { ...doc, sections: arr };
    }
    case "secDel": {
      if (doc.sections.length <= 1) return doc; // 骨架 guard：至少保留一个章节
      return { ...doc, sections: doc.sections.filter((s) => s.id !== a.id) };
    }
    case "secMove": {
      const i = doc.sections.findIndex((s) => s.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= doc.sections.length) return doc;
      const arr = [...doc.sections];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...doc, sections: arr };
    }
    case "reset":
      return initialDocument();
    default:
      return doc;
  }
}

// 内容级校验（MC-3 的“软”半边）：骨架由操作保证，内容空缺在此如实呈现。
export function validate(doc) {
  const issues = [];
  if (!doc.title.trim()) issues.push({ sectionId: null, msg: "文档标题不能为空" });
  doc.sections.forEach((s, idx) => {
    const name = `第 ${idx + 1} 节「${SECTION_KINDS[s.kind].label}」`;
    if (!s.heading.trim()) issues.push({ sectionId: s.id, msg: `${name}缺少标题` });
    if (s.kind === "list" && s.items.some((it) => !it.trim()))
      issues.push({ sectionId: s.id, msg: `${name}存在空条目` });
    if (s.kind === "facts" && s.pairs.some((p) => !p.k.trim() || !p.v.trim()))
      issues.push({ sectionId: s.id, msg: `${name}存在未填写的键或值` });
    if (s.kind === "callout" && !s.note.trim())
      issues.push({ sectionId: s.id, msg: `${name}说明内容为空` });
    if (s.kind === "text" && s.paragraphs.some((p) => !p.trim()))
      issues.push({ sectionId: s.id, msg: `${name}存在空段落` });
  });
  return issues;
}

export const STRUCTURE_RULES = [
  "文档有且仅有一个标题",
  "章节有序，至少保留一个章节",
  "每个章节都有标题",
  "清单 / 要点 / 段落不留空块",
  "所有改动都可撤销，结构不可被破坏",
];

export function stats(doc) {
  const blocks = doc.sections.reduce((n, s) => {
    if (s.kind === "text") return n + s.paragraphs.length;
    if (s.kind === "facts") return n + s.pairs.length;
    if (s.kind === "list") return n + s.items.length;
    return n + 1;
  }, 0);
  let chars = doc.title.length;
  doc.sections.forEach((s) => {
    chars += s.heading.length;
    if (s.kind === "text") s.paragraphs.forEach((p) => (chars += p.length));
    if (s.kind === "list") s.items.forEach((p) => (chars += p.length));
    if (s.kind === "facts") s.pairs.forEach((p) => (chars += p.k.length + p.v.length));
    if (s.kind === "callout") chars += s.note.length;
  });
  return { sections: doc.sections.length, blocks, chars };
}

// 导出同样由模型推导：预览、编辑器与导出三方永不一致漂移。
export function toMarkdown(doc) {
  const lines = [];
  lines.push(`# ${doc.title}`, "");
  const m = doc.meta;
  lines.push(
    `> 类型：${DOC_TYPES[m.docType]} · 状态：${STATUSES[m.status]} · 版本：${m.version} · 日期：${m.date} · 作者：${m.author}`,
    ""
  );
  for (const s of doc.sections) {
    lines.push(`## ${s.heading || "（未命名章节）"}`, "");
    if (s.kind === "facts") {
      lines.push("| 字段 | 内容 |", "| --- | --- |");
      for (const p of s.pairs) lines.push(`| ${p.k || "（待填写）"} | ${p.v || "（待填写）"} |`);
      lines.push("");
    } else if (s.kind === "list") {
      for (const it of s.items) lines.push(`- ${it || "（空条目）"}`);
      lines.push("");
    } else if (s.kind === "callout") {
      lines.push(`> ${s.note || "（待填写）"}`, "");
    } else {
      for (const p of s.paragraphs) lines.push(p || "（待填写）", "");
    }
  }
  return lines.join("\n");
}

export function toJSON(doc) {
  return JSON.stringify(doc, null, 2);
}
