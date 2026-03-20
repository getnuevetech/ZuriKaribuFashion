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
  - id: "country"
    label: "Country"
    items:
      - name: "Nigeria"
        href: "/country/nigeria"
        count: "450+"
        icon: "globe"
        flag: "🇳🇬"
        region: "West"
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

## Country Tab Schema (Explicit)

### Country Item Structure
```yaml
countryItem:
  name: string          # Country name (max 30 chars)
  href: string          # URL path to country page
  count: string         # Product count display (e.g., "450+")
  icon: "globe"         # Fixed icon for all countries
  flag: string          # Emoji flag (e.g., "🇳🇬")
  region: string        # Region: "North" | "West" | "Central" | "East" | "Southern"
  code: string          # ISO country code (e.g., "NG")
```

### Country Region Filters Schema
```yaml
regionFilters:
  - id: "all"
    label: "All"
    count: 54           # Total countries
  - id: "north"
    label: "North"
    count: 6            # Algeria, Egypt, Libya, Morocco, Sudan, Tunisia
  - id: "west"
    label: "West"
    count: 16           # Benin, Burkina Faso, Cape Verde, Côte d'Ivoire, Gambia, Ghana, Guinea, Guinea-Bissau, Liberia, Mali, Mauritania, Niger, Nigeria, Senegal, Sierra Leone, Togo
  - id: "central"
    label: "Central"
    count: 9            # Angola, Cameroon, CAR, Chad, Congo, DR Congo, Equatorial Guinea, Gabon, São Tomé & Príncipe
  - id: "east"
    label: "East"
    count: 18           # Burundi, Comoros, Djibouti, Eritrea, Ethiopia, Kenya, Madagascar, Malawi, Mauritius, Mozambique, Rwanda, Seychelles, Somalia, South Sudan, Tanzania, Uganda, Zambia, Zimbabwe
  - id: "southern"
    label: "Southern"
    count: 5            # Botswana, Lesotho, Namibia, South Africa, Eswatini
```

### All 54 African Countries (Static Data)
```yaml
countries:
  # North (6)
  - { name: "Algeria", code: "DZ", region: "North", flag: "🇩🇿" }
  - { name: "Egypt", code: "EG", region: "North", flag: "🇪🇬" }
  - { name: "Libya", code: "LY", region: "North", flag: "🇱🇾" }
  - { name: "Morocco", code: "MA", region: "North", flag: "🇲🇦" }
  - { name: "Sudan", code: "SD", region: "North", flag: "🇸🇩" }
  - { name: "Tunisia", code: "TN", region: "North", flag: "🇹🇳" }
  
  # West (16)
  - { name: "Benin", code: "BJ", region: "West", flag: "🇧🇯" }
  - { name: "Burkina Faso", code: "BF", region: "West", flag: "🇧🇫" }
  - { name: "Cape Verde", code: "CV", region: "West", flag: "🇨🇻" }
  - { name: "Côte d'Ivoire", code: "CI", region: "West", flag: "🇨🇮" }
  - { name: "Gambia", code: "GM", region: "West", flag: "🇬🇲" }
  - { name: "Ghana", code: "GH", region: "West", flag: "🇬🇭" }
  - { name: "Guinea", code: "GN", region: "West", flag: "🇬🇳" }
  - { name: "Guinea-Bissau", code: "GW", region: "West", flag: "🇬🇼" }
  - { name: "Liberia", code: "LR", region: "West", flag: "🇱🇷" }
  - { name: "Mali", code: "ML", region: "West", flag: "🇲🇱" }
  - { name: "Mauritania", code: "MR", region: "West", flag: "🇲🇷" }
  - { name: "Niger", code: "NE", region: "West", flag: "🇳🇪" }
  - { name: "Nigeria", code: "NG", region: "West", flag: "🇳🇬" }
  - { name: "Senegal", code: "SN", region: "West", flag: "🇸🇳" }
  - { name: "Sierra Leone", code: "SL", region: "West", flag: "🇸🇱" }
  - { name: "Togo", code: "TG", region: "West", flag: "🇹🇬" }
  
  # Central (9)
  - { name: "Angola", code: "AO", region: "Central", flag: "🇦🇴" }
  - { name: "Cameroon", code: "CM", region: "Central", flag: "🇨🇲" }
  - { name: "Central African Republic", code: "CF", region: "Central", flag: "🇨🇫" }
  - { name: "Chad", code: "TD", region: "Central", flag: "🇹🇩" }
  - { name: "Congo", code: "CG", region: "Central", flag: "🇨🇬" }
  - { name: "DR Congo", code: "CD", region: "Central", flag: "🇨🇩" }
  - { name: "Equatorial Guinea", code: "GQ", region: "Central", flag: "🇬🇶" }
  - { name: "Gabon", code: "GA", region: "Central", flag: "🇬🇦" }
  - { name: "São Tomé & Príncipe", code: "ST", region: "Central", flag: "🇸🇹" }
  
  # East (18)
  - { name: "Burundi", code: "BI", region: "East", flag: "🇧🇮" }
  - { name: "Comoros", code: "KM", region: "East", flag: "🇰🇲" }
  - { name: "Djibouti", code: "DJ", region: "East", flag: "🇩🇯" }
  - { name: "Eritrea", code: "ER", region: "East", flag: "🇪🇷" }
  - { name: "Ethiopia", code: "ET", region: "East", flag: "🇪🇹" }
  - { name: "Kenya", code: "KE", region: "East", flag: "🇰🇪" }
  - { name: "Madagascar", code: "MG", region: "East", flag: "🇲🇬" }
  - { name: "Malawi", code: "MW", region: "East", flag: "🇲🇼" }
  - { name: "Mauritius", code: "MU", region: "East", flag: "🇲🇺" }
  - { name: "Mozambique", code: "MZ", region: "East", flag: "🇲🇿" }
  - { name: "Rwanda", code: "RW", region: "East", flag: "🇷🇼" }
  - { name: "Seychelles", code: "SC", region: "East", flag: "🇸🇨" }
  - { name: "Somalia", code: "SO", region: "East", flag: "🇸🇴" }
  - { name: "South Sudan", code: "SS", region: "East", flag: "🇸🇸" }
  - { name: "Tanzania", code: "TZ", region: "East", flag: "🇹🇿" }
  - { name: "Uganda", code: "UG", region: "East", flag: "🇺🇬" }
  - { name: "Zambia", code: "ZM", region: "East", flag: "🇿🇲" }
  - { name: "Zimbabwe", code: "ZW", region: "East", flag: "🇿🇼" }
  
  # Southern (5)
  - { name: "Botswana", code: "BW", region: "Southern", flag: "🇧🇼" }
  - { name: "Lesotho", code: "LS", region: "Southern", flag: "🇱🇸" }
  - { name: "Namibia", code: "NA", region: "Southern", flag: "🇳🇦" }
  - { name: "South Africa", code: "ZA", region: "Southern", flag: "🇿🇦" }
  - { name: "Eswatini", code: "SZ", region: "Southern", flag: "🇸🇿" }
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `subtitle` | string | null | Section description |
| `defaultTab` | string | "category" | Initial active tab |
| `showCounts` | boolean | true | Show item counts |
| `maxItemsPerTab` | number | 8 | Maximum items displayed |
| `gridColumns` | number | 4 | Grid columns (2-4) |
| `showRegionFilters` | boolean | true | Show region filter pills (country tab only) |

## Max Lengths

```yaml
title: 40
subtitle: 100
tabLabel: 20
itemName: 30
count: 10
countryName: 30
regionLabel: 15
```

## Fallback Behavior

```yaml
title: "Shop by"
subtitle: "Discover African fashion your way"
defaultTab: "category"
showCounts: true
showRegionFilters: true
gridColumns: 4
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
    items: [ /* All 54 countries with flags */ ]
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

## Taxonomy Ownership (Source Definitions)

```yaml
category:
  source: "CMS Product Categories"
  fields:
    - name: "name"          # string, max 30 chars
    - name: "slug"          # string, URL-safe
    - name: "productCount"  # number, displayed as "{count}+"
  cache: "1 hour"
  
country:
  source: "STATIC_JSON"     # 54 African countries (hardcoded)
  fields:
    - name: "name"          # string, country name
    - name: "code"          # string, ISO 2-letter code
    - name: "flag"          # string, emoji flag
    - name: "region"        # enum: North|West|Central|East|Southern
    - name: "productCount"  # number, from /api/countries/{code}/count
  cache: "24 hours (static data)"
  
occasion:
  source: "CMS Tags"
  fields:
    - name: "name"          # string, max 30 chars
    - name: "slug"          # string, URL-safe
    - name: "productCount"  # number
  cache: "1 hour"
  
price:
  source: "DYNAMIC_FROM_PRODUCTS"
  fields:
    - name: "rangeLabel"    # string, e.g., "Under $50"
    - name: "minPrice"      # number or null
    - name: "maxPrice"      # number or null
    - name: "productCount"  # number
  cache: "15 minutes"
```

## Empty State Behavior

| Scenario | Behavior |
|----------|----------|
| No items in tab | Show "Coming soon" placeholder with icon |
| No countries in region | Show "No countries in this region" message |
| Data loading | Show skeleton cards (4-8 items) |
| Data error | Show error message with retry button |

## Accessibility (a11y)

```yaml
role: "tablist"
ariaLabels:
  tablist: "Shop by categories"
  tab: "Shop by {category}"
  tabpanel: "{category} items"
  regionFilter: "Filter by {region} region"
focusOrder: [tab1, tab2, tab3, tab4, region-filter, item1, item2, ...]
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
    "showRegionFilters": true,
    "gridColumns": 4,
    "tabs": [
      {
        "id": "category",
        "label": "Category",
        "items": [
          { "name": "Dresses", "href": "/ready-to-wear/dresses", "count": "240+" }
        ]
      },
      {
        "id": "country",
        "label": "Country",
        "items": [
          { "name": "Nigeria", "href": "/country/nigeria", "count": "450+", "flag": "🇳🇬", "region": "West", "code": "NG" }
        ]
      }
    ]
  }
}
```
