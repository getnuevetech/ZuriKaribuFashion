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

## Contract metadata

- `contractVersion: "KIMI_HOMEPAGE_PAYLOAD_V1"`
- `generatedAt: ISO timestamp`

## Frontend integration status

- `apps/web/src/pages/Home.tsx` now consumes canonical payload first.
- Existing per-section endpoints remain in place as fallback inputs during transition.
- No runtime behavior was removed in this stage; this is a safe migration step.

## Next step (Phase D.2)

- Remove duplicate homepage fetches in `Home.tsx` after payload stability is validated in staging/production.
- Move Featured collections and any remaining legacy homepage sources into the canonical payload, then fully switch Home runtime to one network call.
