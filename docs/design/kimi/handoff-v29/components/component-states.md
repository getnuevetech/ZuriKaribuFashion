# Component States Documentation

## Overview
This document defines all interactive component states for the ZuriKaribu design system.

---

## Buttons

### Primary Button

| State | Background | Text | Border | Shadow |
|-------|------------|------|--------|--------|
| Default | #E85A3C | #FFFFFF | none | none |
| Hover | #D14A2C | #FFFFFF | none | 0 4px 12px rgba(232,90,60,0.3) |
| Active | #B83D21 | #FFFFFF | none | inset 0 2px 4px rgba(0,0,0,0.1) |
| Focus | #E85A3C | #FFFFFF | 2px solid #FFFFFF, 4px solid #E85A3C | none |
| Disabled | #E5E5E5 | #999999 | none | none |
| Loading | #E85A3C | transparent | none | none |

### Secondary Button

| State | Background | Text | Border |
|-------|------------|------|--------|
| Default | transparent | #1A1A1A | 1px solid #1A1A1A |
| Hover | #1A1A1A | #FFFFFF | 1px solid #1A1A1A |
| Active | #333333 | #FFFFFF | 1px solid #333333 |
| Focus | transparent | #1A1A1A | 2px solid #E85A3C |
| Disabled | transparent | #999999 | 1px solid #CCCCCC |

### Ghost Button

| State | Background | Text |
|-------|------------|------|
| Default | transparent | #1A1A1A |
| Hover | rgba(0,0,0,0.04) | #1A1A1A |
| Active | rgba(0,0,0,0.08) | #1A1A1A |
| Focus | transparent | #1A1A1A |

---

## Form Inputs

### Text Input

| State | Border | Background | Label |
|-------|--------|------------|-------|
| Default | 1px solid #E5E5E5 | #FFFFFF | #666666 |
| Hover | 1px solid #CCCCCC | #FFFFFF | #666666 |
| Focus | 2px solid #E85A3C | #FFFFFF | #E85A3C |
| Error | 2px solid #DC2626 | #FEF2F2 | #DC2626 |
| Success | 2px solid #16A34A | #F0FDF4 | #16A34A |
| Disabled | 1px solid #E5E5E5 | #F5F5F5 | #999999 |
| Filled | 1px solid #1A1A1A | #FFFFFF | #1A1A1A |

### Input with Icon

```
Icon color default: #999999
Icon color focus: #E85A3C
Icon color error: #DC2626
Icon position: left 16px, vertically centered
Padding-left: 48px
```

---

## Cards

### Product Card

| State | Transform | Shadow | Border |
|-------|-----------|--------|--------|
| Default | none | none | none |
| Hover | translateY(-4px) | 0 12px 24px rgba(0,0,0,0.1) | none |
| Active | translateY(-2px) | 0 6px 12px rgba(0,0,0,0.1) | none |
| Focus | none | 0 0 0 2px #E85A3C | none |

### Pricing Card

| State | Transform | Shadow | Border |
|-------|-----------|--------|--------|
| Default | none | none | 1px solid #E5E5E5 |
| Hover | translateY(-8px) | 0 20px 40px rgba(0,0,0,0.1) | 1px solid #E5E5E5 |
| Featured | none | 0 8px 24px rgba(232,90,60,0.15) | 2px solid #E85A3C |

---

## Navigation

### Nav Link

| State | Color | Underline |
|-------|-------|-----------|
| Default | #1A1A1A | none |
| Hover | #E85A3C | none |
| Active | #E85A3C | 2px solid #E85A3C |
| Current | #E85A3C | 2px solid #E85A3C |

### Mobile Menu

| State | Transform | Opacity |
|-------|-----------|---------|
| Closed | translateX(100%) | 0 |
| Open | translateX(0) | 1 |
| Opening | translateX(0) | 1 (300ms) |
| Closing | translateX(100%) | 0 (200ms) |

---

## Filter Tabs

| State | Background | Text | Border |
|-------|------------|------|--------|
| Default | transparent | #666666 | 1px solid #E5E5E5 |
| Hover | rgba(0,0,0,0.02) | #1A1A1A | 1px solid #CCCCCC |
| Active | #E85A3C | #FFFFFF | 1px solid #E85A3C |
| Focus | transparent | #666666 | 2px solid #E85A3C |

---

## Accordion

| State | Icon Rotation | Content |
|-------|---------------|---------|
| Collapsed | 0deg | height: 0, opacity: 0 |
| Expanded | 180deg | height: auto, opacity: 1 |
| Expanding | 0→180deg (300ms) | fade in + slide (300ms) |
| Collapsing | 180→0deg (200ms) | fade out (200ms) |

---

## Dropdown/Select

| State | Menu | Trigger |
|-------|------|---------|
| Closed | display: none | border: 1px solid #E5E5E5 |
| Open | display: block, opacity 0→1 | border: 2px solid #E85A3C |
| Opening | fade in 200ms | - |
| Closing | fade out 150ms | - |

### Dropdown Menu

```
Background: #FFFFFF
Border: 1px solid #E5E5E5
Border-radius: 8px
Box-shadow: 0 8px 24px rgba(0,0,0,0.1)
Padding: 8px 0
Max-height: 300px
Overflow-y: auto
```

### Dropdown Item

| State | Background | Text |
|-------|------------|------|
| Default | transparent | #1A1A1A |
| Hover | rgba(0,0,0,0.04) | #1A1A1A |
| Selected | rgba(232,90,60,0.1) | #E85A3C |
| Focus | rgba(232,90,60,0.08) | #1A1A1A |

---

## Loading States

### Button Loading

```
Spinner: 20px, white
Position: center, replacing text
Disabled: true (no click)
Background: same as default state
```

### Skeleton Loading

```
Background: linear-gradient(90deg, #F0F0F0 25%, #E0E0E0 50%, #F0F0F0 75%)
Background-size: 200% 100%
Animation: shimmer 1.5s infinite
Border-radius: 4px
```

### Page Loading

```
Overlay: rgba(255,255,255,0.8)
Spinner: 48px, brand color
Position: fixed center
Backdrop-filter: blur(4px)
```

---

## Empty States

### Generic Empty

```
Icon: 64px, text-muted
Title: 18px, font-weight 600
Description: 14px, text-secondary
CTA: Secondary button (optional)
```

### Search Empty

```
Icon: Search icon, 64px
Title: "No results found"
Description: "Try different keywords or filters"
CTA: "Clear filters" button
```

---

## Toast/Notification

| Type | Background | Icon | Border-left |
|------|------------|------|-------------|
| Success | #F0FDF4 | Check green | 4px solid #16A34A |
| Error | #FEF2F2 | X red | 4px solid #DC2626 |
| Warning | #FFFBEB | Alert yellow | 4px solid #F59E0B |
| Info | #EFF6FF | Info blue | 4px solid #3B82F6 |

### Toast Animation

```
Enter: slide from right + fade in (300ms)
Exit: slide right + fade out (200ms)
Auto-dismiss: 5000ms
Progress bar: 5000ms linear
```

---

## Modal/Dialog

### Modal Overlay

| State | Opacity | Background |
|-------|---------|------------|
| Closed | 0 | transparent |
| Open | 1 | rgba(0,0,0,0.5) |

### Modal Content

| State | Transform | Opacity |
|-------|-----------|---------|
| Closed | scale(0.95) translateY(10px) | 0 |
| Open | scale(1) translateY(0) | 1 |

### Modal Animation

```
Enter: 300ms ease-out
Exit: 200ms ease-in
Backdrop: fade 200ms
```

---

## Country Cards (Shop by Country)

| State | Transform | Shadow | Border |
|-------|-----------|--------|--------|
| Default | none | none | none |
| Hover | translateY(-4px) | 0 12px 24px rgba(0,0,0,0.12) | none |
| Active | scale(0.98) | none | none |
| Focus | none | 0 0 0 2px #E85A3C | none |

### Card Image Hover

```
Scale: 1.08
Duration: 500ms
Easing: ease-out
Overflow: hidden on container
```
