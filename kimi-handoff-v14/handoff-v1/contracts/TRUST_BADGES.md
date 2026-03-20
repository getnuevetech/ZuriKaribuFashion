# TRUST_BADGES Section Contract

## Section Key
`TRUST_BADGES`

## Variants
- `HORIZONTAL` (default)
- `GRID`
- `COMPACT`

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `badges` | array | Trust badges to display |

## Badge Structure

```yaml
badges:
  - icon: "ShieldCheck"
    title: "Authentic Guarantee"
    description: "Every piece is verified authentic"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTitle` | boolean | true | Show section title |
| `title` | string | "Why Shop With Us" | Section heading |
| `subtitle` | string | null | Section description |

## Max Lengths

```yaml
title: 40
subtitle: 100
badgeTitle: 30
badgeDescription: 80
```

## Fallback Behavior

```yaml
badges:
  - icon: "ShieldCheck"
    title: "Authentic Guarantee"
    description: "Every piece is verified authentic African craftsmanship"
  - icon: "Truck"
    title: "Global Shipping"
    description: "Free delivery on orders over $100 worldwide"
  - icon: "RefreshCw"
    title: "Easy Returns"
    description: "30-day hassle-free return policy"
  - icon: "Headphones"
    title: "24/7 Support"
    description: "Our team is here to help you anytime"
```

## Copy Hierarchy (N4)

```yaml
priority:
  1: "Authentic Guarantee"
  2: "Global Shipping"
  3: "Easy Returns"
  4: "24/7 Support"
  5: "Secure Payment"
  6: "Artisan Made"
```

## Variant Usage Guidelines

```yaml
HORIZONTAL: "Use between major sections"
GRID: "Use in footer area or dedicated trust page"
COMPACT: "Use near CTAs or checkout"
```

## Accessibility (a11y)

```yaml
ariaLabels:
  section: "Why shop with us"
  badge: "{title}: {description}"
```

## CMS Integration Example

```json
{
  "sectionKey": "TRUST_BADGES",
  "variant": "HORIZONTAL",
  "content": {
    "showTitle": true,
    "title": "Why Shop With Us",
    "badges": [
      {
        "icon": "ShieldCheck",
        "title": "Authentic Guarantee",
        "description": "Every piece is verified authentic"
      }
    ]
  }
}
```
