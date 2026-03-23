import { Router } from 'express';
import { z } from 'zod';
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
import {
  ensureSmtpSettingsSchema,
  readSmtpSettings,
  smtpSettingsPatchSchema,
  toPublicSmtpSettings,
  writeSmtpSettings,
} from '../utils/smtp-settings';

const router = Router();

router.get(
  '/settings',
  authenticate,
  authorizePermissions(Permissions.AUTHENTICATOR_MANAGE, Permissions.USERS_MANAGE),
  async (_req, res) => {
    try {
      await ensureAuthenticatorSchema();
      await ensureSmtpSettingsSchema();
      const [settings, adminRoles, smtpSettings] = await Promise.all([
        readAuthenticatorSettings(),
        listAdminRolesForAuthenticatorPolicy(),
        readSmtpSettings(),
      ]);
      return res.json({
        success: true,
        data: {
          settings,
          smtpSettings: toPublicSmtpSettings(smtpSettings),
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
      await ensureSmtpSettingsSchema();
      const parsedBody = z
        .object({
          smtpSettings: smtpSettingsPatchSchema.optional(),
        })
        .merge(authenticatorSettingsPatchSchema)
        .parse(req.body || {});

      const {
        smtpSettings: smtpPatch,
        ...authenticatorPatch
      } = parsedBody;

      const hasAuthenticatorPatch = Object.keys(authenticatorPatch).length > 0;
      const [settings, adminRoles, smtpSettings] = await Promise.all([
        hasAuthenticatorPatch ? writeAuthenticatorSettings(authenticatorPatch) : readAuthenticatorSettings(),
        listAdminRolesForAuthenticatorPolicy(),
        smtpPatch ? writeSmtpSettings(smtpPatch) : readSmtpSettings(),
      ]);

      return res.json({
        success: true,
        message: 'Authenticator settings updated.',
        data: {
          settings,
          smtpSettings: toPublicSmtpSettings(smtpSettings),
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

router.get(
  '/smtp-settings',
  authenticate,
  authorizePermissions(Permissions.AUTHENTICATOR_MANAGE, Permissions.USERS_MANAGE, Permissions.NOTIFICATIONS_MANAGE),
  async (_req, res) => {
    try {
      await ensureSmtpSettingsSchema();
      const settings = await readSmtpSettings();
      return res.json({
        success: true,
        data: toPublicSmtpSettings(settings),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to load SMTP settings.',
      });
    }
  }
);

router.patch(
  '/smtp-settings',
  authenticate,
  authorizePermissions(Permissions.AUTHENTICATOR_MANAGE, Permissions.USERS_MANAGE, Permissions.NOTIFICATIONS_MANAGE),
  async (req, res) => {
    try {
      await ensureSmtpSettingsSchema();
      const patch = smtpSettingsPatchSchema.parse(req.body || {});
      const settings = await writeSmtpSettings(patch);
      return res.json({
        success: true,
        message: 'SMTP settings updated.',
        data: toPublicSmtpSettings(settings),
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Failed to update SMTP settings.',
      });
    }
  }
);

export default router;

