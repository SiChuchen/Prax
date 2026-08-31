import { useEffect, useRef, useState } from "react";

/**
 * PRAX-WIZARD-001 — benchmark-run setup wizard (direct_code).
 * Pattern contract: PAT-SETTINGS-SECTIONS (SETTINGS-NAVIGATION step header,
 * SETTINGS-SECTION per-step goal groups, CHANGE-FEEDBACK submit status).
 * State model: empty (fresh draft) / ready (all steps valid) / error
 * (per-step validation, announced) / loading (submitting) / success banner.
 */

const STORAGE_KEY = "prax-wizard-draft-v1";
const MAX_REQUIREMENT_CHARS = 4000;
const SUBMIT_MS = 1200;

const SURFACES = [
  "landing-hero",
  "settings-page",
  "architecture-canvas",
  "pricing-compare",
] as const;

const MODELS = [
  "glm-5.3[1m]",
  "glm-4.7",
  "claude-opus-4.5",
  "claude-sonnet-4.5",
  "qwen3-coder",
] as const;

interface Draft {
  surface: string;
  requirementText: string;
  modelA: string;
  modelB: string;
  replicateCount: number;
  blindReview: boolean;
}

const EMPTY_DRAFT: Draft = {
  surface: "",
  requirementText: "",
  modelA: MODELS[0],
  modelB: MODELS[2],
  replicateCount: 3,
  blindReview: true,
};

const STEP_NAMES = ["Target", "Arms", "Review"] as const;

function step1Errors(draft: Draft): string[] {
  const errors: string[] = [];
  if (draft.surface === "") errors.push("Surface under test is required.");
  const text = draft.requirementText.trim();
  if (text === "") errors.push("Requirement text is required.");
  if (draft.requirementText.length > MAX_REQUIREMENT_CHARS) {
    errors.push(
      `Requirement text exceeds ${MAX_REQUIREMENT_CHARS} characters (current ${draft.requirementText.length}).`,
    );
  }
  return errors;
}

function step2Errors(draft: Draft): string[] {
  if (draft.modelA === draft.modelB) {
    return ["Arm A and Arm B must use different models."];
  }
  return [];
}

function isStoredDraft(value: unknown): value is { draft: Draft; step: number } {
  if (typeof value !== "object" || value === null) return false;
  const draft = (value as { draft?: unknown }).draft;
  return (
    typeof draft === "object" &&
    draft !== null &&
    typeof (draft as Draft).surface === "string" &&
    typeof (draft as Draft).requirementText === "string"
  );
}

export function App() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phase, setPhase] = useState<"form" | "submitting" | "success">("form");
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState<Record<number, boolean>>({ 1: false, 2: false });
  const [resumeOffer, setResumeOffer] = useState<{ draft: Draft; step: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const errors1 = step1Errors(draft);
  const errors2 = step2Errors(draft);
  const stepErrors = step === 1 ? errors1 : step === 2 ? errors2 : [...errors1, ...errors2];
  const stepValid = stepErrors.length === 0;
  const showErrors =
    step <= 2 && !stepValid && (attempted[step] === true || touched.size > 0);

  // Draft resume: on first load, offer a stored draft before anything else.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredDraft(parsed)) setResumeOffer({ draft: parsed.draft, step: parsed.step });
    } catch {
      // corrupt storage is not a reason to block the wizard
    }
  }, []);

  // Draft persistence: mirror the controlled state on every change once the
  // user has entered anything; cleared when the run is queued.
  useEffect(() => {
    if (phase !== "form" || resumeOffer !== null || !dirty) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step }));
  }, [draft, step, phase, resumeOffer, dirty]);

  function update(patch: Partial<Draft>, field: string) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setTouched((current) => new Set(current).add(field));
  }

  function announceStep(next: 1 | 2 | 3) {
    setAnnouncement(`Step ${next} of 3 — ${STEP_NAMES[next - 1]}.`);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function goNext() {
    if (!stepValid) {
      setAttempted((current) => ({ ...current, [step]: true }));
      setAnnouncement(`Error: ${stepErrors[0]}`);
      return;
    }
    if (step === 3) return;
    const next = (step + 1) as 1 | 2 | 3;
    setStep(next);
    announceStep(next);
  }

  function goBack() {
    if (step === 1) return;
    const next = (step - 1) as 1 | 2 | 3;
    setStep(next);
    announceStep(next);
  }

  function queueRun() {
    if (!stepValid || phase !== "form") return;
    setPhase("submitting");
    setAnnouncement("Queueing run.");
    window.setTimeout(() => {
      setPhase("success");
      localStorage.removeItem(STORAGE_KEY);
      setAnnouncement("Run queued. Success banner shown.");
    }, SUBMIT_MS);
  }

  function resetForNewRun() {
    setDraft(EMPTY_DRAFT);
    setStep(1);
    setPhase("form");
    setDirty(false);
    setTouched(new Set());
    setAttempted({ 1: false, 2: false });
    setAnnouncement("Step 1 of 3 — Target.");
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function acceptResume() {
    if (resumeOffer === null) return;
    setDraft(resumeOffer.draft);
    setStep(Math.min(3, Math.max(1, resumeOffer.step)) as 1 | 2 | 3);
    setResumeOffer(null);
    setDirty(true);
    setAnnouncement("Draft restored.");
  }

  function discardResume() {
    localStorage.removeItem(STORAGE_KEY);
    setResumeOffer(null);
    setAnnouncement("Draft discarded.");
  }

  const counterOver = draft.requirementText.length > MAX_REQUIREMENT_CHARS;

  return (
    <main className="wizard">
      <header className="wizard-head">
        <h1>Prax Benchmark Run Wizard</h1>
        <p className="wizard-sub mono">
          configure A/B replicate · target / arms / review · queue simulated locally
        </p>
      </header>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {resumeOffer !== null && (
        <section className="resume-banner" aria-label="Resume draft">
          <span>
            Draft found from a previous session (step {resumeOffer.step} of 3). Resume it?
          </span>
          <span className="resume-actions">
            <button type="button" onClick={acceptResume}>
              Resume draft
            </button>
            <button type="button" className="secondary" onClick={discardResume}>
              Start fresh
            </button>
          </span>
        </section>
      )}

      {phase === "success" ? (
        <SuccessBanner draft={draft} onReset={resetForNewRun} />
      ) : (
        <>
          <ol className="steps" aria-label="Wizard steps">
            {STEP_NAMES.map((name, index) => {
              const number = (index + 1) as 1 | 2 | 3;
              const state = number === step ? "current" : number < step ? "done" : "todo";
              return (
                <li key={name} className={`step-${state}`} aria-current={number === step ? "step" : undefined}>
                  <span className="step-index mono">{number < step ? "✓" : number}</span>
                  <span className="step-name">{name}</span>
                </li>
              );
            })}
          </ol>

          <section className="panel" aria-busy={phase === "submitting"}>
            <h2 tabIndex={-1} ref={headingRef} className="step-heading">
              Step {step} of 3 — {STEP_NAMES[step - 1]}
            </h2>

            {showErrors && (
              <p className="error-summary" role="alert">
                {stepErrors[0]}
              </p>
            )}

            {step === 1 && (
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Surface under test</span>
                  <select
                    value={draft.surface}
                    onChange={(event) => update({ surface: event.target.value }, "surface")}
                  >
                    <option value="">Select a surface…</option>
                    {SURFACES.map((surface) => (
                      <option key={surface} value={surface}>
                        {surface}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Requirement text</span>
                  <textarea
                    rows={7}
                    value={draft.requirementText}
                    onChange={(event) => update({ requirementText: event.target.value }, "requirementText")}
                    placeholder="Paste the task-2 requirement the replicate will run…"
                  />
                  <span className={`char-counter mono ${counterOver ? "over" : ""}`}>
                    {draft.requirementText.length} / {MAX_REQUIREMENT_CHARS}
                  </span>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Arm A model</span>
                  <select
                    value={draft.modelA}
                    onChange={(event) => update({ modelA: event.target.value }, "modelA")}
                  >
                    {MODELS.map((model) => (
                      <option key={model}>{model}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Arm B model</span>
                  <select
                    value={draft.modelB}
                    onChange={(event) => update({ modelB: event.target.value }, "modelB")}
                    aria-invalid={draft.modelA === draft.modelB}
                    aria-describedby={draft.modelA === draft.modelB ? "arm-equal-error" : undefined}
                  >
                    {MODELS.map((model) => (
                      <option key={model}>{model}</option>
                    ))}
                  </select>
                  {draft.modelA === draft.modelB && (
                    <span className="field-error" id="arm-equal-error">
                      Arm A and Arm B must use different models.
                    </span>
                  )}
                </label>
                <fieldset className="field stepper-field">
                  <legend className="field-label">Replicate count</legend>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label="Decrease replicate count"
                      disabled={draft.replicateCount <= 1}
                      onClick={() => update({ replicateCount: draft.replicateCount - 1 }, "replicateCount")}
                    >
                      −
                    </button>
                    <span className="stepper-value mono">{draft.replicateCount}</span>
                    <button
                      type="button"
                      aria-label="Increase replicate count"
                      disabled={draft.replicateCount >= 6}
                      onClick={() => update({ replicateCount: draft.replicateCount + 1 }, "replicateCount")}
                    >
                      +
                    </button>
                    <span className="stepper-hint">1–6 replicates per arm pair</span>
                  </div>
                </fieldset>
                <div className="field">
                  <span className="field-label">Blind review</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.blindReview}
                    className={`switch ${draft.blindReview ? "on" : "off"}`}
                    onClick={() => update({ blindReview: !draft.blindReview }, "blindReview")}
                  >
                    <span className="switch-track">
                      <span className="switch-thumb" />
                    </span>
                    <span className="switch-label">{draft.blindReview ? "On" : "Off"}</span>
                  </button>
                  {!draft.blindReview && (
                    <p className="consequence-note" id="blind-note">
                      Blind review off: reviewers will see which implementation produced
                      which package — the comparison loses its blinding strength.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <dl className="review">
                <div>
                  <dt>Surface under test</dt>
                  <dd className="mono">{draft.surface}</dd>
                </div>
                <div>
                  <dt>Requirement text</dt>
                  <dd>
                    {draft.requirementText.length} chars — “{draft.requirementText.trim().slice(0, 96)}
                    {draft.requirementText.trim().length > 96 ? "…" : ""}”
                  </dd>
                </div>
                <div>
                  <dt>Arms</dt>
                  <dd className="mono">
                    A {draft.modelA} vs B {draft.modelB}
                  </dd>
                </div>
                <div>
                  <dt>Replicate count</dt>
                  <dd className="mono">{draft.replicateCount}</dd>
                </div>
                <div>
                  <dt>Blind review</dt>
                  <dd>{draft.blindReview ? "On — packages anonymized before scoring" : "Off — reviewers see sources"}</dd>
                </div>
              </dl>
            )}

            <footer className="step-nav">
              <button type="button" className="secondary" onClick={goBack} disabled={step === 1}>
                ← Back
              </button>
              {step < 3 ? (
                <button type="button" className="primary" onClick={goNext} disabled={!stepValid}>
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={queueRun}
                  disabled={!stepValid || phase === "submitting"}
                >
                  {phase === "submitting" ? "Queueing…" : "Queue run"}
                </button>
              )}
            </footer>
          </section>

          <p className="sim-note mono">
            queue action is a deterministic local simulation — no backend is connected
          </p>
        </>
      )}
    </main>
  );
}

function SuccessBanner({ draft, onReset }: { draft: Draft; onReset: () => void }) {
  return (
    <section className="success-banner" role="status">
      <h2>Run queued</h2>
      <p className="mono">
        {draft.replicateCount} {draft.replicateCount === 1 ? "replicate" : "replicates"} · A {draft.modelA} vs B{" "}
        {draft.modelB} · {draft.surface} · blind review {draft.blindReview ? "on" : "off"}
      </p>
      <p className="sim-note">
        Simulated outcome — no backend is connected; nothing was executed.
      </p>
      <button type="button" onClick={onReset}>
        Configure another run
      </button>
    </section>
  );
}
