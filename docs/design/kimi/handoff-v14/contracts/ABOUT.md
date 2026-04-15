# ABOUT Section Contract

## Section Key
`ABOUT`

## Variants
- `STORY` (default) - Brand story page
- `MISSION` - Mission-focused layout

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description |
| `story` | string | Brand story content |

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroImage` | string | null | Hero banner image |
| `mission` | string | null | Mission statement |
| `values` | array | [...] | Brand values |
| `team` | array | [...] | Team members |
| `stats` | array | [...] | Company stats |

## Max Lengths

```yaml
title: 40
description: 200
story: 2000
mission: 300
valueTitle: 30
valueDescription: 80
```

## Fallback Behavior

```yaml
title: "About ZuriKaribu"
description: "Connecting the world to authentic African fashion."
heroImage: "/assets/about_hero.jpg"
story: "ZuriKaribu was founded with a mission to celebrate African craftsmanship..."
mission: "To make authentic African fashion accessible worldwide."
values:
  - { title: "Authenticity", description: "Every piece tells a true story" }
  - { title: "Craftsmanship", description: "Supporting artisan communities" }
  - { title: "Sustainability", description: "Ethical and eco-conscious practices" }
stats:
  - { label: "Countries", value: "54" }
  - { label: "Artisans", value: "2,500+" }
  - { label: "Products", value: "10,000+" }
```

## CMS Integration Example

```json
{
  "sectionKey": "ABOUT",
  "variant": "STORY",
  "content": {
    "title": "About ZuriKaribu",
    "description": "Connecting the world to authentic African fashion.",
    "heroImage": "/assets/about_hero.jpg",
    "story": "Our story begins...",
    "mission": "To make authentic African fashion accessible worldwide."
  }
}
```
