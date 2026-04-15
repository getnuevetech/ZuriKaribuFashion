# Hybrid Kimi Adoption Blueprint (Draft)

**Product:** African Fashion Platform (ZuriKaribu)  
**Draft status:** v0.1 (execution-ready experience blueprint)  
**Purpose:** Adopt Kimi-inspired premium editorial design while preserving conversion performance, accessibility, and dynamic admin control.

---

## 0) Executive recommendation

Proceed with a **Hybrid Premium-Commerce model**:

- **Global frame:** familiar, trusted ecommerce interaction patterns (Zara/Farfetch-like utility).
- **African soul:** cinematic storytelling, designer narratives, heritage context, and elevated visual identity.

Do **not** hard-switch to a pure cinematic mode for all users.

Instead, ship **experience modes** with progressive enhancement, admin governance, and strict KPI gates.

---

## 1) Audience and business alignment

Primary audience segments:

1. **Diaspora young adults reconnecting with African roots**
   - Needs identity, pride, narrative, and discovery.
2. **Diaspora adults used to global ecommerce standards**
   - Needs speed, familiarity, and shopping confidence.
3. **Global fashion network participants**
   - Needs brand credibility, editorial quality, and operational trust.

Brand position target:

> "A world-class global fashion platform with unmistakable African identity."

---

## 2) Experience mode model (risk-mitigated)

### 2.1 Modes

| Mode | Intent | Visual intensity | Motion/media | Default candidates |
|---|---|---|---|---|
| `LITE_COMMERCE` | maximize speed and task completion | low | static hero/image-first | low-end devices, slow networks, save-data |
| `STANDARD_PREMIUM` | balanced brand + conversion | medium | limited motion, optimized assets | default for most users |
| `EDITORIAL_IMMERSIVE` | maximum storytelling impact | high | cinematic sections, richer transitions | high-capability devices or explicit opt-in |

### 2.2 Selection policy

1. Use runtime capability checks (`deviceMemory`, `hardwareConcurrency`, network quality hints, `prefers-reduced-motion`, save-data).
2. Start first-time visitors in `STANDARD_PREMIUM`.
3. Downgrade automatically when capability/perf constraints are detected.
4. Always provide user override toggle: **Lite / Standard / Editorial**.
5. Persist selected mode in cookie/local storage and respect user choice.

**Principle:** capability detection informs defaults; user preference is authoritative.

---

## 3) Risk controls and acceptance gates

## 3.1 Conversion risk

### Controls
- Above-the-fold utility on homepage:
  - visible CTAs: `Shop RTW`, `Shop CTW`, `Shop Fabrics`;
  - global search entry;
  - immediate trust cues (shipping windows, returns policy, authenticity).
- Keep "quick shop" rails and category cards visible even in editorial mode.
- Preserve predictable PDP/PLP flows and checkout heuristics.

### Acceptance gates
- Product view rate does not drop more than 3% post-release.
- Add-to-cart rate does not drop more than 2%.
- Checkout start rate does not drop more than 2%.

## 3.2 Navigation and discovery risk

### Controls
- Desktop top nav remains visible (do not hide primary commerce actions behind hamburger).
- Suggested IA:
  - `Shop`, `Designers`, `Custom`, `Fabrics`, `Support`, `Contact`.
- `Shop` opens a structured category-entry page:
  - row 1: 3-column primary categories (RTW, CTW, FTB),
  - row 2: supporting cross-category discovery tiles.
- Keep hamburger for secondary/navigation overflow only.

### Acceptance gates
- Category-entry click-through rate improves or remains flat.
- Reduced no-action sessions from homepage.

## 3.3 Accessibility risk

### Controls
- Enforce WCAG AA baseline in both dark and light themes.
- Require contrast-safe token combinations (no publish on invalid contrast).
- Keyboard and focus ring support for all actionable elements.
- Respect `prefers-reduced-motion` with reduced transitions/video autoplay behavior.
- CMS-required alt text for all editorial images.

### Acceptance gates
- Lighthouse accessibility >= 90 on key templates.
- Automated contrast checks pass on all publishable themes.

## 3.4 Performance risk

### Controls
- Performance budgets per mode:
  - `LITE_COMMERCE`: LCP <= 2.2s
  - `STANDARD_PREMIUM`: LCP <= 2.5s
  - `EDITORIAL_IMMERSIVE`: LCP <= 2.8s
- Use responsive images + modern formats + lazy loading below fold.
- Replace autoplay video with image poster on constrained profiles.
- Code-split heavy components and non-critical section bundles.

### Acceptance gates
- CWV targets:
  - LCP <= 2.5s (P75),
  - CLS <= 0.1,
  - INP <= 200ms.

## 3.5 CMS/dynamic fit risk

### Controls
- Use schema-validated section config and template registry.
- Allow style decisions only through tokens and approved variants.
- Block raw CSS/JS injection in CMS content.
- Draft -> preview -> publish -> rollback flow with audit trail.

### Acceptance gates
- No contract-breaking payloads deployed from CMS.
- 1-click rollback available for each published theme/page config version.

---

## 4) CMS contract for seamless backend integration

## 4.1 Rendering contract (page composer)

```ts
type PageMode = 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';

type SectionBlock = {
  id: string;
  type:
    | 'HERO'
    | 'CATEGORY_ENTRY'
    | 'FEATURED_STRIP'
    | 'DESIGNER_SPOTLIGHT'
    | 'HERITAGE_STORY'
    | 'SOCIAL_PROOF'
    | 'EMAIL_CAPTURE'
    | 'SUPPORT_BANNER';
  variant: string; // controlled by template registry
  visibility: {
    modes: PageMode[];
    audiences?: Array<'ANON' | 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'RESELLER'>;
  };
  content: Record<string, unknown>;
  media: Array<{ id: string; url: string; alt: string; role: string }>;
  analyticsKey?: string;
};
```

## 4.2 Template registry (approved variants only)

```ts
type HeroVariant = 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
type CategoryEntryVariant = 'THREE_COLUMN_CORE' | 'MEGA_GRID';
type SpotlightVariant = 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
```

No unregistered variant can be published.

## 4.3 Token registry (design guardrails)

```ts
type ThemeTokenSet = {
  palette: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
  typography: 'MODERN_SANS' | 'EDITORIAL_SANS_SERIF_MIX';
  spacingScale: 'COMPACT' | 'BALANCED' | 'AIRY';
  motionScale: 'MINIMAL' | 'STANDARD' | 'RICH';
};
```

Token sets are selectable by admin; raw hex overrides are restricted to safe ranges with contrast validation.

---

## 5) Rollout plan (phased)

## Phase 1: Foundation controls (no visual hard switch)
- Implement mode selector and capability evaluator.
- Add top-level nav/discovery shell updates.
- Add token and template schema validation.

**Exit criteria:** mode switching works; no API contract regressions.

## Phase 2: Homepage hybridization
- Adopt Kimi-inspired hero and storytelling sections through registry variants.
- Keep conversion rails visible and measurable.

**Exit criteria:** conversion metrics stable within tolerance.

## Phase 3: Category-entry and PLP/PDP parity
- Apply hybrid templates to category pages.
- Keep familiar filtering, sorting, sizing, shipping cues.

**Exit criteria:** no drop in product discovery and add-to-cart.

## Phase 4: Advanced personalization and experiments
- Segment-aware defaults and A/B tests for intensity, CTA placement, and storytelling depth.
- Expand dynamic presets based on winning variants.

**Exit criteria:** statistical win in engagement or conversion against baseline.

---

## 6) KPI scorecard (go/no-go)

Primary KPIs:
- Conversion rate
- Product view rate
- Add-to-cart rate
- Checkout start rate
- Bounce rate (homepage + category-entry page)

Experience KPIs:
- LCP/CLS/INP
- Accessibility score
- Theme switch usage
- Scroll depth and section engagement

Brand KPIs:
- Designer spotlight CTR
- Heritage story engagement
- Email subscribe conversion

---

## 7) Governance and operating model

Ownership:
- **Brand/Product:** narrative quality and merchandising priorities
- **Design System Owner:** token governance and template health
- **Frontend:** renderer integrity and mode behavior
- **Backend/CMS:** schema contracts, validation, publish workflow
- **Analytics:** KPI monitoring and experiment interpretation

Change policy:
- Any new visual pattern must be introduced as:
  1) token-safe styling,
  2) schema-validated template variant,
  3) previewable and rollback-safe release.

---

## 8) Immediate next actions

1. Approve mode names and default selection logic.
2. Approve desktop IA for persistent commerce-first nav.
3. Approve `Shop` category-entry wireframe (3-column + 2-column secondary row).
4. Define first token sets for dark/light premium variants.
5. Prepare Phase-1 implementation tickets and KPI baseline capture.

---

## 9) Decision summary

Adopt Kimi direction **with hybrid controls**, not as a pure cinematic replacement.

This protects:
- business outcomes (conversion and trust),
- user inclusivity (accessibility + performance),
- and long-term agility (admin-manageable dynamic theming without backend breakage).

