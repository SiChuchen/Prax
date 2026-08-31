import { CTA_HREF, CTA_EXTERNAL } from "./links";

// PRAX-PRICING-001 (session ds_20260830103431_85ce10c7, round-2 approved
// representation: penpot file 317f08f6-f8f6-8199-8008-8ffe053a4bd9).
// Content rules from the requirement: no invented prices, no dark patterns;
// the Support tier shows no number ("PRICING NOT ANNOUNCED") and the managed
// cloud tier is an explicit placeholder ("PLANNED", no signup).

const TIERS = [
  {
    n: "01",
    name: "Local OSS",
    price: "Free",
    note: "TODAY · SELF-HOSTED",
    kind: "solid" as const,
    cta: "Get started",
    href: CTA_HREF,
    bullets: ["Full design-gate chain", "Local-first, no account", "MCP server included"],
  },
  {
    n: "02",
    name: "Support",
    price: "—",
    note: "PRICING NOT ANNOUNCED",
    kind: "outline" as const,
    cta: "Contact",
    href: "https://github.com/SiChuchen/Prax/issues",
    bullets: ["Direct issue response", "Priority fixes", "Setup & migration help"],
  },
  {
    n: "03",
    name: "Managed Cloud",
    price: "Planned",
    note: "NOT STARTED · NO SIGNUP",
    kind: "disabled" as const,
    cta: "Not yet",
    bullets: ["Hosted Prax runtime", "Zero-setup onboarding", "Same gate chain, managed"],
  },
];

const MATRIX: Array<{ group: string; rows: Array<[string, string, string, string]> }> = [
  {
    group: "Runtime",
    rows: [
      ["Design gate chain", "yes", "yes", "yes"],
      ["Local, stateful runtime", "yes", "yes", "yes"],
      ["MCP server", "yes", "yes", "yes"],
      ["Self-hosted artifacts", "yes", "yes", "yes"],
    ],
  },
  {
    group: "Knowledge",
    rows: [
      ["Design knowledge routing", "yes", "yes", "yes"],
      ["Golden case fixtures", "yes", "yes", "yes"],
      ["Session replay", "yes", "yes", "yes"],
    ],
  },
  {
    group: "Support",
    rows: [
      ["Direct issue response", "no", "yes", "planned"],
      ["Priority fixes", "no", "yes", "planned"],
      ["Setup & migration help", "no", "yes", "planned"],
    ],
  },
];

const FAQ = [
  {
    q: "What do I need to self-host?",
    a: (
      <>
        A machine with Node.js. Install over npm —{" "}
        <code className="mono-code">npx prax-mcp</code> — and point your coding
        agent at it over MCP. No cloud account, no telemetry requirement.
      </>
    ),
  },
  {
    q: "Where does my data live?",
    a: "On your machine. Sessions, decisions, and evidence are files in your repo under .prax/ — nothing is uploaded.",
  },
  {
    q: "What is the license?",
    a: "Free to run locally today. The exact license text lives in the repository — pricing never changes what you can self-host.",
  },
  {
    q: "What's on the roadmap?",
    a: "Support offerings are next; a managed cloud is planned but not started. The runtime itself stays free — no feature paywalls.",
  },
  {
    q: "How do I reach the team?",
    a: (
      <>
        Open an issue or discussion on GitHub —{" "}
        <a className="mono-link" href={CTA_HREF} {...CTA_EXTERNAL}>
          github.com/SiChuchen/Prax
        </a>
        .
      </>
    ),
  },
];

function MatrixValue({ v }: { v: string }) {
  if (v === "yes") return <span className="matrix-yes">✓</span>;
  if (v === "planned") return <span className="matrix-planned">planned</span>;
  return <span className="matrix-no">—</span>;
}

export function PricingPage() {
  return (
    <div className="page">
      <header className="shell-header">
        <a className="wordmark" href="#/">
          Prax
        </a>
        <nav className="shell-nav" aria-label="Site">
          <a className="mono-link" href="https://github.com/SiChuchen/Prax" {...CTA_EXTERNAL}>
            docs · github
          </a>
          <span className="mono-link mono-link-current" aria-current="page">
            pricing
          </span>
          <a className="button button-small" href={CTA_HREF} {...CTA_EXTERNAL}>
            Get started
          </a>
        </nav>
      </header>
      <main>
        <section className="pricing-framing" aria-label="Pricing framing">
          <p className="eyebrow">PRICING</p>
          <h1 className="pricing-title">
            The runtime is free.
            <br />
            The rest is optional.
          </h1>
          <p className="pricing-lede">
            Prax is a local OSS runtime — free and self-hosted today, and it
            stays free. Paid tiers exist for support and, later, a managed
            cloud. Nothing on this page gates the runtime itself.
          </p>
          <ul className="pricing-chips">
            <li className="chip chip-solid">FREE NOW — LOCAL OSS RUNTIME</li>
            <li className="chip chip-outline">
              PAID LATER — SUPPORT + MANAGED CLOUD (PLANNED)
            </li>
          </ul>
        </section>

        <section className="pricing-tiers" aria-label="Tier comparison">
          <div className="pricing-grid">
            {TIERS.map((tier) => (
              <article className="tier-card" key={tier.n}>
                <p className="tier-n mono">
                  {tier.n} / TIERS
                  {tier.kind === "disabled" && <span className="tier-badge">PLANNED</span>}
                </p>
                <h2 className="tier-name">{tier.name}</h2>
                <p className="tier-price">{tier.price}</p>
                <p className="tier-note mono">{tier.note}</p>
                <ul className="tier-bullets">
                  {tier.bullets.map((bullet) => (
                    <li key={bullet}>
                      <span className="tier-dot mono" aria-hidden="true">
                        ·
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
                {tier.kind === "disabled" ? (
                  <span className="tier-cta tier-cta-disabled" aria-disabled="true">
                    {tier.cta}
                  </span>
                ) : (
                  <a
                    className={`tier-cta tier-cta-${tier.kind}`}
                    href={tier.href}
                    {...(tier.kind === "solid" ? CTA_EXTERNAL : {})}
                  >
                    {tier.cta}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-matrix-section" aria-label="Feature matrix">
          <table className="pricing-matrix">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Local OSS</th>
                <th scope="col">Support</th>
                <th scope="col">Managed Cloud (planned)</th>
              </tr>
            </thead>
            {MATRIX.map((group) => (
              <tbody key={group.group}>
                <tr className="matrix-group">
                  <th colSpan={4} scope="colgroup">
                    {group.group}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row[0]}>
                    <th scope="row">{row[0]}</th>
                    <td>
                      <MatrixValue v={row[1]} />
                    </td>
                    <td>
                      <MatrixValue v={row[2]} />
                    </td>
                    <td>
                      <MatrixValue v={row[3]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </section>

        <section className="pricing-faq" aria-label="Frequently asked questions">
          {FAQ.map((item, index) => (
            <details className="pricing-faq-item" key={item.q} open={index === 0}>
              <summary>
                {item.q}
                <span className="faq-mark mono" aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="site-footer pricing-footer">
        <span className="mono-footnote">
          Prax — product-first design intelligence for coding agents
        </span>
        <span className="mono-footnote">docs · github · mcp</span>
      </footer>
    </div>
  );
}
