# Validation Evidence Receipt — runtime checks pending (NOT collected)
session: ds_20260915163456_f5dc0e15
collected: 2026-09-16
collected_by: execution-arm agent (Claude) — cell-j01-s01-b
status: NOT COLLECTED — no executable browser in this arm

## Checks affected
- keyboard (empirical)
- hierarchy_review (visual)

## Why
No shell tool and no browser-automation MCP exist in this session (verified twice via ToolSearch;
all subagent types verified as non-executing — see static-analysis-receipt.md §Environment fact).
Rendering-dependent evidence cannot be produced here and was NOT fabricated.

## What exists and is runnable (one command per stage, any operator)
selftest.js drives the app through real DOM events (click/input/change/KeyboardEvent) and
asserts, per stage 0..8 (cumulative, deterministic seed):

- stage 0: first-screen-ready (160 entities, 0 selected, 160 visible, >100 tree rows, phase=ready)
- stage 1: ZERO-COLLATERAL core check — collapse unit 水务计量 (6 entities), select system
  能耗计量系统 → exactly 12 selected; no selected entity belongs to collapsed sg-hq-ene-wtr;
  group checkbox fully checked over visible scope; count chip "0/18"; inspector shows 12 items
- stage 2: status filter 停用 → 全选可见 selects exactly the visible scope; scope indicator
  shows 可见 N / 总计 160
- stage 3: batch status op with forced preview — confirm label “确认执行（影响 R 项）”,
  receipt “已影响 R 项”, maintenance count += R
- stage 4: one-step undo — receipt “已撤销”, maintenance count restored
- stage 5: move modal — target = current attribution → explicit error “影响 0 项” + confirm
  disabled; valid target → 预览 12 项; cancel preserves selection; no move executed
- stage 6: delete 2 → total 158, receipt “已影响 2 项”; undo → total 160 restored
- stage 7: keyboard — ArrowDown moves row focus, Space selects focused row, activeElement
  inside treegrid
- stage 8: search “zzzz不存在” → empty-state “无匹配实体”; 清除筛选 restores 160

## Evidence command (Windows, any Chromium)
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu ^
  --user-data-dir="%TEMP%\chrome-headless-cell" --window-size=1440,900 --virtual-time-budget=8000 ^
  --screenshot="stageN.png" ^
  "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j01-s01-b/index.html?selftest=1&stage=N"

Append --dump-dom to capture the `<pre id="selftest-json">` assertion results
([{stage,name,pass,got},...]) and the `#selftest-stage` failed-count line. Normal open
(no query string) loads none of the self-test logic.
