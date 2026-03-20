# ZuriKaribu Design Handoff Package v29

**Version:** Kimi-ZK-Handoff-v29  
**Date:** 2025-01-20  
**Status:** Production Ready for Engineering Kickoff

---

## Package Contents

```
handoff-v29/
├── README.md                    # This file
├── contracts/                   # CMS contracts per section
│   ├── HERO.md
│   ├── NAVIGATION.md
│   ├── SHOP_BY_BLOCKS.md      # Includes Country schema
│   ├── READY_TO_WEAR.md
│   ├── FABRICS.md
│   ├── CUSTOM.md
│   ├── DESIGNERS.md
│   ├── ABOUT.md
│   ├── TRUST_BADGES.md        # Explicit schema
│   └── FOOTER.md
├── tokens/
│   └── design-tokens.css        # Theme integration contract
├── components/
│   └── component-states.md
├── accessibility/
│   └── a11y-annotations.md
├── implementation/
│   ├── implementation-notes.md
│   ├── endpoint-mapping.md      # Backend contract mapping
│   └── route-aliases.md         # Route alias guidance
└── assets/
    └── asset-manifest.md        # Exact shipped filenames
```

---

## Logo Specification

**Two-Color Wordmark Design:**
```
ZURI  →  #1A1A1A (dark)
KARIBU →  #E85A3C (brand)
```

**Implementation:**
```html
<a href="/" class="logo">
  <span class="logo-part1">ZURI</span>
  <span class="logo-part2">KARIBU</span>
</a>
```

```css
.logo {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.logo-part1 {
  color: #1A1A1A; /* Dark */
}
.logo-part2 {
  color: #E85A3C; /* Brand */
}
/* Dark mode override */
.dark .logo-part1 {
  color: #FFFFFF;
}
```

---

## Theme Integration Contract

**Mode:** CSS class `.dark` on `<html>` or `<body>` element

```html
<!-- Light mode (default) -->
<html lang="en">

<!-- Dark mode -->
<html lang="en" class="dark">
```

**Token Application:**
```css
/* Tokens automatically apply based on .dark class */
:root { /* Light theme tokens */ }
.dark { /* Dark theme tokens */ }
```

---

## Critical Issues Status

| Issue | Status | Resolution |
|-------|--------|------------|
| **C1: Remove Kimi runtime** | ✅ | Self-hosted tokens, no external SDK |
| **C2: Nav contrast safety** | ✅ | Split hero layout, dark text on light side |
| **C3: Dynamic content stress** | ✅ | Max lengths, fallbacks documented |
| **C4: CMS contracts** | ✅ | 10 complete section contracts |

---

## Route Alias Guidance

| Our Contract Path | Your Backend Path | Notes |
|-------------------|-------------------|-------|
| `/custom` | `/designs` | Primary alias - use `/designs` in backend |
| `/ready-to-wear` | `/ready-to-wear` | No change needed |
| `/fabrics` | `/fabrics` | No change needed |
| `/designers` | `/designers` | No change needed |
| `/about` | `/about` | No change needed |
| `/shop` | `/shop` | No change needed |

**Implementation:** Frontend routes use contract paths, backend API uses your paths.

---

## Quick Start

### 1. Import Design Tokens
```css
@import '/tokens/design-tokens.css';
```

### 2. Toggle Theme
```javascript
// Toggle dark mode
document.documentElement.classList.toggle('dark');
```

### 3. Implement Section
```javascript
const heroContent = {
  sectionKey: "HERO",
  variant: "SPLIT_EDITORIAL",
  content: { /* see contract */ }
};
```

---

## Approval Gate

Engineering implementation can begin immediately. All blockers resolved.
