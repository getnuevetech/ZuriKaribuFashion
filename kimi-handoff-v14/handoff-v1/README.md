# ZuriKaribu Design Handoff Package

**Version:** Kimi-ZK-Handoff-v1  
**Date:** 2025-01-20  
**Status:** Production Ready for Engineering Kickoff

---

## Package Contents

```
handoff-v1/
├── README.md                          # This file
├── contracts/                         # CMS contracts for each section
│   ├── HERO.md
│   ├── NAVIGATION.md
│   ├── SHOP_BY_BLOCKS.md
│   ├── SHOP_BY_COUNTRY.md
│   ├── TRUST_BADGES.md
│   └── FOOTER.md
├── tokens/                            # Design tokens
│   └── design-tokens.css
├── components/                        # Component specifications
│   └── component-states.md
├── accessibility/                     # Accessibility documentation
│   └── a11y-annotations.md
├── implementation/                    # Implementation guide
│   └── implementation-notes.md
└── assets/                            # Asset specifications
    └── (reference only - assets in /deploy/v15/)
```

---

## Critical Issues Status

| Issue | Status | Notes |
|-------|--------|-------|
| C1: Remove Kimi runtime | ✅ Resolved | Self-hosted tokens, no external dependencies |
| C2: Nav contrast safety | ✅ Resolved | 40% hero overlay, text-shadow, scrolled state |
| C3: Dynamic content stress | ✅ Resolved | Max lengths, fallbacks, empty states defined |
| C4: CMS contracts | ✅ Resolved | Complete contracts for all sections |

---

## Non-Critical Issues Status

| Issue | Status | Notes |
|-------|--------|-------|
| N1: Search overlay states | ✅ Documented | Loading, no-result, error states specified |
| N2: Taxonomy ownership | ✅ Documented | Source of truth defined for all taxonomies |
| N3: Motion/performance | ✅ Documented | Reduced motion, network-aware loading |
| N4: Trust block optimization | ✅ Documented | Copy hierarchy and placement guidelines |

---

## Quick Start for Engineers

### 1. Import Design Tokens
```css
@import '/tokens/design-tokens.css';
```

### 2. Use Tokens in Components
```css
.button-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
  font-family: var(--font-family-display);
  font-size: var(--font-size-sm);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}
```

### 3. Implement Section with CMS Contract
```javascript
// Example: Hero Section
const heroContent = {
  sectionKey: "HERO",
  variant: "SPLIT_EDITORIAL",
  content: {
    title: "ZURI KARIBU",
    subtitle: "Made by Africans. Worn by the world.",
    primaryCtaText: "Shop Now",
    primaryCtaLink: "/shop",
    heroImage: "/assets/hero_model.jpg"
  }
};
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile Small | 360px | Minimum mobile |
| Mobile | 390px | iPhone 14 Pro |
| Tablet | 768px | iPad Mini |
| Tablet Large | 1024px | iPad Pro |
| Desktop | 1440px | Standard desktop |
| Large Desktop | 1600px+ | Large screens |

---

## Key Design Principles (Preserve from V15)

1. **Editorial Premium Look** - Clean, sophisticated, magazine-like
2. **Hero Visual Style** - Bold typography, dramatic imagery
3. **Section Rhythm** - Consistent spacing, clear hierarchy
4. **Brand Mood** - Warm, authentic, African heritage
5. **Typography** - Montserrat display, Inter body
6. **Core Composition** - Asymmetric balance, generous whitespace

---

## Accessibility Requirements

- WCAG AA compliance (4.5:1 contrast minimum)
- Keyboard navigation throughout
- Screen reader support
- Reduced motion alternatives
- Focus visible on all interactive elements
- Skip link for main content

---

## Performance Targets

- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Total Bundle: < 200KB
- Hero Image: < 200KB

---

## Approval Gate

Engineering implementation can begin immediately. All blockers (C1-C4) are resolved.

For questions, refer to:
- Implementation notes: `/implementation/implementation-notes.md`
- Component states: `/components/component-states.md`
- Accessibility: `/accessibility/a11y-annotations.md`
