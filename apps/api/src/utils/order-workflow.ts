import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma, OrderStatus, OrderType, UserRole } from '../db';

const ORDER_WORKFLOW_SETTINGS_KEY = 'order_workflow_settings_v1';

const ORDER_STATUS_VALUES = Object.values(OrderStatus) as OrderStatus[];

const workflowSettingsSchema = z.object({
  processingMode: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  autoProcessCriteria: z
    .object({
      requirePaid: z.boolean().default(true),
      requireShippingProvider: z.boolean().default(false),
      requireCustomerAddress: z.boolean().default(true),
      requireItems: z.boolean().default(true),
    })
    .default({
      requirePaid: true,
      requireShippingProvider: false,
      requireCustomerAddress: true,
      requireItems: true,
    }),
  slaHours: z
    .object({
      adminReview: z.number().int().min(1).max(24 * 60).default(24),
      vendorFulfillment: z.number().int().min(1).max(24 * 60).default(72),
      qaReview: z.number().int().min(1).max(24 * 60).default(24),
      customerConcernWindow: z.number().int().min(1).max(24 * 60).default(72),
    })
    .default({
      adminReview: 24,
      vendorFulfillment: 72,
      qaReview: 24,
      customerConcernWindow: 72,
    }),
  reminderLeadHours: z.number().int().min(1).max(24 * 30).default(24),
  autoCloseDays: z.number().int().min(1).max(60).default(3),
  customerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).default([
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.FABRIC_PENDING,
    OrderStatus.FABRIC_SHIPPED,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.QA_PENDING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
  ]),
  sellerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).default([
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.FABRIC_PENDING,
    OrderStatus.FABRIC_CONFIRMED,
  ]),
  designerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).default([
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.FABRIC_RECEIVED,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.QA_REJECTED,
    OrderStatus.QA_APPROVED,
  ]),
  qaNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).default([
    OrderStatus.QA_PENDING,
    OrderStatus.QA_INSPECTING,
    OrderStatus.QA_APPROVED,
    OrderStatus.QA_REJECTED,
  ]),
  adminNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).default([
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.FABRIC_PENDING,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.QA_PENDING,
    OrderStatus.SHIPPED,
    OrderStatus.REFUND_REQUESTED,
  ]),
  qaChecklistTemplate: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(160),
        required: z.boolean().default(true),
      })
    )
    .max(30)
    .default([
      { key: 'stitching', label: 'Stitching quality passes inspection', required: true },
      { key: 'measurements', label: 'Measurements match order specification', required: true },
      { key: 'material', label: 'Material and color match listing', required: true },
      { key: 'finishing', label: 'Finishing, packaging, and labeling complete', required: true },
    ]),
  orderLimits: z
    .object({
      maxReadyToWearUnitsPerOrder: z.number().int().min(1).max(200).default(3),
      maxCustomToWearItemsPerCheckout: z.number().int().min(1).max(200).default(3),
      maxSuitableFabricsPerDesign: z.number().int().min(1).max(50).default(5),
      minFabricYardsPerOrder: z.number().int().min(1).max(500).default(3),
      maxFabricYardsPerOrder: z.number().int().min(1).max(5000).default(200),
    })
    .default({
      maxReadyToWearUnitsPerOrder: 3,
      maxCustomToWearItemsPerCheckout: 3,
      maxSuitableFabricsPerDesign: 5,
      minFabricYardsPerOrder: 3,
      maxFabricYardsPerOrder: 200,
    }),
});

export type OrderWorkflowSettings = z.infer<typeof workflowSettingsSchema>;

const DEFAULT_WORKFLOW_SETTINGS: OrderWorkflowSettings = workflowSettingsSchema.parse({});

export type WorkflowTargetRole = 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'QA' | 'ADMIN';

type PartialWorkflowSettingsInput = Partial<{
  processingMode: 'MANUAL' | 'AUTO';
  autoProcessCriteria: Partial<OrderWorkflowSettings['autoProcessCriteria']>;
  slaHours: Partial<OrderWorkflowSettings['slaHours']>;
  reminderLeadHours: number;
  autoCloseDays: number;
  customerNotifyStatuses: OrderStatus[];
  sellerNotifyStatuses: OrderStatus[];
  designerNotifyStatuses: OrderStatus[];
  qaNotifyStatuses: OrderStatus[];
  adminNotifyStatuses: OrderStatus[];
  qaChecklistTemplate: Array<{ key: string; label: string; required?: boolean }>;
  orderLimits: Partial<OrderWorkflowSettings['orderLimits']>;
}>;

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeStatusList = (value: unknown, fallback: OrderStatus[]) => {
  const input = Array.isArray(value) ? value : [];
  const allowed = new Set<string>(ORDER_STATUS_VALUES as string[]);
  const normalized = Array.from(
    new Set(
      input
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => allowed.has(entry))
    )
  ) as OrderStatus[];
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeChecklistTemplate = (
  value: unknown,
  fallback: OrderWorkflowSettings['qaChecklistTemplate']
) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows
    .map((entry) => {
      const row = parseObject(entry);
      const key = String(row.key || '').trim().toLowerCase();
      const label = String(row.label || '').trim();
      if (!key || !label) return null;
      return {
        key: key.slice(0, 80),
        label: label.slice(0, 160),
        required: row.required !== false,
      };
    })
    .filter((entry): entry is { key: string; label: string; required: boolean } => Boolean(entry))
    .slice(0, 30);
  return normalized.length > 0 ? normalized : fallback;
};

function normalizeOrderWorkflowSettings(input: unknown): OrderWorkflowSettings {
  const row = parseObject(input);
  const defaults = DEFAULT_WORKFLOW_SETTINGS;
  return {
    processingMode: String(row.processingMode || defaults.processingMode).toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL',
    autoProcessCriteria: {
      requirePaid: row.autoProcessCriteria && typeof row.autoProcessCriteria === 'object'
        ? (parseObject(row.autoProcessCriteria).requirePaid !== false)
        : defaults.autoProcessCriteria.requirePaid,
      requireShippingProvider: Boolean(parseObject(row.autoProcessCriteria).requireShippingProvider ?? defaults.autoProcessCriteria.requireShippingProvider),
      requireCustomerAddress: row.autoProcessCriteria && typeof row.autoProcessCriteria === 'object'
        ? (parseObject(row.autoProcessCriteria).requireCustomerAddress !== false)
        : defaults.autoProcessCriteria.requireCustomerAddress,
      requireItems: row.autoProcessCriteria && typeof row.autoProcessCriteria === 'object'
        ? (parseObject(row.autoProcessCriteria).requireItems !== false)
        : defaults.autoProcessCriteria.requireItems,
    },
    slaHours: {
      adminReview: Math.max(1, Number(parseObject(row.slaHours).adminReview || defaults.slaHours.adminReview)),
      vendorFulfillment: Math.max(1, Number(parseObject(row.slaHours).vendorFulfillment || defaults.slaHours.vendorFulfillment)),
      qaReview: Math.max(1, Number(parseObject(row.slaHours).qaReview || defaults.slaHours.qaReview)),
      customerConcernWindow: Math.max(
        1,
        Number(parseObject(row.slaHours).customerConcernWindow || defaults.slaHours.customerConcernWindow)
      ),
    },
    reminderLeadHours: Math.max(1, Number(row.reminderLeadHours || defaults.reminderLeadHours)),
    autoCloseDays: Math.max(1, Number(row.autoCloseDays || defaults.autoCloseDays)),
    customerNotifyStatuses: normalizeStatusList(row.customerNotifyStatuses, defaults.customerNotifyStatuses),
    sellerNotifyStatuses: normalizeStatusList(row.sellerNotifyStatuses, defaults.sellerNotifyStatuses),
    designerNotifyStatuses: normalizeStatusList(row.designerNotifyStatuses, defaults.designerNotifyStatuses),
    qaNotifyStatuses: normalizeStatusList(row.qaNotifyStatuses, defaults.qaNotifyStatuses),
    adminNotifyStatuses: normalizeStatusList(row.adminNotifyStatuses, defaults.adminNotifyStatuses),
    qaChecklistTemplate: normalizeChecklistTemplate(row.qaChecklistTemplate, defaults.qaChecklistTemplate),
    orderLimits: {
      maxReadyToWearUnitsPerOrder: Math.max(
        1,
        Math.min(
          200,
          Number(parseObject(row.orderLimits).maxReadyToWearUnitsPerOrder || defaults.orderLimits.maxReadyToWearUnitsPerOrder)
        )
      ),
      maxCustomToWearItemsPerCheckout: Math.max(
        1,
        Math.min(
          200,
          Number(
            parseObject(row.orderLimits).maxCustomToWearItemsPerCheckout || defaults.orderLimits.maxCustomToWearItemsPerCheckout
          )
        )
      ),
      maxSuitableFabricsPerDesign: Math.max(
        1,
        Math.min(
          50,
          Number(parseObject(row.orderLimits).maxSuitableFabricsPerDesign || defaults.orderLimits.maxSuitableFabricsPerDesign)
        )
      ),
      minFabricYardsPerOrder: Math.max(
        1,
        Math.min(500, Number(parseObject(row.orderLimits).minFabricYardsPerOrder || defaults.orderLimits.minFabricYardsPerOrder))
      ),
      maxFabricYardsPerOrder: Math.max(
        1,
        Math.min(5000, Number(parseObject(row.orderLimits).maxFabricYardsPerOrder || defaults.orderLimits.maxFabricYardsPerOrder))
      ),
    },
  };
}

async function ensureHomepageSectionSettingTable() {
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
}

export async function readOrderWorkflowSettings(): Promise<OrderWorkflowSettings> {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: unknown }>>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    ORDER_WORKFLOW_SETTINGS_KEY
  );
  if (!rows[0]) return DEFAULT_WORKFLOW_SETTINGS;
  return normalizeOrderWorkflowSettings(rows[0].value);
}

function mergeWorkflowSettings(current: OrderWorkflowSettings, patch: PartialWorkflowSettingsInput): OrderWorkflowSettings {
  const merged = {
    ...current,
    ...patch,
    autoProcessCriteria: {
      ...current.autoProcessCriteria,
      ...(patch.autoProcessCriteria || {}),
    },
    slaHours: {
      ...current.slaHours,
      ...(patch.slaHours || {}),
    },
    orderLimits: {
      ...current.orderLimits,
      ...(patch.orderLimits || {}),
    },
  };
  return normalizeOrderWorkflowSettings(merged);
}

export async function writeOrderWorkflowSettings(
  payload: PartialWorkflowSettingsInput,
  merge = true
): Promise<OrderWorkflowSettings> {
  await ensureHomepageSectionSettingTable();
  const current = await readOrderWorkflowSettings();
  const normalized = merge
    ? mergeWorkflowSettings(current, payload)
    : normalizeOrderWorkflowSettings(payload);
  if (normalized.processingMode === 'AUTO') {
    const hasCriteria = Object.values(normalized.autoProcessCriteria).some(Boolean);
    if (!hasCriteria) {
      throw new Error('At least one auto-processing criterion must be enabled before AUTO mode can be used.');
    }
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    ORDER_WORKFLOW_SETTINGS_KEY
  );
  const existingId = rows[0]?.id ? String(rows[0].id) : null;
  if (existingId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1::jsonb,
           "updatedAt" = NOW()
       WHERE "id" = $2`,
      JSON.stringify(normalized),
      existingId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
      randomUUID(),
      ORDER_WORKFLOW_SETTINGS_KEY,
      JSON.stringify(normalized)
    );
  }
  return normalized;
}

export function determinePostPaymentStatus(params: {
  isPaymentConfirmed: boolean;
  orderType: OrderType;
  hasFabricOrder: boolean;
  settings: OrderWorkflowSettings;
}): OrderStatus {
  if (!params.isPaymentConfirmed) return OrderStatus.PENDING_PAYMENT;
  if (params.settings.processingMode === 'MANUAL') {
    return OrderStatus.PAYMENT_CONFIRMED;
  }
  if (params.orderType === OrderType.FABRIC_ONLY) return OrderStatus.FABRIC_PENDING;
  if (params.orderType === OrderType.CUSTOM_DESIGN && params.hasFabricOrder) return OrderStatus.FABRIC_PENDING;
  return OrderStatus.IN_PRODUCTION;
}

export function getSlaDueAtForStatus(
  status: OrderStatus,
  settings: OrderWorkflowSettings,
  referenceDate = new Date()
): Date | null {
  const addHours = (hours: number) => new Date(referenceDate.getTime() + Math.max(1, hours) * 60 * 60 * 1000);
  switch (status) {
    case OrderStatus.PAYMENT_CONFIRMED:
      return addHours(settings.slaHours.adminReview);
    case OrderStatus.FABRIC_PENDING:
    case OrderStatus.FABRIC_CONFIRMED:
    case OrderStatus.FABRIC_SHIPPED:
    case OrderStatus.FABRIC_RECEIVED:
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.PRODUCTION_COMPLETE:
      return addHours(settings.slaHours.vendorFulfillment);
    case OrderStatus.QA_PENDING:
    case OrderStatus.QA_INSPECTING:
      return addHours(settings.slaHours.qaReview);
    case OrderStatus.DELIVERED:
      return addHours(settings.slaHours.customerConcernWindow);
    default:
      return null;
  }
}

export function appendWorkflowMetadataToShippingAddress(params: {
  shippingAddress: unknown;
  settings: OrderWorkflowSettings;
  status: OrderStatus;
  note?: string;
}): Record<string, unknown> {
  const shipping = parseObject(params.shippingAddress);
  const workflowRoot = parseObject(shipping.workflow);
  const dueAt = getSlaDueAtForStatus(params.status, params.settings);
  const reminders = Array.isArray(workflowRoot.reminders) ? workflowRoot.reminders : [];
  return {
    ...shipping,
    workflow: {
      ...workflowRoot,
      processingMode: params.settings.processingMode,
      adminVerificationRequired: params.settings.processingMode === 'MANUAL',
      autoCloseDays: params.settings.autoCloseDays,
      sla: {
        status: params.status,
        dueAt: dueAt ? dueAt.toISOString() : null,
        reminderLeadHours: params.settings.reminderLeadHours,
      },
      reminders,
      updatedAt: new Date().toISOString(),
      ...(params.note ? { note: params.note } : {}),
    },
  };
}

export function redactShippingAddressForVendor(input: unknown): Record<string, unknown> {
  const address = parseObject(input);
  return {
    country: address.country || '',
    city: address.city || '',
    postalCode: address.postalCode || '',
    shippingProviderName: address.shippingProviderName || null,
    shippingProviderKey: address.shippingProviderKey || null,
    shippingServiceName: address.shippingServiceName || null,
    shippingEtaMinDays: address.shippingEtaMinDays || null,
    shippingEtaMaxDays: address.shippingEtaMaxDays || null,
    workflow: parseObject(address.workflow),
  };
}

export function shouldNotifyRoleForStatus(
  settings: OrderWorkflowSettings,
  role: WorkflowTargetRole,
  status: OrderStatus
): boolean {
  if (role === 'CUSTOMER') return settings.customerNotifyStatuses.includes(status);
  if (role === 'SELLER') return settings.sellerNotifyStatuses.includes(status);
  if (role === 'DESIGNER') return settings.designerNotifyStatuses.includes(status);
  if (role === 'QA') return settings.qaNotifyStatuses.includes(status);
  return settings.adminNotifyStatuses.includes(status);
}

export async function autoCloseOverdueDeliveredOrders(actorUserId?: string) {
  const settings = await readOrderWorkflowSettings();
  const cutoff = new Date(Date.now() - Math.max(1, settings.autoCloseDays) * 24 * 60 * 60 * 1000);
  const overdue = await prisma.order.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      deliveredAt: { lte: cutoff },
    },
    select: { id: true },
  });
  if (overdue.length === 0) {
    return { closedCount: 0 };
  }
  const actorId =
    actorUserId ||
    (
      await prisma.user.findFirst({
        where: { role: UserRole.ADMINISTRATOR },
        select: { id: true },
      })
    )?.id ||
    (
      await prisma.user.findFirst({
        where: { role: UserRole.QA_TEAM },
        select: { id: true },
      })
    )?.id ||
    'system';

  await prisma.$transaction(
    overdue.flatMap((order) => [
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
          customerAcceptedAt: new Date(),
        },
      }),
      prisma.orderTimeline.create({
        data: {
          orderId: order.id,
          status: OrderStatus.COMPLETED,
          notes: `Order auto-closed after ${settings.autoCloseDays} day concern window elapsed.`,
          updatedById: actorId,
          updatedByRole: UserRole.ADMINISTRATOR,
        },
      }),
    ])
  );

  return { closedCount: overdue.length };
}
