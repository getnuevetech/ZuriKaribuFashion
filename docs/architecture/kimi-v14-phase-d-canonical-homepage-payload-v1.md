# Jenks v14 Phase D - Canonical Homepage Payload (v1)

## Goal

Move Jenks homepage runtime from many fragmented frontend calls to a single canonical backend payload contract.

## Delivered in this stage

- Added new public endpoint:
  - `GET /api/homepage-sections/jenks-homepage-payload`
- Endpoint aggregates Jenks homepage data into one response object:
  - `visibility`
  - `topStrip`
  - `statsStrip`
  - `howItWorksStyle`
  - `featuredProductDescription`
  - `authPageSettings`
  - `experienceSettings`
  - `heroSlides`
  - `managedBanners`
  - `promoBadge`
  - `countries`
  - `categories`
  - `howItWorks`
  - `designerSpotlights`
  - `heritage`
  - `testimonials`
  - `footer`
  - `featuredCollections` (`FEATURED_DESIGNS`, `FEATURED_FABRICS`, `FEATURED_READY_TO_WEAR`, `TRENDING_NOW`)
  - `shopByBlocks` (style/price behavior + tab configuration)
  - `freshDrops` (headline/CTA/badge configuration)
  - `newsletter` (newsletter content + subscribe endpoint metadata)

## Contract metadata

- `contractVersion: "JENKS_HOMEPAGE_PAYLOAD_V1"`
- `generatedAt: ISO timestamp`
- `payloadChecksum: SHA-256 hash` (computed from `contractVersion` + payload body, excluding `generatedAt`)

## Frontend integration status

- `apps/web/src/pages/Home.tsx` now consumes canonical payload as the single homepage source.
- Featured strips now read from canonical payload `featuredCollections`.
- Legacy per-section query branches were removed from Home runtime to reduce duplicate homepage fetches and drift.

## Regression safety

- Added smoke scripts: `npm run smoke:jenks:payload` (legacy alias: `npm run smoke:kimi:payload`)
- Script validates:
  - Contract version and required keys
  - `featuredCollections` section arrays
  - `shopByBlocks`/`freshDrops`/`newsletter` contract presence
  - Checksum integrity when `payloadChecksum` is present

## Next step (Phase D.3)

- Extend canonical payload coverage for remaining homepage subsections (e.g. shop-by style/price behavior, newsletter binding) and retire any remaining legacy section-specific API usage.
