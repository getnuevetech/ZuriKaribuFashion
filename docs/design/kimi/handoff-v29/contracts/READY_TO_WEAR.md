# Ready-to-Wear Section Contract

## Section Overview
Featured ready-to-wear collection showcase with grid layout, product cards, and quick-view functionality. Highlights curated African fashion pieces available for immediate purchase.

---

## CMS Schema

```yaml
readyToWear:
  # Section Header
  header:
    type: object
    required: true
    fields:
      eyebrow:
        type: string
        required: false
        max_length: 20
        default: "New Arrivals"
      title:
        type: string
        required: true
        max_length: 40
        default: "Ready-to-Wear Collection"
      description:
        type: string
        required: false
        max_length: 120
        default: "Exquisite African designs, crafted for the modern wardrobe"
      cta:
        type: object
        required: false
        fields:
          label: { type: string, max_length: 25, default: "View All Collection" }
          href: { type: string, default: "/ready-to-wear" }

  # Filter Tabs
  filters:
    type: array
    required: false
    max_items: 6
    default:
      - { id: "all", label: "All" }
      - { id: "dresses", label: "Dresses" }
      - { id: "tops", label: "Tops" }
      - { id: "skirts", label: "Skirts" }
      - { id: "suits", label: "Suits" }
      - { id: "accessories", label: "Accessories" }
    item_schema:
      id: { type: string, required: true }
      label: { type: string, required: true, max_length: 15 }

  # Product Grid
  products:
    type: array
    required: true
    min_items: 4
    max_items: 12
    item_schema:
      id:
        type: string
        required: true
        description: "Unique product identifier"
      name:
        type: string
        required: true
        max_length: 50
      category:
        type: string
        required: true
        max_length: 20
      price:
        type: object
        required: true
        fields:
          currency: { type: string, default: "USD", pattern: "^[A-Z]{3}$" }
          amount: { type: number, required: true, min: 0 }
          original_amount: { type: number, min: 0 }
      images:
        type: array
        required: true
        min_items: 1
        max_items: 4
        item_schema:
          url: { type: string, required: true, format: "uri" }
          alt: { type: string, required: true, max_length: 100 }
          is_primary: { type: boolean, default: false }
      badge:
        type: string
        required: false
        max_length: 20
        enum: ["New", "Sale", "Bestseller", "Limited", ""]
      href:
        type: string
        required: true
        format: "uri"
      quick_actions:
        type: array
        required: false
        max_items: 3
        default: ["wishlist", "quickview"]

  # Section Settings
  settings:
    type: object
    required: false
    fields:
      layout: { type: string, default: "grid", enum: ["grid", "list"] }
      columns_desktop: { type: number, default: 4, enum: [2, 3, 4] }
      columns_tablet: { type: number, default: 3, enum: [2, 3] }
      columns_mobile: { type: number, default: 2, enum: [1, 2] }
      show_pagination: { type: boolean, default: false }
      products_per_page: { type: number, default: 8 }
```

---

## Visual Specification

### Layout
- **Background:** var(--color-bg-primary) (#FFFFFF)
- **Padding:** 96px vertical desktop, 64px mobile
- **Max-width:** 1440px centered
- **Grid gap:** 24px desktop, 16px mobile

### Section Header
- Eyebrow: font-sans, 12px, uppercase, letter-spacing 0.1em, brand color
- Title: font-serif, 36px desktop/28px mobile, font-weight 600
- Description: font-sans, 16px, text-secondary, max-width 600px
- CTA: Primary button style, margin-top 24px

### Filter Tabs
- Container: Flex row, gap 8px, margin-bottom 32px
- Tab style: Pill buttons, 14px font
- Active: Background brand color, white text
- Inactive: Background transparent, border 1px

### Product Card
```
Image container: Aspect-ratio 3:4, overflow hidden
Badge: Absolute top-left, 8px padding, brand bg
Content padding: 16px
Name: 16px, font-weight 500, 2 line clamp
Category: 12px, text-secondary, uppercase
Price: 18px, font-weight 600
Original price: Strikethrough, text-muted
```

### Image Hover Effect
- Scale: 1.05 over 400ms
- Overlay: Quick actions fade in

---

## Motion Specification

### Card Entrance (Scroll-triggered)
```css
/* Stagger: 100ms per card */
/* Duration: 600ms */
/* Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) */
@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Image Hover
```css
/* Duration: 400ms */
.product-image {
  transition: transform 400ms ease-out;
}
.product-card:hover .product-image {
  transform: scale(1.05);
}
```

### Quick Actions Reveal
```css
/* Duration: 300ms */
.quick-actions {
  opacity: 0;
  transform: translateY(10px);
  transition: all 300ms ease;
}
.product-card:hover .quick-actions {
  opacity: 1;
  transform: translateY(0);
}
```

### Filter Tab Switch
```css
/* Duration: 200ms */
transition: background-color 200ms, color 200ms, border-color 200ms;
```

---

## Responsive Behavior

| Breakpoint | Columns | Card Size |
|------------|---------|-----------|
| >= 1280px | 4 columns | ~280px |
| >= 1024px | 4 columns | ~220px |
| >= 768px | 3 columns | ~230px |
| >= 640px | 2 columns | ~280px |
| < 640px | 2 columns | ~160px |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through filter tabs
- Enter/Space to activate filter
- Tab to product cards
- Enter to navigate to product
- Quick actions keyboard accessible

### Focus States
```css
.product-card:focus-within {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
}
.filter-tab:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 2px;
}
```

### Screen Reader
- Product cards: `role="article"`
- Filter group: `role="tablist"`
- Active filter: `aria-selected="true"`
- Image alt text required
- Price announced with currency

---

## Implementation Notes

### Product Card Structure
```html
<article class="product-card">
  <a href="/product/{id}" class="product-link">
    <div class="product-image-wrapper">
      <img src="{primary_image}" alt="{image_alt}" loading="lazy" />
      <span class="badge" aria-label="{badge}">{badge}</span>
      <div class="quick-actions">
        <button aria-label="Add to wishlist">...</button>
        <button aria-label="Quick view">...</button>
      </div>
    </div>
    <div class="product-info">
      <span class="category">{category}</span>
      <h3 class="name">{name}</h3>
      <div class="price">
        <span class="current">${amount}</span>
        <span class="original" aria-label="Original price">${original}</span>
      </div>
    </div>
  </a>
</article>
```

### Performance
- Lazy load images below fold
- Use `loading="lazy"` on all product images
- Preload primary images for first 4 products
- Use CSS Grid for layout (not flexbox)

### Empty State
```yaml
empty_state:
  icon: "shopping-bag"
  title: "No products found"
  description: "Check back soon for new arrivals"
  cta:
    label: "Browse All Collections"
    href: "/shop"
```
