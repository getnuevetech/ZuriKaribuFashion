# SHOP_BY_BLOCKS Section Contract

## Section Key
`SHOP_BY_BLOCKS`

## Variants
- `TABBED_GRID` (default)
- `ACCORDION_MOBILE`

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
    icon: "ShoppingBag"
    items:
      - name: "Dresses"
        href: "/ready-to-wear/dresses"
        count: "240+"
      - name: "Tops"
        href: "/ready-to-wear/tops"
        count: "180+"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `subtitle` | string | null | Section description |
| `defaultTab` | string | "category" | Initial active tab |
| `showCounts` | boolean | true | Show item counts |
| `maxItemsPerTab` | number | 8 | Maximum items displayed |

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
      { name: "Dresses", href: "/ready-to-wear/dresses" },
      { name: "Tops", href: "/ready-to-wear/tops" },
      { name: "Skirts", href: "/ready-to-wear/skirts" }
    ]
```

## Taxonomy Ownership (N2)

### Source of Truth
```yaml
category: "CMS Product Categories"
country: "CMS Country Taxonomy (54 African nations)"
occasion: "CMS Occasion Tags"
price: "Dynamic from product prices"
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
    "tabs": [
      {
        "id": "category",
        "label": "Category",
        "icon": "ShoppingBag",
        "items": [
          { "name": "Dresses", "href": "/ready-to-wear/dresses", "count": "240+" }
        ]
      }
    ]
  }
}
```
