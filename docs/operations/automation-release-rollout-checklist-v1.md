# Automation Release Rollout Checklist (v1)

This checklist is for rolling out the recent automation updates safely:

- Additional material/fabric field for RTW and CTW (`hasAdditionalMaterialOrFabric`)
- All-image verification (`images[*]`) in automation field mapping
- Switchboard consolidation (single control surface for engine + criteria + manual checks)

## 1) Pre-deploy checks (local/CI)

1. Build API:
   - `cd apps/api && npm run db:generate && npm run build`
2. Build web:
   - `cd apps/web && npm run build`
3. Optional endpoint availability smoke:
   - `npm run smoke:automation:routes -- --base=https://<api-domain>/api`
   - Expect non-404 route availability for all probes.

## 2) Deploy sequence (recommended)

1. Deploy API first.
2. Run Prisma generate/migration in runtime environment:
   - `npm run db:generate`
   - Apply migrations as configured by your deployment workflow.
3. Restart API.
4. Verify API health and login.
5. Deploy web.

## 3) Post-deploy smoke checks

Run route smoke with admin token for semantic validation:

```bash
API_SMOKE_TOKEN="<ADMIN_BEARER_TOKEN>" npm run smoke:automation:routes -- --base=https://<api-domain>/api
```

Expected semantic pass includes:

- `READY_TO_WEAR` field catalog contains `hasAdditionalMaterialOrFabric`
- `DESIGN` field catalog contains `hasAdditionalMaterialOrFabric`
- `FABRIC`, `READY_TO_WEAR`, `DESIGN` include `images[*]`

## 4) Admin UAT checklist (manual)

### A. Automation System Switchboard

1. Open: `Admin > Automation > Automation System Switchboard`
2. Confirm **Engine Controls** toggles render and save.
3. Confirm **Field-level AI Pipeline Mapping**:
   - Scope tabs work (FTB/RTW/CTW/Account)
   - `Sync fields` completes successfully
   - Add criterion works
   - Remove criterion works
   - Save persists updates after reload
4. Confirm **Manual Approval Checks**:
   - Product check accepts valid product UUID
   - Account check accepts valid user UUID
   - Evaluation report appears and renders status badges

### B. RTW/CTW additional material field

1. Create or edit RTW product:
   - Set "Did you use any other material/fabric besides the primary fabric for the design?" = **Yes**
2. Create or edit CTW product:
   - Set "Will you use any other material/fabric besides the primary fabric for this design?" = **Yes**
3. Verify product detail pages:
   - RTW shows "was used in making this design" message
   - CTW shows "will be used in making this design" message

### C. Automation image coverage

1. In switchboard criteria mapping, select image-related criterion.
2. Confirm target field can be set to all images (`images[*]` label).
3. Run approval check and verify report references all-image behavior for image checks.

## 5) Rollback plan (if needed)

1. Switch active automation engine back to previous stable configuration in Switchboard.
2. Revert deployment to previous API/web release tags.
3. Re-run smoke:
   - `npm run smoke:automation:routes -- --base=https://<api-domain>/api`
4. Log incident details in release notes and ticketing system.

## 6) Known operational notes

- Without token, smoke probes still validate route existence (non-404) but semantic checks that require a `200` response are skipped.
- Use an admin bearer token for full semantic validation.
- Keep API-first deployment order to avoid frontend/runtime contract mismatch.
