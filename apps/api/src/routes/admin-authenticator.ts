import { Router } from 'express';
import { UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  ensureAuthenticatorSchema,
  listAdminRolesForAuthenticatorPolicy,
  readAuthenticatorSettings,
  writeAuthenticatorSettings,
  authenticatorSettingsPatchSchema,
} from '../utils/authenticator';

const router = Router();

router.get(
  '/settings',
  authenticate,
  authorizePermissions(Permissions.AUTHENTICATOR_MANAGE, Permissions.USERS_MANAGE),
  async (_req, res) => {
    try {
      await ensureAuthenticatorSchema();
      const [settings, adminRoles] = await Promise.all([
        readAuthenticatorSettings(),
        listAdminRolesForAuthenticatorPolicy(),
      ]);
      return res.json({
        success: true,
        data: {
          settings,
          userRoles: Object.values(UserRole),
          adminRoles,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to load authenticator settings.',
      });
    }
  }
);

router.patch(
  '/settings',
  authenticate,
  authorizePermissions(Permissions.AUTHENTICATOR_MANAGE, Permissions.USERS_MANAGE),
  async (req, res) => {
    try {
      await ensureAuthenticatorSchema();
      const patch = authenticatorSettingsPatchSchema.parse(req.body || {});
      const settings = await writeAuthenticatorSettings(patch);
      const adminRoles = await listAdminRolesForAuthenticatorPolicy();
      return res.json({
        success: true,
        message: 'Authenticator settings updated.',
        data: {
          settings,
          userRoles: Object.values(UserRole),
          adminRoles,
        },
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Failed to update authenticator settings.',
      });
    }
  }
);

export default router;

