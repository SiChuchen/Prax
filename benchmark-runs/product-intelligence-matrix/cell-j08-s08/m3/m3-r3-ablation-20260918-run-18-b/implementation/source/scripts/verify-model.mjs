// 模型不变量验证：2000 次随机结构操作后，骨架必须依然合法（编辑不破坏结构）。
// 运行：npm run verify
import {
  SECTION_KINDS,
  initialDocument,
  reduceDoc,
  stats,
  toMarkdown,
  validate,
} from "../src/model.js";

// mulberry32：可复现的伪随机
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function checkSkeleton(doc, step) {
  assert(doc.sections.length >= 1, `step ${step}: sections < 1`);
  for (const s of doc.sections) {
    assert(SECTION_KINDS[s.kind], `step ${step}: unknown kind ${s.kind}`);
    assert(typeof s.heading === "string", `step ${step}: heading missing`);
    if (s.kind === "text")
      assert(s.paragraphs.length >= 1, `step ${step}: text section with 0 paragraphs`);
    if (s.kind === "list") assert(s.items.length >= 1, `step ${step}: list section with 0 items`);
    if (s.kind === "facts") assert(s.pairs.length >= 1, `step ${step}: facts section with 0 pairs`);
    if (s.kind === "callout") assert(typeof s.note === "string", `step ${step}: note missing`);
  }
  // 校验器只允许“内容空缺”类提示，不允许骨架类失败（骨架不可被操作破坏）
  for (const issue of validate(doc)) {
    assert(
      /缺少标题|空条目|空段落|未填写|内容为空|标题不能为空/.test(issue.msg),
      `step ${step}: unexpected issue: ${issue.msg}`
    );
  }
}

const rand = mulberry32(20260924);
let doc = initialDocument();
const kinds = Object.keys(SECTION_KINDS);
let ops = 0;

const pick = (arr) => arr[Math.floor(rand() * arr.length)];

for (let step = 0; step < 2000; step++) {
  const sid = pick(doc.sections).id;
  const sec = doc.sections.find((x) => x.id === sid);
  const roll = rand();
  if (roll < 0.18) doc = reduceDoc(doc, { t: "secDel", id: sid });
  else if (roll < 0.34) doc = reduceDoc(doc, { t: "secAdd", kind: pick(kinds), at: Math.floor(rand() * 10) });
  else if (roll < 0.46) doc = reduceDoc(doc, { t: "secMove", id: sid, dir: rand() < 0.5 ? -1 : 1 });
  else if (roll < 0.56) doc = reduceDoc(doc, { t: "heading", id: sid, v: rand() < 0.15 ? "" : `标题 ${step}` });
  else if (roll < 0.62 && sec.kind === "text") doc = reduceDoc(doc, { t: "paraDel", id: sid, i: 0 });
  else if (roll < 0.68 && sec.kind === "text") doc = reduceDoc(doc, { t: "paraAdd", id: sid });
  else if (roll < 0.74 && sec.kind === "list") doc = reduceDoc(doc, { t: "itemDel", id: sid, i: 0 });
  else if (roll < 0.8 && sec.kind === "list") doc = reduceDoc(doc, { t: "itemAdd", id: sid });
  else if (roll < 0.84 && sec.kind === "facts") doc = reduceDoc(doc, { t: "pairDel", id: sid, i: 0 });
  else if (roll < 0.88 && sec.kind === "facts") doc = reduceDoc(doc, { t: "pairAdd", id: sid });
  else if (roll < 0.92) doc = reduceDoc(doc, { t: "title", v: rand() < 0.1 ? "" : `文档 ${step}` });
  else if (roll < 0.96) doc = reduceDoc(doc, { t: "meta", k: "version", v: `1.${step}.0` });
  else doc = reduceDoc(doc, { t: "note", id: sid, v: rand() < 0.15 ? "" : `说明 ${step}` });
  ops++;
  checkSkeleton(doc, step);
}

// 删到只剩一个章节后，删除必须被 guard 拒绝（返回同一引用）
let single = initialDocument();
while (single.sections.length > 1) single = reduceDoc(single, { t: "secDel", id: single.sections[0].id });
const guarded = reduceDoc(single, { t: "secDel", id: single.sections[0].id });
assert(guarded === single, "secDel guard failed on single-section doc");
assert(guarded.sections.length === 1, "single-section doc must stay at 1 section");

// 统计与导出一致性
const s = stats(doc);
assert(s.sections === doc.sections.length, "stats.sections mismatch");
const md = toMarkdown(doc);
assert(md.startsWith("# "), "markdown must start with H1");
assert(md.includes(doc.title), "markdown missing title");

console.log(
  `PASS: ${ops} random structural ops — skeleton stayed valid; guards held; stats/export consistent ` +
    `(final: ${s.sections} sections, ${s.blocks} blocks, ${validate(doc).length} content issue(s))`
);
