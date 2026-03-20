# Zuri Karibu - Category Pages Design

## Design Philosophy: "Editorial Commerce"

The category pages blend high-end editorial aesthetics with functional e-commerce. Each category has its own immersive hero, gamified visual filtering, and masonry product grids with lifestyle hover effects.

---

## Page Structure (All Category Pages)

### 1. Immersive Category Hero
- Full-viewport hero with category-specific imagery
- Bold typography with category name
- Subtle parallax on scroll
- Breadcrumb navigation

### 2. Visual Filter Bar
- Icon-based filter categories (replacing dropdowns)
- Active filter pills
- Search input
- Clean, minimal design

### 3. Masonry Product Grid
- Pinterest-style layout
- Cards with dual-image hover (studio → lifestyle)
- Country flag badges
- Price and designer info

### 4. Pagination / Load More
- Infinite scroll or "Load More" button
- Smooth loading animations

---

## Visual System (Consistent)

**Colors:**
- Background: #0B0B0C
- Accent: #FF4D2E
- Text Primary: #FFFFFF
- Text Secondary: #B8B5AD
- Card Border: rgba(255,255,255,0.08)

**Typography:**
- Headlines: Montserrat 800
- Body: Inter 400
- Labels: IBM Plex Mono 500

**Animations:**
- GSAP ScrollTrigger for hero parallax
- Product cards fade in with stagger
- Hover: image swap + card lift

---

## Page 1: Ready To Wear

**Hero Image:** Full-body fashion portrait, modern African attire
**Headline:** "READY TO WEAR"
**Subheadline:** "Curated fits built for real life — from everyday essentials to statement pieces."

**Filter Categories:**
- Country (flags): Nigeria, Ghana, Kenya, Senegal, South Africa, Morocco
- Style (icons): Traditional, Modern, Casual, Bridal, Accessories
- Size: XS, S, M, L, XL, XXL, 3XL
- Material: Ankara, Kente, Adire, Aso-Oke, Lace, Shweshwe

---

## Page 2: Fabrics To Buy

**Hero Image:** Close-up of vibrant African textiles
**Headline:** "FABRICS TO BUY"
**Subheadline:** "Source the same textiles artisans use — from wax prints to hand-woven heritage."

**Filter Categories:**
- Country (flags): Nigeria, Ghana, Kenya, Senegal, Mali
- Material (icons): Ankara, Kente, Adire, Mud Cloth, Kitenge, Lace
- Color: All colors with swatches
- Price Range: $, $$, $$$

---

## Page 3: Custom To Wear

**Hero Image:** Designer at work / tailoring atelier
**Headline:** "CUSTOM TO WEAR"
**Subheadline:** "Work one-on-one with African designers. Made to your measurements, made with love."

**Filter Categories:**
- Country (flags): Nigeria, Ghana, Kenya, Senegal
- Style (icons): Traditional, Modern, Bridal, Formal
- Designer: List of featured designers
- Turnaround: Express, Standard, Relaxed

---

## Product Card Design

```
+------------------+
|                  |
|   [Studio Img]   |  ← Default view
|                  |
|   [Hover:        |  ← Lifestyle image
|   Lifestyle]     |     fades in
|                  |
+------------------+
| 🇳🇬             |  ← Country flag
| Product Name     |
| Designer Name    |
| $XXX.XX          |
+------------------+
```

**Hover Effect:**
- Studio image fades out
- Lifestyle image fades in
- Card lifts 6px
- Border color shifts to accent

---

## Responsive Behavior

**Desktop:**
- 4-column masonry grid
- Full filter bar visible

**Tablet:**
- 3-column grid
- Collapsible filters

**Mobile:**
- 2-column grid
- Filter drawer
- Sticky bottom quick-filter bar
