import { randomUUID } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  ENTERPRISE_PERMISSION_CATALOG,
  ENTERPRISE_STANDARD_ROLE_TEMPLATES,
  calculateSubscriptionDates,
  ensureEnterpriseAccountForOwner,
  ensureEnterpriseSchema,
  ensureEnterpriseStandardRoles,
  isEnterpriseSubscriptionActive,
  readEnterpriseActorContext,
  readEnterpriseConfig,
} from '../utils/enterprise';
import { createPaymentSessionForUser, verifyPaymentForUser } from './payments';

const router = Router();

const parsePagination = (pageInput: unknown, limitInput: unknown, fallbackLimit = 20) => {
  const page = Math.max(1, Number(pageInput || 1) || 1);
  const limit = Math.max(1, Math.min(200, Number(limitInput || fallbackLimit) || fallbackLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const normalizeVendorRole = (value: unknown): 'FABRIC_SELLER' | 'FASHION_DESIGNER' | null => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'FABRIC_SELLER') return 'FABRIC_SELLER';
  if (normalized === 'FASHION_DESIGNER') return 'FASHION_DESIGNER';
  return null;
};

const normalizeEnterpriseAccountStatus = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'INACTIVE' || normalized === 'SUSPENDED') return normalized;
  return 'INACTIVE';
};

const normalizeSubscriptionStatus = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (
    normalized === 'INACTIVE' ||
    normalized === 'PENDING_PAYMENT' ||
    normalized === 'ACTIVE' ||
    normalized === 'EXPIRED' ||
    normalized === 'SUSPENDED'
  ) {
    return normalized;
  }
  return 'INACTIVE';
};

const normalizeUpgradeRequestStatus = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'REJECTED' || normalized === 'CANCELLED') {
    return normalized;
  }
  return 'PENDING';
};

const normalizeSubAccountStatus = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'DISABLED') return normalized;
  return 'ACTIVE';
};

const parseJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const resolveVendorActor = async (req: any, options?: { requireOwner?: boolean }) => {
  const actorUserId = String(req.user?.actorUserId || req.user?.id || '').trim();
  if (!actorUserId) {
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }
  const role = normalizeVendorRole(req.user?.role);
  if (!role) {
    throw Object.assign(new Error('Only seller and designer accounts can access enterprise settings.'), { status: 403 });
  }
  const context = await readEnterpriseActorContext(actorUserId, role);
  const ownerUserId = context?.ownerUserId || actorUserId;
  const account = context?.enterpriseAccount || (await ensureEnterpriseAccountForOwner(ownerUserId, role, actorUserId));
  if (!account) {
    throw Object.assign(new Error('Unable to resolve enterprise account.'), { status: 500 });
  }
  if (!context || !context.isSubAccount) {
    await ensureEnterpriseStandardRoles(String(account.id));
  }
  if (options?.requireOwner && context?.isSubAccount) {
    throw Object.assign(new Error('Only the main seller/designer account can perform this action.'), { status: 403 });
  }
  return {
    role,
    actorUserId,
    ownerUserId,
    context,
    account,
  };
};

const canManageSubAccounts = (permissions: string[]) =>
  permissions.includes('subaccounts:manage') || permissions.includes('subaccounts:view');

router.use(authenticate);

router.get('/me', async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const actor = await resolveVendorActor(req);
    const enterpriseAccountId = String(actor.account.id || '');
    const roleRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","key","name","permissions","isSystem","isActive","updatedAt"
       FROM "EnterpriseRole"
       WHERE "enterpriseAccountId" = $1
       ORDER BY "isSystem" DESC, "name" ASC`,
      enterpriseAccountId
    );
    const subAccountRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT sa."id",sa."subUserId",sa."status",sa."createdAt",sa."updatedAt",
              u."email",u."firstName",u."lastName",
              er."id" AS "roleId", er."key" AS "roleKey", er."name" AS "roleName"
       FROM "EnterpriseSubAccount" sa
       JOIN "User" u ON u."id" = sa."subUserId"
       LEFT JOIN "EnterpriseRole" er ON er."id" = sa."roleId"
       WHERE sa."enterpriseAccountId" = $1
       ORDER BY sa."createdAt" DESC`,
      enterpriseAccountId
    );
    const usageCount = subAccountRows.filter((row) => String(row.status || '').toUpperCase() === 'ACTIVE').length;
    const seatLimit = Math.max(1, Number(actor.account.seatLimit || 1));
    const actorPermissions = actor.context?.isSubAccount ? actor.context.permissions : ENTERPRISE_STANDARD_ROLE_TEMPLATES[0].permissions;

    return res.json({
      success: true,
      data: {
        role: actor.role,
        actorUserId: actor.actorUserId,
        ownerUserId: actor.ownerUserId,
        isSubAccount: Boolean(actor.context?.isSubAccount),
        subAccountId: actor.context?.subAccountId || null,
        subAccountRole: actor.context?.subAccountRole || null,
        account: {
          ...actor.account,
          subscriptionActive: isEnterpriseSubscriptionActive(actor.account),
          seatUsage: usageCount,
          seatRemaining: Math.max(0, seatLimit - usageCount),
        },
        actorPermissions,
        permissionCatalog: ENTERPRISE_PERMISSION_CATALOG,
        standardRoleTemplates: ENTERPRISE_STANDARD_ROLE_TEMPLATES,
        roles: roleRows.map((row) => ({
          ...row,
          permissions: parseJsonArray(row.permissions),
        })),
        subAccounts: subAccountRows,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/roles', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req);
    if (actor.context?.isSubAccount && !canManageSubAccounts(actor.context.permissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view enterprise roles.',
      });
    }
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","key","name","permissions","isSystem","isActive","updatedAt"
       FROM "EnterpriseRole"
       WHERE "enterpriseAccountId" = $1
       ORDER BY "isSystem" DESC, "name" ASC`,
      String(actor.account.id || '')
    );
    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        permissions: parseJsonArray(row.permissions),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/roles', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    const payload = z
      .object({
        key: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(80),
        permissions: z.array(z.string().trim().min(1)).min(1),
      })
      .parse(req.body || {});
    const key = String(payload.key || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EnterpriseRole"
        ("id","enterpriseAccountId","key","name","permissions","isSystem","isActive","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,false,true,NOW(),NOW())
       ON CONFLICT ("enterpriseAccountId","key")
       DO UPDATE SET
         "name" = EXCLUDED."name",
         "permissions" = EXCLUDED."permissions",
         "isActive" = true,
         "updatedAt" = NOW()`,
      randomUUID(),
      String(actor.account.id || ''),
      key,
      payload.name,
      JSON.stringify(payload.permissions)
    );
    return res.json({
      success: true,
      message: 'Enterprise role saved successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/roles/:roleId', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    const roleId = String(req.params.roleId || '').trim();
    const payload = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        permissions: z.array(z.string().trim().min(1)).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body || {});
    const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","isSystem","name","permissions","isActive"
       FROM "EnterpriseRole"
       WHERE "id" = $1 AND "enterpriseAccountId" = $2
       LIMIT 1`,
      roleId,
      String(actor.account.id || '')
    );
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise role not found.',
      });
    }
    const nextIsActive = existing.isSystem ? true : payload.isActive ?? Boolean(existing.isActive);
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseRole"
       SET "name" = $3,
           "permissions" = $4::jsonb,
           "isActive" = $5,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "enterpriseAccountId" = $2`,
      roleId,
      String(actor.account.id || ''),
      payload.name || existing.name,
      JSON.stringify(payload.permissions || parseJsonArray(existing.permissions)),
      nextIsActive
    );
    return res.json({
      success: true,
      message: 'Enterprise role updated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/subaccounts', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req);
    if (actor.context?.isSubAccount && !canManageSubAccounts(actor.context.permissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view enterprise sub-accounts.',
      });
    }
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT sa."id",sa."subUserId",sa."status",sa."createdAt",sa."updatedAt",
              u."email",u."firstName",u."lastName",u."lastLogin",
              er."id" AS "roleId", er."key" AS "roleKey", er."name" AS "roleName"
       FROM "EnterpriseSubAccount" sa
       JOIN "User" u ON u."id" = sa."subUserId"
       LEFT JOIN "EnterpriseRole" er ON er."id" = sa."roleId"
       WHERE sa."enterpriseAccountId" = $1
       ORDER BY sa."createdAt" DESC`,
      String(actor.account.id || '')
    );
    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/subaccounts', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    if (!Boolean(actor.account.isEnterprise) || !isEnterpriseSubscriptionActive(actor.account)) {
      return res.status(403).json({
        success: false,
        message: 'Enterprise subscription must be active before adding sub-accounts.',
      });
    }
    const payload = z
      .object({
        roleId: z.string().trim().min(1),
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        email: z.string().trim().email(),
        password: z.string().min(8),
        phone: z.string().trim().optional(),
      })
      .parse(req.body || {});
    const seatLimit = Math.max(1, Number(actor.account.seatLimit || 1));
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "EnterpriseSubAccount"
       WHERE "enterpriseAccountId" = $1
         AND "status" = 'ACTIVE'`,
      String(actor.account.id || '')
    );
    const activeSubAccounts = Number(countRows?.[0]?.count || 0);
    if (activeSubAccounts >= seatLimit) {
      return res.status(400).json({
        success: false,
        message: `Seat limit reached. Current plan allows up to ${seatLimit} active sub-accounts.`,
      });
    }

    const roleRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","name","isActive"
       FROM "EnterpriseRole"
       WHERE "id" = $1 AND "enterpriseAccountId" = $2
       LIMIT 1`,
      payload.roleId,
      String(actor.account.id || '')
    );
    const selectedRole = Array.isArray(roleRows) && roleRows.length > 0 ? roleRows[0] : null;
    if (!selectedRole || selectedRole.isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Selected enterprise role is invalid or inactive.',
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: payload.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        password: hashedPassword,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone || null,
        role: actor.role,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "EnterpriseSubAccount"
        ("id","enterpriseAccountId","ownerUserId","subUserId","roleId","status","createdById","updatedById","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$6,NOW(),NOW())`,
      randomUUID(),
      String(actor.account.id || ''),
      actor.ownerUserId,
      user.id,
      payload.roleId,
      actor.actorUserId
    );

    return res.status(201).json({
      success: true,
      message: 'Enterprise sub-account created successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/subaccounts/:subAccountId', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req);
    const subAccountId = String(req.params.subAccountId || '').trim();
    const payload = z
      .object({
        status: z.enum(['ACTIVE', 'DISABLED']).optional(),
        roleId: z.string().trim().optional(),
      })
      .parse(req.body || {});
    if (actor.context?.isSubAccount && !actor.context.permissions.includes('subaccounts:manage')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage sub-accounts.',
      });
    }
    const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","subUserId","status"
       FROM "EnterpriseSubAccount"
       WHERE "id" = $1 AND "enterpriseAccountId" = $2
       LIMIT 1`,
      subAccountId,
      String(actor.account.id || '')
    );
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sub-account not found.',
      });
    }
    if (payload.roleId) {
      const roleRows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","isActive"
         FROM "EnterpriseRole"
         WHERE "id" = $1 AND "enterpriseAccountId" = $2
         LIMIT 1`,
        payload.roleId,
        String(actor.account.id || '')
      );
      const roleRow = Array.isArray(roleRows) && roleRows.length > 0 ? roleRows[0] : null;
      if (!roleRow || roleRow.isActive === false) {
        return res.status(400).json({
          success: false,
          message: 'Selected role is invalid or inactive.',
        });
      }
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseSubAccount"
       SET "status" = $3,
           "roleId" = $4,
           "updatedById" = $5,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "enterpriseAccountId" = $2`,
      subAccountId,
      String(actor.account.id || ''),
      normalizeSubAccountStatus(payload.status || existing.status),
      payload.roleId || null,
      actor.actorUserId
    );
    return res.json({
      success: true,
      message: 'Sub-account updated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/upgrade-requests/my', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req);
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "EnterpriseUpgradeRequest"
       WHERE "ownerUserId" = $1
       ORDER BY "createdAt" DESC`,
      actor.ownerUserId
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/upgrade-requests', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    const payload = z
      .object({
        requestedLevelKey: z.string().trim().max(60).optional(),
        requestedSeatLimit: z.number().int().min(1).max(1000).optional(),
        requestedYears: z.number().int().min(1).max(5).default(1),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(req.body || {});
    const config = await readEnterpriseConfig();
    if (
      (actor.role === UserRole.FABRIC_SELLER && !config.sellerEnabled) ||
      (actor.role === UserRole.FASHION_DESIGNER && !config.designerEnabled)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Enterprise upgrades are currently disabled for this vendor role.',
      });
    }
    const pendingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id"
       FROM "EnterpriseUpgradeRequest"
       WHERE "ownerUserId" = $1 AND "status" = 'PENDING'
       LIMIT 1`,
      actor.ownerUserId
    );
    if (Array.isArray(pendingRows) && pendingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending enterprise upgrade request.',
      });
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EnterpriseUpgradeRequest"
        ("id","ownerUserId","role","requestedLevelKey","requestedSeatLimit","requestedYears","note","status","paymentStatus","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING','UNPAID',NOW(),NOW())`,
      randomUUID(),
      actor.ownerUserId,
      actor.role,
      payload.requestedLevelKey || null,
      Number(payload.requestedSeatLimit || config.defaultSeatLimit),
      Number(payload.requestedYears || 1),
      payload.note || null
    );

    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMINISTRATOR, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: 'New enterprise upgrade request',
          message: 'A seller/designer requested an enterprise account upgrade.',
          relatedType: 'PROFILE',
          relatedId: actor.ownerUserId,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Enterprise upgrade request submitted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/upgrade-requests/:requestId/payment-session', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    const requestId = String(req.params.requestId || '').trim();
    const payload = z
      .object({
        providerKey: z.string().trim().min(2).max(40),
        returnUrl: z.string().trim().optional(),
        cancelUrl: z.string().trim().optional(),
      })
      .parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "EnterpriseUpgradeRequest"
       WHERE "id" = $1 AND "ownerUserId" = $2
       LIMIT 1`,
      requestId,
      actor.ownerUserId
    );
    const requestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!requestRow) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise upgrade request not found.',
      });
    }
    if (String(requestRow.status || '').toUpperCase() !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'This request is not approved yet by admin.',
      });
    }
    if (String(requestRow.paymentStatus || '').toUpperCase() === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'This request is already paid.',
      });
    }
    const yearlyFee = Number(requestRow.approvedYearlyFeeUsd || 0);
    const years = Math.max(1, Number(requestRow.requestedYears || 1));
    const amountUsd = Number((yearlyFee * years).toFixed(2));
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Approved enterprise fee is invalid.',
      });
    }
    const session = await createPaymentSessionForUser({
      user: {
        id: actor.actorUserId,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
      },
      providerKey: payload.providerKey,
      amount: Math.round(amountUsd * 100),
      currency: 'USD',
      reference: `AF-ENT-${requestId}-${Date.now()}`,
      returnUrl: payload.returnUrl,
      cancelUrl: payload.cancelUrl,
      customer: {
        email: req.user!.email,
        name: `${String(req.user!.firstName || '')} ${String(req.user!.lastName || '')}`.trim() || req.user!.email,
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseUpgradeRequest"
       SET "paymentProviderKey" = $2,
           "paymentReference" = $3,
           "paymentStatus" = 'PENDING',
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      requestId,
      String(session.providerKey || payload.providerKey),
      String(session.paymentIntentId || session.reference || '')
    );
    return res.json({
      success: true,
      data: {
        ...session,
        amountUsd,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/upgrade-requests/:requestId/payment-verify', async (req, res, next) => {
  try {
    const actor = await resolveVendorActor(req, { requireOwner: true });
    const requestId = String(req.params.requestId || '').trim();
    const payload = z
      .object({
        providerKey: z.string().trim().min(2).max(40).optional(),
        reference: z.string().trim().min(4).optional(),
        payerId: z.string().trim().optional(),
      })
      .parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "EnterpriseUpgradeRequest"
       WHERE "id" = $1 AND "ownerUserId" = $2
       LIMIT 1`,
      requestId,
      actor.ownerUserId
    );
    const requestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!requestRow) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise upgrade request not found.',
      });
    }
    if (String(requestRow.status || '').toUpperCase() !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'This request is not approved yet by admin.',
      });
    }
    if (String(requestRow.paymentStatus || '').toUpperCase() === 'PAID') {
      return res.json({
        success: true,
        message: 'Request is already paid and active.',
      });
    }
    const providerKey = String(payload.providerKey || requestRow.paymentProviderKey || '').trim();
    const reference = String(payload.reference || requestRow.paymentReference || '').trim();
    if (!providerKey || !reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment provider and reference are required.',
      });
    }
    const verification = await verifyPaymentForUser({
      userId: actor.actorUserId,
      providerKey,
      reference,
      payerId: payload.payerId,
    });
    if (!verification.isPaid) {
      return res.status(400).json({
        success: false,
        message: `Payment is not completed yet (status: ${verification.status}).`,
      });
    }
    const years = Math.max(1, Number(requestRow.requestedYears || 1));
    const subscription = calculateSubscriptionDates(years);
    await ensureEnterpriseStandardRoles(String(actor.account.id || ''));
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE "EnterpriseUpgradeRequest"
         SET "paymentStatus" = 'PAID',
             "paymentProviderKey" = $2,
             "paymentReference" = $3,
             "paidAt" = NOW(),
             "activatedAt" = NOW(),
             "expiresAt" = $4,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        requestId,
        providerKey,
        String(verification.paymentReference || reference),
        subscription.endsAt
      ),
      prisma.$executeRawUnsafe(
        `UPDATE "EnterpriseAccount"
         SET "isEnterprise" = true,
             "allowSubAccounts" = true,
             "status" = 'ACTIVE',
             "levelName" = COALESCE($2, "levelName"),
             "seatLimit" = COALESCE($3, "seatLimit"),
             "yearlyFeeUsd" = COALESCE($4, "yearlyFeeUsd"),
             "subscriptionStatus" = 'ACTIVE',
             "subscriptionStartedAt" = $5,
             "subscriptionEndsAt" = $6,
             "renewalDueAt" = $6,
             "updatedById" = $7,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(actor.account.id || ''),
        requestRow.approvedLevelName || null,
        requestRow.approvedSeatLimit ? Number(requestRow.approvedSeatLimit) : null,
        requestRow.approvedYearlyFeeUsd ? Number(requestRow.approvedYearlyFeeUsd) : null,
        subscription.startedAt,
        subscription.endsAt,
        actor.actorUserId
      ),
    ]);
    return res.json({
      success: true,
      message: 'Enterprise upgrade payment verified and subscription activated.',
      data: {
        subscriptionEndsAt: subscription.endsAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/config', authorizePermissions(Permissions.USERS_MANAGE), async (_req, res, next) => {
  try {
    const config = await readEnterpriseConfig();
    return res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.put('/config', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const payload = z
      .object({
        sellerEnabled: z.boolean(),
        designerEnabled: z.boolean(),
        enforceSubscription: z.boolean(),
        defaultSeatLimit: z.number().int().min(1).max(1000),
        defaultYearlyFeeUsd: z.number().min(0),
        levels: z
          .array(
            z.object({
              key: z.string().trim().min(1).max(40),
              name: z.string().trim().min(1).max(80),
              seatLimit: z.number().int().min(1).max(10000),
              yearlyFeeUsd: z.number().min(0),
            })
          )
          .default([]),
      })
      .parse(req.body || {});
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseUpgradeConfig"
       SET "sellerEnabled" = $1,
           "designerEnabled" = $2,
           "enforceSubscription" = $3,
           "defaultSeatLimit" = $4,
           "defaultYearlyFeeUsd" = $5,
           "levels" = $6::jsonb,
           "updatedById" = $7,
           "updatedAt" = NOW()
       WHERE "id" = 'default'`,
      payload.sellerEnabled,
      payload.designerEnabled,
      payload.enforceSubscription,
      payload.defaultSeatLimit,
      payload.defaultYearlyFeeUsd,
      JSON.stringify(payload.levels),
      req.user!.id
    );
    return res.json({
      success: true,
      message: 'Enterprise configuration updated successfully.',
      data: payload,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/accounts', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const query = z
      .object({
        role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']).optional(),
        status: z.string().trim().optional(),
        search: z.string().trim().optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const whereClauses = ['u."role" IN (\'FABRIC_SELLER\',\'FASHION_DESIGNER\')'];
    const values: any[] = [];
    if (query.role) {
      values.push(query.role);
      whereClauses.push(`u."role" = $${values.length}`);
    }
    if (query.status) {
      values.push(query.status.toUpperCase());
      whereClauses.push(`COALESCE(ea."status",'INACTIVE') = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      whereClauses.push(
        `(LOWER(COALESCE(u."firstName",'') || ' ' || COALESCE(u."lastName",'')) LIKE $${values.length}
          OR LOWER(COALESCE(u."email",'')) LIKE $${values.length})`
      );
    }
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
          u."id" AS "ownerUserId",
          u."email",
          u."firstName",
          u."lastName",
          u."role",
          u."status" AS "userStatus",
          ea."id" AS "enterpriseAccountId",
          COALESCE(ea."isEnterprise", false) AS "isEnterprise",
          COALESCE(ea."status",'INACTIVE') AS "enterpriseStatus",
          COALESCE(ea."subscriptionStatus",'INACTIVE') AS "subscriptionStatus",
          ea."seatLimit",
          ea."levelName",
          ea."yearlyFeeUsd",
          ea."subscriptionEndsAt",
          COALESCE(subCounts."activeCount", 0) AS "activeSubAccounts"
       FROM "User" u
       LEFT JOIN "EnterpriseAccount" ea ON ea."ownerUserId" = u."id"
       LEFT JOIN (
          SELECT "ownerUserId", COUNT(*)::int AS "activeCount"
          FROM "EnterpriseSubAccount"
          WHERE "status" = 'ACTIVE'
          GROUP BY "ownerUserId"
       ) subCounts ON subCounts."ownerUserId" = u."id"
       ${whereSql}
       ORDER BY u."createdAt" DESC
       LIMIT ${pagination.limit}
       OFFSET ${pagination.skip}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "User" u
       LEFT JOIN "EnterpriseAccount" ea ON ea."ownerUserId" = u."id"
       ${whereSql}`,
      ...values
    );
    const total = Number(countRows?.[0]?.count || 0);
    return res.json({
      success: true,
      data: {
        accounts: rows,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.max(1, Math.ceil(total / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/accounts/:ownerUserId/convert', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const ownerUserId = String(req.params.ownerUserId || '').trim();
    const payload = z
      .object({
        isEnterprise: z.boolean(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        seatLimit: z.number().int().min(1).max(10000).optional(),
        yearlyFeeUsd: z.number().min(0).optional(),
        levelName: z.string().trim().max(80).optional(),
        enforceSubscription: z.boolean().optional(),
      })
      .parse(req.body || {});
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, role: true },
    });
    const role = normalizeVendorRole(owner?.role);
    if (!owner || !role) {
      return res.status(404).json({
        success: false,
        message: 'Vendor account not found.',
      });
    }
    const account = await ensureEnterpriseAccountForOwner(ownerUserId, role, req.user!.id);
    if (!account) {
      return res.status(500).json({ success: false, message: 'Unable to create enterprise account record.' });
    }
    if (payload.isEnterprise) {
      await ensureEnterpriseStandardRoles(String(account.id || ''));
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseAccount"
       SET "isEnterprise" = $2,
           "allowSubAccounts" = $2,
           "status" = $3,
           "seatLimit" = COALESCE($4, "seatLimit"),
           "yearlyFeeUsd" = COALESCE($5, "yearlyFeeUsd"),
           "levelName" = COALESCE($6, "levelName"),
           "enforceSubscription" = COALESCE($7, "enforceSubscription"),
           "updatedById" = $8,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(account.id || ''),
      payload.isEnterprise,
      normalizeEnterpriseAccountStatus(payload.status || account.status || 'INACTIVE'),
      payload.seatLimit ?? null,
      payload.yearlyFeeUsd ?? null,
      payload.levelName || null,
      payload.enforceSubscription ?? null,
      req.user!.id
    );
    return res.json({
      success: true,
      message: payload.isEnterprise
        ? 'Vendor converted to enterprise successfully.'
        : 'Enterprise mode disabled for this vendor.',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/accounts/:ownerUserId/subscription', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const ownerUserId = String(req.params.ownerUserId || '').trim();
    const payload = z
      .object({
        subscriptionStatus: z.enum(['INACTIVE', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUSPENDED']),
        years: z.number().int().min(1).max(5).optional(),
        seatLimit: z.number().int().min(1).max(10000).optional(),
        yearlyFeeUsd: z.number().min(0).optional(),
        levelName: z.string().trim().max(80).optional(),
      })
      .parse(req.body || {});
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, role: true },
    });
    const role = normalizeVendorRole(owner?.role);
    if (!owner || !role) {
      return res.status(404).json({
        success: false,
        message: 'Vendor account not found.',
      });
    }
    const account = await ensureEnterpriseAccountForOwner(ownerUserId, role, req.user!.id);
    if (!account) {
      return res.status(500).json({ success: false, message: 'Unable to create enterprise account record.' });
    }
    const dates =
      payload.subscriptionStatus === 'ACTIVE' ? calculateSubscriptionDates(Math.max(1, Number(payload.years || 1))) : null;
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseAccount"
       SET "isEnterprise" = true,
           "allowSubAccounts" = true,
           "status" = CASE WHEN $2 = 'SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
           "subscriptionStatus" = $2,
           "subscriptionStartedAt" = CASE WHEN $2 = 'ACTIVE' THEN $3 ELSE "subscriptionStartedAt" END,
           "subscriptionEndsAt" = CASE WHEN $2 = 'ACTIVE' THEN $4 ELSE "subscriptionEndsAt" END,
           "renewalDueAt" = CASE WHEN $2 = 'ACTIVE' THEN $4 ELSE "renewalDueAt" END,
           "seatLimit" = COALESCE($5, "seatLimit"),
           "yearlyFeeUsd" = COALESCE($6, "yearlyFeeUsd"),
           "levelName" = COALESCE($7, "levelName"),
           "updatedById" = $8,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(account.id || ''),
      normalizeSubscriptionStatus(payload.subscriptionStatus),
      dates?.startedAt || null,
      dates?.endsAt || null,
      payload.seatLimit ?? null,
      payload.yearlyFeeUsd ?? null,
      payload.levelName || null,
      req.user!.id
    );
    return res.json({
      success: true,
      message: 'Enterprise subscription updated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/accounts/:ownerUserId/subaccounts', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const ownerUserId = String(req.params.ownerUserId || '').trim();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
         sa."id",
         sa."subUserId",
         sa."status",
         sa."createdAt",
         sa."updatedAt",
         u."email",
         u."firstName",
         u."lastName",
         er."id" AS "roleId",
         er."name" AS "roleName",
         er."key" AS "roleKey"
       FROM "EnterpriseSubAccount" sa
       JOIN "User" u ON u."id" = sa."subUserId"
       LEFT JOIN "EnterpriseRole" er ON er."id" = sa."roleId"
       WHERE sa."ownerUserId" = $1
       ORDER BY sa."createdAt" DESC`,
      ownerUserId
    );
    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/upgrade-requests', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const query = z
      .object({
        status: z.string().optional(),
        role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']).optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const whereClauses: string[] = ['1=1'];
    const values: any[] = [];
    if (query.status) {
      values.push(normalizeUpgradeRequestStatus(query.status));
      whereClauses.push(`r."status" = $${values.length}`);
    }
    if (query.role) {
      values.push(query.role);
      whereClauses.push(`r."role" = $${values.length}`);
    }
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
          r.*,
          u."email" AS "ownerEmail",
          u."firstName" AS "ownerFirstName",
          u."lastName" AS "ownerLastName"
       FROM "EnterpriseUpgradeRequest" r
       JOIN "User" u ON u."id" = r."ownerUserId"
       ${whereSql}
       ORDER BY r."createdAt" DESC
       LIMIT ${pagination.limit}
       OFFSET ${pagination.skip}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "EnterpriseUpgradeRequest" r
       ${whereSql}`,
      ...values
    );
    const total = Number(countRows?.[0]?.count || 0);
    return res.json({
      success: true,
      data: {
        requests: rows,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.max(1, Math.ceil(total / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/upgrade-requests/:requestId/review', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const requestId = String(req.params.requestId || '').trim();
    const payload = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        reviewNote: z.string().trim().max(2000).optional(),
        approvedLevelName: z.string().trim().max(80).optional(),
        approvedSeatLimit: z.number().int().min(1).max(10000).optional(),
        approvedYearlyFeeUsd: z.number().min(0).optional(),
      })
      .parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "EnterpriseUpgradeRequest"
       WHERE "id" = $1
       LIMIT 1`,
      requestId
    );
    const requestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!requestRow) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade request not found.',
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseUpgradeRequest"
       SET "status" = $2,
           "reviewedById" = $3,
           "reviewedAt" = NOW(),
           "reviewNote" = $4,
           "approvedLevelName" = CASE WHEN $2 = 'APPROVED' THEN $5 ELSE NULL END,
           "approvedSeatLimit" = CASE WHEN $2 = 'APPROVED' THEN $6 ELSE NULL END,
           "approvedYearlyFeeUsd" = CASE WHEN $2 = 'APPROVED' THEN $7 ELSE NULL END,
           "paymentStatus" = CASE WHEN $2 = 'APPROVED' THEN 'UNPAID' ELSE "paymentStatus" END,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      requestId,
      payload.status,
      req.user!.id,
      payload.reviewNote || null,
      payload.approvedLevelName || requestRow.requestedLevelKey || 'Enterprise',
      payload.approvedSeatLimit ?? Number(requestRow.requestedSeatLimit || 5),
      payload.approvedYearlyFeeUsd ?? Number(requestRow.approvedYearlyFeeUsd || 0)
    );
    await prisma.notification.create({
      data: {
        userId: requestRow.ownerUserId,
        type: payload.status === 'APPROVED' ? 'SYSTEM' : 'NEW_MESSAGE',
        title: payload.status === 'APPROVED' ? 'Enterprise upgrade approved' : 'Enterprise upgrade rejected',
        message:
          payload.status === 'APPROVED'
            ? 'Your enterprise upgrade request was approved. You can now complete payment to activate.'
            : payload.reviewNote || 'Your enterprise upgrade request was rejected by admin.',
        relatedType: 'PROFILE',
        relatedId: requestId,
      },
    });
    return res.json({
      success: true,
      message: `Enterprise upgrade request ${payload.status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/subaccounts/:subAccountId/status', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    await ensureEnterpriseSchema();
    const subAccountId = String(req.params.subAccountId || '').trim();
    const payload = z
      .object({
        status: z.enum(['ACTIVE', 'DISABLED']),
      })
      .parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id"
       FROM "EnterpriseSubAccount"
       WHERE "id" = $1
       LIMIT 1`,
      subAccountId
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sub-account not found.',
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "EnterpriseSubAccount"
       SET "status" = $2,
           "updatedById" = $3,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      subAccountId,
      payload.status,
      req.user!.id
    );
    return res.json({
      success: true,
      message: 'Sub-account status updated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

