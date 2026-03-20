# DESIGNERS Section Contract

## Section Key
`DESIGNERS`

## Variants
- `GRID` (default) - Designer grid with profiles
- `FEATURED` - Featured designer spotlight

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description |
| `designers` | array | Designer profiles |

## Designer Structure

```yaml
designers:
  - id: "1"
    name: "Adeola Designs"
    country: "Nigeria"
    image: "/assets/designer1.jpg"
    specialty: "Ankara Dresses"
    bio: "Award-winning designer creating modern African fashion"
    products: 45
    href: "/designer/1"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroImage` | string | null | Hero banner image |
| `filters` | array | [...] | Filter options |

## Max Lengths

```yaml
title: 40
description: 200
designerName: 40
specialty: 30
bio: 120
```

## Fallback Behavior

```yaml
title: "Our Designers"
description: "Meet the talented artisans behind our collection."
heroImage: "/assets/designers_hero.jpg"
filters: ["All", "Nigeria", "Ghana", "Kenya", "South Africa"]
```

## CMS Integration Example

```json
{
  "sectionKey": "DESIGNERS",
  "variant": "GRID",
  "content": {
    "title": "Our Designers",
    "description": "Meet the talented artisans.",
    "designers": [
      {
        "id": "1",
        "name": "Adeola Designs",
        "country": "Nigeria",
        "image": "/assets/designer1.jpg",
        "specialty": "Ankara Dresses"
      }
    ]
  }
}
```
