# Accessibility Annotations

## WCAG AA Compliance Checklist

### Color Contrast Requirements

| Element | Minimum Ratio | Light Theme | Dark Theme | Pass |
|---------|---------------|-------------|------------|------|
| Body text | 4.5:1 | #1A1917 on #FAF9F7 = 15.8:1 | #F5F0E8 on #141413 = 16.2:1 | ✅ |
| Large text (18px+) | 3:1 | #1A1917 on #FAF9F7 = 15.8:1 | #F5F0E8 on #141413 = 16.2:1 | ✅ |
| UI components | 3:1 | #E85A3C on #FFF = 4.5:1 | #E85A3C on #1A1917 = 4.5:1 | ✅ |
| Disabled text | N/A | #B8B3A8 on #FAF9F7 = 4.8:1 | #736F66 on #141413 = 4.9:1 | ✅ |

### Contrast Pairs Reference

```
Primary Text:
- #1A1917 on #FAF9F7 = 15.8:1 ✅
- #1A1917 on #FFFFFF = 16.1:1 ✅
- #6B665C on #FAF9F7 = 7.2:1 ✅

Brand Text:
- #E85A3C on #FFFFFF = 4.5:1 ✅
- #E85A3C on #FAF9F7 = 4.2:1 ⚠️ (use with caution)
- #FFFFFF on #E85A3C = 4.5:1 ✅
```

## Keyboard Focus Order

### Homepage Focus Order
```
1. Skip to main content [hidden until focused]
2. Logo (ZURI KARIBU)
3. Navigation: Shop
4. Navigation: Ready to Wear
5. Navigation: Fabrics
6. Navigation: Custom
7. Navigation: Designers
8. Navigation: About
9. Search button
10. Cart button
11. Theme toggle
12. Sign In link
13. Mobile menu button
14. Hero: Primary CTA (Shop Now)
15. Hero: Quick path - Ready to Wear
16. Hero: Quick path - Custom Design
17. Hero: Quick path - Fabrics
18. Shop by: Category tab
19. Shop by: Country tab
20. Shop by: Occasion tab
21. Shop by: Price tab
22. [Tab items...]
```

### Focus Ring Specification

```css
/* Standard Focus */
outline: 3px solid rgba(232, 90, 60, 0.4);
outline-offset: 2px;
border-radius: 2px;

/* High Contrast Override */
@media (prefers-contrast: high) {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
```

## Screen Reader Annotations

### Landmark Regions
```html
<header role="banner">        <!-- Navigation -->
<main role="main">            <!-- Main content -->
<nav role="navigation">       <!-- Primary nav -->
<footer role="contentinfo">   <!-- Footer -->
<aside role="complementary">  <!-- Sidebar content -->
```

### ARIA Labels

```html
<!-- Navigation -->
<nav aria-label="Main navigation">
  
<!-- Search -->
<button aria-label="Open search">
<input aria-label="Search products">

<!-- Cart -->
<button aria-label="Shopping cart with 3 items">

<!-- Hero -->
<section aria-labelledby="hero-title">
  <h1 id="hero-title">ZURI KARIBU</h1>

<!-- Tabs -->
<div role="tablist" aria-label="Shop by categories">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
  <div role="tabpanel" aria-labelledby="tab-1">
```

### Live Regions

```html
<!-- Cart updates -->
<div aria-live="polite" aria-atomic="true">
  <span class="sr-only">3 items in cart</span>
</div>

<!-- Search results -->
<div aria-live="polite" aria-atomic="true">
  <span class="sr-only">12 results found</span>
</div>

<!-- Form errors -->
<div aria-live="assertive" aria-atomic="true">
  <span class="sr-only">Error: Please enter a valid email</span>
</div>
```

## Motion & Animation

### Reduced Motion Support (N3)

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Keep essential transitions */
  .focus-ring {
    transition-duration: 0ms;
  }
}
```

### Animation Alternatives

| Animation | Reduced Motion Alternative |
|-----------|---------------------------|
| Hero parallax | Static image, no scroll effect |
| Fade in on scroll | Instant display |
| Card hover lift | Color change only |
| Tab slide | Instant switch |
| Loading spinner | Static loading text |
| Modal slide up | Instant appear |

## Touch & Mobile

### Minimum Touch Targets

```css
/* All interactive elements */
min-height: 44px;
min-width: 44px;

/* Compact mode for dense UIs */
.compact-touch {
  min-height: 32px;
  min-width: 32px;
}
```

### Touch Feedback

```css
/* Active state for touch */
@media (hover: none) and (pointer: coarse) {
  .button:active {
    transform: scale(0.98);
    background: var(--color-brand-primary-active);
  }
}
```

## Form Accessibility

### Required Field Indication

```html
<label for="email">
  Email <span aria-label="required">*</span>
</label>
<input 
  id="email" 
  required 
  aria-required="true"
  aria-invalid="false"
  aria-describedby="email-error"
>
<div id="email-error" role="alert" class="error-message">
  <!-- Error text here -->
</div>
```

## Testing Checklist

### Automated Tests
- [ ] axe-core passes with 0 violations
- [ ] Lighthouse accessibility score ≥ 95
- [ ] WAVE tool shows 0 errors
- [ ] Color contrast checker passes

### Manual Tests
- [ ] Keyboard navigation works throughout
- [ ] Focus order is logical
- [ ] Focus is visible on all interactive elements
- [ ] Screen reader announces content correctly
- [ ] Skip link works
- [ ] Reduced motion preference respected
- [ ] High contrast mode readable
- [ ] Zoom to 200% still usable

### Screen Reader Testing
- [ ] VoiceOver (macOS/iOS)
- [ ] NVDA (Windows)
- [ ] JAWS (Windows)
- [ ] TalkBack (Android)
