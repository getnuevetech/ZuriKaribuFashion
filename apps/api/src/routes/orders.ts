import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, UserRole, OrderType, OrderStatus, PaymentStatus, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import nodemailer from 'nodemailer';
import {
  appendWorkflowMetadataToShippingAddress,
  determinePostPaymentStatus,
  readOrderWorkflowSettings,
  redactShippingAddressForVendor,
  shouldNotifyRoleForStatus,
} from '../utils/order-workflow';
import { emitPartnerOrderEvent } from '../utils/partner-api';

const router = Router();

const ORDER_TICKETING_SETTINGS_KEY = 'order_ticketing_settings_v1';
const ORDER_TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
type OrderTicketStatus = (typeof ORDER_TICKET_STATUSES)[number];
const ORDER_TICKETING_ROLES = [
  UserRole.CUSTOMER,
  UserRole.FABRIC_SELLER,
  UserRole.FASHION_DESIGNER,
  UserRole.QA_TEAM,
  UserRole.ADMINISTRATOR,
] as const;
type OrderTicketingRole = (typeof ORDER_TICKETING_ROLES)[number];
const ADMIN_ROLE_TOKEN_PREFIX = 'ADMIN_ROLE:';
type TicketAssignmentRoleToken = string;
const ORDER_TICKETING_ROLE_LABELS: Record<OrderTicketingRole, string> = {
  [UserRole.CUSTOMER]: 'Customer',
  [UserRole.FABRIC_SELLER]: 'Seller',
  [UserRole.FASHION_DESIGNER]: 'Designer',
  [UserRole.QA_TEAM]: 'QA',
  [UserRole.ADMINISTRATOR]: 'Admin',
};
type OrderTicketingSettings = {
  enabled: boolean;
  defaultVisibleToCustomer: boolean;
  allowVendorToVendorDirect: boolean;
  allowVendorToCustomerDirect: boolean;
  allowCustomerToVendorDirect: boolean;
  allowQaToVendorMessaging: boolean;
  allowQaToCustomerMessaging: boolean;
  autoAssignEnabled: boolean;
  autoAssignRole: TicketAssignmentRoleToken;
  slaResponseHours: number;
  escalationRole: TicketAssignmentRoleToken;
  escalationNotifyRoles: OrderTicketingRole[];
  recipientMatrix: Record<OrderTicketingRole, OrderTicketingRole[]>;
};
const DEFAULT_ORDER_TICKETING_SETTINGS: OrderTicketingSettings = {
  enabled: true,
  defaultVisibleToCustomer: false,
  allowVendorToVendorDirect: false,
  allowVendorToCustomerDirect: false,
  allowCustomerToVendorDirect: false,
  allowQaToVendorMessaging: true,
  allowQaToCustomerMessaging: true,
  autoAssignEnabled: true,
  autoAssignRole: UserRole.QA_TEAM,
  slaResponseHours: 24,
  escalationRole: UserRole.ADMINISTRATOR,
  escalationNotifyRoles: [UserRole.ADMINISTRATOR, UserRole.QA_TEAM],
  recipientMatrix: {
    [UserRole.CUSTOMER]: [UserRole.ADMINISTRATOR, UserRole.QA_TEAM],
    [UserRole.FABRIC_SELLER]: [UserRole.ADMINISTRATOR, UserRole.QA_TEAM],
    [UserRole.FASHION_DESIGNER]: [UserRole.ADMINISTRATOR, UserRole.QA_TEAM],
    [UserRole.QA_TEAM]: [
      UserRole.ADMINISTRATOR,
      UserRole.CUSTOMER,
      UserRole.FABRIC_SELLER,
      UserRole.FASHION_DESIGNER,
      UserRole.QA_TEAM,
    ],
    [UserRole.ADMINISTRATOR]: [
      UserRole.ADMINISTRATOR,
      UserRole.QA_TEAM,
      UserRole.CUSTOMER,
      UserRole.FABRIC_SELLER,
      UserRole.FASHION_DESIGNER,
    ],
  },
};

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};
const asRoleToken = (value: unknown): OrderTicketingRole | null => {
  const token = String(value || '').trim().toUpperCase();
  return ORDER_TICKETING_ROLES.includes(token as OrderTicketingRole) ? (token as OrderTicketingRole) : null;
};
const normalizeAdminRoleAssignmentToken = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  const match = /^ADMIN_ROLE:([0-9a-f-]{36})$/i.exec(raw);
  if (!match) return null;
  return `${ADMIN_ROLE_TOKEN_PREFIX}${String(match[1]).toLowerCase()}`;
};
const normalizeAssignmentRoleToken = (
  value: unknown,
  fallback: TicketAssignmentRoleToken
): TicketAssignmentRoleToken => {
  const standardRole = asRoleToken(value);
  if (standardRole) return standardRole;
  return normalizeAdminRoleAssignmentToken(value) || fallback;
};
const parseStoredAssignmentRoleToken = (value: unknown): TicketAssignmentRoleToken | null => {
  const standardRole = asRoleToken(value);
  if (standardRole) return standardRole;
  return normalizeAdminRoleAssignmentToken(value);
};
const parseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};
const parseRoleArray = (value: unknown): unknown[] => {
  const parsed = parseJsonArray(value);
  if (parsed.length > 0) return parsed;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (Array.isArray(objectValue.roles)) return objectValue.roles;
  }
  return [];
};
const dedupeRoleTokens = (input: unknown): OrderTicketingRole[] => {
  const rows = parseRoleArray(input);
  return Array.from(new Set(rows.map((entry) => asRoleToken(entry)).filter((entry): entry is OrderTicketingRole => Boolean(entry))));
};
const normalizeOrderTicketingSettings = (value: unknown): OrderTicketingSettings => {
  const source = parseJsonObject(value);
  const matrixSource = parseJsonObject(source.recipientMatrix);
  const normalized: OrderTicketingSettings = {
    enabled: source.enabled !== false,
    defaultVisibleToCustomer: Boolean(source.defaultVisibleToCustomer),
    allowVendorToVendorDirect: Boolean(source.allowVendorToVendorDirect),
    allowVendorToCustomerDirect: Boolean(source.allowVendorToCustomerDirect),
    allowCustomerToVendorDirect: Boolean(source.allowCustomerToVendorDirect),
    allowQaToVendorMessaging: source.allowQaToVendorMessaging !== false,
    allowQaToCustomerMessaging: source.allowQaToCustomerMessaging !== false,
    autoAssignEnabled: source.autoAssignEnabled !== false,
    autoAssignRole: normalizeAssignmentRoleToken(
      source.autoAssignRole,
      DEFAULT_ORDER_TICKETING_SETTINGS.autoAssignRole
    ),
    slaResponseHours: Math.max(1, Math.min(24 * 30, Number(source.slaResponseHours || DEFAULT_ORDER_TICKETING_SETTINGS.slaResponseHours))),
    escalationRole: normalizeAssignmentRoleToken(
      source.escalationRole,
      DEFAULT_ORDER_TICKETING_SETTINGS.escalationRole
    ),
    escalationNotifyRoles:
      dedupeRoleTokens(source.escalationNotifyRoles).length > 0
        ? dedupeRoleTokens(source.escalationNotifyRoles)
        : DEFAULT_ORDER_TICKETING_SETTINGS.escalationNotifyRoles,
    recipientMatrix: {
      [UserRole.CUSTOMER]:
        dedupeRoleTokens(matrixSource[UserRole.CUSTOMER]).length > 0
          ? dedupeRoleTokens(matrixSource[UserRole.CUSTOMER])
          : DEFAULT_ORDER_TICKETING_SETTINGS.recipientMatrix[UserRole.CUSTOMER],
      [UserRole.FABRIC_SELLER]:
        dedupeRoleTokens(matrixSource[UserRole.FABRIC_SELLER]).length > 0
          ? dedupeRoleTokens(matrixSource[UserRole.FABRIC_SELLER])
          : DEFAULT_ORDER_TICKETING_SETTINGS.recipientMatrix[UserRole.FABRIC_SELLER],
      [UserRole.FASHION_DESIGNER]:
        dedupeRoleTokens(matrixSource[UserRole.FASHION_DESIGNER]).length > 0
          ? dedupeRoleTokens(matrixSource[UserRole.FASHION_DESIGNER])
          : DEFAULT_ORDER_TICKETING_SETTINGS.recipientMatrix[UserRole.FASHION_DESIGNER],
      [UserRole.QA_TEAM]:
        dedupeRoleTokens(matrixSource[UserRole.QA_TEAM]).length > 0
          ? dedupeRoleTokens(matrixSource[UserRole.QA_TEAM])
          : DEFAULT_ORDER_TICKETING_SETTINGS.recipientMatrix[UserRole.QA_TEAM],
      [UserRole.ADMINISTRATOR]:
        dedupeRoleTokens(matrixSource[UserRole.ADMINISTRATOR]).length > 0
          ? dedupeRoleTokens(matrixSource[UserRole.ADMINISTRATOR])
          : DEFAULT_ORDER_TICKETING_SETTINGS.recipientMatrix[UserRole.ADMINISTRATOR],
    },
  };

  if (!normalized.allowVendorToVendorDirect) {
    normalized.recipientMatrix[UserRole.FABRIC_SELLER] = normalized.recipientMatrix[UserRole.FABRIC_SELLER].filter(
      (role) => role !== UserRole.FASHION_DESIGNER
    );
    normalized.recipientMatrix[UserRole.FASHION_DESIGNER] = normalized.recipientMatrix[UserRole.FASHION_DESIGNER].filter(
      (role) => role !== UserRole.FABRIC_SELLER
    );
  } else {
    if (!normalized.recipientMatrix[UserRole.FABRIC_SELLER].includes(UserRole.FASHION_DESIGNER)) {
      normalized.recipientMatrix[UserRole.FABRIC_SELLER].push(UserRole.FASHION_DESIGNER);
    }
    if (!normalized.recipientMatrix[UserRole.FASHION_DESIGNER].includes(UserRole.FABRIC_SELLER)) {
      normalized.recipientMatrix[UserRole.FASHION_DESIGNER].push(UserRole.FABRIC_SELLER);
    }
  }
  if (!normalized.allowVendorToCustomerDirect) {
    normalized.recipientMatrix[UserRole.FABRIC_SELLER] = normalized.recipientMatrix[UserRole.FABRIC_SELLER].filter(
      (role) => role !== UserRole.CUSTOMER
    );
    normalized.recipientMatrix[UserRole.FASHION_DESIGNER] = normalized.recipientMatrix[UserRole.FASHION_DESIGNER].filter(
      (role) => role !== UserRole.CUSTOMER
    );
  } else {
    if (!normalized.recipientMatrix[UserRole.FABRIC_SELLER].includes(UserRole.CUSTOMER)) {
      normalized.recipientMatrix[UserRole.FABRIC_SELLER].push(UserRole.CUSTOMER);
    }
    if (!normalized.recipientMatrix[UserRole.FASHION_DESIGNER].includes(UserRole.CUSTOMER)) {
      normalized.recipientMatrix[UserRole.FASHION_DESIGNER].push(UserRole.CUSTOMER);
    }
  }
  if (!normalized.allowCustomerToVendorDirect) {
    normalized.recipientMatrix[UserRole.CUSTOMER] = normalized.recipientMatrix[UserRole.CUSTOMER].filter(
      (role) => role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER
    );
  } else {
    if (!normalized.recipientMatrix[UserRole.CUSTOMER].includes(UserRole.FABRIC_SELLER)) {
      normalized.recipientMatrix[UserRole.CUSTOMER].push(UserRole.FABRIC_SELLER);
    }
    if (!normalized.recipientMatrix[UserRole.CUSTOMER].includes(UserRole.FASHION_DESIGNER)) {
      normalized.recipientMatrix[UserRole.CUSTOMER].push(UserRole.FASHION_DESIGNER);
    }
  }
  if (!normalized.allowQaToVendorMessaging) {
    normalized.recipientMatrix[UserRole.QA_TEAM] = normalized.recipientMatrix[UserRole.QA_TEAM].filter(
      (role) => role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER
    );
  }
  if (!normalized.allowQaToCustomerMessaging) {
    normalized.recipientMatrix[UserRole.QA_TEAM] = normalized.recipientMatrix[UserRole.QA_TEAM].filter(
      (role) => role !== UserRole.CUSTOMER
    );
  }
  return normalized;
};
async function ensureOrderTicketingSchema() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "OrderTicket" (
      "id" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "subject" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdById" TEXT NOT NULL,
      "isLocked" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderTicket_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderTicket_orderId_idx" ON "OrderTicket"("orderId","updatedAt")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "subject" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "assignedToRole" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicket" ADD COLUMN IF NOT EXISTS "escalationStatus" TEXT NOT NULL DEFAULT 'NONE'`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderTicket_status_idx" ON "OrderTicket"("status","updatedAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderTicket_dueAt_idx" ON "OrderTicket"("dueAt","escalatedAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "OrderTicketMessage" (
      "id" TEXT NOT NULL,
      "ticketId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "senderUserId" TEXT NOT NULL,
      "senderRole" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "recipientRoles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
      "isInternal" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderTicketMessage_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderTicketMessage" ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderTicketMessage_ticketId_idx" ON "OrderTicketMessage"("ticketId","createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderTicketMessage_orderId_idx" ON "OrderTicketMessage"("orderId","createdAt")`
  );
}
async function readOrderTicketingSettings(): Promise<OrderTicketingSettings> {
  await ensureOrderTicketingSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    ORDER_TICKETING_SETTINGS_KEY
  );
  return rows[0] ? normalizeOrderTicketingSettings(rows[0].value) : DEFAULT_ORDER_TICKETING_SETTINGS;
}
async function writeOrderTicketingSettings(payload: Partial<OrderTicketingSettings>, merge = true) {
  await ensureOrderTicketingSchema();
  const current = await readOrderTicketingSettings();
  const normalized = normalizeOrderTicketingSettings(merge ? { ...current, ...(payload || {}) } : payload || {});
  const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    ORDER_TICKETING_SETTINGS_KEY
  );
  if (existingRows[0]?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting" SET "value" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      JSON.stringify(normalized),
      String(existingRows[0].id)
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id","key","value","createdAt","updatedAt")
       VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
      randomUUID(),
      ORDER_TICKETING_SETTINGS_KEY,
      JSON.stringify(normalized)
    );
  }
  return normalized;
}

const resolveUsersForTicketRole = (
  role: OrderTicketingRole,
  participants: Record<OrderTicketingRole, Array<{ id: string; name: string }>>
) => participants[role] || [];

const pickDefaultAssignee = (
  role: OrderTicketingRole,
  participants: Record<OrderTicketingRole, Array<{ id: string; name: string }>>
) => {
  const pool = resolveUsersForTicketRole(role, participants);
  return pool.length > 0 ? pool[0] : null;
};
const resolveUsersForAssignmentRoleToken = (
  roleToken: TicketAssignmentRoleToken,
  context: Pick<OrderAccessContext, 'participantUsersByRole' | 'adminUsersByAdminRoleToken'>
) => {
  const standardRole = asRoleToken(roleToken);
  if (standardRole) {
    return resolveUsersForTicketRole(standardRole, context.participantUsersByRole);
  }
  const adminRoleToken = normalizeAdminRoleAssignmentToken(roleToken);
  if (!adminRoleToken) return [];
  const scopedAdmins = context.adminUsersByAdminRoleToken.get(adminRoleToken) || [];
  if (scopedAdmins.length > 0) return scopedAdmins;
  return context.participantUsersByRole[UserRole.ADMINISTRATOR] || [];
};
const pickDefaultAssigneeForRoleToken = (
  roleToken: TicketAssignmentRoleToken,
  context: Pick<OrderAccessContext, 'participantUsersByRole' | 'adminUsersByAdminRoleToken'>
) => {
  const users = resolveUsersForAssignmentRoleToken(roleToken, context);
  return users.length > 0 ? users[0] : null;
};

const roleLabelForToken = (
  roleToken: TicketAssignmentRoleToken,
  adminRoleNameByToken?: Map<string, string>
) => {
  const standardRole = asRoleToken(roleToken);
  if (standardRole) return ORDER_TICKETING_ROLE_LABELS[standardRole];
  const normalizedAdminRoleToken = normalizeAdminRoleAssignmentToken(roleToken);
  if (normalizedAdminRoleToken) {
    const adminRoleName = adminRoleNameByToken?.get(normalizedAdminRoleToken);
    return adminRoleName ? `Admin Role (${adminRoleName})` : 'Admin Role';
  }
  return 'Assigned Role';
};

const isTicketStatusActive = (status: unknown) => {
  const token = String(status || '').trim().toUpperCase();
  return token === 'OPEN' || token === 'PENDING';
};

const normalizeAttachmentUrls = (input: unknown) => {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .map((entry) => String(entry || '').trim())
    .filter((entry) => Boolean(entry))
    .slice(0, 12);
};
type OrderAccessContext = {
  orderId: string;
  orderNumber: string;
  customerUser: { id: string; firstName: string; lastName: string; email: string } | null;
  sellerUsers: Array<{ id: string; name: string }>;
  designerUsers: Array<{ id: string; name: string }>;
  qaUsers: Array<{ id: string; name: string }>;
  adminUsers: Array<{ id: string; name: string }>;
  adminUsersByAdminRoleToken: Map<string, Array<{ id: string; name: string }>>;
  adminRoleNameByToken: Map<string, string>;
  participantUsersByRole: Record<OrderTicketingRole, Array<{ id: string; name: string }>>;
};
const fullName = (first?: unknown, last?: unknown) => [String(first || '').trim(), String(last || '').trim()].filter(Boolean).join(' ').trim();
async function resolveOrderAccessContext(orderId: string, user: { id: string; role: UserRole }): Promise<OrderAccessContext> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      fabricOrder: {
        include: {
          seller: {
            select: {
              id: true,
              userId: true,
              businessName: true,
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      designOrder: {
        include: {
          designer: {
            select: {
              id: true,
              userId: true,
              businessName: true,
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      readyToWearItems: {
        include: {
          readyToWear: {
            include: {
              designer: {
                select: {
                  id: true,
                  userId: true,
                  businessName: true,
                  user: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
      qa: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!order) {
    throw Object.assign(new Error('Order not found.'), { status: 404 });
  }
  const sellerUsers = order.fabricOrder?.seller?.user
    ? [
        {
          id: String(order.fabricOrder.seller.user.id),
          name:
            String(order.fabricOrder.seller.businessName || '').trim() ||
            fullName(order.fabricOrder.seller.user.firstName, order.fabricOrder.seller.user.lastName) ||
            'Seller',
        },
      ]
    : [];
  const designersMap = new Map<string, { id: string; name: string }>();
  if (order.designOrder?.designer?.user) {
    designersMap.set(String(order.designOrder.designer.user.id), {
      id: String(order.designOrder.designer.user.id),
      name:
        String(order.designOrder.designer.businessName || '').trim() ||
        fullName(order.designOrder.designer.user.firstName, order.designOrder.designer.user.lastName) ||
        'Designer',
    });
  }
  for (const item of order.readyToWearItems || []) {
    const readyDesigner = item.readyToWear?.designer;
    if (!readyDesigner?.user?.id) continue;
    const readyDesignerId = String(readyDesigner.user.id);
    if (!designersMap.has(readyDesignerId)) {
      designersMap.set(readyDesignerId, {
        id: readyDesignerId,
        name:
          String(readyDesigner.businessName || '').trim() ||
          fullName(readyDesigner.user.firstName, readyDesigner.user.lastName) ||
          'Designer',
      });
    }
  }
  const designerUsers = Array.from(designersMap.values());
  const qaAssigned = order.qa?.user
    ? [{ id: String(order.qa.user.id), name: fullName(order.qa.user.firstName, order.qa.user.lastName) || 'QA' }]
    : [];
  const qaUsersRaw = await prisma.user.findMany({
    where: { role: UserRole.QA_TEAM, status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
  });
  let adminUsersDetailed: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    adminRoleId: string | null;
    adminRoleName: string | null;
  }> = [];
  try {
    adminUsersDetailed = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        adminRoleId: string | null;
        adminRoleName: string | null;
      }>
    >(
      `SELECT u."id",
              u."firstName",
              u."lastName",
              ap."adminRoleId",
              ar."name" AS "adminRoleName"
       FROM "User" u
       LEFT JOIN "AdminProfile" ap ON ap."userId" = u."id"
       LEFT JOIN "AdminRole" ar ON ar."id" = ap."adminRoleId"
       WHERE u."role" = $1
         AND u."status" = $2`,
      UserRole.ADMINISTRATOR,
      'ACTIVE'
    );
  } catch {
    const fallbackAdmins = await prisma.user.findMany({
      where: { role: UserRole.ADMINISTRATOR, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
    });
    adminUsersDetailed = fallbackAdmins.map((row) => ({
      id: String(row.id),
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      adminRoleId: null,
      adminRoleName: null,
    }));
  }
  const adminUsers = adminUsersDetailed.map((row) => ({
    id: String(row.id),
    name: fullName(row.firstName, row.lastName) || 'Admin',
  }));
  const adminUsersByAdminRoleToken = new Map<string, Array<{ id: string; name: string }>>();
  const adminRoleNameByToken = new Map<string, string>();
  for (const row of adminUsersDetailed) {
    const token = normalizeAdminRoleAssignmentToken(
      row.adminRoleId ? `${ADMIN_ROLE_TOKEN_PREFIX}${row.adminRoleId}` : null
    );
    if (!token) continue;
    const bucket = adminUsersByAdminRoleToken.get(token) || [];
    bucket.push({
      id: String(row.id),
      name: fullName(row.firstName, row.lastName) || 'Admin',
    });
    adminUsersByAdminRoleToken.set(token, bucket);
    if (row.adminRoleName) {
      adminRoleNameByToken.set(token, String(row.adminRoleName));
    }
  }
  const qaUsers = qaAssigned.length > 0
    ? qaAssigned
    : qaUsersRaw.map((row) => ({ id: String(row.id), name: fullName(row.firstName, row.lastName) || 'QA' }));

  const hasAccess =
    user.role === UserRole.ADMINISTRATOR ||
    (user.role === UserRole.CUSTOMER && String(order.customerId || '') === String(user.id)) ||
    (user.role === UserRole.FABRIC_SELLER && sellerUsers.some((entry) => entry.id === String(user.id))) ||
    (user.role === UserRole.FASHION_DESIGNER && designerUsers.some((entry) => entry.id === String(user.id))) ||
    (user.role === UserRole.QA_TEAM && qaUsers.some((entry) => entry.id === String(user.id)));
  if (!hasAccess) {
    throw Object.assign(new Error('You do not have permission to access this order ticket.'), { status: 403 });
  }

  const customerUser = order.customer
    ? {
        id: String(order.customer.id),
        firstName: String(order.customer.firstName || '').trim(),
        lastName: String(order.customer.lastName || '').trim(),
        email: String(order.customer.email || '').trim(),
      }
    : null;
  return {
    orderId: String(order.id),
    orderNumber: String(order.orderNumber || ''),
    customerUser,
    sellerUsers,
    designerUsers,
    qaUsers,
    adminUsers,
    adminUsersByAdminRoleToken,
    adminRoleNameByToken,
    participantUsersByRole: {
      [UserRole.CUSTOMER]:
        customerUser
          ? [{ id: customerUser.id, name: fullName(customerUser.firstName, customerUser.lastName) || 'Customer' }]
          : [],
      [UserRole.FABRIC_SELLER]: sellerUsers,
      [UserRole.FASHION_DESIGNER]: designerUsers,
      [UserRole.QA_TEAM]: qaUsers,
      [UserRole.ADMINISTRATOR]: adminUsers,
    },
  };
}
const resolveAllowedRecipientRoles = (
  senderRole: OrderTicketingRole,
  settings: OrderTicketingSettings,
  participants: Record<OrderTicketingRole, Array<{ id: string; name: string }>>
) => {
  const base = Array.from(new Set(settings.recipientMatrix[senderRole] || []));
  const filtered = base.filter((role) => (participants[role] || []).length > 0);
  if (!settings.allowVendorToVendorDirect && senderRole === UserRole.FABRIC_SELLER) {
    return filtered.filter((role) => role !== UserRole.FASHION_DESIGNER);
  }
  if (!settings.allowVendorToVendorDirect && senderRole === UserRole.FASHION_DESIGNER) {
    return filtered.filter((role) => role !== UserRole.FABRIC_SELLER);
  }
  if (!settings.allowVendorToCustomerDirect && (senderRole === UserRole.FABRIC_SELLER || senderRole === UserRole.FASHION_DESIGNER)) {
    return filtered.filter((role) => role !== UserRole.CUSTOMER);
  }
  if (!settings.allowCustomerToVendorDirect && senderRole === UserRole.CUSTOMER) {
    return filtered.filter((role) => role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER);
  }
  if (!settings.allowQaToVendorMessaging && senderRole === UserRole.QA_TEAM) {
    return filtered.filter((role) => role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER);
  }
  if (!settings.allowQaToCustomerMessaging && senderRole === UserRole.QA_TEAM) {
    return filtered.filter((role) => role !== UserRole.CUSTOMER);
  }
  return filtered;
};
const defaultRecipientRolesForSender = (senderRole: OrderTicketingRole, allowed: OrderTicketingRole[]) => {
  const preferred: OrderTicketingRole[] =
    senderRole === UserRole.CUSTOMER
      ? [UserRole.ADMINISTRATOR, UserRole.QA_TEAM]
      : senderRole === UserRole.FABRIC_SELLER || senderRole === UserRole.FASHION_DESIGNER
        ? [UserRole.ADMINISTRATOR, UserRole.QA_TEAM]
        : [UserRole.ADMINISTRATOR, UserRole.QA_TEAM];
  const selected = preferred.filter((role) => allowed.includes(role));
  return selected.length > 0 ? selected : allowed.slice(0, 1);
};
const canViewerSeeTicketMessage = (
  message: {
    senderUserId: string;
    recipientRoles: OrderTicketingRole[];
    visibleToCustomer: boolean;
  },
  viewerRole: OrderTicketingRole,
  viewerUserId: string
) => {
  if (viewerRole === UserRole.ADMINISTRATOR || viewerRole === UserRole.QA_TEAM) return true;
  if (String(message.senderUserId) === String(viewerUserId)) return true;
  if (viewerRole === UserRole.CUSTOMER) return message.visibleToCustomer;
  return message.recipientRoles.includes(viewerRole);
};

// Compatibility aliases for legacy order-create route variants.
router.use((req, _res, next) => {
  if (req.path === '/custom' || req.path === '/design' || req.path === '/custom-order') {
    req.url = req.url.replace(req.path, '/custom-design');
  } else if (req.path === '/ready' || req.path === '/readytowear' || req.path === '/ready-to-buy') {
    req.url = req.url.replace(req.path, '/ready-to-wear');
  } else if (req.path === '/fabric' || req.path === '/fabric-order' || req.path === '/fabric-only-order') {
    req.url = req.url.replace(req.path, '/fabric-only');
  }
  next();
});

const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';
const LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS = [' / ', '/', '|'] as const;
const normalizeReadyToWearSize = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeReadyToWearColor = (value: unknown) =>
  String(value || DEFAULT_READY_TO_WEAR_COLOR)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') || DEFAULT_READY_TO_WEAR_COLOR;
const encodeReadyToWearVariantKey = (size: unknown, color?: unknown) =>
  `${normalizeReadyToWearSize(size)}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizeReadyToWearColor(color)}`;
const decodeReadyToWearVariantKey = (variantKey: unknown) => {
  const raw = String(variantKey || '').trim().toUpperCase();
  if (raw.includes(READY_TO_WEAR_VARIANT_SEPARATOR)) {
    const [sizePart, colorPart] = raw.split(READY_TO_WEAR_VARIANT_SEPARATOR);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: encodeReadyToWearVariantKey(normalizedSize, normalizedColor),
    };
  }
  for (const separator of LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS) {
    if (!raw.includes(separator)) continue;
    const [sizePart, colorPart] = raw.split(separator);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: encodeReadyToWearVariantKey(normalizedSize, normalizedColor),
    };
  }
  const normalizedSize = normalizeReadyToWearSize(raw);
  return {
    size: normalizedSize,
    color: DEFAULT_READY_TO_WEAR_COLOR,
    variantKey: encodeReadyToWearVariantKey(normalizedSize, DEFAULT_READY_TO_WEAR_COLOR),
  };
};

router.use(authenticate);

router.get('/limits', async (_req, res, next) => {
  try {
    const workflowSettings = await readOrderWorkflowSettings();
    res.json({
      success: true,
      data: {
        ...(workflowSettings.orderLimits || {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getOrderMailer(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function getPostCheckoutOfferLines(limit = 3) {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        code: string;
        name: string;
        discountType: string;
        discountValue: number;
        maxDiscountUsd: number | null;
      }>
    >(
      `SELECT "code","name","discountType","discountValue","maxDiscountUsd"
       FROM "PromotionCode"
       WHERE "isActive" = true
         AND ("startsAt" IS NULL OR "startsAt" <= NOW())
         AND ("endsAt" IS NULL OR "endsAt" >= NOW())
       ORDER BY "updatedAt" DESC, "createdAt" DESC
       LIMIT ${Math.max(1, Math.min(5, Number(limit || 3)))}`
    );
    return rows.map((row) => {
      const discountText =
        String(row.discountType || '').toUpperCase() === 'FIXED'
          ? `$${Number(row.discountValue || 0).toFixed(2)} off`
          : `${Number(row.discountValue || 0)}% off`;
      const capText = row.maxDiscountUsd != null ? ` (up to $${Number(row.maxDiscountUsd).toFixed(2)})` : '';
      return `${String(row.code || '').toUpperCase()} — ${String(row.name || '').trim() || 'Special Offer'}: ${discountText}${capText}`;
    });
  } catch {
    return [] as string[];
  }
}

async function sendOrderConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  orderType: string;
  total: number;
  itemCount: number;
  paymentMethod?: string | null;
  shippingAddress?: string | null;
  promoCode?: string | null;
  discountUsd?: number | null;
  shippingCostUsd?: number | null;
  itemLines?: string[];
}) {
  const transporter = getOrderMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !params.to) {
    return;
  }
  const totalText = Number(params.total || 0).toFixed(2);
  const postCheckoutOfferLines = await getPostCheckoutOfferLines(3);
  const safeItemLines = Array.isArray(params.itemLines)
    ? params.itemLines
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const discountText =
    Number(params.discountUsd || 0) > 0
      ? `\nPromo Discount: -$${Number(params.discountUsd || 0).toFixed(2)}${
          params.promoCode ? ` (${String(params.promoCode).toUpperCase()})` : ''
        }`
      : '';
  const shippingText =
    Number(params.shippingCostUsd || 0) > 0
      ? `\nShipping: $${Number(params.shippingCostUsd || 0).toFixed(2)}`
      : Number(params.shippingCostUsd || 0) === 0
        ? '\nShipping: FREE'
        : '';
  const paymentMethodText = params.paymentMethod ? `\nPayment Method: ${String(params.paymentMethod)}` : '';
  const shippingAddressText = params.shippingAddress ? `\nShipping Address: ${String(params.shippingAddress)}` : '';
  const itemListText = safeItemLines.length > 0 ? `\nItems:\n- ${safeItemLines.join('\n- ')}` : '';
  const offerListText =
    postCheckoutOfferLines.length > 0 ? `\n\nNext-order offers:\n- ${postCheckoutOfferLines.join('\n- ')}` : '';
  await transporter.sendMail({
    from,
    to: params.to,
    subject: `Order Confirmation: ${params.orderNumber}`,
    text: `Thank you for your order!\n\nOrder Number: ${params.orderNumber}\nOrder Type: ${params.orderType}\nItems: ${params.itemCount}\nTotal: $${totalText}${discountText}${shippingText}${paymentMethodText}${shippingAddressText}${itemListText}${offerListText}\n\nYour order has been received and is now being processed.`,
    html: `
      <p>Thank you for your order.</p>
      <p><strong>Order Number:</strong> ${params.orderNumber}</p>
      <p><strong>Order Type:</strong> ${params.orderType}</p>
      <p><strong>Items:</strong> ${params.itemCount}</p>
      <p><strong>Total:</strong> $${totalText}</p>
      ${Number(params.discountUsd || 0) > 0 ? `<p><strong>Promo Discount:</strong> -$${Number(params.discountUsd || 0).toFixed(2)}${params.promoCode ? ` (${String(params.promoCode).toUpperCase()})` : ''}</p>` : ''}
      ${Number(params.shippingCostUsd || 0) > 0 || Number(params.shippingCostUsd || 0) === 0 ? `<p><strong>Shipping:</strong> ${Number(params.shippingCostUsd || 0) === 0 ? 'FREE' : `$${Number(params.shippingCostUsd || 0).toFixed(2)}`}</p>` : ''}
      ${params.paymentMethod ? `<p><strong>Payment Method:</strong> ${String(params.paymentMethod)}</p>` : ''}
      ${params.shippingAddress ? `<p><strong>Shipping Address:</strong> ${String(params.shippingAddress)}</p>` : ''}
      ${safeItemLines.length > 0 ? `<p><strong>Items:</strong></p><ul>${safeItemLines.map((line) => `<li>${line}</li>`).join('')}</ul>` : ''}
      ${postCheckoutOfferLines.length > 0 ? `<p><strong>Next-order offers:</strong></p><ul>${postCheckoutOfferLines.map((line) => `<li>${line}</li>`).join('')}</ul>` : ''}
      <p>Your order has been received and is now being processed.</p>
    `,
  });
}

function toStatusLabel(status: OrderStatus) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

async function sendLifecycleEmail(params: {
  to: string;
  subject: string;
  title: string;
  body: string;
}) {
  const transporter = getOrderMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !params.to) return;
  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: `${params.title}\n\n${params.body}`,
    html: `<p><strong>${params.title}</strong></p><p>${params.body}</p>`,
  });
}

async function notifyOrderLifecycle(params: {
  orderId: string;
  status: OrderStatus;
  notes?: string;
  actorRole: UserRole;
}) {
  try {
    const [settings, order, adminUsers] = await Promise.all([
      readOrderWorkflowSettings(),
      prisma.order.findUnique({
        where: { id: params.orderId },
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          fabricOrder: {
            include: {
              seller: {
                include: {
                  user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
              },
            },
          },
          designOrder: {
            include: {
              designer: {
                include: {
                  user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
              },
            },
          },
          readyToWearItems: {
            include: {
              readyToWear: {
                include: {
                  designer: {
                    include: {
                      user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
          qa: {
            include: {
              user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          role: UserRole.ADMINISTRATOR,
          status: 'ACTIVE',
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);
    if (!order) return;

    const statusLabel = toStatusLabel(params.status);
    const notificationTitle = `Order ${order.orderNumber} updated`;
    const roleBlurb = (() => {
      if (params.actorRole === UserRole.ADMINISTRATOR) return 'by Admin';
      if (params.actorRole === UserRole.QA_TEAM) return 'by QA';
      if (params.actorRole === UserRole.FABRIC_SELLER) return 'by Seller';
      if (params.actorRole === UserRole.FASHION_DESIGNER) return 'by Designer';
      return 'by Customer';
    })();
    const notificationBody = `Status is now "${statusLabel}" ${roleBlurb}.${params.notes ? ` Notes: ${params.notes}` : ''}`;

    const recipients: Array<{ role: 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'QA' | 'ADMIN'; userId: string; email: string }> = [];
    if (order.customer?.id && order.customer?.email) {
      recipients.push({ role: 'CUSTOMER', userId: order.customer.id, email: order.customer.email });
    }
    const sellerUser = order.fabricOrder?.seller?.user;
    if (sellerUser?.id && sellerUser?.email) {
      recipients.push({ role: 'SELLER', userId: sellerUser.id, email: sellerUser.email });
    }
    const designerUsers = new Map<string, { id: string; email: string }>();
    const designOwner = order.designOrder?.designer?.user;
    if (designOwner?.id && designOwner?.email) {
      designerUsers.set(designOwner.id, { id: designOwner.id, email: designOwner.email });
    }
    for (const item of order.readyToWearItems || []) {
      const readyDesigner = item.readyToWear?.designer?.user;
      if (readyDesigner?.id && readyDesigner?.email) {
        designerUsers.set(readyDesigner.id, { id: readyDesigner.id, email: readyDesigner.email });
      }
    }
    designerUsers.forEach((value) => {
      recipients.push({ role: 'DESIGNER', userId: value.id, email: value.email });
    });
    const qaUser = order.qa?.user;
    if (qaUser?.id && qaUser?.email) {
      recipients.push({ role: 'QA', userId: qaUser.id, email: qaUser.email });
    }
    for (const admin of adminUsers) {
      if (admin?.id && admin?.email) {
        recipients.push({ role: 'ADMIN', userId: admin.id, email: admin.email });
      }
    }

    const deduped = new Map<string, { role: 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'QA' | 'ADMIN'; userId: string; email: string }>();
    for (const recipient of recipients) {
      const key = `${recipient.role}:${recipient.userId}`;
      if (!deduped.has(key)) deduped.set(key, recipient);
    }

    const notifyTargets = Array.from(deduped.values()).filter((recipient) =>
      shouldNotifyRoleForStatus(settings, recipient.role, params.status)
    );

    await Promise.all(
      notifyTargets.map(async (recipient) => {
        await prisma.notification
          .create({
            data: {
              userId: recipient.userId,
              type: 'ORDER_UPDATE' as any,
              title: notificationTitle,
              message: notificationBody,
              relatedId: order.id,
              relatedType: 'ORDER',
            },
          })
          .catch(() => undefined);
      })
    );

    await Promise.all(
      notifyTargets.map((recipient) =>
        sendLifecycleEmail({
          to: recipient.email,
          subject: `${notificationTitle} · ${statusLabel}`,
          title: notificationTitle,
          body: notificationBody,
        }).catch(() => undefined)
      )
    );
    await emitPartnerOrderEvent('order.status.changed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: params.status,
      actorRole: params.actorRole,
      notes: params.notes || null,
      updatedAt: new Date().toISOString(),
      source: 'platform',
    }).catch(() => undefined);
  } catch (error) {
    console.error('Failed to send lifecycle notifications:', error);
  }
}

function canAutoProcessOrder(params: {
  processingMode: 'MANUAL' | 'AUTO';
  criteria: {
    requirePaid: boolean;
    requireShippingProvider: boolean;
    requireCustomerAddress: boolean;
    requireItems: boolean;
  };
  isPaymentConfirmed: boolean;
  hasShippingProvider: boolean;
  hasShippingAddress: boolean;
  hasItems: boolean;
}) {
  if (params.processingMode !== 'AUTO') return false;
  if (params.criteria.requirePaid && !params.isPaymentConfirmed) return false;
  if (params.criteria.requireShippingProvider && !params.hasShippingProvider) return false;
  if (params.criteria.requireCustomerAddress && !params.hasShippingAddress) return false;
  if (params.criteria.requireItems && !params.hasItems) return false;
  return true;
}

const orderTicketingSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    defaultVisibleToCustomer: z.boolean().optional(),
    allowVendorToVendorDirect: z.boolean().optional(),
    allowVendorToCustomerDirect: z.boolean().optional(),
    allowCustomerToVendorDirect: z.boolean().optional(),
    allowQaToVendorMessaging: z.boolean().optional(),
    allowQaToCustomerMessaging: z.boolean().optional(),
    autoAssignEnabled: z.boolean().optional(),
    autoAssignRole: z.string().trim().optional(),
    slaResponseHours: z.number().int().min(1).max(24 * 30).optional(),
    escalationRole: z.string().trim().optional(),
    escalationNotifyRoles: z.array(z.string()).optional(),
    recipientMatrix: z.record(z.array(z.string())).optional(),
  })
  .strict();

const orderTicketMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    recipientRoles: z.array(z.string()).max(8).optional(),
    attachments: z.array(z.string().trim().max(4096)).max(12).optional(),
    visibleToCustomer: z.boolean().optional(),
    subject: z.string().trim().max(240).optional(),
  })
  .strict();

const ticketStatusUpdateSchema = z
  .object({
    status: z.enum(ORDER_TICKET_STATUSES),
  })
  .strict();

async function getLatestOrderTicket(orderId: string) {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      orderId: string;
      subject: string | null;
      status: string;
      createdById: string;
      isLocked: boolean;
      assignedToUserId: string | null;
      assignedToRole: string | null;
      dueAt: Date | null;
      escalatedAt: Date | null;
      escalationStatus: string | null;
      lastMessageAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    `SELECT "id","orderId","subject","status","createdById","isLocked","assignedToUserId","assignedToRole","dueAt","escalatedAt","escalationStatus","lastMessageAt","createdAt","updatedAt"
     FROM "OrderTicket"
     WHERE "orderId" = $1
     ORDER BY "updatedAt" DESC, "createdAt" DESC
     LIMIT 1`,
    orderId
  );
  if (!rows[0]) return null;
  return {
    id: String(rows[0].id),
    orderId: String(rows[0].orderId),
    subject: rows[0].subject ? String(rows[0].subject) : null,
    status: ORDER_TICKET_STATUSES.includes(String(rows[0].status || '').toUpperCase() as OrderTicketStatus)
      ? (String(rows[0].status || '').toUpperCase() as OrderTicketStatus)
      : 'OPEN',
    createdById: String(rows[0].createdById),
    isLocked: Boolean(rows[0].isLocked),
    assignedToUserId: rows[0].assignedToUserId ? String(rows[0].assignedToUserId) : null,
    assignedToRole: parseStoredAssignmentRoleToken(rows[0].assignedToRole),
    dueAt: rows[0].dueAt ? new Date(rows[0].dueAt).toISOString() : null,
    escalatedAt: rows[0].escalatedAt ? new Date(rows[0].escalatedAt).toISOString() : null,
    escalationStatus: String(rows[0].escalationStatus || 'NONE').toUpperCase(),
    lastMessageAt: rows[0].lastMessageAt ? new Date(rows[0].lastMessageAt).toISOString() : null,
    createdAt: new Date(rows[0].createdAt || Date.now()).toISOString(),
    updatedAt: new Date(rows[0].updatedAt || Date.now()).toISOString(),
  };
}

async function createOrderTicket(params: {
  orderId: string;
  createdById: string;
  subject?: string;
  settings: OrderTicketingSettings;
  orderContext: OrderAccessContext;
}) {
  const autoAssignRole = params.settings.autoAssignEnabled ? params.settings.autoAssignRole : null;
  const assignee = autoAssignRole
    ? pickDefaultAssigneeForRoleToken(autoAssignRole, {
        participantUsersByRole: params.orderContext.participantUsersByRole,
        adminUsersByAdminRoleToken: params.orderContext.adminUsersByAdminRoleToken,
      })
    : null;
  const dueAtIso = new Date(Date.now() + Number(params.settings.slaResponseHours || 24) * 60 * 60 * 1000).toISOString();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrderTicket" ("id","orderId","subject","status","createdById","isLocked","assignedToUserId","assignedToRole","dueAt","lastMessageAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,'OPEN',$4,false,$5,$6,$7::timestamp,NOW(),NOW(),NOW())`,
    id,
    params.orderId,
    params.subject ? String(params.subject).slice(0, 240) : null,
    params.createdById,
    assignee?.id ? String(assignee.id) : null,
    autoAssignRole,
    dueAtIso
  );
  return getLatestOrderTicket(params.orderId);
}

async function runTicketEscalationIfDue(params: {
  ticket: any;
  settings: OrderTicketingSettings;
  orderContext: OrderAccessContext;
}) {
  const ticket = params.ticket;
  if (!ticket || !isTicketStatusActive(ticket.status)) return ticket;
  const dueAtMs = ticket.dueAt ? Number(new Date(ticket.dueAt)) : Number.NaN;
  if (!Number.isFinite(dueAtMs)) {
    const nextDueAtIso = new Date(Date.now() + Number(params.settings.slaResponseHours || 24) * 60 * 60 * 1000).toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE "OrderTicket" SET "dueAt" = $2::timestamp, "updatedAt" = NOW() WHERE "id" = $1`,
      ticket.id,
      nextDueAtIso
    );
    return getLatestOrderTicket(ticket.orderId);
  }
  if (ticket.escalatedAt || Date.now() <= dueAtMs) return ticket;

  const escalationRole = params.settings.escalationRole || UserRole.ADMINISTRATOR;
  const assignee = pickDefaultAssigneeForRoleToken(escalationRole, {
    participantUsersByRole: params.orderContext.participantUsersByRole,
    adminUsersByAdminRoleToken: params.orderContext.adminUsersByAdminRoleToken,
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "OrderTicket"
     SET "escalatedAt" = NOW(),
         "escalationStatus" = 'ESCALATED',
         "assignedToRole" = COALESCE("assignedToRole", $2),
         "assignedToUserId" = COALESCE("assignedToUserId", $3),
         "updatedAt" = NOW()
     WHERE "id" = $1`,
    ticket.id,
    escalationRole,
    assignee?.id ? String(assignee.id) : null
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrderTicketMessage"
      ("id","ticketId","orderId","senderUserId","senderRole","body","recipientRoles","visibleToCustomer","isInternal","attachments","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,false,true,'[]'::jsonb,NOW())`,
    randomUUID(),
    ticket.id,
    params.orderContext.orderId,
    assignee?.id || params.orderContext.adminUsers[0]?.id || params.orderContext.qaUsers[0]?.id || ticket.createdById,
    UserRole.ADMINISTRATOR,
    `Ticket escalated after SLA deadline. Routed to ${roleLabelForToken(
      escalationRole,
      params.orderContext.adminRoleNameByToken
    )}.`,
    JSON.stringify([UserRole.ADMINISTRATOR, UserRole.QA_TEAM])
  );

  const notifyRoles = params.settings.escalationNotifyRoles || [UserRole.ADMINISTRATOR, UserRole.QA_TEAM];
  const notifyUserIds = Array.from(
    new Set(
      notifyRoles
        .flatMap((role) => resolveUsersForTicketRole(role as OrderTicketingRole, params.orderContext.participantUsersByRole))
        .map((entry) => String(entry.id || ''))
        .filter(Boolean)
    )
  );
  await Promise.all(
    notifyUserIds.map((userId) =>
      prisma.notification
        .create({
          data: {
            userId,
            type: 'SYSTEM' as any,
            title: `Ticket escalation • ${params.orderContext.orderNumber}`,
            message: `Order ticket exceeded ${Number(params.settings.slaResponseHours || 24)}h SLA and has been escalated.`,
            relatedId: params.orderContext.orderId,
            relatedType: 'ORDER',
          },
        })
        .catch(() => undefined)
    )
  );
  return getLatestOrderTicket(ticket.orderId);
}

async function readOrderTicketThread(params: {
  orderId: string;
  viewerId: string;
  viewerRole: OrderTicketingRole;
  createIfMissing?: boolean;
  ticketSubject?: string;
  orderContext: OrderAccessContext;
  settings: OrderTicketingSettings;
}) {
  await ensureOrderTicketingSchema();
  let ticket = await getLatestOrderTicket(params.orderId);
  if (!ticket && params.createIfMissing) {
    ticket = await createOrderTicket({
      orderId: params.orderId,
      createdById: params.viewerId,
      subject: params.ticketSubject,
      settings: params.settings,
      orderContext: params.orderContext,
    });
  }
  if (!ticket) {
    return {
      ticket: null,
      messages: [] as any[],
    };
  }
  ticket = await runTicketEscalationIfDue({
    ticket,
    settings: params.settings,
    orderContext: params.orderContext,
  });
  if (!ticket) {
    return {
      ticket: null,
      messages: [] as any[],
    };
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      ticketId: string;
      orderId: string;
      senderUserId: string;
      senderRole: string;
      body: string;
      recipientRoles: unknown;
      attachments: unknown;
      visibleToCustomer: boolean;
      isInternal: boolean;
      createdAt: Date;
    }>
  >(
    `SELECT "id","ticketId","orderId","senderUserId","senderRole","body","recipientRoles","attachments","visibleToCustomer","isInternal","createdAt"
     FROM "OrderTicketMessage"
     WHERE "ticketId" = $1
     ORDER BY "createdAt" ASC`,
    ticket.id
  );
  const senderIds = Array.from(new Set(rows.map((entry) => String(entry.senderUserId || '')).filter(Boolean)));
  const senderUsers = senderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, firstName: true, lastName: true, role: true },
      })
    : [];
  const senderMap = new Map(
    senderUsers.map((row) => [
      String(row.id),
      {
        role: asRoleToken(row.role) || UserRole.ADMINISTRATOR,
        displayName: fullName(row.firstName, row.lastName) || ORDER_TICKETING_ROLE_LABELS[(asRoleToken(row.role) || UserRole.ADMINISTRATOR) as OrderTicketingRole],
      },
    ])
  );
  const customerDisplayName =
    params.orderContext.customerUser
      ? fullName(params.orderContext.customerUser.firstName, params.orderContext.customerUser.lastName) || 'Customer'
      : 'Customer';
  const messages = rows
    .map((entry) => {
      const senderRole = asRoleToken(entry.senderRole) || UserRole.ADMINISTRATOR;
      const recipientRoles = dedupeRoleTokens(entry.recipientRoles);
      const sender = senderMap.get(String(entry.senderUserId || ''));
      const displayName =
        senderRole === UserRole.CUSTOMER
          ? customerDisplayName
          : sender?.displayName || ORDER_TICKETING_ROLE_LABELS[senderRole];
      return {
        id: String(entry.id),
        ticketId: String(entry.ticketId),
        orderId: String(entry.orderId),
        senderUserId: String(entry.senderUserId),
        senderRole,
        senderDisplayName: displayName,
        body: String(entry.body || ''),
        recipientRoles,
        attachments: normalizeAttachmentUrls(parseJsonArray(entry.attachments)),
        visibleToCustomer: Boolean(entry.visibleToCustomer),
        isInternal: Boolean(entry.isInternal),
        createdAt: new Date(entry.createdAt || Date.now()).toISOString(),
      };
    })
    .filter((entry) =>
      canViewerSeeTicketMessage(
        {
          senderUserId: entry.senderUserId,
          recipientRoles: entry.recipientRoles,
          visibleToCustomer: entry.visibleToCustomer,
        },
        params.viewerRole,
        params.viewerId
      )
    );
  return {
    ticket,
    messages,
  };
}

router.get(
  '/admin/ticketing/settings',
  authorizePermissions(Permissions.ORDERS_MANAGE),
  async (_req, res, next) => {
    try {
      const settings = await readOrderTicketingSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/ticketing/settings',
  authorizePermissions(Permissions.ORDERS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = orderTicketingSettingsSchema.parse(req.body || {});
      const settings = await writeOrderTicketingSettings(payload as any, false);
      res.json({ success: true, data: settings, message: 'Order ticketing settings updated.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

router.patch(
  '/admin/ticketing/settings',
  authorizePermissions(Permissions.ORDERS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = orderTicketingSettingsSchema.parse(req.body || {});
      const settings = await writeOrderTicketingSettings(payload as any, true);
      res.json({ success: true, data: settings, message: 'Order ticketing settings saved.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

router.get(
  '/admin/tickets',
  authorizePermissions(Permissions.ORDERS_MANAGE),
  async (req, res, next) => {
    try {
      await ensureOrderTicketingSchema();
      const query = z
        .object({
          search: z.string().trim().max(120).optional(),
          status: z.string().trim().max(30).optional(),
          assignedRole: z.string().trim().max(96).optional(),
          escalated: z.union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')]).optional(),
          page: z.coerce.number().int().min(1).max(500).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query || {});
      const page = Math.max(1, Number(query.page || 1));
      const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
      const offset = (page - 1) * limit;
      const search = String(query.search || '').trim().toLowerCase();
      const statusFilter = String(query.status || '').trim().toUpperCase();
      const assignedRoleFilterRaw = String(query.assignedRole || '').trim();
      const assignedRoleFilter = assignedRoleFilterRaw
        ? normalizeAssignmentRoleToken(assignedRoleFilterRaw, assignedRoleFilterRaw)
        : null;
      const escalatedFilter =
        query.escalated === 'true' || query.escalated === '1'
          ? true
          : query.escalated === 'false' || query.escalated === '0'
            ? false
            : null;

      const whereClauses: string[] = [];
      const values: unknown[] = [];
      if (search) {
        values.push(`%${search}%`);
        whereClauses.push(
          `(LOWER(COALESCE(t."subject", '')) LIKE $${values.length}
            OR LOWER(COALESCE(o."orderNumber", '')) LIKE $${values.length}
            OR LOWER(COALESCE(c."firstName", '') || ' ' || COALESCE(c."lastName", '')) LIKE $${values.length})`
        );
      }
      if (statusFilter) {
        values.push(statusFilter);
        whereClauses.push(`UPPER(COALESCE(t."status", 'OPEN')) = $${values.length}`);
      }
      if (assignedRoleFilter) {
        values.push(assignedRoleFilter);
        whereClauses.push(`COALESCE(t."assignedToRole", '') = $${values.length}`);
      }
      if (escalatedFilter !== null) {
        whereClauses.push(escalatedFilter ? `t."escalatedAt" IS NOT NULL` : `t."escalatedAt" IS NULL`);
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          orderId: string;
          subject: string | null;
          status: string;
          assignedToUserId: string | null;
          assignedToRole: string | null;
          dueAt: Date | null;
          escalatedAt: Date | null;
          escalationStatus: string | null;
          updatedAt: Date;
          createdAt: Date;
          orderNumber: string | null;
          orderStatus: string | null;
          customerName: string | null;
          messageCount: number;
        }>
      >(
        `SELECT
          t."id",
          t."orderId",
          t."subject",
          t."status",
          t."assignedToUserId",
          t."assignedToRole",
          t."dueAt",
          t."escalatedAt",
          t."escalationStatus",
          t."updatedAt",
          t."createdAt",
          o."orderNumber",
          o."status" AS "orderStatus",
          TRIM(COALESCE(c."firstName",'') || ' ' || COALESCE(c."lastName",'')) AS "customerName",
          COALESCE(COUNT(m."id"), 0)::int AS "messageCount"
         FROM "OrderTicket" t
         LEFT JOIN "Order" o ON o."id" = t."orderId"
         LEFT JOIN "User" c ON c."id" = o."customerId"
         LEFT JOIN "OrderTicketMessage" m ON m."ticketId" = t."id"
         ${whereSql}
         GROUP BY t."id", o."id", c."id"
         ORDER BY t."updatedAt" DESC
         LIMIT ${limit} OFFSET ${offset}`,
        ...values
      );
      const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(1)::int AS "count"
         FROM "OrderTicket" t
         LEFT JOIN "Order" o ON o."id" = t."orderId"
         LEFT JOIN "User" c ON c."id" = o."customerId"
         ${whereSql}`,
        ...values
      );
      const total = Number(countRows[0]?.count || 0);

      const ticketIds = rows.map((row) => String(row.id || '')).filter(Boolean);
      const previews = ticketIds.length
        ? await prisma.$queryRawUnsafe<Array<{ ticketId: string; body: string }>>(
            `SELECT DISTINCT ON ("ticketId") "ticketId","body"
             FROM "OrderTicketMessage"
             WHERE "ticketId" = ANY($1::text[])
             ORDER BY "ticketId","createdAt" DESC`,
            ticketIds
          )
        : [];
      const previewMap = new Map(previews.map((row) => [String(row.ticketId || ''), String(row.body || '')]));

      const assigneeIds = Array.from(new Set(rows.map((row) => String(row.assignedToUserId || '')).filter(Boolean)));
      const assignees = assigneeIds.length
        ? await prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
      const assigneeMap = new Map(assignees.map((row) => [String(row.id), fullName(row.firstName, row.lastName) || 'Assigned User']));

      res.json({
        success: true,
        data: rows.map((row) => ({
          id: String(row.id),
          orderId: String(row.orderId),
          orderNumber: String(row.orderNumber || ''),
          orderStatus: String(row.orderStatus || ''),
          subject: row.subject ? String(row.subject) : '',
          status: String(row.status || 'OPEN').toUpperCase(),
          assignedToRole: parseStoredAssignmentRoleToken(row.assignedToRole),
          assignedToUserId: row.assignedToUserId ? String(row.assignedToUserId) : null,
          assignedToUserName: row.assignedToUserId ? assigneeMap.get(String(row.assignedToUserId)) || '' : '',
          customerName: String(row.customerName || '').trim() || 'Customer',
          dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
          escalatedAt: row.escalatedAt ? new Date(row.escalatedAt).toISOString() : null,
          escalationStatus: String(row.escalationStatus || 'NONE').toUpperCase(),
          isOverdue: Boolean(row.dueAt && new Date(row.dueAt).getTime() < Date.now() && !row.escalatedAt),
          messageCount: Number(row.messageCount || 0),
          lastMessagePreview: previewMap.get(String(row.id)) || '',
          updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
          createdAt: new Date(row.createdAt || Date.now()).toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

router.patch(
  '/admin/tickets/:ticketId/assign',
  authorizePermissions(Permissions.ORDERS_MANAGE),
  async (req, res, next) => {
    try {
      await ensureOrderTicketingSchema();
      const payload = z
        .object({
          assignedToRole: z.string().trim().optional(),
          assignedToUserId: z.string().trim().optional(),
          dueAt: z.string().trim().optional(),
        })
        .strict()
        .parse(req.body || {});
      const ticketRows = await prisma.$queryRawUnsafe<
        Array<{ id: string; orderId: string; assignedToRole: string | null }>
      >(
        `SELECT "id","orderId","assignedToRole"
         FROM "OrderTicket"
         WHERE "id" = $1
         LIMIT 1`,
        String(req.params.ticketId || '')
      );
      const ticket = ticketRows[0];
      if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

      const context = await resolveOrderAccessContext(String(ticket.orderId), {
        id: req.user!.id,
        role: req.user!.role,
      });
      const currentRoleToken = parseStoredAssignmentRoleToken(ticket.assignedToRole);
      const nextRole = payload.assignedToRole
        ? normalizeAssignmentRoleToken(
            payload.assignedToRole,
            currentRoleToken || DEFAULT_ORDER_TICKETING_SETTINGS.autoAssignRole
          )
        : currentRoleToken;
      const eligibleUsers = nextRole
        ? resolveUsersForAssignmentRoleToken(nextRole, {
            participantUsersByRole: context.participantUsersByRole,
            adminUsersByAdminRoleToken: context.adminUsersByAdminRoleToken,
          })
        : [];
      const nextUserId = payload.assignedToUserId
        ? String(payload.assignedToUserId)
        : payload.assignedToRole
          ? eligibleUsers[0]?.id || null
          : undefined;
      if (payload.assignedToUserId && nextRole && !eligibleUsers.some((entry) => String(entry.id) === String(payload.assignedToUserId))) {
        return res.status(400).json({
          success: false,
          message: `Assigned user is not valid for role ${roleLabelForToken(nextRole, context.adminRoleNameByToken)}.`,
        });
      }
      const dueAtDate = payload.dueAt ? new Date(payload.dueAt) : null;
      if (dueAtDate && !Number.isFinite(dueAtDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid dueAt date value.' });
      }
      const dueAtIso = dueAtDate ? dueAtDate.toISOString() : null;
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderTicket"
         SET "assignedToRole" = COALESCE($2, "assignedToRole"),
             "assignedToUserId" = CASE WHEN $3::text IS NULL THEN "assignedToUserId" ELSE $3 END,
             "dueAt" = COALESCE($4::timestamp, "dueAt"),
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(ticket.id),
        nextRole || null,
        nextUserId === undefined ? null : nextUserId,
        dueAtIso
      );
      const refreshed = await getLatestOrderTicket(String(ticket.orderId));
      res.json({ success: true, data: refreshed, message: 'Ticket assignment updated.' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

router.get(
  '/:id/ticketing',
  authorizePermissions(Permissions.ORDERS_READ_SELF, Permissions.ORDERS_READ_ASSIGNED, Permissions.ORDERS_READ_ALL),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const userRole = asRoleToken(user.role);
      if (!userRole) {
        return res.status(403).json({ success: false, message: 'Unsupported role for ticketing.' });
      }
      const settings = await readOrderTicketingSettings();
      const context = await resolveOrderAccessContext(String(req.params.id || ''), { id: user.id, role: user.role });
      const thread = await readOrderTicketThread({
        orderId: context.orderId,
        viewerId: user.id,
        viewerRole: userRole,
        orderContext: context,
        settings,
      });
      const allowedRecipientRoles = resolveAllowedRecipientRoles(userRole, settings, context.participantUsersByRole);
      const canPost =
        settings.enabled &&
        (userRole !== UserRole.CUSTOMER || settings.allowCustomerToVendorDirect || settings.recipientMatrix[UserRole.CUSTOMER].length > 0);
      const participants = Object.entries(context.participantUsersByRole).map(([role, users]) => ({
        role,
        label: ORDER_TICKETING_ROLE_LABELS[role as OrderTicketingRole],
        users: (users || []).map((entry) => ({ id: entry.id, name: entry.name })),
      }));
      res.json({
        success: true,
        data: {
          orderId: context.orderId,
          orderNumber: context.orderNumber,
          ticket: thread.ticket,
          messages: thread.messages,
          participants,
          permissions: {
            canPost,
            canManageTicket: userRole === UserRole.ADMINISTRATOR || userRole === UserRole.QA_TEAM,
            canControlCustomerVisibility: userRole === UserRole.ADMINISTRATOR || userRole === UserRole.QA_TEAM,
            allowedRecipientRoles,
          },
          settings: {
            enabled: settings.enabled,
            defaultVisibleToCustomer: settings.defaultVisibleToCustomer,
            allowVendorToVendorDirect: settings.allowVendorToVendorDirect,
            autoAssignEnabled: settings.autoAssignEnabled,
            autoAssignRole: settings.autoAssignRole,
            slaResponseHours: settings.slaResponseHours,
            escalationRole: settings.escalationRole,
            escalationNotifyRoles: settings.escalationNotifyRoles,
          },
        },
      });
    } catch (error: any) {
      if (error?.status) {
        return res.status(error.status).json({ success: false, message: error.message || 'Unable to load order ticket.' });
      }
      next(error);
    }
  }
);

router.post(
  '/:id/ticketing/messages',
  authorizePermissions(Permissions.ORDERS_READ_SELF, Permissions.ORDERS_READ_ASSIGNED, Permissions.ORDERS_READ_ALL),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const userRole = asRoleToken(user.role);
      if (!userRole) return res.status(403).json({ success: false, message: 'Unsupported role for ticketing.' });
      const payload = orderTicketMessageSchema.parse(req.body || {});
      const settings = await readOrderTicketingSettings();
      if (!settings.enabled) {
        return res.status(403).json({ success: false, message: 'Order ticketing is currently disabled by admin.' });
      }
      const context = await resolveOrderAccessContext(String(req.params.id || ''), { id: user.id, role: user.role });
      const allowedRecipientRoles = resolveAllowedRecipientRoles(userRole, settings, context.participantUsersByRole);
      if (allowedRecipientRoles.length === 0) {
        return res.status(403).json({ success: false, message: 'No valid recipients are available for this order.' });
      }
      const requestedRecipientRoles = dedupeRoleTokens(payload.recipientRoles || []);
      const recipientRoles =
        requestedRecipientRoles.length > 0
          ? requestedRecipientRoles.filter((role) => allowedRecipientRoles.includes(role))
          : defaultRecipientRolesForSender(userRole, allowedRecipientRoles);
      if (recipientRoles.length === 0) {
        return res.status(400).json({
          success: false,
          message: `No valid recipients selected. Allowed recipients: ${allowedRecipientRoles.map((role) => ORDER_TICKETING_ROLE_LABELS[role]).join(', ')}`,
        });
      }

      let visibleToCustomer = userRole === UserRole.CUSTOMER;
      if (userRole === UserRole.ADMINISTRATOR || userRole === UserRole.QA_TEAM) {
        visibleToCustomer =
          payload.visibleToCustomer === undefined ? settings.defaultVisibleToCustomer : Boolean(payload.visibleToCustomer);
      } else if (
        (userRole === UserRole.FABRIC_SELLER || userRole === UserRole.FASHION_DESIGNER) &&
        settings.allowVendorToCustomerDirect &&
        recipientRoles.includes(UserRole.CUSTOMER)
      ) {
        visibleToCustomer = true;
      }
      if (visibleToCustomer && !recipientRoles.includes(UserRole.CUSTOMER) && (context.participantUsersByRole[UserRole.CUSTOMER] || []).length > 0) {
        recipientRoles.push(UserRole.CUSTOMER);
      }

      const threadBefore = await readOrderTicketThread({
        orderId: context.orderId,
        viewerId: user.id,
        viewerRole: userRole,
        orderContext: context,
        createIfMissing: true,
        ticketSubject: payload.subject,
        settings,
      });
      const ticket = threadBefore.ticket;
      if (!ticket) {
        return res.status(500).json({ success: false, message: 'Unable to initialize order ticket.' });
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OrderTicketMessage"
          ("id","ticketId","orderId","senderUserId","senderRole","body","recipientRoles","visibleToCustomer","isInternal","attachments","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,NOW())`,
        randomUUID(),
        ticket.id,
        context.orderId,
        user.id,
        userRole,
        payload.body.trim(),
        JSON.stringify(recipientRoles),
        visibleToCustomer,
        !visibleToCustomer,
        JSON.stringify(normalizeAttachmentUrls(payload.attachments || []))
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderTicket"
         SET "updatedAt" = NOW(),
             "lastMessageAt" = NOW(),
             "subject" = COALESCE("subject", $2),
             "dueAt" = (NOW() + ($3 || ' hours')::interval),
             "escalationStatus" = CASE WHEN "escalatedAt" IS NULL THEN "escalationStatus" ELSE 'RESPONDED' END
         WHERE "id" = $1`,
        ticket.id,
        payload.subject ? String(payload.subject).trim().slice(0, 240) : null,
        String(Math.max(1, Number(settings.slaResponseHours || 24)))
      );

      const recipientUsers = recipientRoles.flatMap((role) => context.participantUsersByRole[role] || []);
      const uniqueRecipientIds = Array.from(
        new Set(recipientUsers.map((entry) => String(entry.id || '')).filter((id) => id && id !== String(user.id)))
      );
      await Promise.all(
        uniqueRecipientIds.map((targetUserId) =>
          prisma.notification
            .create({
              data: {
                userId: targetUserId,
                type: 'NEW_MESSAGE' as any,
                title: `Order Ticket • ${context.orderNumber}`,
                message: payload.body.trim().slice(0, 240),
                relatedId: context.orderId,
                relatedType: 'ORDER',
              },
            })
            .catch(() => undefined)
        )
      );

      const threadAfter = await readOrderTicketThread({
        orderId: context.orderId,
        viewerId: user.id,
        viewerRole: userRole,
        orderContext: context,
        settings,
      });
      res.status(201).json({
        success: true,
        message: 'Ticket message sent.',
        data: {
          orderId: context.orderId,
          orderNumber: context.orderNumber,
          ticket: threadAfter.ticket,
          messages: threadAfter.messages,
        },
      });
    } catch (error: any) {
      if (error?.status) {
        return res.status(error.status).json({ success: false, message: error.message || 'Unable to send ticket message.' });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

router.patch(
  '/:id/ticketing/status',
  authorizePermissions(Permissions.ORDERS_READ_ASSIGNED, Permissions.ORDERS_READ_ALL, Permissions.ORDERS_UPDATE_ASSIGNED, Permissions.ORDERS_UPDATE_ALL),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const roleToken = asRoleToken(user.role);
      if (!roleToken || (roleToken !== UserRole.ADMINISTRATOR && roleToken !== UserRole.QA_TEAM)) {
        return res.status(403).json({ success: false, message: 'Only Admin/QA can update ticket status.' });
      }
      const payload = ticketStatusUpdateSchema.parse(req.body || {});
      const context = await resolveOrderAccessContext(String(req.params.id || ''), { id: user.id, role: user.role });
      const ticket = await getLatestOrderTicket(context.orderId);
      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Order ticket not found.' });
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderTicket"
         SET "status" = $2,
             "updatedAt" = NOW(),
             "escalationStatus" = CASE WHEN $2 IN ('RESOLVED','CLOSED') THEN 'RESOLVED' ELSE COALESCE("escalationStatus",'NONE') END
         WHERE "id" = $1`,
        ticket.id,
        payload.status
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OrderTicketMessage"
          ("id","ticketId","orderId","senderUserId","senderRole","body","recipientRoles","visibleToCustomer","isInternal","attachments","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'[]'::jsonb,NOW())`,
        randomUUID(),
        ticket.id,
        context.orderId,
        user.id,
        roleToken,
        `Ticket status changed to ${payload.status}.`,
        JSON.stringify([UserRole.ADMINISTRATOR, UserRole.QA_TEAM]),
        false,
        true
      );
      const updatedTicket = await getLatestOrderTicket(context.orderId);
      res.json({ success: true, data: updatedTicket, message: 'Ticket status updated.' });
    } catch (error: any) {
      if (error?.status) {
        return res.status(error.status).json({ success: false, message: error.message || 'Unable to update ticket status.' });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      next(error);
    }
  }
);

// Get order by ID (with role-based access)
router.get('/:id', authorizePermissions(Permissions.ORDERS_READ_SELF, Permissions.ORDERS_READ_ASSIGNED, Permissions.ORDERS_READ_ALL), async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
        designOrder: {
          include: {
            design: {
              include: {
                designer: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        fabricOrder: {
          include: {
            fabric: {
              include: {
                seller: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        readyToWearItems: {
          include: {
            readyToWear: {
              include: {
                designer: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
        qa: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Check access permissions
    let hasAccess = false;
    if (user.role === UserRole.ADMINISTRATOR) {
      hasAccess = true;
    } else if (user.role === UserRole.CUSTOMER && order.customerId === user.id) {
      hasAccess = true;
    } else if (user.role === UserRole.FABRIC_SELLER && order.fabricOrder) {
      const sellerProfile = await prisma.fabricSellerProfile.findFirst({
        where: { userId: user.id },
      });
      if (sellerProfile && order.fabricOrder.sellerId === sellerProfile.id) {
        hasAccess = true;
      }
    } else if (user.role === UserRole.FASHION_DESIGNER) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      const ownsDesignOrder = Boolean(designerProfile && order.designOrder && order.designOrder.designerId === designerProfile.id);
      const ownsReadyToWearOrder = Boolean(
        designerProfile &&
          (order.readyToWearItems || []).some(
            (item) => String(item.readyToWear?.designerId || '') === String(designerProfile.id)
          )
      );
      if (ownsDesignOrder || ownsReadyToWearOrder) {
        hasAccess = true;
      }
    } else if (user.role === UserRole.QA_TEAM && order.qaId) {
      const qaProfile = await prisma.qAProfile.findFirst({
        where: { userId: user.id },
      });
      if (qaProfile && order.qaId === qaProfile.id) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order.',
      });
    }

    const safeOrder =
      user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER
        ? {
            ...order,
            customer: {
              firstName: String(order.customer?.firstName || ''),
              lastName: String(order.customer?.lastName || ''),
              email: '',
            },
            shippingAddress: redactShippingAddressForVendor(order.shippingAddress),
          }
        : order;

    res.json({
      success: true,
      data: safeOrder,
    });
  } catch (error) {
    next(error);
  }
});

// Create custom design order
router.post('/custom-design', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    const schema = z.object({
      designId: z.string().uuid(),
      fabricId: z.string().uuid().optional(),
      yards: z.number().min(1).optional(),
      fabricSelectionMode: z.enum(['CUSTOMER_SELECTED', 'DESIGNER_DECIDES']).default('CUSTOMER_SELECTED'),
      fabricPreferenceNotes: z.string().max(2000).optional(),
      measurements: z.record(z.number()),
      shippingAddressId: z.string().uuid(),
      paymentMethod: z.string(),
      paymentIntentId: z.string().min(1).optional(),
      shippingCostUsd: z.number().min(0).optional(),
      shippingQuoteId: z.string().min(1).optional(),
      shippingProviderKey: z.string().min(1).optional(),
      shippingProviderName: z.string().min(1).optional(),
      shippingServiceName: z.string().min(1).optional(),
      shippingEtaMinDays: z.number().min(0).optional(),
      shippingEtaMaxDays: z.number().min(0).optional(),
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.id;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: customerId },
      select: { id: true },
    });

    if (!customerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const workflowSettings = await readOrderWorkflowSettings();
    const maxCustomToWearItemsPerCheckout = Math.max(
      1,
      Number(workflowSettings.orderLimits?.maxCustomToWearItemsPerCheckout || 3)
    );
    if (data.paymentIntentId) {
      const existingCount = await prisma.order.count({
        where: {
          customerId,
          type: OrderType.CUSTOM_DESIGN,
          paymentIntentId: data.paymentIntentId,
        },
      });
      if (existingCount >= maxCustomToWearItemsPerCheckout) {
        return res.status(400).json({
          success: false,
          message: `A maximum of ${maxCustomToWearItemsPerCheckout} Custom To Wear product(s) is allowed in one checkout.`,
        });
      }
    }

    const wantsDesignerToChooseFabric =
      data.fabricSelectionMode === 'DESIGNER_DECIDES' || !data.fabricId;
    const hasCustomerSelectedFabric = !wantsDesignerToChooseFabric;
    const selectedYards = Number(data.yards || 0);
    if (hasCustomerSelectedFabric && (!data.fabricId || selectedYards < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Fabric and yards are required when customer selects fabric.',
      });
    }

    // Get design, optional fabric, and address details
    const [design, address, fabric] = await Promise.all([
      prisma.design.findFirst({
        where: {
          id: data.designId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          designer: true,
          suitableFabrics: true,
          measurementVariables: {
            select: {
              name: true,
              isRequired: true,
            },
          },
        },
      }),
      prisma.address.findFirst({
        where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
      }),
      hasCustomerSelectedFabric && data.fabricId
        ? prisma.fabric.findFirst({
            where: {
              id: data.fabricId,
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
            include: { seller: true },
          })
        : Promise.resolve(null),
    ]);

    if (!design) {
      return res.status(404).json({ success: false, message: 'Design not found.' });
    }
    if (!address) {
      return res.status(404).json({ success: false, message: 'Shipping address not found.' });
    }
    if (hasCustomerSelectedFabric && !fabric) {
      return res.status(404).json({ success: false, message: 'Fabric not found.' });
    }

    const hasConfiguredSuitableFabrics =
      Array.isArray(design.suitableFabrics) && design.suitableFabrics.length > 0;
    // Check if selected fabric is suitable for design. If the design has no configured suitable fabrics,
    // allow any approved/available same-country fabric to keep CTW checkout functional.
    if (
      hasCustomerSelectedFabric &&
      hasConfiguredSuitableFabrics &&
      !design.suitableFabrics.some((row) => String(row.fabricId || '') === String(data.fabricId || ''))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Selected fabric is not suitable for this design.',
      });
    }

    // Check if selected fabric and designer are in same country
    if (hasCustomerSelectedFabric && fabric && fabric.seller.country !== design.designer.country) {
      return res.status(400).json({
        success: false,
        message: 'Fabric seller and designer must be in the same country for standard processing.',
      });
    }

    // Check selected fabric stock
    if (hasCustomerSelectedFabric && fabric && fabric.stockYards < selectedYards) {
      return res.status(400).json({
        success: false,
        message: `Not enough fabric in stock. Available: ${fabric.stockYards} yards`,
      });
    }

    const designMeasurementRows = Array.isArray((design as any).measurementVariables)
      ? ((design as any).measurementVariables as Array<{ name?: string; isRequired?: boolean }>)
      : [];
    const requiredMeasurementNames: string[] = Array.from(
      new Set(
        designMeasurementRows
          .filter((entry) => entry?.isRequired !== false)
          .map((entry) => String(entry?.name || '').trim())
          .filter((entry) => entry.length > 0)
      )
    );
    if (requiredMeasurementNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'This CTW design is missing required measurement setup. Please contact support.',
      });
    }
    const missingMeasurements = requiredMeasurementNames.filter((name) => {
      const value = Number((data.measurements as Record<string, number>)[name]);
      return !Number.isFinite(value) || value <= 0;
    });
    if (missingMeasurements.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required measurement(s): ${missingMeasurements.join(', ')}`,
      });
    }

    // Calculate prices
    const fabricPrice = hasCustomerSelectedFabric && fabric ? Number(fabric.finalPrice) * selectedYards : 0;
    const designPrice = Number(design.finalPrice);
    const subtotalBeforeDiscount = fabricPrice + designPrice;
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotalBeforeDiscount));
    const subtotal = subtotalBeforeDiscount - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 25;
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: true,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.CUSTOM_DESIGN,
      hasFabricOrder: hasCustomerSelectedFabric,
      settings: effectiveWorkflowSettings,
    });

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: wantsDesignerToChooseFabric
        ? 'Customer requested designer-selected fabric.'
        : 'Customer selected fabric.',
    });

    // Create order with all components
    const order = await prisma.$transaction(async (tx) => {
      // Create main order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.CUSTOM_DESIGN,
          customerId,
          shippingAddress: shippingSnapshot as any,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          // Create design order item
          designOrder: {
            create: {
              designId: data.designId,
              designerId: design.designerId,
              measurements: data.measurements,
              price: designPrice,
              status: initialStatus === OrderStatus.IN_PRODUCTION ? 'IN_PRODUCTION' : 'PENDING',
              productionNotes: wantsDesignerToChooseFabric
                ? String(data.fabricPreferenceNotes || '').trim() ||
                  'Customer requested designer-selected fabric.'
                : null,
            },
          },
          ...(hasCustomerSelectedFabric && fabric
            ? {
                fabricOrder: {
                  create: {
                    fabricId: data.fabricId!,
                    sellerId: fabric.sellerId,
                    yards: selectedYards,
                    pricePerYard: fabric.finalPrice,
                    totalPrice: fabricPrice,
                    status: 'PENDING',
                  },
                },
              }
            : {}),
          // Create timeline entry
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Order created and payment confirmed${
                    wantsDesignerToChooseFabric ? ' (Designer will select fabric)' : ''
                  }${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Order created, awaiting payment${
                    wantsDesignerToChooseFabric ? ' (Designer will select fabric)' : ''
                  }${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          designOrder: true,
          fabricOrder: true,
        },
      });

      // Only decrement inventory for paid orders.
      if (isPaymentConfirmed && hasCustomerSelectedFabric && data.fabricId) {
        await tx.fabric.update({
          where: { id: data.fabricId },
          data: { stockYards: { decrement: selectedYards } },
        });
      }

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Custom Design',
      total,
      itemCount: 1,
      paymentMethod: data.paymentMethod,
      shippingAddress: [address.address, address.city, address.country].filter(Boolean).join(', '),
      promoCode: data.promoCode || undefined,
      discountUsd,
      shippingCostUsd: shippingCost,
      itemLines: [
        `Design: ${design.name}`,
        wantsDesignerToChooseFabric
          ? 'Fabric: Designer decides'
          : `Fabric: ${fabric?.name || 'Selected fabric'} (${selectedYards} yards)`,
      ],
    }).catch((error) => {
      console.error('Failed to send custom-design order confirmation email:', error);
    });
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: wantsDesignerToChooseFabric
        ? 'Customer selected designer-decides-fabric mode.'
        : 'Customer selected fabric and measurements.',
      actorRole: UserRole.CUSTOMER,
    });
  } catch (error) {
    next(error);
  }
});

// Create ready-to-wear order
router.post('/ready-to-wear', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    type ValidatedReadyToWearItem = {
      readyToWearId: string;
      size: string;
      color: string;
      quantity: number;
      price: number;
      sizeVariationId: string;
    };

    const schema = z.object({
      items: z.array(z.object({
        readyToWearId: z.string().uuid(),
        size: z.string(),
        color: z.string().optional(),
        quantity: z.number().min(1),
      })),
      shippingAddressId: z.string().uuid(),
      paymentMethod: z.string(),
      paymentIntentId: z.string().min(1).optional(),
      shippingCostUsd: z.number().min(0).optional(),
      shippingQuoteId: z.string().min(1).optional(),
      shippingProviderKey: z.string().min(1).optional(),
      shippingProviderName: z.string().min(1).optional(),
      shippingServiceName: z.string().min(1).optional(),
      shippingEtaMinDays: z.number().min(0).optional(),
      shippingEtaMaxDays: z.number().min(0).optional(),
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.id;
    const workflowSettings = await readOrderWorkflowSettings();
    const maxReadyToWearUnitsPerOrder = Math.max(
      1,
      Number(workflowSettings.orderLimits?.maxReadyToWearUnitsPerOrder || 3)
    );
    const totalReadyToWearUnits = (Array.isArray(data.items) ? data.items : []).reduce(
      (sum: number, item: { quantity: number }) => sum + Math.max(0, Number(item.quantity || 0)),
      0
    );
    if (totalReadyToWearUnits > maxReadyToWearUnitsPerOrder) {
      return res.status(400).json({
        success: false,
        message: `A maximum of ${maxReadyToWearUnitsPerOrder} Ready To Wear unit(s) is allowed per order.`,
      });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: customerId },
      select: { id: true },
    });

    if (!customerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    // Validate items and calculate total
    let subtotal = 0;
    const validatedItems: ValidatedReadyToWearItem[] = [];
    const readyItemLines: string[] = [];

    for (const item of data.items) {
      const requestedSize = normalizeReadyToWearSize(item.size);
      const hasRequestedColor = String(item.color || '').trim().length > 0;
      const requestedColor = normalizeReadyToWearColor(item.color);
      const requestedVariantKey = encodeReadyToWearVariantKey(requestedSize, requestedColor);
      const product = await prisma.readyToWear.findFirst({
        where: {
          id: item.readyToWearId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          sizeVariations: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.readyToWearId}`,
        });
      }

      const decodedVariants = product.sizeVariations.map((row) => ({
        row,
        decoded: decodeReadyToWearVariantKey(row.size),
      }));
      const exactVariant =
        decodedVariants.find((entry) => String(entry.row.size || '').trim().toUpperCase() === requestedVariantKey)?.row ||
        decodedVariants.find(
          (entry) => entry.decoded.size === requestedSize && entry.decoded.color === requestedColor
        )?.row ||
        null;
      const defaultColorVariant =
        decodedVariants.find(
          (entry) =>
            entry.decoded.size === requestedSize && entry.decoded.color === DEFAULT_READY_TO_WEAR_COLOR
        )?.row || null;
      const sizeFallbackVariant =
        decodedVariants.find((entry) => entry.decoded.size === requestedSize)?.row || null;
      const availableColorsForSize = new Set(
        decodedVariants
          .filter((entry) => entry.decoded.size === requestedSize)
          .map((entry) => entry.decoded.color)
      );
      const canFallbackToSizeOnly =
        !hasRequestedColor ||
        requestedColor === DEFAULT_READY_TO_WEAR_COLOR ||
        availableColorsForSize.size === 0 ||
        (availableColorsForSize.size === 1 && availableColorsForSize.has(DEFAULT_READY_TO_WEAR_COLOR));
      const matchingVariant = exactVariant || (canFallbackToSizeOnly ? defaultColorVariant || sizeFallbackVariant : null);
      if (!matchingVariant) {
        const availableColorLabels = Array.from(availableColorsForSize).filter(
          (color) => color !== DEFAULT_READY_TO_WEAR_COLOR
        );
        const availabilityHint = availableColorLabels.length > 0
          ? ` Available colors for size ${requestedSize}: ${availableColorLabels.join(', ')}.`
          : '';
        return res.status(400).json({
          success: false,
          message: `Variant ${requestedSize}/${requestedColor} not available for ${product.name}.${availabilityHint}`,
        });
      }

      const sizeVar = matchingVariant;
      const selectedVariant = decodeReadyToWearVariantKey(sizeVar.size);
      if (sizeVar.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.name} in ${selectedVariant.size}/${selectedVariant.color}. Available: ${sizeVar.stock}`,
        });
      }

      const itemTotal = Number(sizeVar.price) * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        readyToWearId: item.readyToWearId,
        size: selectedVariant.size,
        color: selectedVariant.color,
        quantity: item.quantity,
        price: Number(sizeVar.price),
        sizeVariationId: sizeVar.id,
      });
      readyItemLines.push(
        `${product.name} — ${selectedVariant.size}${
          selectedVariant.color !== DEFAULT_READY_TO_WEAR_COLOR ? ` / ${selectedVariant.color}` : ''
        } × ${item.quantity}`
      );
    }

    // Get shipping address
    const address = await prisma.address.findFirst({
      where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found.',
      });
    }

    // Calculate totals
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotal));
    subtotal = subtotal - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: validatedItems.length > 0,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.READY_TO_WEAR,
      hasFabricOrder: false,
      settings: effectiveWorkflowSettings,
    });

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: 'Ready-to-wear order queued for fulfillment.',
    });

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.READY_TO_WEAR,
          customerId,
          shippingAddress: shippingSnapshot as any,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          readyToWearItems: {
            create: validatedItems.map((item) => ({
              readyToWearId: item.readyToWearId,
              size: item.color === DEFAULT_READY_TO_WEAR_COLOR ? item.size : `${item.size} / ${item.color}`,
              price: item.price,
              quantity: item.quantity,
            })),
          },
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Ready-to-wear order created and payment confirmed${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Ready-to-wear order created, awaiting payment${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          readyToWearItems: true,
        },
      });

      // Only decrement inventory for paid orders.
      if (isPaymentConfirmed) {
        for (const item of validatedItems) {
          await tx.readyToWearSize.update({
            where: { id: item.sizeVariationId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Ready To Wear',
      total,
      itemCount: validatedItems.reduce((count, item) => count + Number(item.quantity || 0), 0),
      paymentMethod: data.paymentMethod,
      shippingAddress: [address.address, address.city, address.country].filter(Boolean).join(', '),
      promoCode: data.promoCode || undefined,
      discountUsd,
      shippingCostUsd: shippingCost,
      itemLines: readyItemLines,
    }).catch((error) => {
      console.error('Failed to send ready-to-wear order confirmation email:', error);
    });
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: 'Ready-to-wear order submitted.',
      actorRole: UserRole.CUSTOMER,
    });
  } catch (error) {
    next(error);
  }
});

// Create fabric-only order
router.post('/fabric-only', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    const schema = z.object({
      fabricId: z.string().uuid(),
      yards: z.number().int().min(1),
      shippingAddressId: z.string().uuid(),
      paymentMethod: z.string(),
      paymentIntentId: z.string().min(1).optional(),
      shippingCostUsd: z.number().min(0).optional(),
      shippingQuoteId: z.string().min(1).optional(),
      shippingProviderKey: z.string().min(1).optional(),
      shippingProviderName: z.string().min(1).optional(),
      shippingServiceName: z.string().min(1).optional(),
      shippingEtaMinDays: z.number().min(0).optional(),
      shippingEtaMaxDays: z.number().min(0).optional(),
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.id;
    const workflowSettings = await readOrderWorkflowSettings();
    const minFabricYardsPerOrder = Math.max(1, Number(workflowSettings.orderLimits?.minFabricYardsPerOrder || 3));
    const maxFabricYardsPerOrder = Math.max(
      minFabricYardsPerOrder,
      Number(workflowSettings.orderLimits?.maxFabricYardsPerOrder || 200)
    );
    if (Number(data.yards || 0) > maxFabricYardsPerOrder) {
      return res.status(400).json({
        success: false,
        message: `Maximum Fabric To Buy order is ${maxFabricYardsPerOrder} yards.`,
      });
    }
    if (data.paymentIntentId) {
      const existingOrders = await prisma.order.findMany({
        where: {
          customerId,
          type: OrderType.FABRIC_ONLY,
          paymentIntentId: data.paymentIntentId,
        },
        include: {
          fabricOrder: {
            select: { yards: true },
          },
        },
      });
      const alreadyOrderedYards = existingOrders.reduce(
        (sum, order) => sum + Math.max(0, Number(order.fabricOrder?.yards || 0)),
        0
      );
      if (alreadyOrderedYards + Number(data.yards || 0) > maxFabricYardsPerOrder) {
        return res.status(400).json({
          success: false,
          message: `Maximum Fabric To Buy yards per checkout is ${maxFabricYardsPerOrder}.`,
        });
      }
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: customerId },
      select: { id: true },
    });

    if (!customerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const [fabric, address] = await Promise.all([
      prisma.fabric.findFirst({
        where: {
          id: data.fabricId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: { seller: true },
      }),
      prisma.address.findFirst({
        where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
      }),
    ]);

    if (!fabric) {
      return res.status(404).json({ success: false, message: 'Fabric not found.' });
    }
    if (!address) {
      return res.status(404).json({ success: false, message: 'Shipping address not found.' });
    }
    const effectiveMinYards = Math.max(minFabricYardsPerOrder, Number(fabric.minYards || 3));
    if (Number(data.yards || 0) < effectiveMinYards) {
      return res.status(400).json({
        success: false,
        message: `Minimum order for this fabric is ${effectiveMinYards} yards.`,
      });
    }
    if (fabric.stockYards < data.yards) {
      return res.status(400).json({
        success: false,
        message: `Not enough fabric in stock. Available: ${fabric.stockYards} yards`,
      });
    }

    const subtotalBeforeDiscount = Number(fabric.finalPrice) * data.yards;
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotalBeforeDiscount));
    const subtotal = subtotalBeforeDiscount - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: Number(data.yards || 0) > 0,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.FABRIC_ONLY,
      hasFabricOrder: true,
      settings: effectiveWorkflowSettings,
    });
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: 'Fabric order queued for seller fulfillment.',
    });

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.FABRIC_ONLY,
          customerId,
          shippingAddress: shippingSnapshot as any,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          fabricOrder: {
            create: {
              fabricId: data.fabricId,
              sellerId: fabric.sellerId,
              yards: data.yards,
              pricePerYard: fabric.finalPrice,
              totalPrice: subtotal,
              status: 'PENDING',
            },
          },
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Fabric-only order created and payment confirmed${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Fabric-only order created, awaiting payment${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          fabricOrder: true,
        },
      });

      if (isPaymentConfirmed) {
        await tx.fabric.update({
          where: { id: data.fabricId },
          data: { stockYards: { decrement: data.yards } },
        });
      }

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Fabric order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Fabric To Buy',
      total,
      itemCount: data.yards,
      paymentMethod: data.paymentMethod,
      shippingAddress: [address.address, address.city, address.country].filter(Boolean).join(', '),
      promoCode: data.promoCode || undefined,
      discountUsd,
      shippingCostUsd: shippingCost,
      itemLines: [`Fabric: ${fabric.name} (${data.yards} yards)`],
    }).catch((error) => {
      console.error('Failed to send fabric-only order confirmation email:', error);
    });
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: 'Fabric-only order submitted.',
      actorRole: UserRole.CUSTOMER,
    });
  } catch (error) {
    next(error);
  }
});

// Update order status (for all parties)
router.patch('/:id/status', authorizePermissions(Permissions.ORDERS_UPDATE_SELF, Permissions.ORDERS_UPDATE_ASSIGNED, Permissions.ORDERS_UPDATE_ALL), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.string().min(1),
      notes: z.string().optional(),
    });
    const { status, notes } = schema.parse(req.body);
    const user = req.user!;

    if (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER) {
      const submissionRows = await prisma
        .$queryRawUnsafe<Array<any>>(
          `SELECT "profileStatus","rejectionType"
           FROM "VendorProfileSubmission"
           WHERE "role"::text = $1 AND "userId" = $2
           ORDER BY COALESCE("updatedAt","profileReviewedAt","profileSubmittedAt") DESC NULLS LAST
           LIMIT 1`,
          user.role,
          user.id
        )
        .catch(() => []);
      const submission = Array.isArray(submissionRows) && submissionRows.length > 0 ? submissionRows[0] : null;
      const profileStatus = String(submission?.profileStatus || '').toUpperCase();
      const rejectionType = String(submission?.rejectionType || '').toUpperCase();
      if (profileStatus === 'REJECTED') {
        return res.status(403).json({
          success: false,
          message:
            rejectionType === 'PERMANENT'
              ? 'Your vendor account is permanently rejected. Contact the administrator.'
              : 'Your profile is temporarily rejected. Please correct your profile and resubmit before taking further actions.',
        });
      }
    }

    // Get current order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        designOrder: true,
        fabricOrder: true,
        readyToWearItems: {
          include: {
            readyToWear: {
              select: { designerId: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Validate status transition based on user role
    let canUpdate = false;
    let updateData: any = {};
    let timelineStatus: OrderStatus = order.status;

    if (user.role === UserRole.ADMINISTRATOR) {
      const orderStatus = z.nativeEnum(OrderStatus).safeParse(status);
      if (orderStatus.success) {
        canUpdate = true;
        timelineStatus = orderStatus.data;
        updateData.status = orderStatus.data;
      }
    } else if (user.role === UserRole.FABRIC_SELLER && order.fabricOrder) {
      const sellerProfile = await prisma.fabricSellerProfile.findFirst({
        where: { userId: user.id },
      });
      if (sellerProfile && order.fabricOrder.sellerId === sellerProfile.id) {
        // Fabric seller can only update fabric portion
        const fabricStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED_TO_DESIGNER', 'DELIVERED'] as const;
        const fabricToOrderStatus: Record<(typeof fabricStatuses)[number], OrderStatus> = {
          PENDING: OrderStatus.FABRIC_PENDING,
          CONFIRMED: OrderStatus.FABRIC_CONFIRMED,
          SHIPPED_TO_DESIGNER: OrderStatus.FABRIC_SHIPPED,
          DELIVERED: OrderStatus.FABRIC_RECEIVED,
        };
        if ((fabricStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = fabricToOrderStatus[status as (typeof fabricStatuses)[number]];
          updateData.status = timelineStatus;
          updateData.fabricOrder = {
            update: {
              status,
              ...(status === 'SHIPPED_TO_DESIGNER' && {
                shippedToDesignerAt: new Date(),
              }),
            },
          };
        }
      }
    } else if (user.role === UserRole.FASHION_DESIGNER) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      const ownsDesignOrder = Boolean(designerProfile && order.designOrder && order.designOrder.designerId === designerProfile.id);
      const ownsReadyToWearOrder = Boolean(
        designerProfile &&
          (order.readyToWearItems || []).some(
            (item) => String(item.readyToWear?.designerId || '') === String(designerProfile.id)
          )
      );
      if (designerProfile && ownsDesignOrder) {
        // Designer can only update design portion
        const designStatuses = ['PENDING', 'CONFIRMED', 'FABRIC_RECEIVED', 'IN_PRODUCTION', 'COMPLETED'] as const;
        const designToOrderStatus: Record<(typeof designStatuses)[number], OrderStatus> = {
          PENDING: OrderStatus.PAYMENT_CONFIRMED,
          CONFIRMED: OrderStatus.PAYMENT_CONFIRMED,
          FABRIC_RECEIVED: OrderStatus.FABRIC_RECEIVED,
          IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
          COMPLETED: OrderStatus.PRODUCTION_COMPLETE,
        };
        if ((designStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = designToOrderStatus[status as (typeof designStatuses)[number]];
          updateData.status = timelineStatus;
          updateData.designOrder = {
            update: { status },
          };
        }
      }
      if (designerProfile && ownsReadyToWearOrder) {
        const readyStatuses = ['CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'QA_PENDING'] as const;
        const readyToOrderStatus: Record<(typeof readyStatuses)[number], OrderStatus> = {
          CONFIRMED: OrderStatus.PAYMENT_CONFIRMED,
          IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
          COMPLETED: OrderStatus.PRODUCTION_COMPLETE,
          QA_PENDING: OrderStatus.QA_PENDING,
        };
        if ((readyStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = readyToOrderStatus[status as (typeof readyStatuses)[number]];
          updateData.status = timelineStatus;
        }
      }
    } else if (user.role === UserRole.QA_TEAM) {
      const qaProfile = await prisma.qAProfile.findFirst({
        where: { userId: user.id },
      });
      if (qaProfile && order.qaId === qaProfile.id) {
        const qaStatuses: OrderStatus[] = [
          OrderStatus.QA_PENDING,
          OrderStatus.QA_INSPECTING,
          OrderStatus.QA_APPROVED,
          OrderStatus.QA_REJECTED,
          OrderStatus.SHIPPED,
        ];
        const parsedStatus = z.nativeEnum(OrderStatus).safeParse(status);
        if (parsedStatus.success && qaStatuses.includes(parsedStatus.data)) {
          canUpdate = true;
          updateData.status = parsedStatus.data;
          timelineStatus = parsedStatus.data;
          if (parsedStatus.data === OrderStatus.SHIPPED) {
            updateData.shippedAt = new Date();
          }
        }
      }
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this order status.',
      });
    }

    const workflowSettings = await readOrderWorkflowSettings();
    updateData.shippingAddress = appendWorkflowMetadataToShippingAddress({
      shippingAddress: order.shippingAddress,
      settings: workflowSettings,
      status: timelineStatus,
      note: notes || `Status updated to ${status}`,
    }) as any;
    if (timelineStatus === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: updateData,
      }),
      prisma.orderTimeline.create({
        data: {
          orderId: id,
          status: timelineStatus,
          notes: notes || `Status updated to ${status}`,
          updatedById: user.id,
          updatedByRole: user.role,
        },
      }),
    ]);
    void notifyOrderLifecycle({
      orderId: id,
      status: timelineStatus,
      notes,
      actorRole: user.role,
    });

    res.json({
      success: true,
      message: 'Order status updated successfully.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

// Add tracking number (QA only)
router.patch('/:id/tracking', authorizePermissions(Permissions.ORDERS_UPDATE_ASSIGNED), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trackingNumber } = req.body;
    const user = req.user!;

    // Verify QA access
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const qaProfile = await prisma.qAProfile.findFirst({
      where: { userId: user.id },
    });

    if (!qaProfile || order.qaId !== qaProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned QA can add tracking information.',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { trackingNumber },
    });

    res.json({
      success: true,
      message: 'Tracking number added successfully.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
