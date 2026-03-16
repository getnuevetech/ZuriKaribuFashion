import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma, PaymentStatus, ProductStatus, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { listResellerInfluencersWithMetrics } from '../utils/referral-program';

const router = Router();

const parseObject = (value: unknown): Record<string, unknown> => {
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

const toMoney = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

let reportSchemaEnsured = false;
const ensureReportSchema = async () => {
  if (reportSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ReportDefinition" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "reportType" TEXT NOT NULL,
      "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ReportDefinition_reportType_idx" ON "ReportDefinition"("reportType")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ReportDefinition_createdAt_idx" ON "ReportDefinition"("createdAt")`
  );
  reportSchemaEnsured = true;
};

router.use(authenticate);
router.use(authorizePermissions(Permissions.ADMIN_DASHBOARD_READ));
router.use(async (_req, _res, next) => {
  try {
    await ensureReportSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const reportTypeSchema = z.enum([
  'GENERAL_SALES',
  'STOCK_OVERVIEW',
  'VENDOR_SALES',
  'REFERRAL_PERFORMANCE',
  'ORDER_ACTIVITY',
]);

const definitionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  reportType: reportTypeSchema,
  config: z.record(z.any()).optional(),
  isActive: z.boolean().optional().default(true),
});

const definitionUpdateSchema = definitionSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});

const generateSchema = z.object({
  definitionId: z.string().optional(),
  reportType: reportTypeSchema.optional(),
  config: z.record(z.any()).optional(),
});

const REPORT_CATALOG = {
  reportTypes: [
    {
      key: 'GENERAL_SALES',
      label: 'General Sales Report',
      description: 'Revenue, order volume, order-type split, and grouped trend output.',
      supportedMetrics: ['total_orders', 'total_revenue', 'average_order_value', 'by_order_type'],
      supportedDimensions: ['day', 'week', 'month', 'order_type'],
      supportedFilters: ['fromDate', 'toDate', 'orderTypes'],
      defaultConfig: {
        groupBy: 'DAY',
        metrics: ['total_orders', 'total_revenue', 'average_order_value'],
        filters: {},
      },
    },
    {
      key: 'STOCK_OVERVIEW',
      label: 'Stock Report',
      description: 'Low-stock and out-of-stock visibility for FTB/RTW inventories.',
      supportedMetrics: ['total_items', 'in_stock', 'low_stock', 'out_of_stock'],
      supportedDimensions: ['product_type', 'vendor'],
      supportedFilters: ['lowStockThreshold', 'productType'],
      defaultConfig: {
        metrics: ['total_items', 'low_stock', 'out_of_stock'],
        filters: { lowStockThreshold: 10 },
      },
    },
    {
      key: 'VENDOR_SALES',
      label: 'Seller/Designer Sales Report',
      description: 'Sales ranking and totals per seller/designer category.',
      supportedMetrics: ['vendor_total_sales', 'vendor_count'],
      supportedDimensions: ['vendor_category', 'vendor_name'],
      supportedFilters: ['vendorCategory', 'status'],
      defaultConfig: {
        metrics: ['vendor_total_sales'],
        filters: { vendorCategory: 'ALL' },
      },
    },
    {
      key: 'REFERRAL_PERFORMANCE',
      label: 'Referral Performance Report',
      description: 'Referral conversion and commission performance by referral user.',
      supportedMetrics: ['total_referrals', 'total_commission', 'pending_commission', 'paid_commission'],
      supportedDimensions: ['referral_code', 'referral_name'],
      supportedFilters: ['search'],
      defaultConfig: {
        metrics: ['total_referrals', 'total_commission'],
        filters: {},
      },
    },
    {
      key: 'ORDER_ACTIVITY',
      label: 'Order Activity Report',
      description: 'Operational order pipeline status distribution and trends.',
      supportedMetrics: ['status_count', 'orders_total'],
      supportedDimensions: ['order_status', 'order_type'],
      supportedFilters: ['fromDate', 'toDate', 'statuses'],
      defaultConfig: {
        metrics: ['status_count', 'orders_total'],
        filters: {},
      },
    },
  ],
};

const normalizeDefinitionRow = (row: any) => ({
  id: String(row.id || ''),
  name: String(row.name || ''),
  description: row.description == null ? null : String(row.description),
  reportType: String(row.reportType || ''),
  config: parseObject(row.config),
  isActive: row.isActive !== false,
  createdById: row.createdById == null ? null : String(row.createdById),
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

const readDateFromConfig = (value: unknown) => {
  const token = String(value || '').trim();
  if (!token) return null;
  const parsed = new Date(token);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const generateGeneralSalesReport = async (config: Record<string, unknown>) => {
  const filters = parseObject(config.filters);
  const fromDate = readDateFromConfig(filters.fromDate);
  const toDate = readDateFromConfig(filters.toDate);
  const orderTypes = Array.isArray(filters.orderTypes)
    ? filters.orderTypes.map((entry) => String(entry || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const groupBy = String(config.groupBy || 'DAY').trim().toUpperCase();
  const where: any = { paymentStatus: PaymentStatus.COMPLETED };
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }
  if (orderTypes.length > 0) where.type = { in: orderTypes };
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      total: true,
      type: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const totalOrders = orders.length;
  const totalRevenue = toMoney(orders.reduce((sum, row) => sum + Number(row.total || 0), 0));
  const averageOrderValue = totalOrders > 0 ? toMoney(totalRevenue / totalOrders) : 0;
  const byType = orders.reduce<Record<string, { orders: number; revenue: number }>>((acc, row) => {
    const key = String(row.type || 'UNKNOWN');
    if (!acc[key]) acc[key] = { orders: 0, revenue: 0 };
    acc[key].orders += 1;
    acc[key].revenue = toMoney(acc[key].revenue + Number(row.total || 0));
    return acc;
  }, {});
  const bucketed = orders.reduce<Record<string, { bucket: string; orders: number; revenue: number }>>((acc, row) => {
    const date = new Date(row.createdAt);
    let bucket = date.toISOString().slice(0, 10);
    if (groupBy === 'MONTH') {
      bucket = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'WEEK') {
      const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = weekStart.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setUTCDate(weekStart.getUTCDate() + diff);
      bucket = weekStart.toISOString().slice(0, 10);
    } else if (groupBy === 'NONE') {
      bucket = String(row.type || 'UNKNOWN');
    }
    if (!acc[bucket]) acc[bucket] = { bucket, orders: 0, revenue: 0 };
    acc[bucket].orders += 1;
    acc[bucket].revenue = toMoney(acc[bucket].revenue + Number(row.total || 0));
    return acc;
  }, {});
  return {
    summary: {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      byType,
    },
    columns: ['bucket', 'orders', 'revenue'],
    rows: Object.values(bucketed),
  };
};

const generateStockReport = async (config: Record<string, unknown>) => {
  const filters = parseObject(config.filters);
  const lowStockThreshold = Math.max(1, Number(filters.lowStockThreshold || 10));
  const productTypeFilter = String(filters.productType || 'ALL').trim().toUpperCase();
  const [fabrics, readyProducts] = await Promise.all([
    prisma.fabric.findMany({
      select: {
        id: true,
        name: true,
        stockYards: true,
        status: true,
        seller: {
          select: {
            businessName: true,
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.readyToWear.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        sizeVariations: {
          select: { stock: true },
        },
        designer: {
          select: {
            businessName: true,
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    }),
  ]);
  const fabricRows =
    productTypeFilter === 'ALL' || productTypeFilter === 'FABRIC'
      ? fabrics.map((row) => ({
          productType: 'FABRIC',
          productId: row.id,
          productName: row.name,
          stockValue: Number(row.stockYards || 0),
          status: String(row.status || ''),
          ownerName:
            String(row.seller?.businessName || '').trim() ||
            `${row.seller?.user?.firstName || ''} ${row.seller?.user?.lastName || ''}`.trim(),
        }))
      : [];
  const readyRows =
    productTypeFilter === 'ALL' || productTypeFilter === 'READY_TO_WEAR'
      ? readyProducts.map((row) => ({
          productType: 'READY_TO_WEAR',
          productId: row.id,
          productName: row.name,
          stockValue: row.sizeVariations.reduce((sum, entry) => sum + Number(entry.stock || 0), 0),
          status: String(row.status || ''),
          ownerName:
            String(row.designer?.businessName || '').trim() ||
            `${row.designer?.user?.firstName || ''} ${row.designer?.user?.lastName || ''}`.trim(),
        }))
      : [];
  const rows = [...fabricRows, ...readyRows];
  const summary = {
    totalItems: rows.length,
    inStock: rows.filter((row) => row.stockValue > lowStockThreshold).length,
    lowStock: rows.filter((row) => row.stockValue > 0 && row.stockValue <= lowStockThreshold).length,
    outOfStock: rows.filter((row) => row.stockValue <= 0).length,
    approvedProducts: rows.filter((row) => row.status === ProductStatus.APPROVED).length,
  };
  return {
    summary,
    columns: ['productType', 'productName', 'ownerName', 'stockValue', 'status'],
    rows: rows.sort((a, b) => a.stockValue - b.stockValue),
  };
};

const generateVendorSalesReport = async (config: Record<string, unknown>) => {
  const filters = parseObject(config.filters);
  const vendorCategory = String(filters.vendorCategory || 'ALL').trim().toUpperCase();
  const [sellers, designers] = await Promise.all([
    prisma.fabricSellerProfile.findMany({
      select: {
        userId: true,
        businessName: true,
        totalSales: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    }),
    prisma.designerProfile.findMany({
      select: {
        userId: true,
        businessName: true,
        totalSales: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    }),
  ]);
  const sellerRows =
    vendorCategory === 'ALL' || vendorCategory === 'SELLER'
      ? sellers.map((row) => ({
          vendorCategory: 'SELLER',
          vendorUserId: row.userId,
          vendorName: String(row.businessName || '').trim() || `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim(),
          totalSalesUsd: toMoney(row.totalSales),
          accountStatus: String(row.user.status || ''),
        }))
      : [];
  const designerRows =
    vendorCategory === 'ALL' || vendorCategory === 'DESIGNER'
      ? designers.map((row) => ({
          vendorCategory: 'DESIGNER',
          vendorUserId: row.userId,
          vendorName: String(row.businessName || '').trim() || `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim(),
          totalSalesUsd: toMoney(row.totalSales),
          accountStatus: String(row.user.status || ''),
        }))
      : [];
  const rows = [...sellerRows, ...designerRows].sort((a, b) => b.totalSalesUsd - a.totalSalesUsd);
  return {
    summary: {
      vendorCount: rows.length,
      sellers: sellerRows.length,
      designers: designerRows.length,
      totalSalesUsd: toMoney(rows.reduce((sum, row) => sum + row.totalSalesUsd, 0)),
      averageSalesUsd: rows.length > 0 ? toMoney(rows.reduce((sum, row) => sum + row.totalSalesUsd, 0) / rows.length) : 0,
    },
    columns: ['vendorCategory', 'vendorName', 'totalSalesUsd', 'accountStatus'],
    rows,
  };
};

const generateReferralPerformanceReport = async (config: Record<string, unknown>) => {
  const filters = parseObject(config.filters);
  const search = String(filters.search || '').trim();
  const result = await listResellerInfluencersWithMetrics({ search: search || undefined, page: 1, limit: 500 });
  const rows = result.rows.map((row) => ({
    referralCode: row.referralCode,
    referralName: row.displayName || `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim() || 'Referral',
    email: row.user?.email || '',
    totalReferrals: Number(row.metrics?.totalReferrals || 0),
    totalCommissionUsd: toMoney(row.metrics?.totalCommissionUsd || 0),
    pendingCommissionUsd: toMoney(row.metrics?.pendingCommissionUsd || 0),
    paidCommissionUsd: toMoney(row.metrics?.paidCommissionUsd || 0),
    accountStatus: String(row.user?.status || ''),
  }));
  return {
    summary: {
      referralUsers: rows.length,
      totalReferrals: rows.reduce((sum, row) => sum + row.totalReferrals, 0),
      totalCommissionUsd: toMoney(rows.reduce((sum, row) => sum + row.totalCommissionUsd, 0)),
      pendingCommissionUsd: toMoney(rows.reduce((sum, row) => sum + row.pendingCommissionUsd, 0)),
      paidCommissionUsd: toMoney(rows.reduce((sum, row) => sum + row.paidCommissionUsd, 0)),
    },
    columns: ['referralCode', 'referralName', 'totalReferrals', 'totalCommissionUsd', 'pendingCommissionUsd', 'paidCommissionUsd'],
    rows,
  };
};

const generateOrderActivityReport = async (config: Record<string, unknown>) => {
  const filters = parseObject(config.filters);
  const fromDate = readDateFromConfig(filters.fromDate);
  const toDate = readDateFromConfig(filters.toDate);
  const statuses = Array.isArray(filters.statuses)
    ? filters.statuses.map((entry) => String(entry || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const where: any = {};
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }
  if (statuses.length > 0) where.status = { in: statuses };
  const rows = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      type: true,
      status: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status || 'UNKNOWN');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const typeCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.type || 'UNKNOWN');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    summary: {
      ordersTotal: rows.length,
      completedPayments: rows.filter((row) => row.paymentStatus === PaymentStatus.COMPLETED).length,
      statusCounts,
      typeCounts,
      grossValueUsd: toMoney(rows.reduce((sum, row) => sum + Number(row.total || 0), 0)),
    },
    columns: ['orderNumber', 'type', 'status', 'paymentStatus', 'total', 'createdAt'],
    rows: rows.map((row) => ({
      orderNumber: row.orderNumber,
      type: row.type,
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: toMoney(row.total),
      createdAt: new Date(row.createdAt).toISOString(),
    })),
  };
};

const generateReportOutput = async (reportType: string, config: Record<string, unknown>) => {
  if (reportType === 'GENERAL_SALES') return generateGeneralSalesReport(config);
  if (reportType === 'STOCK_OVERVIEW') return generateStockReport(config);
  if (reportType === 'VENDOR_SALES') return generateVendorSalesReport(config);
  if (reportType === 'REFERRAL_PERFORMANCE') return generateReferralPerformanceReport(config);
  if (reportType === 'ORDER_ACTIVITY') return generateOrderActivityReport(config);
  return {
    summary: {},
    columns: [],
    rows: [],
  };
};

router.get('/catalog', (_req, res) => {
  res.json({
    success: true,
    data: REPORT_CATALOG,
  });
});

router.get('/definitions', async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "ReportDefinition"
       ORDER BY "updatedAt" DESC`
    );
    res.json({
      success: true,
      data: (Array.isArray(rows) ? rows : []).map((row) => normalizeDefinitionRow(row)),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/definitions', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const payload = definitionSchema.parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `INSERT INTO "ReportDefinition"
        ("id","name","description","reportType","config","isActive","createdById","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,$4,$5::jsonb,$6,$7,NOW(),NOW())
       RETURNING *`,
      randomUUID(),
      payload.name,
      payload.description || null,
      payload.reportType,
      JSON.stringify(payload.config || {}),
      payload.isActive !== false,
      req.user?.id || null
    );
    const created = rows?.[0] || null;
    res.status(201).json({
      success: true,
      message: 'Report definition created.',
      data: created ? normalizeDefinitionRow(created) : null,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/definitions/:id', authorizePermissions(Permissions.USERS_MANAGE), async (req, res, next) => {
  try {
    const payload = definitionUpdateSchema.parse(req.body || {});
    const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "ReportDefinition" WHERE "id" = $1 LIMIT 1`,
      String(req.params.id || '')
    );
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Report definition not found.',
      });
    }
    const nextConfig =
      payload.config !== undefined ? JSON.stringify(payload.config || {}) : JSON.stringify(parseObject(existing.config));
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `UPDATE "ReportDefinition"
       SET "name" = COALESCE($2, "name"),
           "description" = COALESCE($3, "description"),
           "reportType" = COALESCE($4, "reportType"),
           "config" = $5::jsonb,
           "isActive" = COALESCE($6, "isActive"),
           "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      String(req.params.id || ''),
      payload.name ?? null,
      payload.description ?? null,
      payload.reportType ?? null,
      nextConfig,
      payload.isActive ?? null
    );
    const updated = rows?.[0] || null;
    res.json({
      success: true,
      message: 'Report definition updated.',
      data: updated ? normalizeDefinitionRow(updated) : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const payload = generateSchema.parse(req.body || {});
    let reportType = payload.reportType ? String(payload.reportType) : '';
    let config = parseObject(payload.config);
    let definition: Record<string, unknown> | null = null;
    if (payload.definitionId) {
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT *
         FROM "ReportDefinition"
         WHERE "id" = $1
         LIMIT 1`,
        String(payload.definitionId)
      );
      const row = rows?.[0] || null;
      if (!row) {
        return res.status(404).json({
          success: false,
          message: 'Report definition not found.',
        });
      }
      reportType = String(row.reportType || reportType || '').trim().toUpperCase();
      definition = normalizeDefinitionRow(row);
      config = {
        ...parseObject(row.config),
        ...config,
      };
    } else {
      reportType = String(reportType || '').trim().toUpperCase();
    }
    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: 'reportType or definitionId is required.',
      });
    }
    const output = await generateReportOutput(reportType, config);
    return res.json({
      success: true,
      data: {
        reportType,
        definition,
        config,
        generatedAt: new Date().toISOString(),
        ...output,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
