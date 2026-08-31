const PIPELINE =
  "frame → context → route → decide → sdir → reconcile → implement → validate";

const STAGES = [
  {
    n: "01",
    name: "Frame",
    body: "The agent must establish user, goal, tasks, and product objects before any layout exists. Backend structures stay constraints, not the product model.",
  },
  {
    n: "02",
    name: "Decide",
    body: "Design decisions cite routed principles and are committed on the record. Alternatives are rejected with reasons, not silently dropped.",
  },
  {
    n: "03",
    name: "Prove",
    body: "Validation demands evidence — artifacts, screenshots, digests. Drift fails the gate before it reaches a review meeting.",
  },
];

const FEATURES = [
  {
    name: "Enforced design gates",
    body: "Ten staged tools; the chain stops when a gate is not satisfied. No bypass path.",
  },
  {
    name: "Explicit session artifacts",
    body: "Every decision persists as versioned YAML you can diff, audit, and replay.",
  },
  {
    name: "Scoped knowledge routing",
    body: "Principles surface only when context triggers them, with an auditable routing record.",
  },
  {
    name: "SDIR linting",
    body: "Render-level fields are caught before they leak into design specifications.",
  },
  {
    name: "Capability reconciliation",
    body: "Product actions map to real capabilities; gaps are named before implementation.",
  },
  {
    name: "Evidence-aware validation",
    body: "Checks demand artifacts, not self-attestation. Screenshots, digests, structured findings.",
  },
];

import { useEffect, useState } from "react";
import { CTA_HREF, CTA_EXTERNAL } from "./links";
import { PricingPage } from "./PricingPage";

// rel-header-pricing (ds_20260830103431_85ce10c7): the header nav gains a
// pricing entry; the home page itself is otherwise untouched.
function Header({ current }: { current: "home" | "pricing" }) {
  return (
    <header className="shell-header">
      <a className="wordmark" href={current === "home" ? "/" : "#/"}>
        Prax
      </a>
      <nav className="shell-nav" aria-label="Site">
        <a className="mono-link" href="#docs">
          docs · github
        </a>
        {current === "home" ? (
          <a className="mono-link" href="#/pricing">
            pricing
          </a>
        ) : (
          <span className="mono-link mono-link-current" aria-current="page">
            pricing
          </span>
        )}
        <a className="button button-small" href={CTA_HREF} {...CTA_EXTERNAL}>
          Get started
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" aria-label="Hero">
      <p className="eyebrow">DESIGN INTELLIGENCE RUNTIME · MCP</p>
      <h1 className="hero-title">
        Product-first design
        <br />
        intelligence for coding agents.
      </h1>
      <p className="hero-body">
        Prax is a local, stateful design runtime your coding agent talks to over
        MCP. It makes the agent establish users, tasks, product objects, and
        design decisions before UI ships — then proves the result at validation
        time.
      </p>
      <div className="hero-cta-row">
        <a className="button button-large" href={CTA_HREF} {...CTA_EXTERNAL}>
          Get started
        </a>
        <span className="mono-code">$ npx prax-mcp</span>
      </div>
      <p className="pipeline">{PIPELINE}</p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="how" aria-label="How it works">
      <p className="eyebrow">HOW IT WORKS</p>
      <h2 className="section-title">Three stages, enforced by gates.</h2>
      <div className="stages">
        {STAGES.map((stage) => (
          <article className="stage" key={stage.n}>
            <p className="stage-n mono">{stage.n}</p>
            <h3 className="stage-name">{stage.name}</h3>
            <p className="stage-body">{stage.body}</p>
          </article>
        ))}
      </div>
      <p className="mono-footnote">
        Each stage persists as an explicit session artifact — diffable,
        auditable, replayable.
      </p>
    </section>
  );
}

function Features() {
  return (
    <section className="features" aria-label="Capabilities">
      <p className="eyebrow">CAPABILITIES</p>
      <h2 className="section-title">What ships in the runtime.</h2>
      <ul className="feature-grid">
        {FEATURES.map((feature, index) => (
          <li className="feature-card" key={feature.name}>
            <p className="feature-n mono">{String(index + 1).padStart(2, "0")}</p>
            <h3 className="feature-name">{feature.name}</h3>
            <p className="feature-body">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="closing" aria-label="Get started">
      <h2 className="closing-title">Make your agent design first.</h2>
      <p className="closing-body">
        Run the gates, keep the evidence, ship UI your reviewers can trust.
      </p>
      <a className="button button-large" href={CTA_HREF} {...CTA_EXTERNAL}>
        Get started
      </a>
      <footer className="site-footer">
        <span className="mono-footnote">
          Prax — product-first design intelligence for coding agents
        </span>
        <span className="mono-footnote">docs · github · mcp</span>
      </footer>
    </section>
  );
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  if (hash.startsWith("#/pricing")) return <PricingPage />;
  return (
    <div className="page">
      <Header current="home" />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ClosingCta />
      </main>
    </div>
  );
}
