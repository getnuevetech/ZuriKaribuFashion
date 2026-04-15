# READY_TO_WEAR Section Contract

## Section Key
`READY_TO_WEAR`

## Variants
- `CATEGORY_GRID` (default) - Product grid with filters
- `FEATURED_HERO` - Hero + featured products

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description |
| `products` | array | Product items |

## Product Structure

```yaml
products:
  - id: "1"
    name: "Ankara Maxi Dress"
    price: 189
    originalPrice: 249
    image: "/assets/product1.jpg"
    country: "Nigeria"
    badge: "New" | "Sale" | "Bestseller" | null
    href: "/product/1"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroImage` | string | null | Hero banner image |
| `categories` | array | [...] | Filter categories |
| `sortOptions` | array | [...] | Sort options |
| `itemsPerPage` | number | 12 | Products per page |

## Max Lengths

```yaml
title: 40
description: 200
productName: 60
badge: 15
```

## Fallback Behavior

```yaml
title: "Ready to Wear"
description: "Discover our curated collection of authentic African fashion, ready to ship worldwide."
heroImage: "/assets/rw_hero.jpg"
categories: ["All", "Dresses", "Tops", "Skirts", "Pants", "Outerwear"]
sortOptions: ["Featured", "Newest", "Price: Low to High", "Price: High to Low"]
itemsPerPage: 12
```

## CMS Integration Example

```json
{
  "sectionKey": "READY_TO_WEAR",
  "variant": "CATEGORY_GRID",
  "content": {
    "title": "Ready to Wear",
    "description": "Discover our curated collection of authentic African fashion.",
    "heroImage": "/assets/rw_hero.jpg",
    "products": [
      {
        "id": "1",
        "name": "Ankara Maxi Dress",
        "price": 189,
        "image": "/assets/product1.jpg",
        "country": "Nigeria",
        "badge": "New"
      }
    ]
  }
}
```
