# CUSTOM Section Contract

## Section Key
`CUSTOM`

## Variants
- `BESPOKE_SERVICE` (default) - Custom design service page
- `CONSULTATION_FORM` - Consultation booking form

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description |
| `processSteps` | array | Design process steps |

## Process Step Structure

```yaml
processSteps:
  - title: "Consultation"
    description: "Share your vision with our design team"
    icon: "message-circle"
  - title: "Design"
    description: "Our artisans create custom sketches"
    icon: "palette"
  - title: "Creation"
    description: "Master craftsmen bring your design to life"
    icon: "scissors"
  - title: "Delivery"
    description: "Your bespoke piece shipped to your doorstep"
    icon: "truck"
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroImage` | string | null | Hero banner image |
| `packages` | array | [...] | Design packages |
| `testimonials` | array | [...] | Client testimonials |
| `features` | array | [...] | Service features |

## Max Lengths

```yaml
title: 40
description: 200
stepTitle: 30
stepDescription: 80
packageName: 30
```

## Fallback Behavior

```yaml
title: "Custom Design"
description: "Bring your vision to life with our bespoke African fashion service."
heroImage: "/assets/custom_hero.jpg"
processSteps:
  - { title: "Consultation", description: "Share your vision", icon: "message-circle" }
  - { title: "Design", description: "Custom sketches", icon: "palette" }
  - { title: "Creation", description: "Crafted by artisans", icon: "scissors" }
  - { title: "Delivery", description: "Shipped to you", icon: "truck" }
packages:
  - { name: "Essential", price: "From $199", popular: false }
  - { name: "Signature", price: "From $499", popular: true }
  - { name: "Couture", price: "From $999", popular: false }
```

## CMS Integration Example

```json
{
  "sectionKey": "CUSTOM",
  "variant": "BESPOKE_SERVICE",
  "content": {
    "title": "Custom Design",
    "description": "Bring your vision to life.",
    "heroImage": "/assets/custom_hero.jpg",
    "processSteps": [
      { "title": "Consultation", "description": "Share your vision", "icon": "message-circle" }
    ]
  }
}
```
