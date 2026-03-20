# Footer Contract

## Section Overview
Multi-column footer with navigation links, newsletter signup, social links, and legal information. Dark theme with organized link groups and trust indicators.

---

## CMS Schema

```yaml
footer:
  # Layout
  layout:
    type: string
    required: true
    default: "multi-column"
    enum: ["multi-column", "simple", "expanded"]

  # Brand Column
  brand:
    type: object
    required: true
    fields:
      logo:
        type: object
        required: true
        fields:
          wordmark_part1: { type: string, default: "ZURI", max_length: 10 }
          wordmark_part2: { type: string, default: "KARIBU", max_length: 10 }
      tagline:
        type: string
        required: false
        max_length: 100
        default: "Authentic African fashion, crafted with heritage and heart."
      social_links:
        type: array
        required: true
        max_items: 6
        default:
          - { platform: "instagram", href: "https://instagram.com/zurikaribu", label: "Instagram" }
          - { platform: "facebook", href: "https://facebook.com/zurikaribu", label: "Facebook" }
          - { platform: "twitter", href: "https://twitter.com/zurikaribu", label: "Twitter" }
          - { platform: "pinterest", href: "https://pinterest.com/zurikaribu", label: "Pinterest" }
        item_schema:
          platform: { type: string, required: true, enum: ["instagram", "facebook", "twitter", "pinterest", "youtube", "linkedin"] }
          href: { type: string, required: true, format: "uri" }
          label: { type: string, required: true, max_length: 20 }

  # Link Columns
  linkColumns:
    type: array
    required: true
    min_items: 2
    max_items: 4
    default:
      - title: "Shop"
        links:
          - { label: "All Products", href: "/shop" }
          - { label: "Ready-to-Wear", href: "/ready-to-wear" }
          - { label: "Fabrics", href: "/fabrics" }
          - { label: "Custom Design", href: "/custom" }
      - title: "Company"
        links:
          - { label: "About Us", href: "/about" }
          - { label: "Our Designers", href: "/designers" }
          - { label: "Sustainability", href: "/sustainability" }
          - { label: "Careers", href: "/careers" }
      - title: "Support"
        links:
          - { label: "Contact Us", href: "/contact" }
          - { label: "FAQs", href: "/faqs" }
          - { label: "Shipping", href: "/shipping" }
          - { label: "Returns", href: "/returns" }
      - title: "Legal"
        links:
          - { label: "Privacy Policy", href: "/privacy" }
          - { label: "Terms of Service", href: "/terms" }
          - { label: "Cookie Policy", href: "/cookies" }
    item_schema:
      title: { type: string, required: true, max_length: 20 }
      links:
        type: array
        required: true
        max_items: 6
        item_schema:
          label: { type: string, required: true, max_length: 25 }
          href: { type: string, required: true }

  # Newsletter
  newsletter:
    type: object
    required: false
    fields:
      enabled: { type: boolean, default: true }
      title: { type: string, default: "Stay Connected", max_length: 25 }
      description: { type: string, default: "Subscribe for exclusive offers and new arrivals", max_length: 60 }
      placeholder: { type: string, default: "Enter your email", max_length: 25 }
      button_label: { type: string, default: "Subscribe", max_length: 15 }
      privacy_note: { type: string, default: "By subscribing, you agree to our Privacy Policy", max_length: 60 }

  # Payment Methods
  paymentMethods:
    type: array
    required: false
    max_items: 6
    default: ["visa", "mastercard", "amex", "paypal", "apple-pay"]
    item_schema:
      type: string
      enum: ["visa", "mastercard", "amex", "paypal", "apple-pay", "google-pay", "shop-pay"]

  # Bottom Bar
  bottomBar:
    type: object
    required: true
    fields:
      copyright:
        type: string
        required: true
        max_length: 100
        default: "© 2024 ZuriKaribu. All rights reserved."
      additional_text:
        type: string
        max_length: 100
        default: "Made with love in Africa"
```

---

## Visual Specification

### Layout
- **Background:** var(--color-bg-dark) (#1A1A1A)
- **Padding:** 80px top, 32px bottom
- **Max-width:** 1440px centered
- **Grid:** 4-5 columns desktop, 2 columns tablet, 1 column mobile

### Brand Column
```
Logo: White text, same styling as header
Tagline: 14px, text-muted, max-width 280px
Social icons: Flex row, gap 16px, 24px icons
```

### Link Columns
```
Title: 14px uppercase, letter-spacing 0.05em, white
Links: 14px, text-secondary, hover white
Gap: 12px vertical between links
```

### Newsletter
```
Container: Border-top 1px border-dark, padding-top 32px
Title: 18px font-weight 600, white
Input group: Flex row, gap 8px
Input: Dark bg, light border, white text
Button: Primary brand color
```

### Payment Methods
```
Container: Flex row, gap 12px, margin-top 24px
Icons: 40px width, grayscale, hover color
```

### Bottom Bar
```
Border-top: 1px border-dark
Padding: 24px 0
Flex row, space-between
Text: 13px text-muted
```

---

## Motion Specification

### Link Hover
```css
/* Duration: 200ms */
.footer-link {
  color: rgba(255,255,255,0.6);
  transition: color 200ms ease;
}
.footer-link:hover {
  color: #FFFFFF;
}
```

### Social Icon Hover
```css
/* Duration: 200ms */
.social-icon {
  opacity: 0.7;
  transition: opacity 200ms ease, transform 200ms ease;
}
.social-icon:hover {
  opacity: 1;
  transform: translateY(-2px);
}
```

---

## Responsive Behavior

| Breakpoint | Columns |
|------------|---------|
| >= 1024px | 5 columns (brand + 4 link columns) |
| >= 768px | 3 columns |
| < 768px | 1 column, accordion style |

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through all links
- Newsletter input focusable
- Submit button keyboard accessible

### Focus States
```css
.footer-link:focus-visible,
.social-icon:focus-visible {
  outline: 2px solid #E85A3C;
  outline-offset: 4px;
  border-radius: 4px;
}
```

### Screen Reader
- Link columns: `role="list"` with `aria-label`
- Social links: `aria-label="Follow us on {platform}"`
- Newsletter: Proper form labeling

---

## Implementation Notes

### Footer Structure
```html
<footer class="site-footer">
  <div class="footer-main">
    <div class="brand-column">
      <a href="/" class="footer-logo">
        <span class="part1">ZURI</span>
        <span class="part2">KARIBU</span>
      </a>
      <p class="tagline">{tagline}</p>
      <div class="social-links">
        <a href="{href}" aria-label="Follow us on {platform}">
          <Icon name="{platform}" />
        </a>
      </div>
    </div>
    
    <div class="link-columns">
      <div class="link-column">
        <h3 class="column-title">{title}</h3>
        <ul role="list">
          <li><a href="{href}">{label}</a></li>
        </ul>
      </div>
    </div>
  </div>
  
  <div class="newsletter-section">
    <h3 class="newsletter-title">{newsletter.title}</h3>
    <p class="newsletter-description">{newsletter.description}</p>
    <form class="newsletter-form">
      <input 
        type="email" 
        placeholder="{newsletter.placeholder}" 
        aria-label="Email address"
        required
      />
      <button type="submit">{newsletter.button_label}</button>
    </form>
    <p class="privacy-note">{newsletter.privacy_note}</p>
  </div>
  
  <div class="payment-methods">
    <img src="/icons/payment-{method}.svg" alt="{method}" />
  </div>
  
  <div class="bottom-bar">
    <p class="copyright">{bottomBar.copyright}</p>
    <p class="additional">{bottomBar.additional_text}</p>
  </div>
</footer>
```

### Performance
- Lazy load footer (below fold)
- Use SVG for payment method icons
- Minimize footer JavaScript
