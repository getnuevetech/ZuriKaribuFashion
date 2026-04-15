import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  MODULE_KEYS,
  ModuleKey,
  ensureModuleRuntimeSchema,
  listModuleRuntimeSettings,
  moduleRuntimePatchSchema,
  resolveModuleAccessDecisions,
  updateModuleRuntimeSetting,
} from '../utils/module-runtime';

const router = Router();

const moduleKeySchema = z.enum(MODULE_KEYS);

const parseModuleKeys = (value: unknown): ModuleKey[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => String(entry || '').trim())
          .filter((entry): entry is ModuleKey => MODULE_KEYS.includes(entry as ModuleKey))
      )
    );
  }
  const tokens = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const valid = tokens.filter((entry): entry is ModuleKey => MODULE_KEYS.includes(entry as ModuleKey));
  return Array.from(new Set(valid));
};

router.get('/decisions', authenticate, async (req, res) => {
  try {
    await ensureModuleRuntimeSchema();
    const queryKeys = parseModuleKeys(req.query?.keys);
    const keys = queryKeys.length > 0 ? queryKeys : [...MODULE_KEYS];
    const map = await resolveModuleAccessDecisions({
      moduleKeys: keys,
      actorRole: req.user?.role || null,
      actorUserId: req.user?.id || null,
    });
    return res.json({
      success: true,
      data: {
        keys,
        map,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load module access decisions.',
    });
  }
});

router.get(
  '/admin/modules',
  authenticate,
  authorizePermissions(Permissions.MODULES_MANAGE, Permissions.USERS_MANAGE, Permissions.ADMIN_ROLE_MANAGE),
  async (req, res) => {
    try {
      await ensureModuleRuntimeSchema();
      const rows = await listModuleRuntimeSettings();
      const map = await resolveModuleAccessDecisions({
        moduleKeys: rows.map((row) => row.moduleKey),
        actorRole: req.user?.role || null,
        actorUserId: req.user?.id || null,
      });
      return res.json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          accessDecision: map[row.moduleKey],
        })),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to load module settings.',
      });
    }
  }
);

router.patch(
  '/admin/modules/:moduleKey',
  authenticate,
  authorizePermissions(Permissions.MODULES_MANAGE, Permissions.USERS_MANAGE, Permissions.ADMIN_ROLE_MANAGE),
  async (req, res) => {
    try {
      await ensureModuleRuntimeSchema();
      const moduleKey = moduleKeySchema.parse(String(req.params.moduleKey || '').trim());
      const patch = moduleRuntimePatchSchema.parse(req.body || {});
      const updated = await updateModuleRuntimeSetting({
        moduleKey,
        patch,
        actorUserId: req.user?.id || null,
      });
      return res.json({
        success: true,
        data: updated,
        message: `Module "${moduleKey}" settings updated.`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0]?.message || 'Invalid module payload.',
          issues: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to update module settings.',
      });
    }
  }
);

export default router;

