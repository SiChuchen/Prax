import { useEffect, useMemo, useRef, useState } from "react";
import { FIXTURE, formatDuration, formatUptime, type SessionRow, type SessionStatus } from "./data";

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready" };

type SortKey = "startedAt" | "status";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | SessionStatus;

const STATUS_LABEL: Record<SessionStatus, string> = {
  running: "running",
  complete: "complete",
  failed: "failed",
};

// Test seams (golden case PRAX-DASHBOARD-001): ?forceError=1 makes the
// simulated load fail; ?slow=1 extends the loading skeleton so the state is
// deterministically observable. Both must survive refactors.
function readSeam(name: "forceError" | "slow"): boolean {
  return new URLSearchParams(window.location.search).get(name) === "1";
}

function useSimulatedLoad(): [LoadState, () => void] {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const delay = readSeam("slow") ? 30000 : 300;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        // Retry ignores the forced-failure seam: the operator's explicit
        // retry must always be able to reach ready.
        const failed = readSeam("forceError") && attemptRef.current === 0;
        setState(failed ? { phase: "error" } : { phase: "ready" });
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attemptRef.current]);

  const retry = () => {
    attemptRef.current += 1;
    setState({ phase: "loading" });
  };
  return [state, retry];
}

function StatusBadge({ status }: { status: SessionStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

function KpiCards({ sessions }: { sessions: SessionRow[] }) {
  const today = sessions.filter((session) => session.startedAt.startsWith("2026-08-3") || session.startedAt.startsWith("2026-08-29"));
  const medianLatency = (() => {
    const sorted = [...sessions].map((session) => session.durationMs).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  })();
  const evidenceFiles = sessions.reduce((sum, session) => sum + session.evidence, 0);
  const openGaps = 1; // n4-export, recorded in capability-gaps.yaml this run
  const kpis = [
    { label: "sessions (48h)", value: String(today.length) },
    { label: "median gate latency", value: formatDuration(medianLatency) },
    { label: "evidence files", value: String(evidenceFiles) },
    { label: "open gaps", value: String(openGaps) },
  ];
  return (
    <section className="kpi-row" aria-label="Key metrics">
      {kpis.map((kpi) => (
        <div className="kpi-card" key={kpi.label}>
          <span className="kpi-value mono">{kpi.value}</span>
          <span className="kpi-label">{kpi.label}</span>
        </div>
      ))}
    </section>
  );
}

function GateChart() {
  const max = Math.max(...FIXTURE.gateOutcomes.map((day) => day.passed + day.failed));
  return (
    <section className="panel chart-panel" aria-label="Gate outcomes, last 14 days">
      <h2 className="panel-title">gate outcomes · 14d</h2>
      <svg viewBox="0 0 560 120" role="img" aria-label="Bar chart of passed and failed gates per day for the last 14 days">
        {FIXTURE.gateOutcomes.map((day, index) => {
          const x = 10 + index * 39;
          const passedHeight = (day.passed / max) * 90;
          const failedHeight = (day.failed / max) * 90;
          return (
            <g key={day.date}>
              <rect x={x} y={100 - passedHeight} width="14" height={passedHeight} fill="#5B8AF5" rx="2">
                <title>{`${day.date}: ${day.passed} passed`}</title>
              </rect>
              {day.failed > 0 && (
                <rect x={x} y={100 - passedHeight - failedHeight - 2} width="14" height={failedHeight} fill="#E5484D" rx="2">
                  <title>{`${day.date}: ${day.failed} failed`}</title>
                </rect>
              )}
              <text x={x + 7} y="114" textAnchor="middle" className="chart-tick">
                {day.date}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="legend">
        <span className="legend-swatch legend-pass" /> passed <span className="legend-swatch legend-fail" /> failed
      </p>
    </section>
  );
}

function EventLog() {
  const events = FIXTURE.events.slice(0, 200);
  return (
    <section className="panel log-panel" aria-label="Event log">
      <h2 className="panel-title">event log</h2>
      <ul className="event-list">
        {events.map((event) => (
          <li key={`${event.at}-${event.message}`} className={`event event-${event.level}`}>
            <span className="mono event-time">{event.at.slice(5, 16).replace("T", " ")}</span>
            <span className="event-message">{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function App() {
  const [load, retry] = useSimulatedLoad();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [taskFilter, setTaskFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = FIXTURE.sessions;
  const visible = useMemo(() => {
    const needle = taskFilter.trim().toLowerCase();
    const filtered = sessions.filter(
      (session) =>
        (statusFilter === "all" || session.status === statusFilter) &&
        (needle === "" || session.task.toLowerCase().includes(needle)),
    );
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "startedAt") return a.startedAt.localeCompare(b.startedAt) * direction;
      return a.status.localeCompare(b.status) * direction;
    });
  }, [sessions, statusFilter, taskFilter, sortKey, sortDir]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const activateRow = (event: React.KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId((current) => (current === id ? null : id));
    }
  };

  return (
    <div className="dashboard">
      <header className="runtime-strip" aria-label="Runtime identity">
        <span className="wordmark">Prax</span>
        <span className="mono strip-item">runtime {FIXTURE.runtime.version}</span>
        <span className="mono strip-item">uptime {formatUptime(FIXTURE.runtime.uptimeMs)}</span>
        <span className="mono strip-item">{sessions.length} sessions on record</span>
      </header>

      {load.phase === "loading" && (
        <div className="skeleton-wrap" role="status" aria-label="Loading dashboard data">
          <div className="skeleton kpi-skeleton" />
          <div className="skeleton table-skeleton" />
          <span className="sr-only">Loading…</span>
        </div>
      )}

      {load.phase === "error" && (
        <div className="error-banner" role="alert">
          <span>Failed to load dashboard data (simulated failure, ?forceError=1).</span>
          <button type="button" className="retry-button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {load.phase === "ready" && (
        <>
          <KpiCards sessions={sessions} />

          <main className="explorer">
            <section className="panel table-panel" aria-label="Sessions">
              <div className="table-toolbar">
                <h2 className="panel-title">sessions</h2>
                <label className="filter-label">
                  status{" "}
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    <option value="all">all</option>
                    <option value="running">running</option>
                    <option value="complete">complete</option>
                    <option value="failed">failed</option>
                  </select>
                </label>
                <label className="filter-label">
                  task{" "}
                  <input
                    className="filter-input"
                    type="text"
                    value={taskFilter}
                    onChange={(event) => setTaskFilter(event.target.value)}
                    placeholder="contains…"
                  />
                </label>
                <span className="mono result-count" role="status" aria-live="polite">
                  {visible.length} / {sessions.length}
                </span>
              </div>
              <table className="session-table">
                <thead>
                  <tr>
                    <th scope="col">session</th>
                    <th scope="col" aria-sort={sortKey === "startedAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="sort-button" onClick={() => toggleSort("startedAt")}>
                        started {sortKey === "startedAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col" aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="sort-button" onClick={() => toggleSort("status")}>
                        status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">gates</th>
                    <th scope="col">evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={5}>
                        <span className="empty-state">
                          No sessions match status “{statusFilter}”
                          {taskFilter ? ` / task “${taskFilter}”` : ""}. Clear the filters to see all {sessions.length}.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    visible.map((session) => (
                      <tr
                        key={session.id}
                        tabIndex={0}
                        className={`session-row${selectedId === session.id ? " selected" : ""}`}
                        aria-selected={selectedId === session.id}
                        onClick={() => setSelectedId((current) => (current === session.id ? null : session.id))}
                        onKeyDown={(event) => activateRow(event, session.id)}
                      >
                        <td className="mono">{session.id}</td>
                        <td className="started mono">{session.startedAt.slice(5, 16).replace("T", " ")}</td>
                        <td>
                          <StatusBadge status={session.status} />
                        </td>
                        <td className="mono">
                          {session.gates.passed}/{session.gates.total}
                        </td>
                        <td className="mono">{session.evidence}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <aside className={`panel detail-panel${selected ? "" : " empty"}`} aria-label="Session detail" aria-live="polite">
              <h2 className="panel-title">detail</h2>
              {selected ? (
                <dl className="detail-grid">
                  <dt>session</dt>
                  <dd className="mono">{selected.id}</dd>
                  <dt>task</dt>
                  <dd>{selected.task}</dd>
                  <dt>requirement</dt>
                  <dd>{selected.requirement}</dd>
                  <dt>status</dt>
                  <dd>
                    <StatusBadge status={selected.status} />
                  </dd>
                  <dt>started</dt>
                  <dd className="mono">{selected.startedAt}</dd>
                  <dt>duration</dt>
                  <dd className="mono">{formatDuration(selected.durationMs)}</dd>
                  <dt>gates</dt>
                  <dd className="mono">
                    {selected.gates.passed}/{selected.gates.total} passed
                  </dd>
                  <dt>evidence</dt>
                  <dd className="mono">{selected.evidence} files</dd>
                </dl>
              ) : (
                <p className="detail-empty">Select a row to inspect a session.</p>
              )}
            </aside>
          </main>

          <div className="lower-row">
            <GateChart />
            <EventLog />
          </div>
        </>
      )}
    </div>
  );
}
