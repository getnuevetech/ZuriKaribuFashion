# SHOP_BY_BLOCKS Section Contract

## Section Key
`SHOP_BY_BLOCKS`

## Variants
- `TABBED_GRID` (default) - Tabbed interface with grid items
- `ACCORDION_MOBILE` - Accordion style on mobile

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Section heading |
| `tabs` | array | Tab definitions with items |

## Tab Structure

```yaml
tabs:
  - id: "category"
    label: "Category"
    items:
      - name: "Dresses"
        href: "/ready-to-wear/dresses"
        count: "240+"
        icon: "shopping-bag"
      - name: "Tops & Blouses"
        href: "/ready-to-wear/tops"
        count: "180+"
        icon: "shopping-bag"
  - id: "country"
    label: "Country"
    items:
      - name: "Nigeria"
        href: "/country/nigeria"
        count: "450+"
        icon: "globe"
  - id: "occasion"
    label: "Occasion"
    items:
      - name: "Wedding"
        href: "/occasion/wedding"
        count: "180+"
        icon: "calendar"
  - id: "price"
    label: "Price"
    items:
      - name: "Under $50"
        href: "/price/under-50"
        count: "280+"
        icon: "tag"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `subtitle` | string | null | Section description |
| `defaultTab` | string | "category" | Initial active tab |
| `showCounts` | boolean | true | Show item counts |
| `maxItemsPerTab` | number | 8 | Maximum items displayed |
| `gridColumns` | number | 4 | Grid columns (2-4) |

## Max Lengths

```yaml
title: 40
subtitle: 100
tabLabel: 20
itemName: 30
count: 10
```

## Fallback Behavior

```yaml
title: "Shop by"
subtitle: "Discover African fashion your way"
defaultTab: "category"
tabs:
  category:
    items: [
      { name: "Dresses", href: "/ready-to-wear/dresses", count: "240+" },
      { name: "Tops & Blouses", href: "/ready-to-wear/tops", count: "180+" },
      { name: "Skirts", href: "/ready-to-wear/skirts", count: "120+" },
      { name: "Pants", href: "/ready-to-wear/pants", count: "95+" },
      { name: "Outerwear", href: "/ready-to-wear/outerwear", count: "60+" },
      { name: "Accessories", href: "/accessories", count: "320+" },
      { name: "Men's Wear", href: "/mens", count: "150+" },
      { name: "Kids", href: "/kids", count: "80+" }
    ]
  country:
    items: [
      { name: "Nigeria", href: "/country/nigeria", count: "450+" },
      { name: "Ghana", href: "/country/ghana", count: "280+" },
      { name: "Kenya", href: "/country/kenya", count: "190+" },
      { name: "South Africa", href: "/country/south-africa", count: "220+" },
      { name: "Senegal", href: "/country/senegal", count: "120+" },
      { name: "Ethiopia", href: "/country/ethiopia", count: "85+" },
      { name: "Tanzania", href: "/country/tanzania", count: "95+" },
      { name: "Mali", href: "/country/mali", count: "70+" }
    ]
  occasion:
    items: [
      { name: "Wedding", href: "/occasion/wedding", count: "180+" },
      { name: "Casual", href: "/occasion/casual", count: "420+" },
      { name: "Formal", href: "/occasion/formal", count: "150+" },
      { name: "Festival", href: "/occasion/festival", count: "200+" },
      { name: "Workwear", href: "/occasion/workwear", count: "110+" },
      { name: "Party", href: "/occasion/party", count: "160+" },
      { name: "Traditional", href: "/occasion/traditional", count: "95+" },
      { name: "Beach", href: "/occasion/beach", count: "75+" }
    ]
  price:
    items: [
      { name: "Under $50", href: "/price/under-50", count: "280+" },
      { name: "$50 - $100", href: "/price/50-100", count: "350+" },
      { name: "$100 - $200", href: "/price/100-200", count: "290+" },
      { name: "$200 - $500", href: "/price/200-500", count: "180+" },
      { name: "$500+", href: "/price/500-plus", count: "95+" },
      { name: "Sale", href: "/sale", count: "150+" }
    ]
```

## Taxonomy Ownership (N2)

### Source of Truth
```yaml
category:
  source: "CMS Product Categories"
  endpoint: "/api/categories"
  cache: "1 hour"
  
country:
  source: "CMS Country Taxonomy (54 African nations)"
  endpoint: "/api/countries"
  cache: "24 hours (static data)"
  
occasion:
  source: "CMS Occasion Tags"
  endpoint: "/api/tags?type=occasion"
  cache: "1 hour"
  
price:
  source: "Dynamic from product prices"
  endpoint: "/api/products/price-ranges"
  cache: "15 minutes"
```

### Empty State Behavior
```yaml
scenario: "No items in tab"
behavior: "Show 'Coming soon' placeholder with icon"
cta: "Browse all {category}"
```

### Data Unavailable
```yaml
behavior: "Hide tab from navigation"
log: "Console warning for missing taxonomy"
```

## Accessibility (a11y)

```yaml
role: "tablist"
ariaLabels:
  tablist: "Shop by categories"
  tab: "Shop by {category}"
  tabpanel: "{category} items"
focusOrder: [tab1, tab2, tab3, tab4, item1, item2, ...]
```

## CMS Integration Example

```json
{
  "sectionKey": "SHOP_BY_BLOCKS",
  "variant": "TABBED_GRID",
  "content": {
    "title": "Shop by",
    "subtitle": "Discover African fashion your way",
    "defaultTab": "category",
    "showCounts": true,
    "gridColumns": 4,
    "tabs": [
      {
        "id": "category",
        "label": "Category",
        "items": [
          { "name": "Dresses", "href": "/ready-to-wear/dresses", "count": "240+" }
        ]
      }
    ]
  }
}
```
