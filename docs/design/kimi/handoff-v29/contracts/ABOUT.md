# About Section Contract

## Section Overview
Brand story and mission section with editorial imagery, company values, and trust indicators. Split layout with compelling narrative and visual storytelling.

---

## CMS Schema

```yaml
about:
  # Section Layout
  layout:
    type: string
    required: true
    default: "split"
    enum: ["split", "full-width", "timeline"]

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
      video:
        type: object
        required: false
        fields:
          url: { type: string, format: "uri" }
          poster: { type: string, format: "uri" }
          autoplay: { type: boolean, default: false }

  # Content Side
  content:
    type: object
    required: true
    fields:
      eyebrow:
        type: string
        required: false
        max_length: 20
        default: "Our Story"
      title:
        type: string
        required: true
        max_length: 50
        default: "Celebrating African Heritage Through Fashion"
      story:
        type: string
        required: true
        max_length: 400
        default: "ZuriKaribu was born from a passion to share Africa's rich textile heritage with the world. We partner directly with artisans, weavers, and designers across the continent to bring you authentic, contemporary African fashion."
      mission:
        type: string
        required: false
        max_length: 200
        default: "To empower African artisans while bringing exceptional, ethically-crafted fashion to global audiences."

  # Company Values
  values:
    type: array
    required: true
    min_items: 3
    max_items: 4
    default:
      - { icon: "heart", title: "Artisan First", description: "Fair partnerships with craftspeople" }
      - { icon: "leaf", title: "Sustainable", description: "Eco-conscious production methods" }
      - { icon: "globe", title: "Authentic", description: "Genuine African heritage in every piece" }
      - { icon: "users", title: "Community", description: "Supporting local economies" }
    item_schema:
      icon: { type: string, required: true, max_length: 20 }
      title: { type: string, required: true, max_length: 25 }
      description: { type: string, required: true, max_length: 60 }

  # Stats/Metrics
  stats:
    type: array
    required: false
    max_items: 4
    default:
      - { value: "50+", label: "Artisan Partners" }
      - { value: "12", label: "African Countries" }
      - { value: "10K+", label: "Happy Customers" }
      - { value: "5", label: "Years of Excellence" }
    item_schema:
      value: { type: string, required: true, max_length: 10 }
      label: { type: string, required: true, max_length: 25 }

  # CTA
  cta:
    type: object
    required: false
    fields:
      enabled: { type: boolean, default: true }
      label: { type: string, default: "Learn More About Us", max_length: 25 }
      href: { type: string, default: "/about" }
```

---

## Visual Specification

### Layout (Split)
- **Background:** var(--color-bg-primary) (#FFFFFF)
- **Padding:** 120px vertical desktop, 80px mobile
- **Grid:** 45/55 split (image/content), gap 64px
- **Image:** Full height, rounded 12px, overflow hidden

### Image Side
```
Container: Position relative, min-height 500px
Image: Object-fit cover, 100%
Optional video overlay: Play button centered
Stats overlay: Absolute bottom, glassmorphism bg
```

### Content Side
```
Eyebrow: 12px uppercase, brand color
Title: 40px serif, font-weight 600, line-height 1.2
Story: 16px, line-height 1.8, text-secondary
Mission: 18px italic, border-left 3px brand, padding-left 20px
Values: Grid 2x2, gap 24px
```

### Values Grid
```
Item: Flex column, gap 12px
Icon: 40px, brand color
Title: 16px font-weight 600
Description: 14px text-muted
```

### Stats Bar
```
Container: Flex row, gap 48px, margin-top 32px
Stat: Flex column, centered
Value: 36px font-weight 700, brand color
Label: 14px text-secondary
```

---

## Motion Specification

### Section Entrance
```css
/* Image: Fade in + slight scale */
/* Content: Slide from right */
/* Duration: 800ms */
/* Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) */
```

### Values Stagger
```css
/* Stagger: 150ms per value */
/* Duration: 500ms */
/* Easing: ease-out */
```

### Stats Counter
```css
/* Number count-up animation */
/* Duration: 2000ms */
/* Easing: ease-out */
```

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | 45/55 split horizontal |
| < 1024px | Stack vertical, image first |
| < 768px | Full width, values 2 columns |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through values
- CTA keyboard accessible
- Video controls if present

### Focus States
```css
.value-item:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 8px;
}
```

### Screen Reader
- Stats: `aria-label="{value} {label}"`
- Values: `role="list"` with `aria-label="Our values"`

---

## Implementation Notes

### Section Structure
```html
<section id="about" class="about-section">
  <div class="split-layout">
    <div class="visual-side">
      <img src="{visual.image.url}" alt="{visual.image.alt}" />
      <div class="stats-overlay">
        <div class="stat">
          <span class="value">{value}</span>
          <span class="label">{label}</span>
        </div>
      </div>
    </div>
    <div class="content-side">
      <span class="eyebrow">{content.eyebrow}</span>
      <h2 class="title">{content.title}</h2>
      <p class="story">{content.story}</p>
      <blockquote class="mission">{content.mission}</blockquote>
      
      <div class="values-grid" role="list" aria-label="Our values">
        <div class="value-item" role="listitem">
          <Icon name="{icon}" />
          <h3 class="value-title">{title}</h3>
          <p class="value-description">{description}</p>
        </div>
      </div>
      
      <a href="{cta.href}" class="btn-primary">{cta.label}</a>
    </div>
  </div>
</section>
```

### Performance
- Lazy load about section image
- Use intersection observer for stats counter
- Optimize image size (max 800px width)
