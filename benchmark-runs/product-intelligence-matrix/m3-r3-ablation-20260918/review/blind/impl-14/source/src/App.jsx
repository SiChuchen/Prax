import React, { useEffect, useMemo, useReducer, useState } from "react";
import {
  DOC_TYPES,
  SECTION_KINDS,
  STATUSES,
  STRUCTURE_RULES,
  initialDocument,
  reduceDoc,
  stats,
  toMarkdown,
  toJSON,
  validate,
} from "./model.js";

const HISTORY_LIMIT = 100;

// 文本类操作按“同一字段的连续输入”合并为一个撤销组：一次 Ctrl+Z 回退整段输入。
const TEXT_OP = new Set(["title", "meta", "heading", "para", "item", "pair", "note"]);
const sigOf = (a) =>
  TEXT_OP.has(a.t) ? [a.t, a.id ?? "", a.k ?? "", a.i ?? "", a.f ?? ""].join("|") : null;

// 历史栈包住结构 reducer：每个落盘操作都可撤销（MC-5，P-28）。
function historyReducer(state, action) {
  switch (action.t) {
    case "undo": {
      if (!state.past.length) return state;
      const past = state.past.slice(0, -1);
      const doc = state.past[state.past.length - 1];
      return { past, doc, future: [state.doc, ...state.future].slice(0, HISTORY_LIMIT), lastSig: null };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [doc, ...rest] = state.future;
      return { past: [...state.past, state.doc].slice(-HISTORY_LIMIT), doc, future: rest, lastSig: null };
    }
    default: {
      const next = reduceDoc(state.doc, action);
      if (next === state.doc) return state; // guard 拒绝的操作：历史不推进
      const sig = sigOf(action);
      if (sig && sig === state.lastSig) {
        return { past: state.past, doc: next, future: [], lastSig: sig };
      }
      return {
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        doc: next,
        future: [],
        lastSig: sig,
      };
    }
  }
}

const initState = () => ({ past: [], doc: initialDocument(), future: [], lastSig: null });

const Ph = ({ children }) => <span className="ph">{children}</span>;
const orPh = (v, ph) => (v.trim() ? v : <Ph>{ph}</Ph>);

export default function App() {
  const [state, dispatch] = useReducer(historyReducer, undefined, initState);
  const [selectedId, setSelectedId] = useState(null);
  const [lastEdited, setLastEdited] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const doc = state.doc;

  const issues = useMemo(() => validate(doc), [doc]);
  const s = useMemo(() => stats(doc), [doc]);
  const issueSections = useMemo(() => new Set(issues.map((i) => i.sectionId)), [issues]);

  const act = (action) => {
    dispatch(action);
    setLastEdited(new Date());
  };

  // Ctrl+Z / Ctrl+Y（含 Ctrl+Shift+Z）—— 键盘与指针等价（WEB-DESKTOP）。
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        act({ t: "undo" });
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        act({ t: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 双向选择同步：编辑器卡片与预览块互相高亮并滚动到位。
  useEffect(() => {
    if (!selectedId) return;
    document
      .querySelectorAll(`[data-section="${selectedId}"]`)
      .forEach((el) => el.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }, [selectedId]);

  const onCopy = async () => {
    const md = toMarkdown(doc);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onDownload = () => {
    const blob = new Blob([toJSON(doc)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.title || "document").replace(/[\\/:*?"<>|]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onReset = () => {
    if (window.confirm("重置为示例文档？当前内容仍可通过撤销（Ctrl+Z）恢复。")) act({ t: "reset" });
  };

  const addSection = (kind) => {
    const at = selectedId
      ? doc.sections.findIndex((x) => x.id === selectedId) + 1
      : doc.sections.length;
    act({ t: "secAdd", kind, at: at || doc.sections.length });
  };

  const okPill = issues.length === 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand" aria-hidden="true">
          §
        </div>
        <div className="brand-name">
          Struct
          <span className="brand-sub">结构化文档编辑器</span>
        </div>

        <input
          className="title-input"
          value={doc.title}
          onChange={(e) => act({ t: "title", v: e.target.value })}
          aria-label="文档标题"
          placeholder="文档标题"
        />

        <div className="header-pills">
          <div className="issues-anchor">
            <button
              type="button"
              className={`pill ${okPill ? "pill-ok" : "pill-warn"}`}
              onClick={() => setIssuesOpen((v) => !v)}
              aria-expanded={issuesOpen}
              aria-controls="issues-pop"
              title="查看结构检查详情"
            >
              <span className="dot" aria-hidden="true" />
              结构检查 · {okPill ? "通过" : `${issues.length} 项待处理`}
            </button>
            {issuesOpen && (
              <div className="pop" id="issues-pop" role="dialog" aria-label="结构检查详情">
                {okPill ? (
                  <>
                    <p className="pop-title">已通过全部结构规则</p>
                    <ul>
                      {STRUCTURE_RULES.map((r) => (
                        <li key={r}>✓ {r}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="pop-title">待处理的结构提示</p>
                    <ul>
                      {issues.map((i, k) => (
                        <li key={k}>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => {
                              setSelectedId(i.sectionId);
                              setIssuesOpen(false);
                            }}
                          >
                            {i.msg}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="pop-hint">骨架结构不受影响；内容补齐后提示自动消除。</p>
                  </>
                )}
              </div>
            )}
          </div>
          <span
            className="pill pill-sync"
            title="预览由同一文档状态实时推导，与编辑器永不漂移"
          >
            编辑器 ⇄ 预览 已同步
          </span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={() => act({ t: "undo" })}
            disabled={!state.past.length}
            title="撤销（Ctrl+Z）"
          >
            ↺ 撤销
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => act({ t: "redo" })}
            disabled={!state.future.length}
            title="重做（Ctrl+Y）"
          >
            ↻ 重做
          </button>
          <button type="button" className="btn" onClick={onCopy}>
            {copied ? "✓ 已复制" : "复制 Markdown"}
          </button>
          <button type="button" className="btn" onClick={onDownload}>
            下载 JSON
          </button>
          <button type="button" className="btn btn-danger" onClick={onReset}>
            重置
          </button>
        </div>
      </header>

      <main className="main">
        {/* ── 编辑窗格：结构化编辑（representation.primary = form）── */}
        <section className="pane pane-editor" aria-label="结构编辑器">
          <div className="pane-head">
            <h2>编辑</h2>
            <span className="pane-note">所有改动实时同步到预览</span>
          </div>

          <div className="card meta-card">
            <p className="card-kicker">文档信息</p>
            <div className="meta-grid">
              <label>
                类型
                <select
                  className="in"
                  value={doc.meta.docType}
                  onChange={(e) => act({ t: "meta", k: "docType", v: e.target.value })}
                >
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select
                  className="in"
                  value={doc.meta.status}
                  onChange={(e) => act({ t: "meta", k: "status", v: e.target.value })}
                >
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                版本
                <input
                  className="in"
                  value={doc.meta.version}
                  onChange={(e) => act({ t: "meta", k: "version", v: e.target.value })}
                />
              </label>
              <label>
                日期
                <input
                  className="in"
                  type="date"
                  value={doc.meta.date}
                  onChange={(e) => act({ t: "meta", k: "date", v: e.target.value })}
                />
              </label>
              <label>
                作者
                <input
                  className="in"
                  value={doc.meta.author}
                  onChange={(e) => act({ t: "meta", k: "author", v: e.target.value })}
                />
              </label>
            </div>
          </div>

          <ol className="sections">
            {doc.sections.map((sec, idx) => (
              <SectionCard
                key={sec.id}
                sec={sec}
                idx={idx}
                total={doc.sections.length}
                selected={selectedId === sec.id}
                hasIssue={issueSections.has(sec.id)}
                onSelect={() => setSelectedId(sec.id)}
                act={act}
              />
            ))}
          </ol>

          <div className="add-row" role="group" aria-label="添加章节">
            <span className="add-label">添加章节</span>
            {Object.entries(SECTION_KINDS).map(([k, meta]) => (
              <button key={k} type="button" className="btn" onClick={() => addSection(k)}>
                + {meta.label}
              </button>
            ))}
          </div>
          <p className="rules-note">
            结构规则：标题必填 · 每节有标题 · 不留空块 · 至少保留一个章节。骨架由操作保护，内容提示实时显示在两侧。
          </p>
        </section>

        {/* ── 预览窗格：同一模型的渲染视图（representation.supporting = document）── */}
        <section className="pane pane-preview" aria-label="文档预览">
          <div className="pane-head">
            <h2>预览</h2>
            <span className="pane-note">点击任一段落可反向定位编辑器</span>
          </div>
          <div className="paper-wrap">
            <article className="paper">
              <h1>{orPh(doc.title, "（未命名文档）")}</h1>
              <p className="paper-meta">
                {DOC_TYPES[doc.meta.docType]} · {STATUSES[doc.meta.status]} · v{doc.meta.version} ·{" "}
                {doc.meta.date} · {doc.meta.author}
              </p>
              <hr />
              {doc.sections.map((sec) => (
                <PreviewSection
                  key={sec.id}
                  sec={sec}
                  selected={selectedId === sec.id}
                  hasIssue={issueSections.has(sec.id)}
                  onSelect={() => setSelectedId(sec.id)}
                />
              ))}
            </article>
          </div>
          <footer className="pane-foot">
            <span>
              {s.sections} 节 · {s.blocks} 块 · 约 {s.chars} 字
            </span>
            <span className="pane-foot-right">
              最后编辑 {lastEdited.toLocaleTimeString("zh-CN", { hour12: false })}
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function SectionCard({ sec, idx, total, selected, hasIssue, onSelect, act }) {
  const kind = SECTION_KINDS[sec.kind];
  const move = (dir) => act({ t: "secMove", id: sec.id, dir });
  return (
    <li
      className={`card sec-card${selected ? " selected" : ""}${hasIssue ? " warn" : ""}`}
      data-section={sec.id}
      onMouseDown={onSelect}
      onFocus={onSelect}
    >
      <div className="sec-head">
        <span className={`badge badge-${sec.kind}`}>{kind.label}</span>
        <span className="sec-index">第 {idx + 1} 节</span>
        <span className="sec-ops">
          <button
            type="button"
            className="icon-btn"
            onClick={() => move(-1)}
            disabled={idx === 0}
            aria-label={`上移「${sec.heading || "未命名"}」`}
            title="上移"
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => move(1)}
            disabled={idx === total - 1}
            aria-label={`下移「${sec.heading || "未命名"}」`}
            title="下移"
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-btn icon-danger"
            onClick={() => act({ t: "secDel", id: sec.id })}
            disabled={total <= 1}
            title={total <= 1 ? "至少保留一个章节" : "删除章节（可撤销）"}
            aria-label={`删除「${sec.heading || "未命名"}」`}
          >
            ✕
          </button>
        </span>
      </div>

      <input
        className="in heading-input"
        value={sec.heading}
        placeholder="章节标题"
        aria-label={`第 ${idx + 1} 节标题`}
        onChange={(e) => act({ t: "heading", id: sec.id, v: e.target.value })}
      />

      {sec.kind === "text" && (
        <div className="sec-body">
          {sec.paragraphs.map((p, i) => (
            <div className="block-row" key={i}>
              <textarea
                className="in"
                rows={2}
                value={p}
                placeholder="段落内容"
                aria-label={`第 ${idx + 1} 节第 ${i + 1} 段`}
                onChange={(e) => act({ t: "para", id: sec.id, i, v: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => act({ t: "paraDel", id: sec.id, i })}
                disabled={sec.paragraphs.length <= 1}
                title={sec.paragraphs.length <= 1 ? "至少保留一个段落" : "删除段落（可撤销）"}
                aria-label={`删除第 ${i + 1} 段`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => act({ t: "paraAdd", id: sec.id })}>
            + 段落
          </button>
        </div>
      )}

      {sec.kind === "list" && (
        <div className="sec-body">
          {sec.items.map((it, i) => (
            <div className="block-row" key={i}>
              <span className="row-dot" aria-hidden="true">
                •
              </span>
              <input
                className="in"
                value={it}
                placeholder="条目内容"
                aria-label={`第 ${idx + 1} 节第 ${i + 1} 条`}
                onChange={(e) => act({ t: "item", id: sec.id, i, v: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => act({ t: "itemDel", id: sec.id, i })}
                disabled={sec.items.length <= 1}
                title={sec.items.length <= 1 ? "至少保留一个条目" : "删除条目（可撤销）"}
                aria-label={`删除第 ${i + 1} 条`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => act({ t: "itemAdd", id: sec.id })}>
            + 条目
          </button>
        </div>
      )}

      {sec.kind === "facts" && (
        <div className="sec-body">
          {sec.pairs.map((p, i) => (
            <div className="block-row pair-row" key={i}>
              <input
                className="in"
                value={p.k}
                placeholder="字段"
                aria-label={`第 ${idx + 1} 节第 ${i + 1} 行字段名`}
                onChange={(e) => act({ t: "pair", id: sec.id, i, f: "k", v: e.target.value })}
              />
              <input
                className="in"
                value={p.v}
                placeholder="内容"
                aria-label={`第 ${idx + 1} 节第 ${i + 1} 行内容`}
                onChange={(e) => act({ t: "pair", id: sec.id, i, f: "v", v: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => act({ t: "pairDel", id: sec.id, i })}
                disabled={sec.pairs.length <= 1}
                title={sec.pairs.length <= 1 ? "至少保留一行" : "删除该行（可撤销）"}
                aria-label={`删除第 ${i + 1} 行`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => act({ t: "pairAdd", id: sec.id })}>
            + 键值行
          </button>
        </div>
      )}

      {sec.kind === "callout" && (
        <div className="sec-body">
          <textarea
            className="in"
            rows={2}
            value={sec.note}
            placeholder="提示内容"
            aria-label={`第 ${idx + 1} 节提示内容`}
            onChange={(e) => act({ t: "note", id: sec.id, v: e.target.value })}
          />
        </div>
      )}
    </li>
  );
}

function PreviewSection({ sec, selected, hasIssue, onSelect }) {
  return (
    <div
      className={`pv-sec${selected ? " selected" : ""}${hasIssue ? " warn" : ""}`}
      data-section={sec.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`预览定位：${sec.heading || "未命名章节"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <h2>
        {orPh(sec.heading, "（未命名章节）")}
        {hasIssue && <span className="pv-flag">待补齐</span>}
      </h2>
      {sec.kind === "facts" && (
        <table className="pv-table">
          <tbody>
            {sec.pairs.map((p, i) => (
              <tr key={i}>
                <th>{orPh(p.k, "（待填写）")}</th>
                <td>{orPh(p.v, "（待填写）")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sec.kind === "list" && (
        <ul>
          {sec.items.map((it, i) => (
            <li key={i}>{orPh(it, "（空条目）")}</li>
          ))}
        </ul>
      )}
      {sec.kind === "callout" && <blockquote>{orPh(sec.note, "（待填写）")}</blockquote>}
      {sec.kind === "text" &&
        sec.paragraphs.map((p, i) => <p key={i}>{orPh(p, "（待填写）")}</p>)}
    </div>
  );
}
