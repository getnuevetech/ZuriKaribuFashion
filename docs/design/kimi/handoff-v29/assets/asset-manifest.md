# Asset Manifest v29

## Exact Shipped Filenames

### Hero Images (Delivered)

| Filename | Dimensions | Format | Alt Text | Usage |
|----------|------------|--------|----------|-------|
| hero_model.jpg | 1920x1080 | JPG | "African model in traditional blue and gold attire" | Homepage hero |
| rw_hero.jpg | 1920x600 | JPG | "Ready to Wear collection showcase" | Ready to Wear page hero |
| fabrics_hero.jpg | 1920x600 | JPG | "African fabrics display" | Fabrics page hero |

### Product Images (Delivered)

| Filename | Dimensions | Format | Alt Text | Usage |
|----------|------------|--------|----------|-------|
| product1.jpg | 800x1000 | JPG | "Ankara maxi dress in vibrant pattern" | Product grid |

### Generated Assets (Not Shipped - Placeholders)

The following assets are referenced in contracts but NOT included in the shipped package:

| Filename | Status | Action Required |
|----------|--------|-----------------|
| custom_hero.jpg | NOT SHIPPED | Generate or remove from contract |
| designers_hero.jpg | NOT SHIPPED | Generate or remove from contract |
| about_hero.jpg | NOT SHIPPED | Generate or remove from contract |
| designer1.jpg | NOT SHIPPED | Generate or remove from contract |
| designer2.jpg | NOT SHIPPED | Generate or remove from contract |
| designer3.jpg | NOT SHIPPED | Generate or remove from contract |
| fabric1.jpg | NOT SHIPPED | Generate or remove from contract |
| fabric2.jpg | NOT SHIPPED | Generate or remove from contract |
| fabric3.jpg | NOT SHIPPED | Generate or remove from contract |
| fabric4.jpg | NOT SHIPPED | Generate or remove from contract |

### SVG Icons (Not Shipped - Inline Recommended)

No SVG files are shipped. Icons should be implemented as inline SVG or via icon library.

Recommended icon library: Lucide React or Heroicons

| Icon Name | Usage | Lucide Equivalent |
|-----------|-------|-------------------|
| shopping-bag | Category icons | `ShoppingBag` |
| globe | Country icons | `Globe` |
| calendar | Occasion icons | `Calendar` |
| tag | Price icons | `Tag` |
| shield-check | Trust badge | `ShieldCheck` |
| truck | Trust badge | `Truck` |
| refresh-cw | Trust badge | `RefreshCw` |
| headphones | Trust badge | `Headphones` |
| lock | Trust badge | `Lock` |
| award | Trust badge | `Award` |
| search | Navigation | `Search` |
| shopping-cart | Navigation | `ShoppingCart` |
| menu | Mobile menu | `Menu` |
| x | Close button | `X` |
| moon | Dark mode | `Moon` |
| sun | Light mode | `Sun` |
| chevron-down | Dropdown | `ChevronDown` |
| arrow-right | CTAs | `ArrowRight` |

## CDN Path Structure

```
/assets/
  /images/
    hero_model.jpg
    rw_hero.jpg
    fabrics_hero.jpg
    product1.jpg
  /icons/
    # No SVG files - use inline or icon library
```

## Image Optimization Requirements

| Asset Type | Format | Max Size | Dimensions |
|------------|--------|----------|------------|
| Hero images | JPG/WebP | 200KB | 1920x1080 or 1920x600 |
| Product images | JPG/WebP | 100KB | 800x1000 |
| Thumbnails | JPG/WebP | 30KB | 400x500 |

## Usage Rights

All delivered images (hero_model.jpg, rw_hero.jpg, fabrics_hero.jpg, product1.jpg) are licensed for commercial use on the ZuriKaribu platform.

## Missing Assets Resolution

For any contract referencing missing assets, implement one of:

1. **Generate assets** - Create images matching the specified dimensions
2. **Use placeholders** - Implement fallback colors/patterns
3. **Remove from contract** - Update contract to not require missing assets

Recommended fallback for missing hero images:
```css
.hero--fallback {
  background: linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%);
}
```
