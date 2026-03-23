# Jenks Homepage Runtime Canary Rollout Checklist (v1)

This runbook defines a safe rollout sequence for promoting Jenks homepage runtime from preview-safe to live.

## Scope

- Runtime switchboard endpoint: `/api/homepage-sections/admin/experience-settings`
- Health checks endpoint: `/api/homepage-sections/admin/runtime-health`
- Dry-run endpoint: `/api/homepage-sections/admin/runtime-health/dry-run`
- Rollback endpoint: `/api/homepage-sections/admin/runtime-rollback`
- Audit trail endpoint: `/api/homepage-sections/admin/runtime-audit`

## Preconditions

1. Canonical payload smoke test passes:
   - `npm run smoke:jenks:payload -- --base=https://<api-domain>/api`
2. Frontend build passes:
   - `npm run build`
3. Super Admin access is available for:
   - `Jenks Homepage Manager`
   - `Homepage Runtime Switchboard`
4. Incident/owner contacts are set for rollback authority.

## Phase 1: Preview-safe validation (no live user impact)

1. In **Homepage Runtime Switchboard**, set:
   - `homepageTemplate = JENKS`
   - `rolloutMode = PREVIEW_SAFE`
2. Run **Dry-run Health Check**.
3. Ensure all health checks are `PASS` or approved `WARN`.
4. Validate preview behavior using query override on `/`:
   - `?zkHomePreview=jenks` (dynamic Jenks path)
   - `?zkHomePreview=jenks-static` (static fallback)
   - `?zkHomePreview=legacy` (legacy path)
5. Verify key sections from canonical payload:
   - Hero, Shop By, Featured Collections, Fresh Drops, Newsletter.

## Phase 2: Canary live rollout

1. Keep `homepageTemplate = JENKS`.
2. Change `rolloutMode = LIVE`.
3. Provide reason in runtime switch form (required if policy enabled).
4. Save switchboard and confirm audit entry exists.
5. Monitor for 15-30 minutes:
   - 5xx on homepage routes
   - client JS errors
   - newsletter subscribe endpoint errors
   - conversion-critical routes (`/shop`, `/ready-to-wear`, `/fabrics`, `/custom`)

## Phase 3: Post-rollout verification

1. Export runtime audit CSV for change record.
2. Confirm current runtime health remains green.
3. Confirm default `/` resolves to expected template.
4. Verify admin settings edits propagate to frontend:
   - Shop By Blocks
   - Fresh Drops
   - Newsletter

## Rollback plan

1. Open **Homepage Runtime Switchboard**.
2. Select rollback target from audit trail.
3. Provide rollback reason (if required by policy).
4. Execute rollback and verify:
   - runtime health is green
   - audit entry recorded
   - `/` resolves to expected fallback

## Exit criteria

- Runtime remains stable for one business day after rollout.
- No unresolved high-severity issues linked to homepage runtime switch.
- Audit trail and exported CSV attached to release notes.
