# Navigation Contract

## Section Overview
Fixed header navigation with logo, menu links, search, cart, and mobile hamburger. Supports transparent (hero overlay) and solid (scrolled) states.

---

## CMS Schema

```yaml
navigation:
  # Logo
  logo:
    type: object
    required: true
    fields:
      wordmark_part1:
        type: string
        required: true
        max_length: 10
        default: "ZURI"
        description: "First part of logo (dark color)"
      wordmark_part2:
        type: string
        required: true
        max_length: 10
        default: "KARIBU"
        description: "Second part of logo (brand color #E85A3C)"
      href:
        type: string
        required: true
        default: "/"
        description: "Logo click destination"

  # Primary Navigation Links
  navLinks:
    type: array
    required: true
    min_items: 4
    max_items: 6
    default:
      - { label: "Shop", href: "#shop" }
      - { label: "Ready-to-Wear", href: "#ready-to-wear" }
      - { label: "Fabrics", href: "#fabrics" }
      - { label: "Custom", href: "#custom" }
      - { label: "Designers", href: "#designers" }
      - { label: "About", href: "#about" }
    item_schema:
      label:
        type: string
        required: true
        max_length: 20
      href:
        type: string
        required: true
        format: "url or anchor"
      is_external:
        type: boolean
        default: false
      highlight:
        type: boolean
        default: false
        description: "Apply brand color to this link"

  # Utility Actions
  utilities:
    type: object
    required: true
    fields:
      search:
        type: object
        required: true
        fields:
          enabled: { type: boolean, default: true }
          placeholder: { type: string, default: "Search...", max_length: 30 }
          href: { type: string, default: "/search" }
      cart:
        type: object
        required: true
        fields:
          enabled: { type: boolean, default: true }
          href: { type: string, default: "/cart" }
          show_count: { type: boolean, default: true }
      cta_button:
        type: object
        required: false
        fields:
          enabled: { type: boolean, default: false }
          label: { type: string, max_length: 20 }
          href: { type: string }

  # Mobile Menu
  mobileMenu:
    type: object
    required: true
    fields:
      breakpoint: { type: string, default: "1024px" }
      animation_duration: { type: number, default: 300 }
      close_on_select: { type: boolean, default: true }
```

---

## Visual Specification

### Layout
- **Position:** Fixed top, z-index: 50
- **Height:** 80px desktop, 64px mobile
- **Max-width:** 1440px centered
- **Padding:** 0 80px desktop, 0 24px mobile

### States

#### 1. Transparent State (Hero Overlay)
- Background: transparent
- Logo: Light variant (white)
- Links: White with 80% opacity
- Border-bottom: none

#### 2. Solid State (Scrolled)
- Background: var(--color-bg-primary) (#FFFFFF)
- Logo: Dark variant (dark text + brand color)
- Links: var(--color-text-primary) (#1A1A1A)
- Border-bottom: 1px solid var(--color-border-light)
- Box-shadow: 0 2px 8px rgba(0,0,0,0.04)

### Logo Styling
```
ZURI (Part 1): #1A1A1A (dark)
KARIBU (Part 2): #E85A3C (brand)
Font: font-serif, 24px, font-weight: 700
Letter-spacing: 0.05em
```

### Navigation Links
- Font: font-sans, 14px, font-weight: 500
- Spacing: 32px gap between items
- Hover: Color transition to brand (#E85A3C)
- Active: Brand color with underline

### Utility Icons
- Size: 24px
- Color: Inherit from state
- Hover: Scale 1.05, color to brand

---

## Motion Specification

### Scroll State Transition
```css
/* Duration: 300ms */
/* Easing: ease-out */
transition: background-color 300ms ease-out,
            border-color 300ms ease-out,
            box-shadow 300ms ease-out;
```

### Link Hover
```css
/* Duration: 200ms */
transition: color 200ms ease;
```

### Mobile Menu
- **Open:** Slide from right, 300ms, ease-out
- **Overlay:** Fade in black/50, 200ms
- **Close:** Reverse animations

---

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| >= 1024px | Full horizontal nav visible |
| < 1024px | Hamburger menu, slide-out drawer |
| < 640px | Compact logo, single icon utilities |

---

## Accessibility Requirements

### Keyboard Navigation
- Logo: Tab focusable, Enter to navigate home
- Links: Tab order follows visual order
- Search/Cart: Tab focusable with visible focus ring
- Mobile menu: Trap focus when open, Escape to close

### Focus States
```css
.nav-link:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 4px;
}
```

### ARIA
- `role="navigation"` on nav container
- `aria-label="Main navigation"`
- `aria-expanded` on mobile toggle
- `aria-current="page"` on active link

---

## Implementation Notes

### Scroll Detection
```javascript
// Trigger solid state after 50px scroll
const handleScroll = () => {
  setIsScrolled(window.scrollY > 50);
};
```

### Mobile Menu Structure
```html
<nav aria-label="Main navigation">
  <div class="logo">
    <a href="/" aria-label="ZuriKaribu Home">
      <span class="logo-part1">ZURI</span>
      <span class="logo-part2">KARIBU</span>
    </a>
  </div>
  <ul class="nav-links" role="menubar">
    <!-- Desktop links -->
  </ul>
  <div class="utilities">
    <button aria-label="Search">...</button>
    <a href="/cart" aria-label="Cart">...</a>
  </div>
  <button class="mobile-toggle" aria-expanded="false" aria-controls="mobile-menu">
    <!-- Hamburger icon -->
  </button>
</nav>
```

### Performance
- Use `transform` for mobile menu animation
- Debounce scroll handler (16ms)
- Use CSS `will-change: transform` on mobile drawer
