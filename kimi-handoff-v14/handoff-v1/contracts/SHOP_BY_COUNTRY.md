# SHOP_BY_COUNTRY Section Contract

## Section Key
`SHOP_BY_COUNTRY`

## Variants
- `GRID_WITH_FILTERS` (default)
- `COMPACT_LIST`
- `MAP_OVERLAY`

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Section heading |
| `countries` | array | List of countries with flags |

## Country Structure

```yaml
countries:
  - code: "NG"
    name: "Nigeria"
    region: "West"
    flag: "🇳🇬"
    href: "/country/nigeria"
    productCount: 450
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `subtitle` | string | null | Section description |
| `showRegionFilter` | boolean | true | Enable region filtering |
| `showProductCount` | boolean | false | Show product counts |
| `maxDisplay` | number | 54 | Max countries to show |

## Max Lengths

```yaml
title: 40
subtitle: 100
countryName: 30
```

## Fallback Behavior

```yaml
title: "Shop by Country"
subtitle: "Explore fashion from all 54 African nations"
countries: "Full list of 54 African countries with flags"
showRegionFilter: true
```

## African Countries Data (54 Total)

```yaml
regions: [North, West, Central, East, Southern]
counts:
  North: 6
  West: 16
  Central: 9
  East: 18
  Southern: 5
```

## Accessibility (a11y)

```yaml
ariaLabels:
  section: "Shop by African country"
  filter: "Filter by region"
  country: "Shop from {country}"
focusOrder: [region-filter, country1, country2, ...]
```

## CMS Integration Example

```json
{
  "sectionKey": "SHOP_BY_COUNTRY",
  "variant": "GRID_WITH_FILTERS",
  "content": {
    "title": "Shop by Country",
    "subtitle": "Explore fashion from all 54 African nations",
    "showRegionFilter": true,
    "countries": [
      { "code": "NG", "name": "Nigeria", "region": "West", "flag": "🇳🇬", "href": "/country/nigeria" }
    ]
  }
}
```

## Note: Country Data Static
The 54 African countries list is static and should be hardcoded. Only product counts are dynamic.
