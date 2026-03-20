# Designers Section Contract

## Section Overview
Featured designer profiles showcasing the creative talent behind ZuriKaribu. Grid layout with designer cards, portfolio previews, and direct links to designer collections.

---

## CMS Schema

```yaml
designers:
  # Section Header
  header:
    type: object
    required: true
    fields:
      eyebrow:
        type: string
        required: false
        max_length: 20
        default: "Creative Minds"
      title:
        type: string
        required: true
        max_length: 40
        default: "Our Designers"
      description:
        type: string
        required: false
        max_length: 150
        default: "Meet the visionary artisans shaping contemporary African fashion"

  # Designer Grid
  designers:
    type: array
    required: true
    min_items: 3
    max_items: 9
    item_schema:
      id:
        type: string
        required: true
      name:
        type: string
        required: true
        max_length: 30
      role:
        type: string
        required: true
        max_length: 40
      location:
        type: string
        required: true
        max_length: 30
      bio:
        type: string
        required: true
        max_length: 150
      image:
        type: object
        required: true
        fields:
          portrait: { type: string, required: true, format: "uri" }
          portrait_alt: { type: string, required: true, max_length: 80 }
          work_sample: { type: string, format: "uri" }
      specialties:
        type: array
        required: false
        max_items: 4
        item_schema:
          type: string
          max_length: 20
      stats:
        type: object
        required: false
        fields:
          years_experience: { type: number, min: 0 }
          collections_count: { type: number, min: 0 }
          pieces_sold: { type: number, min: 0 }
      social:
        type: object
        required: false
        fields:
          instagram: { type: string, format: "uri" }
          website: { type: string, format: "uri" }
          portfolio: { type: string, format: "uri" }
      collection_link:
        type: object
        required: true
        fields:
          label: { type: string, default: "View Collection", max_length: 20 }
          href: { type: string, required: true }

  # Featured Designer (Optional)
  featuredDesigner:
    type: object
    required: false
    fields:
      enabled: { type: boolean, default: false }
      designer_id: { type: string }
      highlight_text: { type: string, max_length: 30, default: "Designer Spotlight" }

  # CTA
  cta:
    type: object
    required: false
    fields:
      enabled: { type: boolean, default: true }
      label: { type: string, default: "View All Designers", max_length: 25 }
      href: { type: string, default: "/designers" }
```

---

## Visual Specification

### Layout
- **Background:** var(--color-bg-secondary) (#F8F7F5)
- **Padding:** 120px vertical desktop, 80px mobile
- **Grid:** 3 columns desktop, 2 tablet, 1 mobile
- **Gap:** 32px desktop, 24px mobile

### Designer Card
```
Container: White bg, rounded 12px, overflow hidden
Image wrapper: Aspect-ratio 4:5, overflow hidden
Portrait: 100% cover, grayscale filter default
Hover: Color reveal, scale 1.05
Content padding: 24px
Name: 20px font-weight 600
Role: 14px brand color
Location: 13px text-secondary with map pin icon
Bio: 14px text-muted, 3 line clamp
Specialties: Flex row, gap 8px, pill tags
Stats: Flex row, gap 16px, small text
CTA: Full width button, margin-top 16px
```

### Card Hover Effects
```
Image: Grayscale to color, 400ms
Overlay: Brand gradient fade in
Social links: Slide up from bottom
```

### Featured Designer (if enabled)
```
Full-width banner above grid
Split layout: Image left, content right
Large portrait: 400x500px
Highlight badge: Brand color pill
```

---

## Motion Specification

### Card Entrance
```css
/* Stagger: 100ms per card */
/* Duration: 600ms */
/* Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) */
```

### Image Hover
```css
/* Duration: 400ms */
.designer-image {
  filter: grayscale(100%);
  transition: filter 400ms ease, transform 400ms ease;
}
.designer-card:hover .designer-image {
  filter: grayscale(0%);
  transform: scale(1.05);
}
```

### Social Links Reveal
```css
/* Duration: 300ms */
.social-links {
  opacity: 0;
  transform: translateY(20px);
  transition: all 300ms ease;
}
.designer-card:hover .social-links {
  opacity: 1;
  transform: translateY(0);
}
```

---

## Responsive Behavior

| Breakpoint | Columns | Card Size |
|------------|---------|-----------|
| >= 1024px | 3 columns | ~350px |
| >= 768px | 2 columns | ~350px |
| < 768px | 1 column | 100% |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through designer cards
- Enter to view collection
- Social links keyboard accessible

### Focus States
```css
.designer-card:focus-within {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 12px;
}
```

### Screen Reader
- Card: `role="article"`
- Name: Heading level 3
- Stats: `aria-label="{number} years experience"`

---

## Implementation Notes

### Card Structure
```html
<article class="designer-card">
  <div class="image-wrapper">
    <img src="{portrait}" alt="{portrait_alt}" class="designer-image" />
    <div class="social-links">
      <a href="{instagram}" aria-label="Instagram"><InstagramIcon /></a>
      <a href="{website}" aria-label="Website"><GlobeIcon /></a>
    </div>
  </div>
  <div class="card-content">
    <h3 class="name">{name}</h3>
    <span class="role">{role}</span>
    <span class="location"><MapPinIcon /> {location}</span>
    <p class="bio">{bio}</p>
    <div class="specialties">
      <span class="tag">{specialty}</span>
    </div>
    <div class="stats">
      <span>{years_experience} years</span>
      <span>{collections_count} collections</span>
    </div>
    <a href="{collection_link.href}" class="btn-outline">
      {collection_link.label}
    </a>
  </div>
</article>
```

### Performance
- Lazy load designer portraits
- Use `loading="lazy"` for images below fold
- Preload featured designer image
