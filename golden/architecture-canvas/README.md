# Architecture Canvas Golden Case

This package is the first Prax vertical slice and the source of the automated
end-to-end fixture. It records the requirement, context, approved decisions,
semantic intent, required states, and a controlled artifact-level A/B review.

The benchmark applies the same six-part rubric to a bare-agent artifact
baseline and the Prax-guided artifact. It concludes only that Prax raised the
artifact-level quality floor; empirical implementation evidence remains listed
as missing rather than fabricated.

The review caused one explicit correction: the inspector moved from persistent
primary prominence to selection-driven contextual importance. That correction
is reflected in the Pattern knowledge, heuristic, and SDIR fixture.

Run the executable vertical slice with:

```bash
npm test -- tests/service-e2e.test.ts
```
