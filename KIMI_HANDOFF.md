# Kimi Design Handoff + Issue Remediation Plan (v1)

**Product:** African Fashion Platform (ZuriKaribu)  
**Scope:** New dedicated `HomeKimi` frontpage (parallel to legacy), dynamic backend integration, controlled rollout  
**Audience:** Kimi design team, frontend engineers, backend engineers, product/QA

---

## 1) Purpose

This document defines:

1. The exact design handoff package required from Kimi.
2. How to resolve current **critical** and **non-critical** issues before integration.
3. Acceptance criteria and signoff gates for build readiness.

Goal: ship a complete new frontpage from Kimi materials without returning to iterative tweaks on legacy homepage UI.

---

## 2) Handoff package required from Kimi

Kimi should provide a versioned handoff bundle with all items below.

## 2.1 Core deliverables (required)

1. **Responsive artboards**
   - Desktop: 1440
   - Tablet: 1024 / 768
   - Mobile: 390 / 360
2. **Section specs**
   - Hero, Shop-by blocks, trust/reassurance blocks, featured sections, footer transitions.
3. **Design tokens**
   - Color, typography, spacing, radius, shadows, motion/easing, z-index, focus-ring tokens.
4. **Interaction states**
   - Default/hover/focus/active/disabled/loading/error for all interactive components.
5. **Accessibility annotations**
   - Contrast pair list, keyboard flow, focus order, reduced-motion alternatives.
6. **Asset package**
   - Optimized images/video, posters, alt-text sheet, licensing confirmation.
7. **CMS constraints sheet**
   - Required vs optional fields, max text lengths, fallback rules for missing content/media.

## 2.2 Optional but recommended

1. Animation reference clips (short MP4/GIF demos).
2. Content examples for long-language expansion and localization.
3. Annotated “do/don’t” examples for section composition.

---

## 3) Critical issues and exact remediation

These must be resolved before engineering kickoff.

## C1) Remove Kimi SDK dependency from production

**Observed:** Public page includes Kimi SDK/widget script.  
**Risk:** third-party dependency risk, brand control risk, extra runtime overhead.

**Fix plan**
- Remove any Kimi runtime script/widget from production build output.
- Keep all functionality self-hosted in platform codebase.
- Add CI check to fail if disallowed third-party script domain appears in homepage HTML.

**Owner:** Frontend + QA  
**Acceptance**
- No `kimi.com` runtime script on production homepage.
- Lighthouse and Sentry runs show no widget/network dependency.

---

## C2) Header/nav contrast and readability on hero

**Observed:** Nav readability can drop on translucent hero overlays.  
**Risk:** accessibility + conversion friction on first-screen interaction.

**Fix plan**
- Enforce tokenized nav contrast pairings for light/dark hero contexts.
- Add sticky-state style with guaranteed contrast at scroll thresholds.
- Validate with automated AA checks on top nav and CTA text.

**Owner:** Design + Frontend  
**Acceptance**
- WCAG AA contrast pass for nav items/logo/icons across all hero variants.
- Keyboard focus ring visible on every nav action in both themes.

---

## C3) Dynamic-content stress states not fully defined

**Observed:** Long text/missing media/translated copy edge cases are not fully specified.  
**Risk:** backend-driven content can break visual composition.

**Fix plan**
- Define max lengths per field (headline/subheadline/button labels/badges).
- Define overflow rules (`line-clamp`, wrap, truncation, responsive fallback).
- Define missing-image fallback component and fallback content order.
- Include localization stress examples (30% text expansion).

**Owner:** Design + Frontend + QA  
**Acceptance**
- Stress test suite passes for long text + null media payloads.
- No layout collapse in desktop/tablet/mobile snapshots.

---

## C4) CMS contract packaging for section variants

**Observed:** Visual concept exists, but section contract definitions are incomplete for integration.  
**Risk:** integration drift between Kimi visuals and admin-managed data.

**Fix plan**
- Deliver section-level schema mapping:
  - `requiredFields`
  - `optionalFields`
  - `maxLength`
  - `fallbackBehavior`
  - `compatibleVariants`
- Map each section to existing backend endpoints/settings keys.
- Lock variant IDs and token set names to avoid ad-hoc naming drift.

**Owner:** Product + Design + Backend + Frontend  
**Acceptance**
- JSON schema (or equivalent typed contract) approved and versioned.
- Admin preview payload can render all Kimi sections without manual code edits.

---

## 4) Non-critical issues and remediation (should complete before full rollout)

## N1) Search overlay UX states

**Fix**
- Define loading, no-results, and API-error states.
- Add keyboard shortcuts (`Esc`, tab trapping) and focus restoration.

**Acceptance**
- Usability test pass with keyboard-only flow and no dead-end state.

---

## N2) Shop-by taxonomy ownership (Category/Country/Occasion/Price)

**Fix**
- Define source of truth per tab:
  - backend-managed list vs static curated fallback.
- Add empty-state visuals when source feed returns no items.

**Acceptance**
- Every tab has deterministic data ownership and fallback behavior.

---

## N3) Motion/performance calibration

**Fix**
- Keep reduced-motion mode behavior documented and testable.
- Define media downgrade strategy for low capability / save-data users.

**Acceptance**
- P75 CWV within budget by experience mode.

---

## N4) Trust block semantics and placement

**Fix**
- Keep trust messages concise and non-repetitive.
- Confirm placement order and copy hierarchy for conversion flow.

**Acceptance**
- A/B check shows neutral-to-positive effect on checkout-start and bounce.

---

## 5) Kimi-to-platform field contract template

Use this per section in handoff:

```yaml
sectionKey: HERO
variant: SPLIT_EDITORIAL
requiredFields:
  - title
  - subtitle
  - primaryCtaText
  - primaryCtaLink
  - heroImage
optionalFields:
  - quickPathRtwText
  - quickPathRtwLink
  - quickPathCtwText
  - quickPathCtwLink
  - quickPathFabricsText
  - quickPathFabricsLink
maxLength:
  title: 56
  subtitle: 120
  ctaText: 24
fallbackBehavior:
  heroImage: "/kimi/hero_model.jpg"
  ctaLink: "/shop"
compatibility:
  modes: [STANDARD_PREMIUM, EDITORIAL_IMMERSIVE]
  themes: [LIGHT, DARK]
a11y:
  minContrast: "WCAG-AA"
  reducedMotionAlternative: "static hero image, no parallax"
analytics:
  events:
    - home_hero_primary_cta_click
    - home_hero_quick_path_click
```

---

## 6) Build/readiness gates

All gates below must pass before `HomeKimi` becomes default.

1. **Design gate**
   - All critical items (C1-C4) signed off.
2. **Integration gate**
   - Section schema + API mappings implemented and validated.
3. **Quality gate**
   - Accessibility (AA) and responsive snapshots pass.
4. **Performance gate**
   - CWV budgets pass per mode (Lite/Standard/Editorial).
5. **Business gate**
   - Conversion and discovery metrics are stable in canary rollout.

---

## 7) Rollout recommendation

1. Implement dedicated `HomeKimi` template in parallel (do not mutate legacy heavily).
2. Add admin switch: `homepageTemplate = LEGACY | KIMI`.
3. Deploy Kimi in canary (small audience / region / role slice).
4. Monitor KPI gates for 7-14 days.
5. Promote Kimi to default when stable; keep instant rollback.

---

## 8) Immediate next actions

1. Kimi team submits v1 handoff package using this checklist.
2. Engineering maps section contract to current homepage settings APIs.
3. QA prepares automated checks for contrast, reduced motion, and stress content.
4. Product approves go/no-go checklist and canary audience definition.

