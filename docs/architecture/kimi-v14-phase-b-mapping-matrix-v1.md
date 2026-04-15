# Kimi v14 Phase B Mapping Matrix (Hero, Trust, ShopBy)

**Date:** 2026-03-20  
**Scope:** Phase B execution artifact for initial backend connection  
**Sections covered:** Hero, Trust, ShopBy  
**Frontend baseline:** `/kimi-v14-r20260320/index.html?v=20260320-1`

---

## 1) Endpoints used in this phase

### Primary public endpoints
- `GET /homepage/hero-slides`
- `GET /homepage-sections/experience-settings`
- `GET /homepage-sections/stats-strip`
- `GET /homepage-sections/categories`
- `GET /homepage-sections/countries`
- `GET /homepage-sections/visibility`

### Optional/secondary endpoints (used if needed)
- `GET /homepage/top-strip`
- `GET /homepage/featured` (later phase tie-in from ShopBy CTA)

---

## 2) Target section contracts (normalized DTOs)

## 2.1 HeroDTO
```ts
type HeroDTO = {
  title: string;            // <= 56 chars
  subtitle: string;         // <= 120 chars
  ctaText: string;          // <= 24 chars
  ctaLink: string;          // internal route preferred
  image: string;            // resolved asset URL
  quickLinks: Array<{ label: string; href: string }>;
};
```

## 2.2 TrustDTO
```ts
type TrustDTO = {
  items: Array<{
    title: string;          // <= 48 chars
    subtitle: string;       // <= 90 chars
    icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
    enabled: boolean;
  }>;
};
```

## 2.3 ShopByDTO
```ts
type ShopByDTO = {
  categories: Array<{
    id: string;
    label: string;
    image: string;
    href: string;
    countLabel: string;
  }>;
  countries: Array<{
    code: string;
    name: string;
    region: 'North' | 'West' | 'Central' | 'East' | 'Southern';
    count: number;
  }>;
  occasions: Array<{ label: string; href: string }>;
  prices: Array<{ label: string; href: string }>;
};
```

---

## 3) Concrete mapping matrix

## 3.1 Hero mapping

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Hero title | `/homepage/hero-slides` | `data[0].title` | trim, clamp 56 | `ZURI KARIBU` |
| Hero subtitle | `/homepage/hero-slides` | `data[0].subtitle` | trim, clamp 120 | `Made by Africans. Worn by the world.` |
| Hero CTA text | `/homepage/hero-slides` | `data[0].ctaText` | trim, clamp 24 | `Shop now` |
| Hero CTA link | `/homepage/hero-slides` | `data[0].ctaLink` | normalize to internal route, prevent invalid URL | `/shop` |
| Hero image | `/homepage/hero-slides` | `data[0].image` | resolve asset URL | `/hero_model.jpg` |
| Quick link RTW label | `/homepage-sections/experience-settings` | `data.kimiCopy.quickPathRtwLabel` | trim, clamp 32 | `Ready to Wear` |
| Quick link Custom label | `/homepage-sections/experience-settings` | `data.kimiCopy.quickPathCustomLabel` | trim, clamp 32 | `Custom` |
| Quick link Fabrics label | `/homepage-sections/experience-settings` | `data.kimiCopy.quickPathFabricsLabel` | trim, clamp 32 | `Fabrics` |

**Visibility gate:** render Hero only if `/homepage-sections/visibility` -> `hero === true`

---

## 3.2 Trust mapping

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Trust items (preferred) | `/homepage-sections/experience-settings` | `data.trustBadges[]` | keep enabled rows, max 4, normalize icon enum | v14 static 4 badges |
| Trust title (optional enhancement) | static copy | n/a | static in phase B | `Why Shop With Us` |
| Trust subtitle fallback source | `/homepage-sections/stats-strip` | `data.items[]` | optional derived badge subtitle if trustBadges empty | static trust subtitles |

**Visibility gate:** render Trust only if `/homepage-sections/visibility` -> `statsStrip === true` OR dedicated trust flag when introduced.

---

## 3.3 ShopBy mapping

### Category tab (primary)

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Category cards | `/homepage-sections/categories` | `data[]` | sort by `displayOrder`, use top 3 for now | static 3 cards (RTW/Fabrics/Custom) |
| Card label | `/homepage-sections/categories` | `row.title` | clamp 40 | static label |
| Card image | `/homepage-sections/categories` | `row.image` or first of `row.images` | resolve asset URL | static category image |
| Card href | `/homepage-sections/categories` | `row.ctaLink` or `row.link` | normalize route aliases (`/designs` <-> `/custom`) | route defaults |
| Count label | `/homepage-sections/categories` | `row.countText` or `row.productCount` | format `n+` | static count label |

### Country tab (primary)

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Country list | `/homepage-sections/countries` | `data[]` | map by name; merge with full 54-country static schema | static 54-country list |
| Product count | `/homepage-sections/countries` | `row.count` / `row.productCount` | numeric coerce | `0` |
| Region | static schema | derived by country code | map to North/West/Central/East/Southern | static region mapping |

### Occasion tab (phase B static)

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Occasion list | none yet | n/a | keep static until endpoint added | Wedding/Casual/Formal/Festival |

### Price tab (phase B static)

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Price bands | none yet | n/a | keep static until endpoint added | Under $100, $100-$300, $300-$500, $500+ |

**Visibility gates:**  
- ShopBy section uses `/homepage-sections/visibility` -> `categories` and `countries`

---

## 4) Gap log (no backend redesign required)

1. **Occasion and Price tabs** currently lack dedicated backend endpoints.  
   - **Decision:** keep static in Phase B, add backend-managed endpoint in Phase C if needed.

2. **Trust section visibility** does not have a dedicated trust key.  
   - **Decision:** tie to `statsStrip` for now or add `trust` visibility key later (small backend extension).

3. **Category subset rule (3 only)** for current business needs.  
   - **Decision:** map top 3 categories and explicitly exclude unsupported categories (e.g., accessories) until enabled.

---

## 5) Implementation checklist (Phase B)

### B1. Hero integration
- [x] Create `heroMapper.ts`
- [x] Bind Hero section fields from `HeroDTO`
- [x] Add null/long-text guards
- [x] Add events: `home_hero_cta_click`, `home_quicklink_click`

### B2. Trust integration
- [x] Create `trustMapper.ts`
- [x] Bind `trustBadges` from experience settings
- [x] Keep static fallback if payload absent

### B3. ShopBy integration
- [x] Create `shopByMapper.ts`
- [x] Categories: enforce top 3 and valid hrefs
- [x] Countries: merge backend rows + static 54-country set
- [x] Occasion/Price: keep static placeholders for now

### B4. QA gates
- [ ] Desktop/tablet/mobile snapshots pass
- [ ] Missing payload does not break section rendering
- [ ] Route safety checks for malformed CTA links

---

## 6) Rollback behavior

- If any mapper fails runtime validation:
  - render v14 static defaults for that section
  - log non-fatal telemetry event
  - do not crash whole homepage

---

## 7) Ownership

- Product/Design: approve labels, ordering, and category subset
- Frontend: mapper implementation + rendering guards
- Backend: provide endpoint continuity only (no broad redesign)
- QA: regression + stress payload test

