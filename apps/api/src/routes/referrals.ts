import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  ensureReferralProgramSchema,
  ensureResellerProfileForUser,
  listResellerInfluencersWithMetrics,
  readReferralProgramSettings,
  readResellerDashboard,
  saveReferralProgramSettings,
} from '../utils/referral-program';
const RESELLER_ROLE = 'RESELLER_INFLUENCER' as unknown as UserRole;

const router = Router();
router.use(async (_req, _res, next) => {
  try {
    await ensureReferralProgramSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const resellerCreateSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional().default(UserStatus.ACTIVE),
  displayName: z.string().max(120).optional(),
  commissionOverridePercent: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return Number(value);
    },
    z.number().min(0).max(100).optional()
  ),
});

const resellerUpdateSchema = z.object({
  displayName: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
  commissionOverridePercent: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return Number(value);
    },
    z.number().min(0).max(100).optional()
  ),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().nullable().optional(),
});

const referralSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  registrationReferralEnabled: z.boolean().optional(),
  defaultReferralCode: z.string().trim().min(2).max(80).optional(),
  sellerCommissionPercent: z.number().min(0).max(100).optional(),
  designerCommissionPercent: z.number().min(0).max(100).optional(),
  holdDays: z.number().int().min(0).max(365).optional(),
  minimumPayoutUsd: z.number().min(0).max(1_000_000).optional(),
  referralBaseUrl: z.string().trim().min(1).optional(),
});

router.get('/program/public', async (_req, res, next) => {
  try {
    const payload = await readReferralProgramSettings();
    res.json({
      success: true,
      data: {
        enabled: payload.settings.enabled,
        registrationReferralEnabled: payload.settings.registrationReferralEnabled,
        defaultReferralCode: payload.settings.defaultReferralCode,
      },
      source: payload.source,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get(
  '/program/settings',
  authorizePermissions(Permissions.USERS_READ, Permissions.USERS_MANAGE),
  async (_req, res, next) => {
    try {
      const payload = await readReferralProgramSettings();
      res.json({
        success: true,
        data: payload.settings,
        source: payload.source,
        updatedAt: payload.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/program/settings',
  authorizePermissions(Permissions.USERS_MANAGE),
  async (req, res, next) => {
    try {
      const parsed = referralSettingsSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid referral settings payload.',
          errors: parsed.error.issues,
        });
      }
      const payload = parsed.data;
      const saved = await saveReferralProgramSettings(payload);
      res.json({
        success: true,
        message: 'Referral program settings saved.',
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/resellers', authorizePermissions(Permissions.USERS_READ), async (req, res, next) => {
  try {
    const querySchema = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const query = querySchema.parse(req.query || {});
    const result = await listResellerInfluencersWithMetrics(query);
    res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/resellers', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const parsed = resellerCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid reseller payload.',
        errors: parsed.error.issues,
      });
    }
    const payload = parsed.data;
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: payload.email, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing?.id) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }
    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        phone: payload.phone?.trim() || null,
        password: hashedPassword,
        role: RESELLER_ROLE,
        status: payload.status,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });
    const profile = await ensureResellerProfileForUser({
      userId: user.id,
      createdById: req.user?.id || null,
      displayName: payload.displayName || `${user.firstName} ${user.lastName}`.trim(),
    });
    if (payload.commissionOverridePercent != null) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ResellerInfluencerProfile"
         SET "commissionOverridePercent" = $1, "updatedAt" = NOW()
         WHERE "userId" = $2`,
        Number(payload.commissionOverridePercent),
        user.id
      );
    }
    res.status(201).json({
      success: true,
      message: 'Reseller/Influencer account created.',
      data: {
        user,
        profile: {
          ...profile,
          commissionOverridePercent:
            payload.commissionOverridePercent != null ? Number(payload.commissionOverridePercent) : profile.commissionOverridePercent,
        },
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }
    next(error);
  }
});

router.patch('/resellers/:userId', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const parsed = resellerUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid reseller update payload.',
        errors: parsed.error.issues,
      });
    }
    const payload = parsed.data;
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== RESELLER_ROLE) {
      return res.status(404).json({ success: false, message: 'Reseller user not found.' });
    }
    if (payload.status || payload.phone !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: payload.status,
          phone: payload.phone === undefined ? undefined : payload.phone,
        },
      });
    }
    await ensureResellerProfileForUser({ userId, createdById: req.user?.id || null });
    if (
      payload.displayName !== undefined ||
      payload.isActive !== undefined ||
      payload.commissionOverridePercent !== undefined
    ) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ResellerInfluencerProfile"
         SET "displayName" = COALESCE($1, "displayName"),
             "isActive" = COALESCE($2, "isActive"),
             "commissionOverridePercent" = $3,
             "updatedAt" = NOW()
         WHERE "userId" = $4`,
        payload.displayName ?? null,
        payload.isActive ?? null,
        payload.commissionOverridePercent ?? null,
        userId
      );
    }
    const refreshed = await listResellerInfluencersWithMetrics({ search: userId, page: 1, limit: 1 });
    const row = refreshed.rows.find((entry) => entry.userId === userId) || null;
    res.json({
      success: true,
      message: 'Reseller updated successfully.',
      data: row,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    if (req.user?.role !== RESELLER_ROLE) {
      return res.status(403).json({
        success: false,
        message: 'Only reseller/influencer users can access this endpoint.',
      });
    }
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const query = querySchema.parse(req.query || {});
    await ensureResellerProfileForUser({
      userId: req.user.id,
      displayName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    });
    const dashboard = await readResellerDashboard(req.user.id, query);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Reseller profile not found.',
      });
    }
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
