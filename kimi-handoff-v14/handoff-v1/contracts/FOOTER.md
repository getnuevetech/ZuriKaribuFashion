# FOOTER Section Contract

## Section Key
`FOOTER`

## Variants
- `FULL` (default)
- `MINIMAL`

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `logoText` | string | Brand name |
| `tagline` | string | Brand tagline |

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `newsletterEnabled` | boolean | true | Show newsletter signup |
| `newsletterTitle` | string | "Join the Family" | Newsletter heading |
| `newsletterDescription` | string | "..." | Newsletter description |
| `linkColumns` | array | [...] | Footer link columns |
| `socialLinks` | array | [...] | Social media links |
| `showPaymentIcons` | boolean | true | Show payment methods |
| `copyrightText` | string | "..." | Copyright text |

## Link Column Structure

```yaml
linkColumns:
  - title: "Shop"
    links:
      - label: "Ready to Wear"
        href: "/ready-to-wear"
  - title: "Support"
    links:
      - label: "Contact Us"
        href: "/contact"
```

## Max Lengths

```yaml
logoText: 20
tagline: 100
columnTitle: 20
linkLabel: 30
newsletterTitle: 40
newsletterDescription: 120
```

## Fallback Behavior

```yaml
logoText: "ZURI KARIBU"
tagline: "Connecting the world to authentic African fashion"
newsletterEnabled: true
newsletterTitle: "Join the ZuriKaribu Family"
newsletterDescription: "Subscribe for exclusive offers and stories from Africa"
```

## Accessibility (a11y)

```yaml
ariaLabels:
  footer: "Site footer"
  newsletter: "Newsletter signup"
  linkColumn: "{title} links"
focusOrder: [newsletter-email, newsletter-submit, link-columns, social-links]
```

## CMS Integration Example

```json
{
  "sectionKey": "FOOTER",
  "variant": "FULL",
  "content": {
    "logoText": "ZURI KARIBU",
    "tagline": "Connecting the world to authentic African fashion",
    "newsletterEnabled": true,
    "linkColumns": [
      {
        "title": "Shop",
        "links": [
          { "label": "Ready to Wear", "href": "/ready-to-wear" }
        ]
      }
    ]
  }
}
```
