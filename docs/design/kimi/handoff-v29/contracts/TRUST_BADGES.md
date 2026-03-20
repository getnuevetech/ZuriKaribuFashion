# TRUST_BADGES Section Contract

## Section Key
`TRUST_BADGES`

## Variants
- `HORIZONTAL` (default) - Horizontal row of badges
- `GRID` - 2x2 or 4-column grid layout
- `COMPACT` - Minimal inline badges

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `badges` | array | Trust badges to display |

## Badge Schema (Explicit)

```yaml
badge:
  icon: string        # Icon identifier (see icon mapping below)
  title: string       # Badge title (max 30 chars)
  description: string # Badge description (max 80 chars)
  order: number       # Display order priority (1-6)
```

### Icon Mapping
```yaml
iconMapping:
  "shield-check":   "Authentic Guarantee"
  "truck":          "Global Shipping"  
  "refresh-cw":     "Easy Returns"
  "headphones":     "24/7 Support"
  "lock":           "Secure Payment"
  "award":          "Artisan Made"
  "globe":          "Worldwide Delivery"
  "heart":          "Made with Love"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTitle` | boolean | true | Show section title |
| `title` | string | "Why Shop With Us" | Section heading (max 40 chars) |
| `subtitle` | string | null | Section description (max 100 chars) |
| `layout` | string | "horizontal" | Layout: "horizontal" | "grid" | "compact" |
| `maxBadges` | number | 4 | Maximum badges to display |

## Max Lengths

```yaml
title: 40
subtitle: 100
badgeTitle: 30
badgeDescription: 80
```

## Fallback Behavior

```yaml
showTitle: true
title: "Why Shop With Us"
subtitle: null
layout: "horizontal"
maxBadges: 4
badges:
  - icon: "shield-check"
    title: "Authentic Guarantee"
    description: "Every piece is verified authentic African craftsmanship"
    order: 1
  - icon: "truck"
    title: "Global Shipping"
    description: "Free delivery on orders over $100 worldwide"
    order: 2
  - icon: "refresh-cw"
    title: "Easy Returns"
    description: "30-day hassle-free return policy"
    order: 3
  - icon: "headphones"
    title: "24/7 Support"
    description: "Our team is here to help you anytime"
    order: 4
```

## Copy Hierarchy (Priority Order)

```yaml
priority:
  1: { icon: "shield-check", title: "Authentic Guarantee" }
  2: { icon: "truck", title: "Global Shipping" }
  3: { icon: "refresh-cw", title: "Easy Returns" }
  4: { icon: "headphones", title: "24/7 Support" }
  5: { icon: "lock", title: "Secure Payment" }
  6: { icon: "award", title: "Artisan Made" }
```

## Variant Usage Guidelines

| Variant | Use Case | Placement |
|---------|----------|-----------|
| `HORIZONTAL` | Default, between major sections | Below Shop By, above Countries |
| `GRID` | Dedicated trust page or footer area | Trust page, footer |
| `COMPACT` | Near CTAs or checkout flow | Product page, cart, checkout |

## Empty States

| Scenario | Behavior |
|----------|----------|
| No badges provided | Show fallback 4 badges |
| Less than 4 badges | Center align, maintain spacing |
| All badges empty | Hide section entirely |

## Accessibility (a11y)

```yaml
ariaLabels:
  section: "Why shop with us"
  badge: "{title}: {description}"
role: "list" for badges container
role: "listitem" for each badge
```

## CMS Integration Example

```json
{
  "sectionKey": "TRUST_BADGES",
  "variant": "HORIZONTAL",
  "content": {
    "showTitle": true,
    "title": "Why Shop With Us",
    "layout": "horizontal",
    "maxBadges": 4,
    "badges": [
      {
        "icon": "shield-check",
        "title": "Authentic Guarantee",
        "description": "Every piece is verified authentic",
        "order": 1
      },
      {
        "icon": "truck",
        "title": "Global Shipping",
        "description": "Free delivery on orders over $100",
        "order": 2
      }
    ]
  }
}
```
