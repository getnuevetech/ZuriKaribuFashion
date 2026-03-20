# Accessibility Annotations

## WCAG AA Compliance Checklist

### Color Contrast Requirements

| Element | Minimum Ratio | Light Theme | Dark Theme | Pass |
|---------|---------------|-------------|------------|------|
| Body text | 4.5:1 | #1A1A1A on #F8F6F1 = 12.6:1 | #F5F5F5 on #141414 = 16.1:1 | ✅ |
| Large text (18px+) | 3:1 | #1A1A1A on #F8F6F1 = 12.6:1 | #F5F5F5 on #141414 = 16.1:1 | ✅ |
| UI components | 3:1 | #E85A3C on #FFF = 4.5:1 | #E85A3C on #1A1A1A = 4.5:1 | ✅ |
| Disabled text | N/A | #A8A49C on #F8F6F1 = 4.6:1 | #737373 on #141414 = 4.7:1 | ✅ |

### Contrast Pairs Reference

```
Primary Text:
- #1A1A1A on #F8F6F1 = 12.6:1 ✅
- #1A1A1A on #FFFFFF = 15.8:1 ✅
- #5C5954 on #F8F6F1 = 6.8:1 ✅

Brand Text:
- #E85A3C on #FFFFFF = 4.5:1 ✅
- #E85A3C on #F8F6F1 = 4.0:1 ⚠️ (use with caution)
- #FFFFFF on #E85A3C = 4.5:1 ✅

Hero Overlay:
- Hero image MUST have minimum 40% dark overlay
- White text on overlay = minimum 4.5:1 ✅
- Use text-shadow: 0 1px 2px rgba(0,0,0,0.3) for extra safety
```

## Keyboard Focus Order

### Homepage Focus Order
```
1. Skip to main content [hidden until focused]
2. Logo (ZURI KARIBU)
3. Navigation: Ready to Wear
4. Navigation: Fabrics
5. Navigation: Custom
6. Search button
7. Cart button
8. Theme toggle
9. Mobile menu button [mobile only]
10. Hero: Primary CTA (Shop Now)
11. Hero: Quick path - Ready to Wear
12. Hero: Quick path - Fabrics
13. Hero: Quick path - Custom
14. Shop by: Category tab
15. Shop by: Country tab
16. Shop by: Occasion tab
17. Shop by: Price tab
18. [Tab items...]
19. Trust badges
20. Country grid items
21. Footer: Newsletter email
22. Footer: Newsletter submit
23. Footer links...
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

<!-- Country Grid -->
<a aria-label="Shop from Nigeria - 450 products">
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

### Media Downgrade Strategy (N3)

```javascript
// Network-aware image loading
const connection = navigator.connection;
if (connection) {
  const saveData = connection.saveData;
  const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
  
  if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
    // Load low-res images
    // Disable autoplay videos
    // Reduce animation complexity
  }
}
```

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

### Error Summary

```html
<div role="alert" aria-live="assertive">
  <h2>There are 2 errors in this form</h2>
  <ul>
    <li><a href="#email">Email is required</a></li>
    <li><a href="#password">Password must be at least 8 characters</a></li>
  </ul>
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
