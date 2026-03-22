# Kimi v14 Phase C Footer Mapping (v1)

**Date:** 2026-03-22  
**Scope:** Footer/support block normalization and fallback-safe rendering

---

## Endpoints
- `GET /homepage-sections/footer`

---

## Mapper introduced
- `apps/web/src/mappers/homepage/footerMapper.ts`

Purpose:
- normalize footer payload into stable DTO
- support legacy mixed payloads (including socialLinks JSON container)
- keep safe defaults for all footer slots when backend data is partial or malformed

---

## Bound component
- `apps/web/src/components/Footer.tsx`

Now reads mapped data instead of parsing raw payload directly in component.

---

## Key behaviors
- social links: robust parse with fallback `#`
- menu blocks: shop/company/support normalized and guaranteed required support links
- policy links: normalized with fallback labels/hrefs
- contact/company text fields: default copy preserved for null/empty backend values

