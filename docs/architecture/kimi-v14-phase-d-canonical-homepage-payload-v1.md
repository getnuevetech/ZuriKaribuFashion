# Kimi v14 Phase D - Canonical Homepage Payload (v1)

## Goal

Move Kimi homepage runtime from many fragmented frontend calls to a single canonical backend payload contract.

## Delivered in this stage

- Added new public endpoint:
  - `GET /api/homepage-sections/kimi-homepage-payload`
- Endpoint aggregates Kimi homepage data into one response object:
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

## Contract metadata

- `contractVersion: "KIMI_HOMEPAGE_PAYLOAD_V1"`
- `generatedAt: ISO timestamp`

## Frontend integration status

- `apps/web/src/pages/Home.tsx` now consumes canonical payload first.
- Featured strips now read from canonical payload `featuredCollections`.
- Legacy per-section queries are disabled in Home runtime to reduce duplicate homepage fetches.

## Next step (Phase D.3)

- Validate canonical payload field coverage against all mapper modules and remove legacy fallback branches that are no longer needed.
- Add optional payload checksum + lightweight smoke assertion script for contract regression detection.
