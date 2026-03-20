# Kimi v14 Frontend-to-Backend Integration Blueprint (v1)

**Product:** ZuriKaribu / African Fashion Platform  
**Date:** 2026-03-20  
**Goal:** Keep Kimi v14 design fidelity while connecting to the current backend without duplicating backend systems.

---

## 1) Executive decisions (from your 3 questions)

### D1. Backend strategy
**Decision:** Use **one backend** (shared by old and new frontend), do not duplicate backend services.

**Why:**
- avoids data drift across auth/orders/payments/inventory
- faster stabilization and lower ops risk
- easier rollback and traffic splitting

### D2. Mapping help from product/design side
**Decision:** **Yes**, product/design-led mapping is recommended and should be formalized as a contract sheet.

**Why:**
- speeds integration
- prevents accidental backend redesign
- keeps Kimi fidelity by making each section-field mapping explicit

### D3. Two homepage experiences by capability
**Decision:** Ship two Kimi variants:
1. **Animated Kimi** (default)
2. **Static-long Kimi** (for low-resource / reduced-motion / older-demographic preference)

**Why:**
- improves performance/accessibility
- supports demographic preference differences
- reduces bounce on weaker devices

---

## 2) Target architecture (no backend duplication)

```text
Frontend Layer
  - Kimi Animated Homepage (new)
  - Kimi Static-long Homepage (new)
  - Legacy Homepage (temporary fallback)

Adapter Layer (web client)
  - mappers/normalizers per section
  - strict defaults and guards for missing fields

Backend Layer (shared, existing)
  - auth, users, products, orders, payments, shipping
  - homepage sections/settings APIs
  - analytics/event pipeline
```

---

## 3) Integration principles

1. **Design fidelity first**  
   Kimi section structure and spacing should not be altered to fit backend payloads. Use mapping/adapters instead.

2. **Contract over ad-hoc binding**  
   Every section has a typed contract and fallback behavior.

3. **Backend remains source of truth**  
   Frontend maps backend payloads into Kimi contracts; no duplicate business logic.

4. **Progressive connection**  
   Connect one section at a time behind feature flags.

5. **Performance-aware routing**  
   Runtime selects animated/static Kimi by capability plus user preference.

---

## 4) Section contract map (implementation order)

Priority order for fastest value with lowest risk:

1. Hero
2. Top navigation + trust badges
3. Shop-by (category/country/occasion/price)
4. Featured strips (RTW/Fabrics/Custom)
5. Designer spotlight
6. Footer + support/contact blocks

Each section should be implemented through:
- `fetch -> map -> validate -> render`
- default + null-safe fallback
- analytics event hooks

---

## 5) Mapping matrix template (fill this with your team)

Use this exact table per section while integrating:

| Kimi Section | Kimi Field | Backend Endpoint | Backend Field | Transform Rule | Fallback | Owner |
|---|---|---|---|---|---|---|
| Hero | title | `/homepage/...` | `title` | trim max 56 | `ZURI KARIBU` | FE |
| Hero | subtitle | `/homepage/...` | `subtitle` | trim max 120 | `Made by Africans...` | FE |
| Hero | ctaLink | `/homepage/...` | `ctaLink` | normalize path | `/shop` | FE |
| ShopByCategory | cards[] | `/homepage-sections/categories` | list rows | map to card DTO | static Kimi cards | FE |
| FeaturedRTW | items[] | `/homepage/...featured` | `FEATURED_READY_TO_WEAR` | price/currency map | static placeholders | FE/BE |

**Rule:** No section moves to production until its mapping row is complete and approved.

---

## 6) Capability routing: animated vs static-long Kimi

### 6.1 Inputs
- `prefers-reduced-motion`
- `navigator.deviceMemory`
- `navigator.hardwareConcurrency`
- connection type (`effectiveType`)
- `saveData` preference
- explicit user preference toggle

### 6.2 Routing policy
- Default to **animated Kimi**.
- Route to **static-long Kimi** when any hard guard is true:
  - reduced-motion enabled
  - saveData enabled
  - very low memory/CPU
  - poor network classification
- Allow user override ("Use immersive" / "Use lighter mode"), persist in storage/cookie.

### 6.3 UX controls
- Mode switch visible in header/footer
- "Remember my preference"
- Do not switch modes mid-session automatically

---

## 7) Delivery phases

## Phase A: Baseline freeze (already started)
- Deploy exact Kimi static package
- Confirm visual parity against source
- Lock CSS/token baseline

**Exit criteria:**
- visual review signoff with no structural deltas

## Phase B: Contract + mapper scaffolding
- create mapper modules per section
- add schema validation + defaults
- wire analytics events

**Exit criteria:**
- all P1 section mapping matrix rows completed

## Phase C: Incremental backend connection
- connect sections in order (Hero -> Trust -> ShopBy -> Featured -> Spotlight -> Footer)
- run regression checks after each section

**Exit criteria:**
- no visual regressions and no API error uncaught states

## Phase D: Capability routing
- ship animated/static Kimi selector
- add automatic capability-based mode selection
- expose manual user override

**Exit criteria:**
- performance KPIs pass for low-end and high-end cohorts

## Phase E: Legacy isolation
- keep legacy at isolated route
- shift majority traffic to Kimi
- decommission legacy homepage when stable

**Exit criteria:**
- KPI stability window met (conversion, bounce, checkout start)

---

## 8) Non-negotiable acceptance gates

1. **Design gate:** exact Kimi layout fidelity for connected sections
2. **Data gate:** no section crashes on null/missing payload
3. **Accessibility gate:** keyboard nav + contrast + reduced-motion support
4. **Performance gate:** acceptable LCP/INP on low-resource devices
5. **Business gate:** stable conversion and session depth

---

## 9) Rollback and safety

- Keep `legacy` route alive during rollout.
- Feature flags:
  - `home.kimi.enabled`
  - `home.kimi.animated.enabled`
  - `home.kimi.static.enabled`
  - `home.kimi.backend.section.<name>.enabled`
- One-click rollback path to legacy route if KPI or error thresholds fail.

---

## 10) Ownership model

- **Product/Design (you + Kimi):** approve mapping matrix values and visual fidelity
- **Frontend:** implement mappers, section integration, capability routing
- **Backend:** expose/adjust endpoint contracts only where required
- **QA:** visual parity checks + edge-case payload validation + perf checks

---

## 11) Immediate next 7 actions

1. Freeze current Kimi v14 visual baseline screenshots (desktop/tablet/mobile)
2. Create and complete mapping matrix for Hero + Trust + ShopBy first
3. Implement section mapper modules with strict defaults
4. Connect Hero and Trust to backend, run visual diff
5. Connect ShopBy tabs, run null/long-content stress tests
6. Implement capability router for animated/static Kimi
7. Start legacy traffic reduction after KPI validation

---

## 12) What I need from you to accelerate

If you provide these, integration speed increases significantly:
- your preferred fallback copy for each section
- priority list of sections for first backend binding
- your animated vs static mock references
- business KPI thresholds for rollout go/no-go

