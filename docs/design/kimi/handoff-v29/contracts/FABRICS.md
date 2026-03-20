# Fabrics Section Contract

## Section Overview
Premium African textiles showcase featuring authentic fabrics from across the continent. Split layout with editorial imagery and detailed fabric information with origin storytelling.

---

## CMS Schema

```yaml
fabrics:
  # Section Layout
  layout:
    type: string
    required: true
    default: "split"
    enum: ["split", "grid", "carousel"]

  # Visual Side
  visual:
    type: object
    required: true
    fields:
      image:
        type: object
        required: true
        fields:
          url: { type: string, required: true, format: "uri" }
          alt: { type: string, required: true, max_length: 100 }
          caption: { type: string, max_length: 60 }
      overlay_text:
        type: string
        required: false
        max_length: 30
        default: "Authentic Textiles"
      badge:
        type: object
        required: false
        fields:
          text: { type: string, max_length: 20, default: "Sourced in Africa" }
          position: { type: string, default: "bottom-right", enum: ["top-left", "top-right", "bottom-left", "bottom-right"] }

  # Content Side
  content:
    type: object
    required: true
    fields:
      eyebrow:
        type: string
        required: false
        max_length: 20
        default: "Premium Textiles"
      title:
        type: string
        required: true
        max_length: 50
        default: "Authentic African Fabrics"
      description:
        type: string
        required: true
        max_length: 200
        default: "Discover our curated collection of premium African textiles, sourced directly from master weavers and textile artisans across the continent."

  # Featured Fabrics List
  featuredFabrics:
    type: array
    required: true
    min_items: 3
    max_items: 6
    item_schema:
      id: { type: string, required: true }
      name: { type: string, required: true, max_length: 30 }
      origin: { type: string, required: true, max_length: 30 }
      description: { type: string, required: true, max_length: 100 }
      characteristics:
        type: array
        max_items: 4
        item_schema:
          type: string
          max_length: 20
      price_range:
        type: object
        fields:
          from: { type: number, required: true }
          to: { type: number, required: true }
          currency: { type: string, default: "USD" }
      href: { type: string, required: true, format: "uri" }
      color_swatch:
        type: array
        max_items: 4
        item_schema:
          hex: { type: string, pattern: "^#[0-9A-Fa-f]{6}$" }
          name: { type: string, max_length: 15 }

  # CTA Actions
  ctas:
    type: array
    required: false
    max_items: 2
    default:
      - { label: "Browse All Fabrics", href: "/fabrics", variant: "primary" }
      - { label: "Request Samples", href: "/samples", variant: "secondary" }
    item_schema:
      label: { type: string, required: true, max_length: 25 }
      href: { type: string, required: true }
      variant: { type: string, default: "primary", enum: ["primary", "secondary", "outline"] }

  # Trust Indicators
  trustIndicators:
    type: array
    required: false
    max_items: 4
    default:
      - { icon: "shield-check", label: "Ethically Sourced" }
      - { icon: "truck", label: "Global Shipping" }
      - { icon: "refresh-cw", label: "Quality Guaranteed" }
      - { icon: "award", label: "Artisan Certified" }
```

---

## Visual Specification

### Layout (Split)
- **Background:** var(--color-bg-secondary) (#F8F7F5)
- **Padding:** 120px vertical desktop, 80px mobile
- **Grid:** 50/50 split, gap 64px
- **Image side:** Full height, object-fit cover
- **Content side:** Centered vertically, max-width 560px

### Visual Side
```
Image: 100% width, min-height 600px
Overlay gradient: linear-gradient(to top, rgba(0,0,0,0.4), transparent)
Overlay text: White, bottom-left, 24px serif
Badge: Absolute positioned, white bg, dark text, 12px padding
```

### Content Side
- Eyebrow: 12px uppercase, brand color, letter-spacing 0.1em
- Title: 40px serif, font-weight 600, line-height 1.2
- Description: 16px, text-secondary, line-height 1.7

### Fabric Items
```
Container: Vertical stack, gap 24px
Item: Flex row, gap 16px
Swatch: 48px square, rounded 4px
Info: Flex column
Name: 16px font-weight 600
Origin: 13px text-secondary, with flag emoji
Description: 14px text-muted, 2 line clamp
Price: 14px brand color
Characteristics: Flex row, gap 8px, pill tags
```

### Color Swatches
- Size: 48x48px
- Border: 1px solid rgba(0,0,0,0.1)
- Border-radius: 4px
- Tooltip on hover: Color name

---

## Motion Specification

### Section Entrance
```css
/* Image side: slide from left */
/* Content side: slide from right */
/* Duration: 800ms */
/* Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) */
/* Stagger: 150ms between elements */
```

### Fabric Item Hover
```css
/* Duration: 300ms */
.fabric-item {
  transition: transform 300ms ease, box-shadow 300ms ease;
}
.fabric-item:hover {
  transform: translateX(8px);
}
```

### Swatch Hover
```css
/* Duration: 200ms */
.swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | 50/50 split horizontal |
| < 1024px | Stack vertical, image first |
| < 768px | Full width, reduced padding |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through fabric items
- Enter to navigate to fabric detail
- Swatches: Focusable with tooltip

### Focus States
```css
.fabric-item:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 4px;
}
```

### Screen Reader
- Image: Descriptive alt text with context
- Fabric list: `role="list"`
- Each fabric: `role="listitem"`
- Price range: Announced with currency

---

## Implementation Notes

### Section Structure
```html
<section id="fabrics" class="fabrics-section">
  <div class="split-layout">
    <div class="visual-side">
      <img src="{image_url}" alt="{image_alt}" />
      <span class="overlay-text">{overlay_text}</span>
      <span class="badge">{badge.text}</span>
    </div>
    <div class="content-side">
      <span class="eyebrow">{eyebrow}</span>
      <h2 class="title">{title}</h2>
      <p class="description">{description}</p>
      
      <ul class="fabric-list" role="list">
        <li class="fabric-item" role="listitem">
          <div class="swatches">
            <span class="swatch" style="background-color: {hex}" title="{name}"></span>
          </div>
          <div class="fabric-info">
            <h3 class="name">{name}</h3>
            <span class="origin">{origin}</span>
            <p class="description">{description}</p>
            <span class="price-range">From ${from}</span>
            <div class="characteristics">
              <span class="tag">{tag}</span>
            </div>
          </div>
        </li>
      </ul>
      
      <div class="ctas">
        <a href="{href}" class="btn-primary">{label}</a>
      </div>
      
      <div class="trust-indicators">
        <span class="indicator"><Icon /> {label}</span>
      </div>
    </div>
  </div>
</section>
```

### Performance
- Lazy load fabric section image
- Use CSS Grid for split layout
- Optimize fabric images (WebP with JPEG fallback)
