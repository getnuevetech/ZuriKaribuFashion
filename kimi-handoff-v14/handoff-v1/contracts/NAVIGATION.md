# NAVIGATION Section Contract

## Section Key
`NAVIGATION`

## Variants
- `STICKY_TRANSPARENT` (default on hero)
- `STICKY_SOLID` (scrolled state)
- `MOBILE_DRAWER`
- `SEARCH_OVERLAY`

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
| `cartCount` | number | 0 | Cart item count |

## Nav Link Structure

```yaml
navLinks:
  - label: "Ready to Wear"
    href: "/ready-to-wear"
    highlight: false
  - label: "Fabrics"
    href: "/fabrics"
    highlight: false
  - label: "Custom"
    href: "/custom"
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
  { label: "Ready to Wear", href: "/ready-to-wear" },
  { label: "Fabrics", href: "/fabrics" },
  { label: "Custom", href: "/custom" }
]
```

## Contrast Safety (Critical C2)

### Transparent State (on hero)
```yaml
background: "transparent"
textColor: "#FFFFFF"
logoColor: "#FFFFFF"
ctaColor: "#FFFFFF"
minContrast: "4.5:1 against hero image"
```

### Solid State (scrolled)
```yaml
background: "var(--color-bg-primary)"
textColor: "var(--color-text-primary)"
minContrast: "4.5:1"
```

### Contrast Enforcement
- Hero images MUST have minimum 40% dark overlay
- Logo/text must have text-shadow for readability
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
focusOrder: [skip-link, logo, nav-links, search, cart, menu]
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
      { "label": "Ready to Wear", "href": "/ready-to-wear" },
      { "label": "Fabrics", "href": "/fabrics" },
      { "label": "Custom", "href": "/custom" }
    ],
    "showSearch": true,
    "showCart": true,
    "cartCount": 0
  }
}
```
