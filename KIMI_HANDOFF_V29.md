# Kimi Design Handoff v29 (Engineering Lock)

This repository now includes the upgraded Kimi handoff package from:
- Google Drive folder: `1j9Nr1GUEODffo9oKBXhZu7AQ-pmHzolS`
- Local repo path: `docs/design/kimi/handoff-v29/`

## Included

- 10 section contracts (`contracts/*.md`)
- Design tokens (`tokens/design-tokens.css`)
- Component states (`components/component-states.md`)
- Accessibility annotations (`accessibility/a11y-annotations.md`)
- Implementation guides:
  - `implementation/implementation-notes.md`
  - `implementation/endpoint-mapping.md`
  - `implementation/route-aliases.md`
- Asset manifest (`assets/asset-manifest.md`)

## Runtime Alignment Applied

- Added frontend route aliases:
  - `/custom` -> `Designs` page
  - `/custom/:id` -> `DesignDetail` page
- Updated main navigation links to use `/custom`.
- Added `.dark` class synchronization on `<html>` based on resolved homepage theme.

## Asset Sync

Kimi material images were refreshed in:
- `apps/web/public/kimi/`

This now includes the expanded v29 material set used by homepage and related visual sections.
