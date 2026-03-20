# Custom Design Section Contract

## Section Overview
Bespoke tailoring and custom design services showcase. Process timeline, service tiers, and designer consultation booking. Emphasizes personalization and craftsmanship.

---

## CMS Schema

```yaml
customDesign:
  # Section Header
  header:
    type: object
    required: true
    fields:
      eyebrow:
        type: string
        required: false
        max_length: 20
        default: "Bespoke Services"
      title:
        type: string
        required: true
        max_length: 50
        default: "Custom Design Experience"
      description:
        type: string
        required: true
        max_length: 200
        default: "Work one-on-one with our master designers to create a piece that tells your unique story. From consultation to final fitting, every detail is crafted for you."

  # Process Timeline
  processSteps:
    type: array
    required: true
    min_items: 4
    max_items: 6
    default:
      - { order: 1, title: "Consultation", description: "Share your vision and preferences with our design team" }
      - { order: 2, title: "Design", description: "Review sketches and select fabrics together" }
      - { order: 3, title: "Measurements", description: "Precision fitting for the perfect silhouette" }
      - { order: 4, title: "Creation", description: "Expert craftsmanship brings your design to life" }
      - { order: 5, title: "Fitting", description: "Final adjustments ensure perfection" }
    item_schema:
      order: { type: number, required: true, min: 1, max: 6 }
      title: { type: string, required: true, max_length: 25 }
      description: { type: string, required: true, max_length: 80 }
      icon: { type: string, required: false, max_length: 20 }
      duration: { type: string, max_length: 20 }

  # Service Tiers
  serviceTiers:
    type: array
    required: true
    min_items: 2
    max_items: 4
    default:
      - id: "essential"
        name: "Essential"
        description: "Perfect for special occasions"
        price: { from: 450, currency: "USD" }
        features:
          - "2 consultation sessions"
          - "Standard fabric selection"
          - "1 fitting session"
          - "6-week delivery"
      - id: "signature"
        name: "Signature"
        description: "Our most popular choice"
        price: { from: 850, currency: "USD" }
        featured: true
        features:
          - "4 consultation sessions"
          - "Premium fabric selection"
          - "2 fitting sessions"
          - "4-week delivery"
          - "Design sketch included"
      - id: "bespoke"
        name: "Bespoke"
        description: "The ultimate luxury experience"
        price: { from: 1500, currency: "USD" }
        features:
          - "Unlimited consultations"
          - "Exclusive fabric access"
          - "Multiple fittings"
          - "Priority delivery"
          - "Dedicated designer"
    item_schema:
      id: { type: string, required: true }
      name: { type: string, required: true, max_length: 20 }
      description: { type: string, required: true, max_length: 60 }
      price:
        type: object
        fields:
          from: { type: number, required: true }
          currency: { type: string, default: "USD" }
      featured: { type: boolean, default: false }
      features:
        type: array
        required: true
        min_items: 3
        max_items: 6
        item_schema:
          type: string
          max_length: 40
      cta:
        type: object
        fields:
          label: { type: string, default: "Book Consultation", max_length: 25 }
          href: { type: string, default: "/book" }

  # Designer Spotlight
  designerSpotlight:
    type: object
    required: false
    fields:
      enabled: { type: boolean, default: true }
      title: { type: string, default: "Meet Your Designers", max_length: 30 }
      designers:
        type: array
        max_items: 3
        item_schema:
          name: { type: string, required: true, max_length: 30 }
          role: { type: string, required: true, max_length: 30 }
          bio: { type: string, required: true, max_length: 120 }
          image: { type: string, format: "uri" }
          specialties:
            type: array
            max_items: 3
            item_schema:
              type: string
              max_length: 20

  # Booking CTA
  bookingCta:
    type: object
    required: true
    fields:
      title: { type: string, default: "Ready to Begin Your Journey?", max_length: 50 }
      description: { type: string, default: "Schedule your complimentary consultation today", max_length: 80 }
      button_label: { type: string, default: "Book Free Consultation", max_length: 30 }
      button_href: { type: string, default: "/book" }
      secondary_link:
        type: object
        fields:
          label: { type: string, default: "View Portfolio", max_length: 20 }
          href: { type: string, default: "/portfolio" }
```

---

## Visual Specification

### Layout
- **Background:** var(--color-bg-primary) (#FFFFFF)
- **Padding:** 120px vertical desktop, 80px mobile
- **Max-width:** 1440px centered

### Process Timeline
```
Container: Horizontal on desktop, vertical on mobile
Connector line: 2px brand color, dashed
Step: Flex column, centered
Number: 48px circle, brand bg, white text
Title: 18px font-weight 600
Description: 14px text-secondary, centered
Duration: 12px brand color
```

### Service Tiers (Pricing Cards)
```
Container: 3-column grid, gap 24px
Card: White bg, border 1px, rounded 12px
Featured card: Brand border, elevated shadow
Header: Padding 32px, centered
Name: 24px font-weight 600
Price: 36px brand color
Features: Padding 32px, vertical list with checkmarks
CTA: Full-width button at bottom
```

### Designer Spotlight
```
Container: Horizontal scroll on mobile
Card: 280px width, image top
Image: 280x320px, object-fit cover
Info: Padding 24px
Name: 20px font-weight 600
Role: 14px brand color
Specialties: Flex row, pill tags
```

---

## Motion Specification

### Timeline Animation
```css
/* Steps reveal sequentially on scroll */
/* Duration: 600ms per step */
/* Stagger: 200ms */
/* Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) */
```

### Pricing Card Hover
```css
/* Duration: 300ms */
.pricing-card {
  transition: transform 300ms ease, box-shadow 300ms ease;
}
.pricing-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
```

### Featured Card Pulse
```css
/* Subtle pulse on featured badge */
@keyframes featuredPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232, 90, 60, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(232, 90, 60, 0); }
}
```

---

## Responsive Behavior

| Breakpoint | Timeline | Pricing |
|------------|----------|---------|
| >= 1024px | Horizontal | 3 columns |
| >= 768px | Horizontal | 2 columns |
| < 768px | Vertical | 1 column, stacked |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through process steps
- Tab through pricing cards
- Enter to book from any tier

### Focus States
```css
.pricing-card:focus-visible {
  outline: 3px solid #E85A3C;
  outline-offset: 4px;
}
```

### Screen Reader
- Timeline: `role="list"` with `aria-label="Design process"`
- Pricing: `role="radiogroup"` if selectable
- Featured tier: `aria-label="Most popular option"`

---

## Implementation Notes

### Route Alias Note
```yaml
# IMPORTANT: Frontend uses /custom, backend serves /designs
# All internal links should use /custom
# Router must handle alias mapping
```

### Section Structure
```html
<section id="custom" class="custom-section">
  <div class="section-header">
    <span class="eyebrow">{eyebrow}</span>
    <h2 class="title">{title}</h2>
    <p class="description">{description}</p>
  </div>
  
  <div class="process-timeline" role="list">
    <div class="step" role="listitem">
      <span class="step-number">{order}</span>
      <h3 class="step-title">{title}</h3>
      <p class="step-description">{description}</p>
      <span class="step-duration">{duration}</span>
    </div>
  </div>
  
  <div class="pricing-tiers">
    <div class="pricing-card" data-featured="{featured}">
      <div class="card-header">
        <span class="featured-badge">Most Popular</span>
        <h3 class="tier-name">{name}</h3>
        <p class="tier-description">{description}</p>
        <div class="price">From ${from}</div>
      </div>
      <ul class="features">
        <li><CheckIcon /> {feature}</li>
      </ul>
      <a href="{cta.href}" class="btn-primary">{cta.label}</a>
    </div>
  </div>
  
  <div class="booking-cta">
    <h3>{bookingCta.title}</h3>
    <p>{bookingCta.description}</p>
    <a href="{bookingCta.button_href}" class="btn-primary btn-large">
      {bookingCta.button_label}
    </a>
    <a href="{secondary_link.href}" class="link-secondary">
      {secondary_link.label}
    </a>
  </div>
</section>
```
