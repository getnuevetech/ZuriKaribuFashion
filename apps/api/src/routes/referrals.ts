import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions, sanitizePermissionGrants } from '../rbac';
import {
  createReferralMaterial,
  deleteReferralMaterial,
  ensureReferralProgramSchema,
  ensureResellerProfileForUser,
  listReferralMaterials,
  listResellerInfluencersWithMetrics,
  readReferralProgramSettings,
  readResellerDashboard,
  updateReferralMaterial,
  updateResellerProfileFromSelfService,
  saveReferralProgramSettings,
} from '../utils/referral-program';
import { markTemporaryPasswordRequired } from '../utils/password-policy';
import { buildPasswordPolicyErrorMessage, evaluatePasswordSecurity } from '../utils/password-security';

const router = Router();
router.use(async (_req, _res, next) => {
  try {
    await ensureReferralProgramSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const isSuperAdminRequest = (req: any) => {
  const grants = sanitizePermissionGrants(Array.isArray(req?.user?.permissions) ? req.user.permissions : []);
  const grantSet = new Set(grants.map((entry) => String(entry || '').trim()));
  const lowerGrantSet = new Set(grants.map((entry) => String(entry || '').trim().toLowerCase()));
  return grantSet.has('*') || grantSet.has('ALL') || lowerGrantSet.has('all');
};

let callerIdSchemaEnsured = false;
async function ensureCallerIdSchemaAndBackfill() {
  if (!callerIdSchemaEnsured) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "callerId" TEXT`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_callerId_key" ON "User"("callerId") WHERE "callerId" IS NOT NULL`
    );
    callerIdSchemaEnsured = true;
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "User"
     SET "callerId" = (
       CASE
         WHEN "role"::text = 'ADMINISTRATOR' THEN 'ADM'
         WHEN "role"::text = 'FASHION_DESIGNER' THEN 'DSN'
         WHEN "role"::text = 'FABRIC_SELLER' THEN 'SLR'
         WHEN "role"::text = 'RESELLER_INFLUENCER' THEN 'RSL'
         WHEN "role"::text = 'QA_TEAM' THEN 'QAT'
         ELSE 'CUS'
       END
       || '-' || UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 10))
     )
     WHERE "callerId" IS NULL OR BTRIM("callerId") = ''`
  );
}

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
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().transform((value) => value.toLowerCase().trim()).optional(),
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
  avatar: z.string().trim().url().nullable().optional(),
});

const referralSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  registrationReferralEnabled: z.boolean().optional(),
  defaultReferralCode: z.string().trim().min(2).max(80).optional(),
  codePrefix: z.string().trim().min(2).max(12).optional(),
  codeDigits: z.number().int().min(4).max(12).optional(),
  sellerCommissionPercent: z.number().min(0).max(100).optional(),
  designerCommissionPercent: z.number().min(0).max(100).optional(),
  customerCommissionPercent: z.number().min(0).max(100).optional(),
  earnFromCustomerOrders: z.boolean().optional(),
  holdDays: z.number().int().min(0).max(365).optional(),
  minimumPayoutUsd: z.number().min(0).max(1_000_000).optional(),
  referralBaseUrl: z.string().trim().min(1).optional(),
  profileEditableFields: z
    .array(z.enum(['firstName', 'lastName', 'phone', 'avatar', 'displayName']))
    .min(1)
    .optional(),
});

const resellerSelfUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  avatar: z.string().trim().url().nullable().optional(),
  displayName: z.string().max(120).optional(),
});

const referralMaterialCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().url().optional(),
  targetUrl: z.string().trim().url().optional(),
  widthPx: z.number().int().min(16).max(5000).optional(),
  heightPx: z.number().int().min(16).max(5000).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

const referralMaterialUpdateSchema = referralMaterialCreateSchema.partial();

const parsePagination = (pageInput: unknown, limitInput: unknown, fallback = 20) => {
  const page = Math.max(1, Number(pageInput || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitInput || fallback) || fallback));
  return { page, limit, offset: (page - 1) * limit };
};

router.get('/program/public', async (_req, res, next) => {
  try {
    const payload = await readReferralProgramSettings();
    res.json({
      success: true,
      data: {
        enabled: payload.settings.enabled,
        registrationReferralEnabled: payload.settings.registrationReferralEnabled,
        defaultReferralCode: payload.settings.defaultReferralCode,
        codePrefix: payload.settings.codePrefix,
        codeDigits: payload.settings.codeDigits,
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
    const superAdminViewer = isSuperAdminRequest(req);
    if (superAdminViewer) {
      await ensureCallerIdSchemaAndBackfill();
    }
    const querySchema = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const query = querySchema.parse(req.query || {});
    const result = await listResellerInfluencersWithMetrics(query);
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const userIds = rows.map((row) => String(row?.userId || '').trim()).filter(Boolean);
    const callerIdRows =
      superAdminViewer && userIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ id: string; callerId: string | null }>>(
            `SELECT "id","callerId" FROM "User" WHERE "id" = ANY($1::text[])`,
            userIds
          )
        : [];
    const callerIdByUserId = new Map(
      callerIdRows.map((row) => [String(row.id), String(row.callerId || '').trim() || null])
    );
    const mappedRows = rows.map((row) => ({
      ...row,
      user: {
        ...(row?.user || {}),
        callerId: superAdminViewer ? callerIdByUserId.get(String(row?.userId || '')) || null : null,
      },
    }));
    res.json({
      success: true,
      data: mappedRows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/referral-list', authorizePermissions(Permissions.USERS_READ), async (req, res, next) => {
  try {
    const querySchema = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const query = querySchema.parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const search = String(query.search || '').trim();
    const whereSql = search
      ? `WHERE (
           LOWER(COALESCE(rp."displayName", '')) LIKE LOWER($1)
           OR LOWER(COALESCE(ru."firstName",'') || ' ' || COALESCE(ru."lastName",'')) LIKE LOWER($1)
           OR LOWER(COALESCE(uu."firstName",'') || ' ' || COALESCE(uu."lastName",'')) LIKE LOWER($1)
           OR LOWER(COALESCE(uu."email", '')) LIKE LOWER($1)
           OR LOWER(COALESCE(rp."referralCode", '')) LIKE LOWER($1)
         )`
      : '';
    const values: unknown[] = [];
    if (search) values.push(`%${search}%`);
    values.push(pagination.offset, pagination.limit);
    let rows: Array<any> = [];
    try {
      rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT
            a."id" AS "attributionId",
            a."createdAt" AS "attributedAt",
            a."referredRole",
            a."source",
            rp."referralCode",
            rp."createdAt" AS "referralJoinedAt",
            COALESCE(rp."displayName", TRIM(COALESCE(ru."firstName",'') || ' ' || COALESCE(ru."lastName",''))) AS "referralName",
            rp."isActive" AS "referralProgramActive",
            ru."status" AS "referralAccountStatus",
            uu."id" AS "referredUserId",
            TRIM(COALESCE(uu."firstName",'') || ' ' || COALESCE(uu."lastName",'')) AS "referredName",
            uu."email" AS "referredEmail",
            uu."createdAt" AS "refereeJoinedAt",
            uu."status" AS "referredAccountStatus",
            vps."profileStatus" AS "vendorProfileStatus",
            COALESCE(comm."designerSellerSalesUsd", 0)::numeric AS "designerSellerSalesUsd",
            COALESCE(comm."referralCommissionUsd", 0)::numeric AS "referralCommissionUsd"
         FROM "ReferralAttribution" a
         JOIN "ResellerInfluencerProfile" rp ON rp."userId" = a."resellerUserId"
         JOIN "User" ru ON ru."id" = rp."userId"
         JOIN "User" uu ON uu."id" = a."referredUserId"
         LEFT JOIN LATERAL (
           SELECT v."profileStatus"
           FROM "VendorProfileSubmission" v
           WHERE v."userId" = uu."id"
             AND UPPER(v."role") = UPPER(a."referredRole")
           ORDER BY COALESCE(v."updatedAt", v."profileReviewedAt", v."profileSubmittedAt", v."createdAt") DESC
           LIMIT 1
         ) vps ON TRUE
         LEFT JOIN (
           SELECT
             "vendorUserId",
             SUM("baseAmountUsd")::numeric AS "designerSellerSalesUsd",
             SUM("commissionAmountUsd")::numeric AS "referralCommissionUsd"
           FROM "ReferralCommissionLedger"
           GROUP BY "vendorUserId"
         ) comm ON comm."vendorUserId" = a."referredUserId"
         ${whereSql}
         ORDER BY a."createdAt" DESC
         OFFSET $${search ? 2 : 1}
         LIMIT $${search ? 3 : 2}`,
        ...values
      );
    } catch {
      rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT
            a."id" AS "attributionId",
            a."createdAt" AS "attributedAt",
            a."referredRole",
            a."source",
            rp."referralCode",
            rp."createdAt" AS "referralJoinedAt",
            COALESCE(rp."displayName", TRIM(COALESCE(ru."firstName",'') || ' ' || COALESCE(ru."lastName",''))) AS "referralName",
            rp."isActive" AS "referralProgramActive",
            ru."status" AS "referralAccountStatus",
            uu."id" AS "referredUserId",
            TRIM(COALESCE(uu."firstName",'') || ' ' || COALESCE(uu."lastName",'')) AS "referredName",
            uu."email" AS "referredEmail",
            uu."createdAt" AS "refereeJoinedAt",
            uu."status" AS "referredAccountStatus",
            NULL::text AS "vendorProfileStatus",
            COALESCE(comm."designerSellerSalesUsd", 0)::numeric AS "designerSellerSalesUsd",
            COALESCE(comm."referralCommissionUsd", 0)::numeric AS "referralCommissionUsd"
         FROM "ReferralAttribution" a
         JOIN "ResellerInfluencerProfile" rp ON rp."userId" = a."resellerUserId"
         JOIN "User" ru ON ru."id" = rp."userId"
         JOIN "User" uu ON uu."id" = a."referredUserId"
         LEFT JOIN (
           SELECT
             "vendorUserId",
             SUM("baseAmountUsd")::numeric AS "designerSellerSalesUsd",
             SUM("commissionAmountUsd")::numeric AS "referralCommissionUsd"
           FROM "ReferralCommissionLedger"
           GROUP BY "vendorUserId"
         ) comm ON comm."vendorUserId" = a."referredUserId"
         ${whereSql}
         ORDER BY a."createdAt" DESC
         OFFSET $${search ? 2 : 1}
         LIMIT $${search ? 3 : 2}`,
        ...values
      );
    }
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
       FROM "ReferralAttribution" a
       JOIN "ResellerInfluencerProfile" rp ON rp."userId" = a."resellerUserId"
       JOIN "User" ru ON ru."id" = rp."userId"
       JOIN "User" uu ON uu."id" = a."referredUserId"
       ${whereSql}`,
      ...(search ? [`%${search}%`] : [])
    );
    const data = (Array.isArray(rows) ? rows : []).map((row) => {
      const referredRole = String(row.referredRole || '').toUpperCase();
      const vendorCategory =
        referredRole === 'FABRIC_SELLER'
          ? 'SELLER'
          : referredRole === 'FASHION_DESIGNER'
            ? 'DESIGNER'
            : 'USER';
      return {
        attributionId: String(row.attributionId || ''),
        referralName: String(row.referralName || 'Referral'),
        referralCode: String(row.referralCode || ''),
        referredName: String(row.referredName || '') || 'User',
        referredEmail: String(row.referredEmail || ''),
        vendorCategory,
        referredRole,
        referralJoinedAt: row.referralJoinedAt ? new Date(row.referralJoinedAt).toISOString() : null,
        refereeJoinedAt: row.refereeJoinedAt ? new Date(row.refereeJoinedAt).toISOString() : null,
        designerSellerSalesUsd: Number(row.designerSellerSalesUsd || 0),
        referralCommissionUsd: Number(row.referralCommissionUsd || 0),
        refereeStatus: String(row.source || 'ATTRIBUTED'),
        sellerDesignerCustomerStatus:
          String(row.vendorProfileStatus || '').trim() || String(row.referredAccountStatus || '').trim() || 'UNKNOWN',
        referredAccountStatus: String(row.referredAccountStatus || ''),
        referralProgramStatus:
          row.referralProgramActive === false || String(row.referralAccountStatus || '').toUpperCase() !== 'ACTIVE'
            ? 'INACTIVE'
            : 'ACTIVE',
      };
    });
    res.json({
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: Number(countRows?.[0]?.total || 0),
        pages: Math.max(1, Math.ceil(Number(countRows?.[0]?.total || 0) / pagination.limit)),
      },
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
    const passwordSecurity = evaluatePasswordSecurity(payload.password);
    if (!passwordSecurity.isValid) {
      return res.status(400).json({
        success: false,
        message: buildPasswordPolicyErrorMessage(passwordSecurity),
        errors: passwordSecurity.missing.map((item) => ({
          code: item.key,
          message: item.label,
          path: ['password'],
        })),
      });
    }
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
        role: UserRole.RESELLER_INFLUENCER,
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
    await markTemporaryPasswordRequired(user.id);
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
    if (!user || user.role !== UserRole.RESELLER_INFLUENCER) {
      return res.status(404).json({ success: false, message: 'Reseller user not found.' });
    }
    if (
      payload.status ||
      payload.phone !== undefined ||
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.email !== undefined ||
      payload.avatar !== undefined
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          email: payload.email,
          status: payload.status,
          phone: payload.phone === undefined ? undefined : payload.phone,
          avatar: payload.avatar === undefined ? undefined : payload.avatar,
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
             "commissionOverridePercent" = COALESCE($3, "commissionOverridePercent"),
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
    if (req.user?.role !== UserRole.RESELLER_INFLUENCER) {
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

router.get('/me/profile', async (req, res, next) => {
  try {
    if (req.user?.role !== UserRole.RESELLER_INFLUENCER) {
      return res.status(403).json({
        success: false,
        message: 'Only reseller/influencer users can access this endpoint.',
      });
    }
    await ensureResellerProfileForUser({
      userId: req.user.id,
      displayName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    });
    const dashboard = await readResellerDashboard(req.user.id, { page: 1, limit: 1 });
    const settings = (await readReferralProgramSettings()).settings;
    return res.json({
      success: true,
      data: {
        profile: dashboard?.profile || null,
        editableFields: settings.profileEditableFields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me/profile', async (req, res, next) => {
  try {
    if (req.user?.role !== UserRole.RESELLER_INFLUENCER) {
      return res.status(403).json({
        success: false,
        message: 'Only reseller/influencer users can access this endpoint.',
      });
    }
    const parsed = resellerSelfUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid profile payload.',
        errors: parsed.error.issues,
      });
    }
    await updateResellerProfileFromSelfService(req.user.id, parsed.data);
    const dashboard = await readResellerDashboard(req.user.id, { page: 1, limit: 1 });
    const settings = (await readReferralProgramSettings()).settings;
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        profile: dashboard?.profile || null,
        editableFields: settings.profileEditableFields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/materials', async (req, res, next) => {
  try {
    if (req.user?.role !== UserRole.RESELLER_INFLUENCER) {
      return res.status(403).json({
        success: false,
        message: 'Only reseller/influencer users can access this endpoint.',
      });
    }
    const dashboard = await readResellerDashboard(req.user.id, { page: 1, limit: 1 });
    if (!dashboard?.profile) {
      return res.status(404).json({
        success: false,
        message: 'Reseller profile not found.',
      });
    }
    const materials = await listReferralMaterials({ includeInactive: false });
    return res.json({
      success: true,
      data: materials.map((material) => {
        const target = material.targetUrl || dashboard.profile.referralLink;
        const image = material.imageUrl || '';
        const embedHtml = image
          ? `<a href="${target}" target="_blank" rel="noopener noreferrer"><img src="${image}" alt="${String(
              material.title || 'Referral banner'
            )}" style="max-width:100%;height:auto;" /></a>`
          : `<a href="${target}" target="_blank" rel="noopener noreferrer">${String(material.title || target)}</a>`;
        return {
          ...material,
          targetUrl: target,
          embedHtml,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/materials/manage', authorizePermissions(Permissions.USERS_READ), async (_req, res, next) => {
  try {
    const materials = await listReferralMaterials({ includeInactive: true });
    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/materials/manage', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const parsed = referralMaterialCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid material payload.',
        errors: parsed.error.issues,
      });
    }
    await createReferralMaterial({
      ...parsed.data,
      createdById: req.user?.id || null,
    });
    const materials = await listReferralMaterials({ includeInactive: true });
    res.status(201).json({
      success: true,
      message: 'Referral material created.',
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/materials/manage/:id', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const parsed = referralMaterialUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid material payload.',
        errors: parsed.error.issues,
      });
    }
    await updateReferralMaterial(String(req.params.id || ''), parsed.data);
    const materials = await listReferralMaterials({ includeInactive: true });
    res.json({
      success: true,
      message: 'Referral material updated.',
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/materials/manage/:id', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await deleteReferralMaterial(String(req.params.id || ''));
    const materials = await listReferralMaterials({ includeInactive: true });
    res.json({
      success: true,
      message: 'Referral material deleted.',
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
