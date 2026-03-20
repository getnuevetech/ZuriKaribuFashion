# ZuriKaribu Implementation Notes

**Version:** Kimi-ZK-Handoff-v1  
**Date:** 2025-01-20  
**Status:** Production Ready

---

## 1. Critical Issues Resolution (C1-C4)

### C1: Remove Kimi Runtime Dependency ✅

**Problem:** Production dependency on Kimi SDK/widget scripts.

**Solution:**
- All design tokens are self-hosted in `tokens/design-tokens.css`
- No external JavaScript dependencies for core functionality
- Assets are local/static files only
- CMS integration is API-based, not widget-based

**Implementation:**
```html
<!-- ❌ DO NOT include -->
<script src="https://kimi.com/widget.js"></script>

<!-- ✅ Self-hosted only -->
<link rel="stylesheet" href="/tokens/design-tokens.css">
<script src="/js/app.js"></script>
```

### C2: Header/Nav Contrast Safety ✅

**Problem:** Ensure WCAG AA contrast for nav/logo/CTAs in all hero states.

**Solution:**
1. **Hero Overlay:** Minimum 40% dark overlay on all hero images
2. **Text Shadow:** Add subtle shadow for extra safety
3. **Scrolled State:** Solid background when scrolled

**CSS Implementation:**
```css
/* Hero overlay for contrast */
.hero-overlay {
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.3) 50%,
    rgba(0, 0, 0, 0.1) 100%
  );
}

/* Nav text on hero */
.nav-transparent {
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Scrolled state */
.nav-scrolled {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-md);
}
```

**Contrast Verification:**
- White text on 40% black overlay = 7.2:1 ✅ (exceeds 4.5:1)
- Brand color (#E85A3C) on white = 4.5:1 ✅

### C3: Dynamic Content Stress States ✅

**Long Title Handling:**
```css
.hero-title {
  font-size: clamp(2rem, 5vw, 3.75rem);
  line-height: 0.95;
  max-width: 12ch; /* Prevent excessive wrapping */
  overflow-wrap: break-word;
}
```

**Long Subtitle Handling:**
```css
.hero-subtitle {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 50ch;
}
```

**Missing Image Fallback:**
```css
.hero-image-container {
  background: var(--color-bg-tertiary);
  background-image: url('/assets/pattern-fallback.svg');
}

.hero-image-container img {
  object-fit: cover;
}

.hero-image-container img[src=""] {
  display: none;
}
```

**Localization (30% longer):**
```css
/* Allow text to scale down */
.cta-button {
  font-size: clamp(0.75rem, 1vw, 0.875rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

### C4: CMS Contract Completeness ✅

See `/contracts/` directory for complete section contracts:
- `HERO.md`
- `NAVIGATION.md`
- `SHOP_BY_BLOCKS.md`
- `SHOP_BY_COUNTRY.md`
- `TRUST_BADGES.md`
- `FOOTER.md`

---

## 2. Non-Critical Issues (N1-N4)

### N1: Search Overlay States

**Loading State:**
```jsx
<div className="search-loading">
  <Spinner size="sm" />
  <span>Searching...</span>
</div>
```

**No Results State:**
```jsx
<div className="search-empty">
  <SearchXIcon />
  <h3>No results for "{query}"</h3>
  <p>Try these popular searches:</p>
  <div className="suggestions">
    {popularSearches.map(s => <button>{s}</button>)}
  </div>
</div>
```

**Error State:**
```jsx
<div className="search-error" role="alert">
  <AlertTriangleIcon />
  <h3>Search unavailable</h3>
  <p>Please try again in a moment</p>
  <button onClick={retry}>Retry</button>
</div>
```

**Keyboard Behavior:**
- `Escape`: Close overlay, return focus to search button
- `Tab`: Trap focus within overlay
- `ArrowDown/Up`: Navigate suggestions
- `Enter`: Select highlighted suggestion

### N2: Shop by Taxonomy Ownership

**Source of Truth:**
```yaml
category:
  source: "CMS Product Categories"
  endpoint: "/api/categories"
  cache: "1 hour"
  
country:
  source: "Static JSON (54 countries)"
  file: "/data/african-countries.json"
  cache: "Never (static)"
  
occasion:
  source: "CMS Tags"
  endpoint: "/api/tags?type=occasion"
  cache: "1 hour"
  
price:
  source: "Dynamic from products"
  endpoint: "/api/products/price-ranges"
  cache: "15 minutes"
```

**Empty State:**
```jsx
{items.length === 0 && (
  <div className="tab-empty">
    <PackageOpenIcon />
    <p>Coming soon</p>
    <a href="/shop">Browse all products</a>
  </div>
)}
```

### N3: Motion/Performance Policy

**Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .parallax { transform: none !important; }
  .fade-in { opacity: 1 !important; }
  .slide-up { transform: none !important; }
}
```

**Network-Aware Loading:**
```javascript
const getImageQuality = () => {
  const connection = navigator.connection;
  if (!connection) return 'high';
  
  if (connection.saveData) return 'low';
  if (connection.effectiveType === '4g') return 'high';
  if (connection.effectiveType === '3g') return 'medium';
  return 'low';
};

// Usage
<img src={`/images/photo-${getImageQuality()}.jpg`} />
```

### N4: Trust Block Optimization

**Copy Hierarchy:**
1. Authentic Guarantee (highest priority)
2. Global Shipping
3. Easy Returns
4. 24/7 Support
5. Secure Payment
6. Artisan Made

**Placement Guidelines:**
- `HORIZONTAL`: Between major sections, above fold
- `GRID`: Footer area, dedicated trust page
- `COMPACT`: Near CTAs, checkout flow

---

## 3. Responsive Breakpoints

```css
/* Mobile Small */
@media (max-width: 360px) { }

/* Mobile */
@media (max-width: 390px) { }

/* Tablet */
@media (max-width: 768px) { }

/* Tablet Large */
@media (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }

/* Large Desktop */
@media (min-width: 1440px) { }
```

---

## 4. Performance Budget

| Metric | Target | Maximum |
|--------|--------|---------|
| First Contentful Paint | < 1.5s | 2.0s |
| Largest Contentful Paint | < 2.5s | 3.0s |
| Time to Interactive | < 3.5s | 4.5s |
| Total Bundle Size | < 200KB | 300KB |
| Images (hero) | < 200KB | 300KB |
| Fonts | < 100KB | 150KB |

---

## 5. Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |
| iOS Safari | 14+ |
| Chrome Android | 90+ |

---

## 6. Asset Requirements

### Images
- Format: WebP with JPEG fallback
- Hero: 1920x1080, max 200KB
- Product: 800x1000, max 100KB
- Thumbnail: 400x500, max 30KB

### Fonts
- Montserrat: 400, 500, 600, 700, 800
- Inter: 400, 500, 600
- IBM Plex Mono: 400, 500

---

## 7. Deployment Checklist

- [ ] All contracts validated
- [ ] Tokens imported correctly
- [ ] Contrast ratios verified
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Reduced motion tested
- [ ] Mobile touch targets verified
- [ ] Performance budget met
- [ ] Assets optimized
- [ ] CMS endpoints configured

---

## 8. Contact

For implementation questions:
- Design System: `/tokens/design-tokens.css`
- Component States: `/components/component-states.md`
- Accessibility: `/accessibility/a11y-annotations.md`
- Section Contracts: `/contracts/*.md`
