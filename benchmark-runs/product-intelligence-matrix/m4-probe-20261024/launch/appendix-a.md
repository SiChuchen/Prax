## Appendix A — Knowledge entry H-23 (Accessibility AA Floor)

```yaml
  - id: H-23
    type: heuristic
    name: Accessibility AA Floor
    summary: Text contrast, visible focus, target size, and minimum type size meet WCAG 2.2 AA before a styling pass is called done.
    category: accessibility
    scope:
      platform: &a9
        - web_desktop
      phase:
        - decision
        - validation
    triggers:
      - accessibility
      - contrast
      - focus
      - target_size
      - text_size
      - styling
      - wcag
    lifecycle:
      status: draft
    provenance:
      source_refs:
        - WCAG22
        - BENCH-M3-A11Y
      authority_category: established_design_research
      certainty: high
      recommendation_strength: strong
    validation:
      mode: assistive
      checks:
        - text contrast meets 4.5:1 (3:1 for text >=24px or >=18.66px bold)
        - every keyboard stop shows a visible focus indicator
        - interactive targets are at least 24x24 CSS px in both dimensions
        - primary and secondary text render at 12px or larger
    statement: Apply the WCAG 2.2 AA floor while styling - never ship gray-300/400-class tokens as text on light backgrounds, never remove focus outlines without a visible replacement, and keep interactive targets at least 24px square.
    applies_when:
      - any web desktop surface with text or interactive controls
      - styling or theming passes that introduce muted color tokens
    does_not_apply_when:
      - purely decorative graphics and logotypes (contrast exemption)
      - disabled controls (contrast exemption applies)
    rationale: 40 benchmark runs showed both bare and assisted agents ship slate-300/400-class text on light backgrounds (median 48% below the AA ratio), 8.5-11.5px type, and CSS resets that strip focus indicators; all four failures are habit-level and knowledge-addressable.
    tradeoffs:
      - muted aesthetic tiers must be rebalanced (one shade darker often suffices)
    counterexamples:
      - large decorative display type >=24px needs only 3:1, not 4.5:1
      - logotypes and disabled controls are exempt from contrast requirements
    asset_class: heuristic
    stability: A
    trigger_conditions:
      platform: *a9
      phase:
        - decision
        - validation
    evidence:
      authority_initial: C
      source_version: WCAG22
      review_by: 2026-12-31
```
