# Accessibility Annotations

## Overview
WCAG 2.1 AA compliance annotations for the ZuriKaribu design system.

---

## Color Contrast Requirements

### Text Contrast Ratios

| Element | Minimum Ratio | Required Color |
|---------|---------------|----------------|
| Body text (16px+) | 4.5:1 | #1A1A1A on #FFFFFF |
| Large text (18px+ bold, 24px+ regular) | 3:1 | #1A1A1A on #FFFFFF |
| UI Components | 3:1 | Border vs background |
| Graphical Objects | 3:1 | Icons, charts |

### Verified Combinations

```
✓ Primary text (#1A1A1A) on white: 12.6:1
✓ Secondary text (#666666) on white: 5.7:1
✓ Muted text (#999999) on white: 2.8:1 ⚠️ Do not use for body text
✓ Brand (#E85A3C) on white: 3.5:1 ⚠️ Use only for large text
✓ White text on brand (#E85A3C): 3.5:1 ⚠️ Use only for large text
✓ White text on dark (#1A1A1A): 12.6:1
✓ Link hover (#E85A3C) on white: 3.5:1 ⚠️ Underline required
```

### Dark Mode Combinations

```
✓ White text (#FFFFFF) on dark bg (#1A1A1A): 12.6:1
✓ Muted text (#B0B0B0) on dark bg: 7.4:1
✓ Brand (#E85A3C) on dark bg: 5.2:1
```

---

## Focus Management

### Focus Visible Requirements

```css
/* All interactive elements must have visible focus */
:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 4px;
}

/* Exception for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Focus Order

1. Skip link (first)
2. Logo
3. Navigation links (left to right)
4. Utility buttons (search, cart)
5. Main content
6. Section CTAs
7. Footer links

### Skip Navigation

```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<main id="main-content" tabindex="-1">
  <!-- Page content -->
</main>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1A1A1A;
  color: #FFFFFF;
  padding: 12px 24px;
  z-index: 100;
}
.skip-link:focus {
  top: 16px;
}
```

---

## Keyboard Navigation

### Required Keyboard Support

| Component | Keys | Action |
|-----------|------|--------|
| Button | Enter, Space | Activate |
| Link | Enter | Navigate |
| Checkbox | Space | Toggle |
| Radio group | ↑↓←→ | Change selection |
| Select | ↑↓, Enter | Open, navigate, select |
| Modal | Escape | Close |
| Menu | ↑↓, Enter, Escape | Navigate, select, close |
| Tabs | ←→, Enter | Change tab |
| Accordion | Enter, Space | Toggle |

### Focus Trap (Modals)

```javascript
// Trap focus within modal when open
const trapFocus = (element) => {
  const focusableElements = element.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });
};
```

---

## ARIA Labels and Roles

### Landmark Regions

```html
<header role="banner">...</header>
<nav role="navigation" aria-label="Main">...</nav>
<main role="main">...</main>
<aside role="complementary" aria-label="Related">...</aside>
<footer role="contentinfo">...</footer>
```

### Navigation

```html
<nav aria-label="Main navigation">
  <ul role="menubar">
    <li role="none">
      <a href="/" role="menuitem" aria-current="page">Home</a>
    </li>
  </ul>
</nav>
```

### Buttons with Icons

```html
<!-- Icon-only button -->
<button aria-label="Add to cart">
  <ShoppingCartIcon aria-hidden="true" />
</button>

<!-- Button with text and icon -->
<button>
  <ShoppingCartIcon aria-hidden="true" />
  Add to Cart
</button>
```

### Images

```html
<!-- Decorative image -->
<img src="decoration.jpg" alt="" role="presentation" />

<!-- Informative image -->
<img src="product.jpg" alt="Red Ankara dress with floral pattern" />

<!-- Complex image -->
<figure>
  <img src="chart.jpg" alt="Sales chart showing 50% growth" />
  <figcaption>Monthly sales growth for 2024</figcaption>
</figure>
```

### Form Inputs

```html
<label for="email">Email Address</label>
<input 
  id="email"
  type="email"
  aria-required="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert" class="error">
  Please enter a valid email
</span>
```

### Live Regions

```html
<!-- Status announcements -->
<div role="status" aria-live="polite" aria-atomic="true">
  Item added to cart
</div>

<!-- Error announcements -->
<div role="alert" aria-live="assertive" aria-atomic="true">
  Payment failed. Please try again.
</div>
```

---

## Screen Reader Support

### Hidden Content

```css
/* Visually hidden but accessible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Product Card Announcement

```html
<article aria-label="{name}, {price}">
  <!-- Card content -->
</article>
```

### Price Announcement

```html
<span class="sr-only">Current price:</span>
<span aria-label="{amount} dollars">${amount}</span>

<span class="sr-only">Original price:</span>
<span class="original-price" aria-label="was {amount} dollars">
  ${amount}
</span>
```

---

## Motion and Animation

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Essential Animations (Keep)

- Loading spinners
- Focus indicators
- Error shake (subtle)

### Non-Essential Animations (Disable)

- Scroll-triggered reveals
- Hover transforms
- Page transitions
- Decorative animations

---

## Touch Targets

### Minimum Sizes

| Element | Minimum Size | Recommended |
|---------|--------------|-------------|
| Buttons | 44x44px | 48x48px |
| Links | 44x44px | 48x48px |
| Form inputs | 44px height | 48px height |
| Checkboxes | 24x24px | 44x44px |
| Spacing between | 8px | 12px |

---

## Error Handling

### Form Validation

```html
<form novalidate>
  <label for="email">Email</label>
  <input 
    id="email"
    type="email"
    aria-required="true"
    aria-invalid="false"
    aria-describedby="email-hint email-error"
  />
  <span id="email-hint">We'll never share your email</span>
  <span id="email-error" role="alert" class="error hidden">
    Please enter a valid email address
  </span>
</form>
```

### Error State Update

```javascript
// When validation fails
input.setAttribute('aria-invalid', 'true');
errorElement.classList.remove('hidden');
input.setAttribute('aria-describedby', 'email-error');

// When validation passes
input.setAttribute('aria-invalid', 'false');
errorElement.classList.add('hidden');
input.setAttribute('aria-describedby', 'email-hint');
```

---

## Accessibility Checklist

### Perceivable

- [ ] Text alternatives for images
- [ ] Captions/transcripts for video
- [ ] Color not sole means of conveying info
- [ ] Text resizable to 200%
- [ ] Contrast ratios met

### Operable

- [ ] All functions keyboard accessible
- [ ] No keyboard traps
- [ ] Skip links provided
- [ ] Focus indicators visible
- [ ] Time limits can be extended

### Understandable

- [ ] Language specified
- [ ] Form errors identified
- [ ] Consistent navigation
- [ ] Input assistance provided

### Robust

- [ ] Valid HTML
- [ ] ARIA used correctly
- [ ] Compatible with assistive tech
