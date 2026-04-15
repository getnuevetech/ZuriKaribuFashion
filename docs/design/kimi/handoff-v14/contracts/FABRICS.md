# FABRICS Section Contract

## Section Key
`FABRICS`

## Variants
- `CATEGORY_GRID` (default) - Fabric grid with filters
- `FEATURED_HERO` - Hero + featured fabrics

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description |
| `fabrics` | array | Fabric items |

## Fabric Structure

```yaml
fabrics:
  - id: "1"
    name: "Premium Ankara"
    price: 25
    unit: "yard"
    image: "/assets/fabric1.jpg"
    country: "Nigeria"
    type: "Ankara"
    description: "Vibrant wax-printed cotton fabric"
    minOrder: 2
    href: "/fabric/1"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroImage` | string | null | Hero banner image |
| `fabricTypes` | array | [...] | Filter fabric types |
| `showBulkCta` | boolean | true | Show bulk order CTA |

## Max Lengths

```yaml
title: 40
description: 200
fabricName: 50
description: 80
```

## Fallback Behavior

```yaml
title: "African Fabrics"
description: "Authentic textiles sourced directly from master weavers and artisans across the African continent."
heroImage: "/assets/fabrics_hero.jpg"
fabricTypes: ["All", "Ankara", "Kente", "Kitenge", "Aso Oke", "Bogolan", "Shweshwe", "Lace"]
showBulkCta: true
```

## CMS Integration Example

```json
{
  "sectionKey": "FABRICS",
  "variant": "CATEGORY_GRID",
  "content": {
    "title": "African Fabrics",
    "description": "Authentic textiles from master weavers.",
    "heroImage": "/assets/fabrics_hero.jpg",
    "fabrics": [
      {
        "id": "1",
        "name": "Premium Ankara",
        "price": 25,
        "unit": "yard",
        "image": "/assets/fabric1.jpg",
        "country": "Nigeria",
        "type": "Ankara"
      }
    ]
  }
}
```
