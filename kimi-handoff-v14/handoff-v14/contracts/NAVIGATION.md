# NAVIGATION Section Contract

## Section Key
`NAVIGATION`

## Variants
- `STICKY_TRANSPARENT` (default on hero) - Transparent background over hero
- `STICKY_SOLID` (scrolled state) - Solid background when scrolled
- `MOBILE_DRAWER` - Mobile slide-out menu
- `SEARCH_OVERLAY` - Full-screen search overlay

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `logoText` | string | Brand name text |
| `logoLink` | string | Logo click destination |

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `navLinks` | array | [...] | Navigation items array |
| `showSearch` | boolean | true | Enable search icon |
| `showCart` | boolean | true | Enable cart icon |
| `showThemeToggle` | boolean | true | Enable theme toggle |
| `showSignIn` | boolean | true | Enable sign in link |
| `cartCount` | number | 0 | Cart item count |

## Nav Link Structure

```yaml
navLinks:
  - label: "Shop"
    href: "/shop"
    highlight: false
  - label: "Ready to Wear"
    href: "/ready-to-wear"
    highlight: false
  - label: "Fabrics"
    href: "/fabrics"
    highlight: false
  - label: "Custom"
    href: "/custom"
    highlight: false
  - label: "Designers"
    href: "/designers"
    highlight: false
  - label: "About"
    href: "/about"
    highlight: false
```

## Max Lengths

```yaml
logoText: 20
navLinkLabel: 24
searchPlaceholder: 50
```

## Fallback Behavior

```yaml
logoText: "ZURI KARIBU"
logoLink: "/"
navLinks: [
  { label: "Shop", href: "/shop" },
  { label: "Ready to Wear", href: "/ready-to-wear" },
  { label: "Fabrics", href: "/fabrics" },
  { label: "Custom", href: "/custom" },
  { label: "Designers", href: "/designers" },
  { label: "About", href: "/about" }
]
showSearch: true
showCart: true
showThemeToggle: true
showSignIn: true
cartCount: 0
```

## Contrast Safety (Critical C2)

### Transparent State (on hero)
```yaml
background: "transparent"
textColor: "#1A1917"
logoColor: "#1A1917"
minContrast: "4.5:1 against hero background"
```

### Solid State (scrolled)
```yaml
background: "var(--color-bg-primary)"
textColor: "var(--color-text-primary)"
borderBottom: "1px solid var(--color-border-default)"
minContrast: "4.5:1"
```

### Contrast Enforcement
- Split hero layout provides natural contrast (image left, light content right)
- Logo/text on light side must have minimum 4.5:1 contrast
- Scrolled state uses solid background

## Search Overlay States (N1)

### Loading State
```yaml
behavior: "Show spinner in search input"
delay: "300ms before showing loading indicator"
```

### No Results State
```yaml
behavior: "Display 'No results for {query}' with suggestions"
suggestions: "Show popular searches"
```

### Error State
```yaml
behavior: "Display 'Search unavailable' with retry button"
retryAction: "Clear and refocus input"
```

### Keyboard Behavior
```yaml
escape: "Close overlay, return focus to search button"
tab: "Trap focus within overlay"
enter: "Submit search"
arrowKeys: "Navigate suggestions"
```

## Accessibility (a11y)

```yaml
skipLink: "Skip to main content"
ariaLabels:
  nav: "Main navigation"
  menu: "Open menu"
  search: "Open search"
  cart: "Shopping cart with {count} items"
  theme: "Toggle dark mode"
  signIn: "Sign in to your account"
focusOrder: [skip-link, logo, nav-links, search, cart, theme, sign-in, menu]
```

## CMS Integration Example

```json
{
  "sectionKey": "NAVIGATION",
  "variant": "STICKY_TRANSPARENT",
  "content": {
    "logoText": "ZURI KARIBU",
    "logoLink": "/",
    "navLinks": [
      { "label": "Shop", "href": "/shop" },
      { "label": "Ready to Wear", "href": "/ready-to-wear" },
      { "label": "Fabrics", "href": "/fabrics" },
      { "label": "Custom", "href": "/custom" },
      { "label": "Designers", "href": "/designers" },
      { "label": "About", "href": "/about" }
    ],
    "showSearch": true,
    "showCart": true,
    "showThemeToggle": true,
    "showSignIn": true,
    "cartCount": 0
  }
}
```
