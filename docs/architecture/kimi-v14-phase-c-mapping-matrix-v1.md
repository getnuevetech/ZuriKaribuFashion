# Kimi v14 Phase C Mapping Matrix (Featured + Spotlight)

**Date:** 2026-03-22  
**Scope:** Next slice after Hero/Trust/ShopBy mapper integration  
**Sections covered:** Featured (CTW/RTW/Fabrics), Designer Spotlight

---

## 1) Endpoints used in this slice

### Primary public endpoints
- `GET /homepage/featured`
- `GET /homepage-sections/designer-spotlights`
- `GET /homepage-sections/experience-settings`
- `GET /homepage-sections/visibility`

### Optional source fallback
- managed banner payloads already loaded on homepage (image/copy fallback)

---

## 2) Target section contracts (normalized DTOs)

## 2.1 FeaturedCollectionsDTO
```ts
type FeaturedCollectionsDTO = {
  customToWear: FeaturedProductDTO[];
  readyToWear: FeaturedProductDTO[];
  fabricsToBuy: FeaturedProductDTO[];
};
```

## 2.2 FeaturedSectionTitlesDTO
```ts
type FeaturedSectionTitlesDTO = {
  customToWear: string;
  readyToWear: string;
  fabricsToBuy: string;
};
```

## 2.3 DesignerSpotlightDTO
```ts
type DesignerSpotlightDTO = {
  id: string;
  profileId: string;
  vendorType: string;
  name: string;
  country: string;
  flagCode: string;
  quote: string;
  image: string;
  linkMode: string;
  externalUrl: string;
  blog: unknown;
};
```

---

## 3) Concrete mapping matrix

## 3.1 Featured strips mapping

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| CTW cards | `/homepage/featured` | `FEATURED_DESIGNS[]` or grouped `featuredProducts[]` | normalize product shape, price, image, country | static CTW featured array |
| RTW cards | `/homepage/featured` | `FEATURED_READY_TO_WEAR[]` or grouped `featuredProducts[]` | normalize product shape, price, image, country | static RTW featured array |
| Fabrics cards | `/homepage/featured` | `FEATURED_FABRICS[]` or grouped `featuredProducts[]` | normalize product shape, price, image, country | static fabrics featured array |
| Product labels | `/homepage/featured` | `productLabels[]` | sanitize and cap label payload | empty label list |
| CTW title | `/homepage-sections/experience-settings` | `kimiCopy.featuredDesignsTitle` | trim/clamp 60 | `Custom To Wear` |
| RTW title | `/homepage-sections/experience-settings` | `kimiCopy.featuredRtwTitle` | trim/clamp 60 | `Ready To Wear` |
| Fabrics title | `/homepage-sections/experience-settings` | `kimiCopy.featuredFabricsTitle` | trim/clamp 60 | `Fabrics To Buy` |

---

## 3.2 Designer spotlight mapping

| Kimi UI field | Backend source | Backend field | Transform rule | Fallback |
|---|---|---|---|---|
| Spotlight cards | `/homepage-sections/designer-spotlights` | `data[]` | normalize profile/country/flag/image/link mode | static spotlight list |
| Spotlight title | `/homepage-sections/experience-settings` | `kimiCopy.designerSpotlightTitle` | trim/clamp 60 | `Meet Designers Across Africa` |
| Spotlight link targets | `/homepage-sections/designer-spotlights` | `linkMode`, `externalUrl`, `blog.slug`, `designerId`, `vendorType` | route-safe resolution | default `/custom` |

---

## 4) Checklist

- [x] Create `featuredMapper.ts`
- [x] Create `spotlightMapper.ts`
- [x] Wire featured cards through mapper pipeline
- [x] Wire spotlight cards through mapper pipeline
- [x] Bind featured/spotlight section titles to `experienceSettings.kimiCopy`
- [x] Add spotlight click analytics event (`home_designer_spotlight_click`)
- [ ] Capture desktop/tablet/mobile snapshots after deployment

