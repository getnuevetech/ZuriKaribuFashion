# HERO Section Contract

## Section Key
`HERO`

## Variants
- `SPLIT_EDITORIAL` (default)
- `FULL_BLEED_IMMERSIVE`
- `MINIMAL_TEXT_OVERLAY`

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Main headline, max 56 chars |
| `subtitle` | string | Supporting text, max 120 chars |
| `primaryCtaText` | string | CTA button text, max 24 chars |
| `primaryCtaLink` | string | CTA destination URL |
| `heroImage` | string (URL) | Background/main hero image |

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `secondaryCtaText` | string | null | Secondary CTA text, max 24 chars |
| `secondaryCtaLink` | string | null | Secondary CTA URL |
| `quickPathRtwText` | string | "Ready to Wear" | Quick link text |
| `quickPathRtwLink` | string | "/ready-to-wear" | Quick link URL |
| `quickPathFabricsText` | string | "Fabrics" | Quick link text |
| `quickPathFabricsLink` | string | "/fabrics" | Quick link URL |
| `quickPathCustomText` | string | "Custom" | Quick link text |
| `quickPathCustomLink` | string | "/custom" | Quick link URL |
| `overlayOpacity` | number | 0.4 | Dark overlay opacity (0-1) |
| `textAlignment` | string | "left" | "left" | "center" | "right" |

## Max Lengths

```yaml
title: 56
subtitle: 120
primaryCtaText: 24
secondaryCtaText: 24
quickPathRtwText: 20
quickPathFabricsText: 20
quickPathCustomText: 20
```

## Fallback Behavior

```yaml
heroImage: "/assets/hero_model.jpg"
title: "ZURI KARIBU"
subtitle: "Made by Africans. Worn by the world."
primaryCtaText: "Shop Now"
primaryCtaLink: "/shop"
overlayOpacity: 0.4
```

## Variant Compatibility

```yaml
modes: [STANDARD_PREMIUM, EDITORIAL_IMMERSIVE]
themes: [LIGHT, DARK]
responsive: [DESKTOP_1440, TABLET_1024, TABLET_768, MOBILE_390, MOBILE_360]
```

## Accessibility (a11y)

```yaml
minContrast: "WCAG-AA-4.5:1"
reducedMotionAlternative: "static hero image, no parallax, no fade animations"
focusOrder: [skip-link, logo, nav-links, primary-cta, secondary-cta, quick-paths]
ariaLabels:
  hero: "Main hero section"
  cta: "Primary call to action"
  quickPath: "Quick navigation to {category}"
```

## Dynamic Content Stress States

### Long Title (56 chars)
```
"Discover Authentic African Fashion From 54 Countries"
```
**Behavior**: Text wraps to 2 lines, maintains hierarchy

### Long Subtitle (120 chars)
```
"Experience the rich heritage of African craftsmanship. Every piece tells a story of tradition, culture, and artisanal excellence."
```
**Behavior**: Wraps to 3 lines max, truncates with ellipsis if exceeded

### Missing Image
**Behavior**: Display solid background color (--color-bg-tertiary) with fallback pattern

### Localization (30% longer)
**Behavior**: 
- Title: Allow 2-line wrap
- Subtitle: Clamp to 3 lines with fade
- CTAs: Scale font-size down 10% if needed

## Empty States

| Scenario | Behavior |
|----------|----------|
| No title | Display fallback "ZURI KARIBU" |
| No subtitle | Hide subtitle container |
| No CTA | Hide CTA button, show quick paths only |
| No image | Show color background + pattern |
| No quick paths | Hide quick path row entirely |

## CMS Integration Example

```json
{
  "sectionKey": "HERO",
  "variant": "SPLIT_EDITORIAL",
  "content": {
    "title": "ZURI KARIBU",
    "subtitle": "Made by Africans. Worn by the world.",
    "primaryCtaText": "Shop Now",
    "primaryCtaLink": "/shop",
    "heroImage": "/assets/hero_model.jpg",
    "quickPathRtwText": "Ready to Wear",
    "quickPathRtwLink": "/ready-to-wear"
  }
}
```
