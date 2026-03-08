import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus, ProductStatus, ProductType } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import {
  getPermissionCatalog,
  hasPermissionFromGrants,
  Permissions,
  sanitizePermissionGrants,
} from '../rbac';

const router = Router();

function parsePagination(pageValue: unknown, limitValue: unknown, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(String(pageValue ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(limitValue ?? defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const HOMEPAGE_TOP_STRIP_SETTINGS_KEY = 'HOMEPAGE_TOP_STRIP';
const ADMIN_TOP_STRIP_DEFAULTS = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};
const adminTopStripUpdateSchema = z.object({
  messages: z.array(z.string().trim().min(1)).min(1),
  separator: z.string().trim().min(1).max(8).optional(),
  repeatCount: z.coerce.number().int().min(2).max(12).optional(),
  animationSeconds: z.coerce.number().int().min(8).max(120).optional(),
  textColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

const normalizeAdminTopStripSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_TOP_STRIP_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages)
    ? row.messages
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
  return {
    messages: messages.length > 0 ? messages : [...ADMIN_TOP_STRIP_DEFAULTS.messages],
    separator:
      typeof row.separator === 'string' && row.separator.trim()
        ? row.separator.trim().slice(0, 8)
        : ADMIN_TOP_STRIP_DEFAULTS.separator,
    repeatCount: Number.isFinite(Number(row.repeatCount))
      ? Math.max(2, Math.min(12, Math.round(Number(row.repeatCount))))
      : ADMIN_TOP_STRIP_DEFAULTS.repeatCount,
    animationSeconds: Number.isFinite(Number(row.animationSeconds))
      ? Math.max(8, Math.min(120, Math.round(Number(row.animationSeconds))))
      : ADMIN_TOP_STRIP_DEFAULTS.animationSeconds,
    textColor: normalizeHexColor(row.textColor, ADMIN_TOP_STRIP_DEFAULTS.textColor),
    backgroundColor: normalizeHexColor(row.backgroundColor, ADMIN_TOP_STRIP_DEFAULTS.backgroundColor),
  };
};

const ensureHomepageSectionSettingTable = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
};

const readAdminTopStripSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_TOP_STRIP_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminTopStripSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_TOP_STRIP_DEFAULTS } };
  }
};

const saveAdminTopStripSettings = async (input: unknown) => {
  const parsed = adminTopStripUpdateSchema.parse(input);
  const merged = normalizeAdminTopStripSettings(parsed);
  const existing = await readAdminTopStripSettings();
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};

const adminPermissionListSchema = z.array(z.string()).default([]);
const adminRoleCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  permissions: adminPermissionListSchema,
  isActive: z.boolean().optional().default(true),
});
const adminRoleUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: adminPermissionListSchema.optional(),
  isActive: z.boolean().optional(),
});
const adminUserRoleAssignmentSchema = z.object({
  adminRoleId: z.string().uuid().nullable().optional(),
  permissions: adminPermissionListSchema.optional(),
});

const adminUserCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  phone: z.string().optional(),
});

const adminUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().nullable().optional(),
});

const vendorCreateMinimalSchema = z.object({
  role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  businessName: z.string().min(1),
  country: z.string().min(1),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const adminProductTypeSchema = z.nativeEnum(ProductType);
const featuredSectionSchema = z.enum([
  'FEATURED_DESIGNS',
  'FEATURED_FABRICS',
  'FEATURED_READY_TO_WEAR',
  'TRENDING_NOW',
  'NEW_ARRIVALS',
]);
const productFeaturedSchema = z.object({
  isFeatured: z.boolean(),
  section: featuredSectionSchema.optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const productModerationSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SUSPEND', 'PUBLISH', 'UNPUBLISH']),
  message: z.string().trim().min(1).optional(),
  notifyVendor: z.boolean().default(true),
});

const bulkModerationSchema = z.object({
  productType: adminProductTypeSchema,
  productIds: z.array(z.string().uuid()).min(1),
  action: productModerationSchema.shape.action,
  message: z.string().trim().min(1).optional(),
  notifyVendor: z.boolean().default(true),
});

const adminProductCreateSchema = z.object({
  type: adminProductTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().optional(),
  materialTypeId: z.string().optional(),
  sellerId: z.string().optional(),
  designerId: z.string().optional(),
  price: z.coerce.number().positive(),
  minYards: z.coerce.number().int().min(1).optional(),
  stockYards: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  size: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  image: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isAvailable: z.boolean().optional(),
});

const adminProductUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  materialTypeId: z.string().optional(),
  price: z.coerce.number().positive().optional(),
  minYards: z.coerce.number().int().min(1).optional(),
  stockYards: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  images: z.array(z.string().url()).optional(),
  image: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isAvailable: z.boolean().optional(),
});

const vendorRoleSchema = z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']);
const vendorProfileStatusSchema = z.enum(['INCOMPLETE', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const vendorProfileFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.enum([
    'TEXT',
    'TEXTAREA',
    'NUMBER',
    'DATE',
    'SELECT',
    'MULTI_SELECT',
    'EMAIL',
    'PHONE',
    'URL',
    'DOCUMENT',
    'IMAGE',
  ]),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});
const measurementTemplateSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).default('cm'),
  isRequired: z.boolean().default(true),
  instructions: z.string().optional(),
});

const parseDateValue = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getDefaultFeaturedSectionForType = (productType: ProductType): z.infer<typeof featuredSectionSchema> => {
  if (productType === ProductType.FABRIC) return 'FEATURED_FABRICS';
  if (productType === ProductType.READY_TO_WEAR) return 'FEATURED_READY_TO_WEAR';
  return 'FEATURED_DESIGNS';
};

const getImagePolicyForProductType = (productType: ProductType) => {
  if (productType === ProductType.READY_TO_WEAR) {
    return { min: 3, max: 4, label: 'Ready To Wear' };
  }
  if (productType === ProductType.DESIGN) {
    return { min: 4, max: 6, label: 'Custom To Wear / Designer' };
  }
  return { min: 4, max: 6, label: 'Fabric / Designer' };
};

let adminRbacSchemaEnsured = false;
let adminRbacSchemaPromise: Promise<void> | null = null;

const ensureAdminRbacSchema = async () => {
  if (adminRbacSchemaEnsured) return;
  if (adminRbacSchemaPromise) {
    await adminRbacSchemaPromise;
    return;
  }

  adminRbacSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "AdminRole" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AdminRole_name_key" ON "AdminRole"("name")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminRole_isActive_idx" ON "AdminRole"("isActive")`);
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'AdminProfile'
            AND column_name = 'adminRoleId'
        ) THEN
          ALTER TABLE "AdminProfile" ADD COLUMN "adminRoleId" TEXT;
        END IF;
      END $$;`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AdminProfile_adminRoleId_idx" ON "AdminProfile"("adminRoleId")`
    );
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'AdminProfile_adminRoleId_fkey'
        ) THEN
          ALTER TABLE "AdminProfile"
          ADD CONSTRAINT "AdminProfile_adminRoleId_fkey"
          FOREIGN KEY ("adminRoleId") REFERENCES "AdminRole"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "VendorProfileField" (
        "id" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "fieldType" TEXT NOT NULL,
        "placeholder" TEXT,
        "helpText" TEXT,
        "required" BOOLEAN NOT NULL DEFAULT false,
        "options" JSONB,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "updatedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VendorProfileField_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileField_role_key_key" ON "VendorProfileField"("role", "key")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "VendorProfileField_role_sortOrder_idx" ON "VendorProfileField"("role", "sortOrder")`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "VendorProfileSubmission" (
        "id" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "businessName" TEXT,
        "profileStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
        "profileData" JSONB,
        "profileSubmittedAt" TIMESTAMP(3),
        "profileReviewedAt" TIMESTAMP(3),
        "profileReviewNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role", "userId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "VendorProfileSubmission_status_idx" ON "VendorProfileSubmission"("profileStatus")`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "MeasurementTemplate" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "unit" TEXT NOT NULL DEFAULT 'cm',
        "isRequired" BOOLEAN NOT NULL DEFAULT true,
        "instructions" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "MeasurementTemplate_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "MeasurementTemplate_name_key" ON "MeasurementTemplate"("name")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MeasurementTemplate_displayOrder_idx" ON "MeasurementTemplate"("displayOrder")`
    );

    const allPermissions = JSON.stringify(getPermissionCatalog().map((entry) => entry.key));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AdminRole" ("id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, true, true, NOW(), NOW())
       ON CONFLICT ("name") DO NOTHING`,
      randomUUID(),
      'Super Administrator',
      'Full administrative access across all system modules.',
      allPermissions
    );

    adminRbacSchemaEnsured = true;
  })();

  try {
    await adminRbacSchemaPromise;
  } finally {
    adminRbacSchemaPromise = null;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureAdminRbacSchema();
  } catch (error) {
    console.error('Failed to ensure admin RBAC schema:', error);
  }
  next();
});

// All admin routes require admin role
router.use(authenticate);
router.use(authorizePermissions(Permissions.ADMIN_ACCESS));

const resolveAdminRoutePermissions = (method: string, path: string) => {
  if (/^\/users\/[^/]+\/admin-access$/.test(path) || path.startsWith('/roles') || path.startsWith('/permission-catalog')) {
    return [Permissions.ADMIN_ROLE_MANAGE];
  }
  if (path.startsWith('/dashboard')) return [Permissions.ADMIN_DASHBOARD_READ];
  if (path.startsWith('/traffic-report')) return [Permissions.TRAFFIC_READ];
  if (path.startsWith('/security/session-audit')) return [Permissions.SESSION_AUDIT_READ];
  if (path.startsWith('/users/pending')) return [Permissions.USERS_READ];
  if (path.startsWith('/users')) {
    return method === 'GET' ? [Permissions.USERS_READ] : [Permissions.USERS_MANAGE];
  }
  if (path.startsWith('/vendor-profile/fields')) {
    return method === 'GET' ? [Permissions.VENDOR_PROFILES_READ] : [Permissions.VENDOR_PROFILES_REVIEW];
  }
  if (path.startsWith('/vendor-profiles')) {
    return method === 'GET' ? [Permissions.VENDOR_PROFILES_READ] : [Permissions.VENDOR_PROFILES_REVIEW];
  }
  if (path.startsWith('/products') || path.startsWith('/categories') || path.startsWith('/materials')) {
    return [Permissions.PRODUCTS_MANAGE];
  }
  if (path.startsWith('/measurement-templates')) return [Permissions.MEASUREMENT_TEMPLATES_MANAGE];
  if (path.startsWith('/pricing-rules')) return [Permissions.PRICING_MANAGE];
  if (path.startsWith('/orders')) return [Permissions.ORDERS_MANAGE];
  return [];
};

router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }
  const grants = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  const routePermissions = resolveAdminRoutePermissions(req.method, req.path);
  const missing = routePermissions.filter((permission) => !hasPermissionFromGrants(grants, permission));
  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource.',
    });
  }
  return next();
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalFabricSellers,
      totalDesigners,
      totalQa,
      pendingApprovals,
      totalOrders,
      totalRevenue,
      totalProducts,
      recentOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.user.count({ where: { role: UserRole.FABRIC_SELLER } }),
      prisma.user.count({ where: { role: UserRole.FASHION_DESIGNER } }),
      prisma.user.count({ where: { role: UserRole.QA_TEAM } }),
      prisma.user.count({
        where: {
          role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] },
          status: UserStatus.PENDING,
        },
      }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { paymentStatus: 'COMPLETED' },
        _sum: { total: true },
      }),
      prisma.$transaction([
        prisma.fabric.count(),
        prisma.design.count(),
        prisma.readyToWear.count(),
      ]).then(([fabrics, designs, rtw]) => fabrics + designs + rtw),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          fabricSellers: totalFabricSellers,
          designers: totalDesigners,
          qa: totalQa,
          pendingApprovals,
        },
        orders: {
          total: totalOrders,
          revenue: totalRevenue._sum.total || 0,
        },
        products: {
          total: totalProducts,
        },
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users with filters
router.get('/users', async (req, res, next) => {
  try {
    const { role, status, search, page, limit } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pagination = parsePagination(page, limit, 20);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          lastLogin: true,
          adminProfile: {
            select: {
              permissions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const adminRoleRows =
      userIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ userId: string; adminRoleId: string | null }>>(
            `SELECT "userId", "adminRoleId" FROM "AdminProfile" WHERE "userId" = ANY($1::text[])`,
            userIds
          )
        : [];
    const adminRoleByUserId = new Map(adminRoleRows.map((row) => [String(row.userId), row.adminRoleId || null]));
    const usersWithAdminMeta = users.map((user) => ({
      ...user,
      adminProfile: user.adminProfile
        ? {
            ...user.adminProfile,
            permissions: sanitizePermissionGrants(user.adminProfile.permissions),
            adminRoleId: adminRoleByUserId.get(user.id) ?? null,
          }
        : null,
    }));

    res.json({
      success: true,
      data: {
        users: usersWithAdminMeta,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const data = adminUserCreateSchema.parse(req.body);
    const password = await bcrypt.hash(data.password, 10);

    const created = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        password,
        role: data.role,
        status: data.status,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (created.role === UserRole.ADMINISTRATOR) {
      await prisma.adminProfile.upsert({
        where: { userId: created.id },
        create: { userId: created.id },
        update: {},
      });
    }

    if (created.role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          businessName: `${created.firstName} ${created.lastName}`.trim(),
          businessEmail: created.email,
          businessPhone: data.phone?.trim() || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (created.role === UserRole.FASHION_DESIGNER) {
      await prisma.designerProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          businessName: `${created.firstName} ${created.lastName}`.trim(),
          businessEmail: created.email,
          businessPhone: data.phone?.trim() || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (created.role === UserRole.QA_TEAM) {
      await prisma.qAProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: created,
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

router.patch('/users/:id', async (req, res, next) => {
  try {
    const data = adminUserUpdateSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        email: data.email ? data.email.toLowerCase().trim() : undefined,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        role: data.role,
        status: data.status,
        phone: data.phone === null ? null : data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (updated.role === UserRole.ADMINISTRATOR) {
      await prisma.adminProfile.upsert({
        where: { userId: updated.id },
        create: { userId: updated.id },
        update: {},
      });
    }

    if (updated.role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          businessName: `${updated.firstName} ${updated.lastName}`.trim(),
          businessEmail: updated.email,
          businessPhone: updated.phone || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (updated.role === UserRole.FASHION_DESIGNER) {
      await prisma.designerProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          businessName: `${updated.firstName} ${updated.lastName}`.trim(),
          businessEmail: updated.email,
          businessPhone: updated.phone || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (updated.role === UserRole.QA_TEAM) {
      await prisma.qAProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: updated,
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

router.post('/vendor-profiles/create-minimal', async (req, res, next) => {
  try {
    const payload = vendorCreateMinimalSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const role = payload.role === 'FABRIC_SELLER' ? UserRole.FABRIC_SELLER : UserRole.FASHION_DESIGNER;

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        role,
        status: UserStatus.PENDING,
        phone: payload.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.create({
        data: {
          userId: user.id,
          businessName: payload.businessName.trim(),
          businessEmail: payload.email.toLowerCase().trim(),
          businessPhone: payload.phone?.trim() || '',
          country: payload.country.trim(),
          city: payload.city?.trim() || '',
          address: payload.address?.trim() || '',
        },
      });
    } else {
      await prisma.designerProfile.create({
        data: {
          userId: user.id,
          businessName: payload.businessName.trim(),
          businessEmail: payload.email.toLowerCase().trim(),
          businessPhone: payload.phone?.trim() || '',
          country: payload.country.trim(),
          city: payload.city?.trim() || '',
          address: payload.address?.trim() || '',
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vendor created. Vendor can complete profile after first login.',
      data: user,
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

// Get pending approvals
router.get('/users/pending', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: UserStatus.PENDING,
        role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] },
      },
      include: {
        fabricSellerProfile: true,
        designerProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

// Approve/reject user
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.nativeEnum(UserStatus),
      reason: z.string().optional(),
    });
    const { status, reason } = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    // TODO: Send notification email to user

    res.json({
      success: true,
      message: `User ${status.toLowerCase()} successfully.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

const parseStoredPermissions = (value: unknown) => {
  if (Array.isArray(value)) {
    return sanitizePermissionGrants(value);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return sanitizePermissionGrants(parsed);
    } catch {
      return [];
    }
  }
  return [];
};

type VendorRole = z.infer<typeof vendorRoleSchema>;
type VendorProfileStatus = z.infer<typeof vendorProfileStatusSchema>;

const normalizeVendorProfileStatus = (value: unknown): VendorProfileStatus => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOMPLETE' || normalized === 'SUBMITTED' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'SUBMITTED';
};

const getVendorProfileFields = async (role: VendorRole) => {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
     FROM "VendorProfileField"
     WHERE "role" = $1
     ORDER BY "sortOrder" ASC, "createdAt" ASC`,
    role
  );
  return rows.map((row) => ({
    ...row,
    required: Boolean(row.required),
    isActive: Boolean(row.isActive),
    options: Array.isArray(row.options) ? row.options : [],
  }));
};

const getVendorSubmissionRows = async () => {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","updatedAt"
     FROM "VendorProfileSubmission"`
  );
  return new Map(rows.map((row) => [`${row.role}:${row.userId}`, row]));
};

// ==================== TRAFFIC / AUDIT / VENDOR GOVERNANCE ====================

router.get('/traffic-report', async (req, res, next) => {
  try {
    const querySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
      vendorUserId: z.string().uuid().optional(),
      page: z.string().optional(),
    });
    const filters = querySchema.parse(req.query);

    const where: any = {};
    const startDate = parseDateValue(filters.startDate);
    const endDate = parseDateValue(filters.endDate);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        designOrder: {
          include: {
            design: {
              select: {
                id: true,
                name: true,
                designer: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
        fabricOrder: {
          include: {
            fabric: {
              select: {
                id: true,
                name: true,
                seller: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
        readyToWearItems: {
          include: {
            readyToWear: {
              select: {
                id: true,
                name: true,
                designer: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type Entry = {
      orderId: string;
      productId: string;
      productName: string;
      productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      page: string;
      vendorUserId: string;
      vendorName: string;
      vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
      revenue: number;
    };

    const entries: Entry[] = [];
    for (const order of orders) {
      if (order.designOrder?.design?.designer?.userId) {
        entries.push({
          orderId: order.id,
          productId: order.designOrder.design.id,
          productName: order.designOrder.design.name,
          productType: 'DESIGN',
          page: `/designs/${order.designOrder.design.id}`,
          vendorUserId: order.designOrder.design.designer.userId,
          vendorName: order.designOrder.design.designer.businessName || 'Designer',
          vendorRole: 'FASHION_DESIGNER',
          revenue: Number(order.designOrder.price || 0),
        });
      }
      if (order.fabricOrder?.fabric?.seller?.userId) {
        entries.push({
          orderId: order.id,
          productId: order.fabricOrder.fabric.id,
          productName: order.fabricOrder.fabric.name,
          productType: 'FABRIC',
          page: `/fabrics/${order.fabricOrder.fabric.id}`,
          vendorUserId: order.fabricOrder.fabric.seller.userId,
          vendorName: order.fabricOrder.fabric.seller.businessName || 'Fabric Seller',
          vendorRole: 'FABRIC_SELLER',
          revenue: Number(order.fabricOrder.totalPrice || 0),
        });
      }
      for (const item of order.readyToWearItems || []) {
        if (!item.readyToWear?.designer?.userId) continue;
        entries.push({
          orderId: order.id,
          productId: item.readyToWear.id,
          productName: item.readyToWear.name,
          productType: 'READY_TO_WEAR',
          page: `/ready-to-wear/${item.readyToWear.id}`,
          vendorUserId: item.readyToWear.designer.userId,
          vendorName: item.readyToWear.designer.businessName || 'Designer',
          vendorRole: 'FASHION_DESIGNER',
          revenue: Number(item.price || 0) * Number(item.quantity || 1),
        });
      }
    }

    const filtered = entries.filter((entry) => {
      if (filters.productType && entry.productType !== filters.productType) return false;
      if (filters.vendorUserId && entry.vendorUserId !== filters.vendorUserId) return false;
      if (filters.page && entry.page !== filters.page) return false;
      return true;
    });

    const vendors = new Map<string, any>();
    const products = new Map<string, any>();
    const pages = new Map<string, any>();
    const uniqueOrders = new Set<string>();
    let totalRevenue = 0;

    for (const entry of filtered) {
      uniqueOrders.add(entry.orderId);
      totalRevenue += entry.revenue;

      const vendorKey = `${entry.vendorRole}:${entry.vendorUserId}`;
      const vendorAgg = vendors.get(vendorKey) || {
        vendorUserId: entry.vendorUserId,
        vendorName: entry.vendorName,
        vendorRole: entry.vendorRole,
        orderCount: 0,
        revenue: 0,
      };
      vendorAgg.orderCount += 1;
      vendorAgg.revenue += entry.revenue;
      vendors.set(vendorKey, vendorAgg);

      const productKey = `${entry.productType}:${entry.productId}`;
      const productAgg = products.get(productKey) || {
        productId: entry.productId,
        productName: entry.productName,
        productType: entry.productType,
        page: entry.page,
        orderCount: 0,
        revenue: 0,
      };
      productAgg.orderCount += 1;
      productAgg.revenue += entry.revenue;
      products.set(productKey, productAgg);

      const pageAgg = pages.get(entry.page) || {
        page: entry.page,
        orderCount: 0,
        revenue: 0,
      };
      pageAgg.orderCount += 1;
      pageAgg.revenue += entry.revenue;
      pages.set(entry.page, pageAgg);
    }

    res.json({
      success: true,
      data: {
        filters: {
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
          productType: filters.productType || null,
          vendorUserId: filters.vendorUserId || null,
          page: filters.page || null,
        },
        summary: {
          totalOrders: uniqueOrders.size,
          totalLineItems: filtered.length,
          totalRevenue,
        },
        vendors: Array.from(vendors.values()).sort((a, b) => b.revenue - a.revenue),
        products: Array.from(products.values()).sort((a, b) => b.orderCount - a.orderCount),
        pages: Array.from(pages.values()).sort((a, b) => b.orderCount - a.orderCount),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/security/session-audit', async (req, res, next) => {
  try {
    const querySchema = z.object({
      action: z.enum(['VENDOR_SESSION_STARTED', 'VENDOR_SESSION_REPLACED', 'VENDOR_SESSION_LOGOUT']).optional(),
      role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']).optional(),
      userId: z.string().uuid().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const filters = querySchema.parse(req.query);
    const pagination = parsePagination(filters.page, filters.limit, 20);

    const where: any = {
      action: filters.action
        ? filters.action
        : {
            in: ['VENDOR_SESSION_STARTED', 'VENDOR_SESSION_REPLACED', 'VENDOR_SESSION_LOGOUT'],
          },
    };
    if (filters.userId) where.userId = filters.userId;
    if (filters.role) where.user = { role: filters.role };

    const [events, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        events: events.map((event) => {
          const details = (event.details as any) || {};
          return {
            id: event.id,
            action: event.action,
            createdAt: event.createdAt,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            user: event.user,
            details: {
              role: details.role || event.user?.role || null,
              deviceType: details.deviceType || 'unknown',
              sessionIssuedAt: details.sessionIssuedAt || null,
              previousSessionAt: details.previousSessionAt || null,
            },
          };
        }),
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

router.get('/vendor-profile/fields', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.query.role || 'FABRIC_SELLER'));
    const fields = await getVendorProfileFields(role);
    res.json({
      success: true,
      data: {
        role,
        fields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/vendor-profile/fields', async (req, res, next) => {
  try {
    const schema = z.object({
      role: vendorRoleSchema,
      fields: z.array(vendorProfileFieldSchema).min(1),
    });
    const payload = schema.parse(req.body);
    await prisma.$executeRawUnsafe(`DELETE FROM "VendorProfileField" WHERE "role" = $1`, payload.role);
    for (let index = 0; index < payload.fields.length; index += 1) {
      const field = payload.fields[index];
      await prisma.$executeRawUnsafe(
        `INSERT INTO "VendorProfileField"
          ("id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive","createdById","updatedById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,NOW(),NOW())`,
        randomUUID(),
        payload.role,
        String(field.key).trim(),
        String(field.label).trim(),
        field.fieldType,
        field.placeholder || null,
        field.helpText || null,
        Boolean(field.required),
        JSON.stringify(field.options || []),
        field.sortOrder ?? index + 1,
        field.isActive !== false,
        req.user?.id || null,
        req.user?.id || null
      );
    }
    const fields = await getVendorProfileFields(payload.role);
    res.json({
      success: true,
      message: 'Vendor profile fields updated successfully.',
      data: { role: payload.role, fields },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor-profiles', async (req, res, next) => {
  try {
    const schema = z.object({
      role: vendorRoleSchema.optional(),
      status: vendorProfileStatusSchema.optional(),
      search: z.string().trim().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const query = schema.parse(req.query);
    const pagination = parsePagination(query.page, query.limit, 20);
    const search = query.search?.trim().toLowerCase();

    const [sellers, designers, submissions] = await Promise.all([
      query.role && query.role !== 'FABRIC_SELLER'
        ? Promise.resolve([])
        : prisma.fabricSellerProfile.findMany({
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, status: true },
              },
            },
            orderBy: { updatedAt: 'desc' },
          }),
      query.role && query.role !== 'FASHION_DESIGNER'
        ? Promise.resolve([])
        : prisma.designerProfile.findMany({
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, status: true },
              },
            },
            orderBy: { updatedAt: 'desc' },
          }),
      getVendorSubmissionRows(),
    ]);

    const rows = [
      ...sellers.map((profile) => {
        const submission = submissions.get(`FABRIC_SELLER:${profile.userId}`);
        const profileStatus = submission
          ? normalizeVendorProfileStatus(submission.profileStatus)
          : profile.isVerified
            ? 'APPROVED'
            : profile.user.status === UserStatus.PENDING
              ? 'SUBMITTED'
              : 'INCOMPLETE';
        return {
          role: 'FABRIC_SELLER' as const,
          userId: profile.userId,
          profileId: profile.id,
          businessName: profile.businessName,
          profileStatus,
          isVerified: profile.isVerified,
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
          profileData: submission?.profileData || {},
          user: profile.user,
          updatedAt: submission?.updatedAt || profile.updatedAt,
        };
      }),
      ...designers.map((profile) => {
        const submission = submissions.get(`FASHION_DESIGNER:${profile.userId}`);
        const profileStatus = submission
          ? normalizeVendorProfileStatus(submission.profileStatus)
          : profile.isVerified
            ? 'APPROVED'
            : profile.user.status === UserStatus.PENDING
              ? 'SUBMITTED'
              : 'INCOMPLETE';
        return {
          role: 'FASHION_DESIGNER' as const,
          userId: profile.userId,
          profileId: profile.id,
          businessName: profile.businessName,
          profileStatus,
          isVerified: profile.isVerified,
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
          profileData: submission?.profileData || {},
          user: profile.user,
          updatedAt: submission?.updatedAt || profile.updatedAt,
        };
      }),
    ]
      .filter((row) => {
        if (query.status && row.profileStatus !== query.status) return false;
        if (!search) return true;
        return (
          row.businessName?.toLowerCase().includes(search) ||
          row.user.email?.toLowerCase().includes(search) ||
          `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim().toLowerCase().includes(search)
        );
      })
      .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)));

    const paged = rows.slice(pagination.skip, pagination.skip + pagination.limit);
    res.json({
      success: true,
      data: {
        profiles: paged,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: rows.length,
          pages: Math.max(1, Math.ceil(rows.length / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor-profiles/:role/:userId', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.params.role || ''));
    const userId = String(req.params.userId || '');
    const [submissionRows, fields] = await Promise.all([
      prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes"
         FROM "VendorProfileSubmission"
         WHERE "role" = $1 AND "userId" = $2
         LIMIT 1`,
        role,
        userId
      ),
      getVendorProfileFields(role),
    ]);
    const submission = submissionRows[0] || null;

    if (role === 'FABRIC_SELLER') {
      const profile = await prisma.fabricSellerProfile.findFirst({
        where: { userId },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
      });
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
      }
      return res.json({
        success: true,
        data: {
          role,
          user: profile.user,
          profile: {
            ...profile,
            profileStatus: submission ? normalizeVendorProfileStatus(submission.profileStatus) : profile.isVerified ? 'APPROVED' : 'SUBMITTED',
            profileData: submission?.profileData || {},
            profileSubmittedAt: submission?.profileSubmittedAt || null,
            profileReviewedAt: submission?.profileReviewedAt || null,
            profileReviewNotes: submission?.profileReviewNotes || null,
          },
          fields,
        },
      });
    }

    const profile = await prisma.designerProfile.findFirst({
      where: { userId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }
    return res.json({
      success: true,
      data: {
        role,
        user: profile.user,
        profile: {
          ...profile,
          profileStatus: submission ? normalizeVendorProfileStatus(submission.profileStatus) : profile.isVerified ? 'APPROVED' : 'SUBMITTED',
          profileData: submission?.profileData || {},
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
        },
        fields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/vendor-profiles/:role/:userId/review', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.params.role || ''));
    const userId = String(req.params.userId || '');
    const payload = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","profileStatus","profileReviewNotes","profileReviewedAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "profileStatus" = EXCLUDED."profileStatus",
         "profileReviewNotes" = EXCLUDED."profileReviewNotes",
         "profileReviewedAt" = EXCLUDED."profileReviewedAt",
         "updatedAt" = NOW()`,
      randomUUID(),
      role,
      userId,
      payload.status,
      payload.notes || null,
      now
    );

    if (role === 'FABRIC_SELLER') {
      await prisma.fabricSellerProfile.updateMany({
        where: { userId },
        data: { isVerified: payload.status === 'APPROVED' },
      });
    } else {
      await prisma.designerProfile.updateMany({
        where: { userId },
        data: { isVerified: payload.status === 'APPROVED' },
      });
    }

    if (payload.status === 'APPROVED') {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
    }

    await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId,
          type: payload.status === 'APPROVED' ? 'SYSTEM' : 'NEW_MESSAGE',
          title: payload.status === 'APPROVED' ? 'Vendor profile approved' : 'Vendor profile rejected',
          message:
            payload.status === 'APPROVED'
              ? 'Your vendor profile has been approved. You can now upload products.'
              : payload.notes || 'Your vendor profile requires corrections before approval.',
          relatedType: 'PROFILE',
          relatedId: userId,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'VENDOR_PROFILE_REVIEWED',
          details: {
            role,
            vendorUserId: userId,
            status: payload.status,
            notes: payload.notes || null,
          },
        },
      }),
    ]);

    res.json({
      success: true,
      message: `Vendor profile ${payload.status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/measurement-templates', async (_req, res, next) => {
  try {
    const templates = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","name","unit","isRequired","instructions","displayOrder","isActive"
       FROM "MeasurementTemplate"
       WHERE "isActive" = true
       ORDER BY "displayOrder" ASC, "name" ASC`
    );
    res.json({
      success: true,
      data: templates.map((item) => ({
        name: item.name,
        unit: item.unit,
        isRequired: Boolean(item.isRequired),
        instructions: item.instructions || '',
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/measurement-templates', async (req, res, next) => {
  try {
    const schema = z.object({
      templates: z.array(measurementTemplateSchema).min(1),
    });
    const payload = schema.parse(req.body);
    await prisma.$executeRawUnsafe(`DELETE FROM "MeasurementTemplate"`);
    for (let index = 0; index < payload.templates.length; index += 1) {
      const item = payload.templates[index];
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MeasurementTemplate"
          ("id","name","unit","isRequired","instructions","displayOrder","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW())`,
        randomUUID(),
        item.name.trim(),
        item.unit.trim(),
        Boolean(item.isRequired),
        item.instructions?.trim() || '',
        index + 1
      );
    }
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'MEASUREMENT_TEMPLATES_UPDATED',
        details: { templates: payload.templates },
      },
    });
    res.json({
      success: true,
      message: 'Measurement templates updated successfully.',
      data: payload.templates,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ADMIN ROLES & PERMISSIONS ====================

router.get('/permission-catalog', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (_req, res) => {
  const catalog = getPermissionCatalog();
  res.json({
    success: true,
    data: {
      catalog,
      groups: Array.from(new Set(catalog.map((item) => item.group))),
    },
  });
});

router.get('/roles', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (_req, res, next) => {
  try {
    const roles = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        assignedAdmins: number;
      }>
    >(
      `SELECT r."id",
              r."name",
              r."description",
              r."permissions",
              r."isSystem",
              r."isActive",
              r."createdAt",
              r."updatedAt",
              COALESCE(COUNT(ap."id"), 0)::int AS "assignedAdmins"
       FROM "AdminRole" r
       LEFT JOIN "AdminProfile" ap ON ap."adminRoleId" = r."id"
       GROUP BY r."id", r."name", r."description", r."permissions", r."isSystem", r."isActive", r."createdAt", r."updatedAt"
       ORDER BY r."isSystem" DESC, r."name" ASC`
    );

    res.json({
      success: true,
      data: roles.map((role) => ({
        ...role,
        permissions: parseStoredPermissions(role.permissions),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/roles', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminRoleCreateSchema.parse(req.body);
    const permissions = sanitizePermissionGrants(payload.permissions);
    const roleRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      `INSERT INTO "AdminRole" ("id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, false, $5, NOW(), NOW())
       RETURNING "id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt"`,
      randomUUID(),
      payload.name.trim(),
      payload.description?.trim() || null,
      JSON.stringify(permissions),
      payload.isActive ?? true
    );

    const created = roleRows[0];
    res.status(201).json({
      success: true,
      data: {
        ...created,
        permissions: parseStoredPermissions(created?.permissions),
        assignedAdmins: 0,
      },
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An admin role with this name already exists.',
      });
    }
    next(error);
  }
});

router.patch('/roles/:id', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminRoleUpdateSchema.parse(req.body);
    const existingRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; isSystem: boolean; permissions: unknown }>
    >(`SELECT "id", "isSystem", "permissions" FROM "AdminRole" WHERE "id" = $1 LIMIT 1`, req.params.id);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin role not found.' });
    }
    if (existing.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be modified.' });
    }

    const permissions =
      payload.permissions !== undefined
        ? sanitizePermissionGrants(payload.permissions)
        : parseStoredPermissions(existing.permissions);

    const roleRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      `UPDATE "AdminRole"
       SET "name" = COALESCE($1, "name"),
           "description" = CASE WHEN $2::boolean THEN NULL ELSE COALESCE($3, "description") END,
           "permissions" = $4::jsonb,
           "isActive" = COALESCE($5, "isActive"),
           "updatedAt" = NOW()
       WHERE "id" = $6
       RETURNING "id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt"`,
      payload.name?.trim() || null,
      payload.description === null,
      payload.description?.trim() || null,
      JSON.stringify(permissions),
      payload.isActive ?? null,
      req.params.id
    );

    const updated = roleRows[0];
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(COUNT(*), 0)::int AS "total" FROM "AdminProfile" WHERE "adminRoleId" = $1`,
      req.params.id
    );
    res.json({
      success: true,
      data: {
        ...updated,
        permissions: parseStoredPermissions(updated?.permissions),
        assignedAdmins: Number(countRows[0]?.total || 0),
      },
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An admin role with this name already exists.',
      });
    }
    next(error);
  }
});

router.delete('/roles/:id', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; isSystem: boolean }>>(
      `SELECT "id", "isSystem" FROM "AdminRole" WHERE "id" = $1 LIMIT 1`,
      req.params.id
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin role not found.' });
    }
    if (existing.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be deleted.' });
    }

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(COUNT(*), 0)::int AS "total" FROM "AdminProfile" WHERE "adminRoleId" = $1`,
      req.params.id
    );
    if (Number(countRows[0]?.total || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: 'This role is still assigned to one or more administrators.',
      });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "AdminRole" WHERE "id" = $1`, req.params.id);
    res.json({ success: true, message: 'Admin role deleted.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/admin-access', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminUserRoleAssignmentSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role !== UserRole.ADMINISTRATOR) {
      return res.status(400).json({
        success: false,
        message: 'Only administrator users can receive admin role assignments.',
      });
    }

    let rolePermissions: string[] = [];
    let selectedRole: { id: string; name: string; isActive: boolean } | null = null;
    if (payload.adminRoleId) {
      const roleRows = await prisma.$queryRawUnsafe<
        Array<{ id: string; name: string; permissions: unknown; isActive: boolean }>
      >(
        `SELECT "id", "name", "permissions", "isActive"
         FROM "AdminRole"
         WHERE "id" = $1
         LIMIT 1`,
        payload.adminRoleId
      );
      const role = roleRows[0];
      if (!role || !role.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Selected admin role is invalid or inactive.',
        });
      }
      rolePermissions = parseStoredPermissions(role.permissions);
      selectedRole = { id: role.id, name: role.name, isActive: role.isActive };
    }

    const nextPermissions =
      payload.permissions !== undefined
        ? sanitizePermissionGrants(payload.permissions)
        : payload.adminRoleId !== undefined
          ? rolePermissions
          : undefined;

    const profile = await prisma.adminProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        permissions: nextPermissions ?? [],
      },
      update: nextPermissions !== undefined ? { permissions: nextPermissions } : {},
      select: {
        userId: true,
        permissions: true,
      },
    });

    if (payload.adminRoleId !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "AdminProfile"
         SET "adminRoleId" = $1, "updatedAt" = NOW()
         WHERE "userId" = $2`,
        payload.adminRoleId || null,
        user.id
      );
    }

    res.json({
      success: true,
      message: 'Admin access updated.',
      data: {
        userId: user.id,
        adminRoleId: payload.adminRoleId ?? null,
        adminRole: payload.adminRoleId ? selectedRole : null,
        permissions: sanitizePermissionGrants(profile.permissions),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PRODUCTS (LIST/CREATE/EDIT) ====================

router.get('/products/options', async (_req, res, next) => {
  try {
    const [categories, materials, sellersRaw, designersRaw] = await Promise.all([
      prisma.productCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.materialType.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.fabricSellerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.designerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const sellers = sellersRaw.map((item) => {
      const fallbackName = `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() || item.user?.email || 'Fabric Seller';
      return {
        id: item.id,
        businessName: String(item.businessName || '').trim() || fallbackName,
        country: item.country || '',
      };
    });

    const designers = designersRaw.map((item) => {
      const fallbackName = `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() || item.user?.email || 'Designer';
      return {
        id: item.id,
        businessName: String(item.businessName || '').trim() || fallbackName,
        country: item.country || '',
      };
    });

    res.json({
      success: true,
      data: {
        categories,
        materials,
        sellers,
        designers,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const querySchema = z.object({
      search: z.string().optional(),
      status: z.nativeEnum(ProductStatus).optional(),
      type: adminProductTypeSchema.optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const query = querySchema.parse(req.query);
    const pagination = parsePagination(query.page, query.limit, 20);
    const search = String(query.search || '').trim();

    const [fabrics, designs, readyToWear] = await Promise.all([
      !query.type || query.type === ProductType.FABRIC
        ? prisma.fabric.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              seller: { select: { id: true, businessName: true, country: true } },
              materialType: { select: { name: true } },
              images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } },
              _count: { select: { orderItems: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      !query.type || query.type === ProductType.DESIGN
        ? prisma.design.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              designer: { select: { id: true, businessName: true, country: true } },
              category: { select: { name: true } },
              images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } },
              _count: { select: { orderItems: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      !query.type || query.type === ProductType.READY_TO_WEAR
        ? prisma.readyToWear.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              designer: { select: { id: true, businessName: true, country: true } },
              category: { select: { name: true } },
              images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } },
              _count: { select: { orderItems: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const rows = [
      ...fabrics.map((item) => ({
        id: item.id,
        type: ProductType.FABRIC,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.sellerPrice || 0),
        finalPrice: Number(item.finalPrice || 0),
        sellerId: item.seller.id,
        ownerName: item.seller.businessName || 'Fabric Seller',
        ownerCountry: item.seller.country || null,
        category: item.materialType?.name || 'Material',
        orderCount: item._count.orderItems,
        image: item.images?.[0]?.url || null,
        createdAt: item.createdAt,
      })),
      ...designs.map((item) => ({
        id: item.id,
        type: ProductType.DESIGN,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.basePrice || 0),
        finalPrice: Number(item.finalPrice || 0),
        designerId: item.designer.id,
        ownerName: item.designer.businessName || 'Designer',
        ownerCountry: item.designer.country || null,
        category: item.category?.name || 'Category',
        orderCount: item._count.orderItems,
        image: item.images?.[0]?.url || null,
        createdAt: item.createdAt,
      })),
      ...readyToWear.map((item) => ({
        id: item.id,
        type: ProductType.READY_TO_WEAR,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.basePrice || 0),
        finalPrice: Number(item.basePrice || 0),
        designerId: item.designer.id,
        ownerName: item.designer.businessName || 'Designer',
        ownerCountry: item.designer.country || null,
        category: item.category?.name || 'Category',
        orderCount: item._count.orderItems,
        image: item.images?.[0]?.url || null,
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    const featuredRows =
      rows.length > 0
        ? await prisma.featuredProduct.findMany({
            where: {
              OR: [
                {
                  productType: ProductType.FABRIC,
                  productId: {
                    in: rows.filter((row) => row.type === ProductType.FABRIC).map((row) => row.id),
                  },
                },
                {
                  productType: ProductType.DESIGN,
                  productId: {
                    in: rows.filter((row) => row.type === ProductType.DESIGN).map((row) => row.id),
                  },
                },
                {
                  productType: ProductType.READY_TO_WEAR,
                  productId: {
                    in: rows.filter((row) => row.type === ProductType.READY_TO_WEAR).map((row) => row.id),
                  },
                },
              ],
            },
            select: {
              productId: true,
              productType: true,
              section: true,
              isActive: true,
            },
          })
        : [];

    const featuredMap = new Map<string, string[]>();
    for (const row of featuredRows) {
      if (!row.isActive) continue;
      const key = `${row.productType}:${row.productId}`;
      const existing = featuredMap.get(key) || [];
      if (!existing.includes(row.section)) {
        existing.push(row.section);
      }
      featuredMap.set(key, existing);
    }

    const rowsWithFeatured = rows.map((row) => {
      const key = `${row.type}:${row.id}`;
      const featuredSections = featuredMap.get(key) || [];
      return {
        ...row,
        isFeatured: featuredSections.length > 0,
        featuredSections,
      };
    });

    const paged = rowsWithFeatured.slice(pagination.skip, pagination.skip + pagination.limit);
    res.json({
      success: true,
      data: {
        products: paged,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: rowsWithFeatured.length,
          pages: Math.max(1, Math.ceil(rowsWithFeatured.length / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const payload = adminProductCreateSchema.parse(req.body);
    const normalizedImages = Array.from(
      new Set(
        [
          ...(Array.isArray(payload.images) ? payload.images : []),
          payload.image || '',
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    const imagePolicy = getImagePolicyForProductType(payload.type);
    if (normalizedImages.length < imagePolicy.min || normalizedImages.length > imagePolicy.max) {
      return res.status(400).json({
        success: false,
        message: `${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`,
      });
    }
    if (payload.type === ProductType.FABRIC) {
      if (!payload.sellerId || !payload.materialTypeId) {
        return res.status(400).json({ success: false, message: 'sellerId and materialTypeId are required for fabric.' });
      }
      const created = await prisma.fabric.create({
        data: {
          sellerId: payload.sellerId,
          materialTypeId: payload.materialTypeId,
          name: payload.name.trim(),
          description: payload.description.trim(),
          sellerPrice: payload.price,
          finalPrice: payload.price,
          minYards: payload.minYards ?? 1,
          stockYards: payload.stockYards ?? 0,
          status: payload.status ?? ProductStatus.DRAFT,
          isAvailable: payload.isAvailable ?? true,
          images: normalizedImages.length > 0
            ? {
                create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
              }
            : undefined,
        },
      });
      return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
    }

    if (payload.type === ProductType.DESIGN) {
      if (!payload.designerId || !payload.categoryId) {
        return res.status(400).json({ success: false, message: 'designerId and categoryId are required for design.' });
      }
      const created = await prisma.design.create({
        data: {
          designerId: payload.designerId,
          categoryId: payload.categoryId,
          materialTypeId: payload.materialTypeId || null,
          name: payload.name.trim(),
          description: payload.description.trim(),
          basePrice: payload.price,
          finalPrice: payload.price,
          status: payload.status ?? ProductStatus.DRAFT,
          isAvailable: payload.isAvailable ?? true,
          images: normalizedImages.length > 0
            ? {
                create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
              }
            : undefined,
        },
      });
      return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
    }

    if (!payload.designerId || !payload.categoryId) {
      return res.status(400).json({ success: false, message: 'designerId and categoryId are required for ready-to-wear.' });
    }
    const created = await prisma.readyToWear.create({
      data: {
        designerId: payload.designerId,
        categoryId: payload.categoryId,
        name: payload.name.trim(),
        description: payload.description.trim(),
        basePrice: payload.price,
        status: payload.status ?? ProductStatus.DRAFT,
        isAvailable: payload.isAvailable ?? true,
        images: normalizedImages.length > 0
          ? {
              create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
            }
          : undefined,
        sizeVariations: {
          create: [
            {
              size: payload.size || 'M',
              price: payload.price,
              stock: payload.stock ?? 0,
            },
          ],
        },
      },
    });
    return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:type/:id', async (req, res, next) => {
  try {
    const type = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const payload = adminProductUpdateSchema.parse(req.body);
    const hasImagesPayload =
      Array.isArray(payload.images) || (typeof payload.image === 'string' && String(payload.image).trim().length > 0);
    const normalizedImages = Array.from(
      new Set(
        [
          ...(Array.isArray(payload.images) ? payload.images : []),
          payload.image || '',
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    if (hasImagesPayload) {
      const imagePolicy = getImagePolicyForProductType(type);
      if (normalizedImages.length < imagePolicy.min || normalizedImages.length > imagePolicy.max) {
        return res.status(400).json({
          success: false,
          message: `${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`,
        });
      }
    }
    if (type === ProductType.FABRIC) {
      const updated = await prisma.fabric.update({
        where: { id: req.params.id },
        data: {
          name: payload.name?.trim(),
          description: payload.description?.trim(),
          materialTypeId: payload.materialTypeId,
          sellerPrice: payload.price,
          finalPrice: payload.price,
          minYards: payload.minYards,
          stockYards: payload.stockYards,
          status: payload.status,
          isAvailable: payload.isAvailable,
        },
      });
      if (hasImagesPayload) {
        await prisma.fabricImage.deleteMany({ where: { fabricId: updated.id } });
        if (normalizedImages.length > 0) {
          await prisma.fabricImage.createMany({
            data: normalizedImages.map((url, index) => ({
              fabricId: updated.id,
              url,
              sortOrder: index,
            })),
          });
        }
      }
      return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
    }

    if (type === ProductType.DESIGN) {
      const updated = await prisma.design.update({
        where: { id: req.params.id },
        data: {
          name: payload.name?.trim(),
          description: payload.description?.trim(),
          categoryId: payload.categoryId,
          materialTypeId: payload.materialTypeId || null,
          basePrice: payload.price,
          finalPrice: payload.price,
          status: payload.status,
          isAvailable: payload.isAvailable,
        },
      });
      if (hasImagesPayload) {
        await prisma.designImage.deleteMany({ where: { designId: updated.id } });
        if (normalizedImages.length > 0) {
          await prisma.designImage.createMany({
            data: normalizedImages.map((url, index) => ({
              designId: updated.id,
              url,
              sortOrder: index,
            })),
          });
        }
      }
      return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
    }

    const updated = await prisma.readyToWear.update({
      where: { id: req.params.id },
      data: {
        name: payload.name?.trim(),
        description: payload.description?.trim(),
        categoryId: payload.categoryId,
        basePrice: payload.price,
        status: payload.status,
        isAvailable: payload.isAvailable,
      },
    });
    if (hasImagesPayload) {
      await prisma.readyToWearImage.deleteMany({ where: { readyToWearId: updated.id } });
      if (normalizedImages.length > 0) {
        await prisma.readyToWearImage.createMany({
          data: normalizedImages.map((url, index) => ({
            readyToWearId: updated.id,
            url,
            sortOrder: index,
          })),
        });
      }
    }
    if (payload.price !== undefined || payload.stock !== undefined) {
      const existingSize = await prisma.readyToWearSize.findFirst({
        where: { readyToWearId: updated.id },
        orderBy: { size: 'asc' },
      });
      if (existingSize) {
        await prisma.readyToWearSize.update({
          where: { id: existingSize.id },
          data: {
            price: payload.price ?? undefined,
            stock: payload.stock ?? undefined,
          },
        });
      }
    }
    return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:type/:id/moderate', async (req, res, next) => {
  try {
    const productType = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const { id } = req.params;
    const payload = productModerationSchema.parse(req.body);

    let exists = false;
    if (productType === ProductType.FABRIC) {
      exists = (await prisma.fabric.count({ where: { id } })) > 0;
    } else if (productType === ProductType.DESIGN) {
      exists = (await prisma.design.count({ where: { id } })) > 0;
    } else {
      exists = (await prisma.readyToWear.count({ where: { id } })) > 0;
    }

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    let nextStatus: ProductStatus | undefined;
    let nextAvailability: boolean | undefined;
    switch (payload.action) {
      case 'APPROVE':
      case 'PUBLISH':
        nextStatus = ProductStatus.APPROVED;
        nextAvailability = true;
        break;
      case 'REJECT':
        nextStatus = ProductStatus.REJECTED;
        nextAvailability = false;
        break;
      case 'REQUEST_CHANGES':
        nextStatus = ProductStatus.PENDING_REVIEW;
        nextAvailability = false;
        break;
      case 'SUSPEND':
        nextStatus = ProductStatus.ARCHIVED;
        nextAvailability = false;
        break;
      case 'UNPUBLISH':
        nextAvailability = false;
        break;
    }

    const updateData: { status?: ProductStatus; isAvailable?: boolean } = {};
    if (nextStatus) updateData.status = nextStatus;
    if (typeof nextAvailability === 'boolean') updateData.isAvailable = nextAvailability;

    if (productType === ProductType.FABRIC) {
      await prisma.fabric.update({
        where: { id },
        data: updateData,
      });
    } else if (productType === ProductType.DESIGN) {
      await prisma.design.update({
        where: { id },
        data: updateData,
      });
    } else {
      await prisma.readyToWear.update({
        where: { id },
        data: updateData,
      });
    }

    if (payload.action !== 'APPROVE' && payload.action !== 'PUBLISH') {
      await prisma.featuredProduct.deleteMany({
        where: { productId: id, productType },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADMIN_PRODUCT_MODERATE',
        details: {
          productId: id,
          productType,
          action: payload.action,
          message: payload.message || null,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Product moderation action applied.',
      data: {
        productId: id,
        productType,
        action: payload.action,
        status: nextStatus,
        isAvailable: nextAvailability,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/products/moderate-bulk', async (req, res, next) => {
  try {
    const payload = bulkModerationSchema.parse(req.body);
    let nextStatus: ProductStatus | undefined;
    let nextAvailability: boolean | undefined;

    switch (payload.action) {
      case 'APPROVE':
      case 'PUBLISH':
        nextStatus = ProductStatus.APPROVED;
        nextAvailability = true;
        break;
      case 'REJECT':
        nextStatus = ProductStatus.REJECTED;
        nextAvailability = false;
        break;
      case 'REQUEST_CHANGES':
        nextStatus = ProductStatus.PENDING_REVIEW;
        nextAvailability = false;
        break;
      case 'SUSPEND':
        nextStatus = ProductStatus.ARCHIVED;
        nextAvailability = false;
        break;
      case 'UNPUBLISH':
        nextAvailability = false;
        break;
    }

    const updateData: { status?: ProductStatus; isAvailable?: boolean } = {};
    if (nextStatus) updateData.status = nextStatus;
    if (typeof nextAvailability === 'boolean') updateData.isAvailable = nextAvailability;

    if (payload.productType === ProductType.FABRIC) {
      await prisma.fabric.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    } else if (payload.productType === ProductType.DESIGN) {
      await prisma.design.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    } else {
      await prisma.readyToWear.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    }

    if (payload.action !== 'APPROVE' && payload.action !== 'PUBLISH') {
      await prisma.featuredProduct.deleteMany({
        where: { productType: payload.productType, productId: { in: payload.productIds } },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADMIN_PRODUCT_MODERATE_BULK',
        details: {
          productType: payload.productType,
          productIds: payload.productIds,
          action: payload.action,
          message: payload.message || null,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Bulk moderation action applied.',
      data: { affected: payload.productIds.length },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/products/:type/:id/featured', async (req, res, next) => {
  try {
    const productType = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const { id } = req.params;
    const payload = productFeaturedSchema.parse(req.body);

    let exists = false;
    if (productType === ProductType.FABRIC) {
      exists = (await prisma.fabric.count({ where: { id } })) > 0;
    } else if (productType === ProductType.DESIGN) {
      exists = (await prisma.design.count({ where: { id } })) > 0;
    } else {
      exists = (await prisma.readyToWear.count({ where: { id } })) > 0;
    }

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    if (payload.isFeatured) {
      const section = payload.section || getDefaultFeaturedSectionForType(productType);
      const featured = await prisma.featuredProduct.upsert({
        where: {
          productId_productType_section: {
            productId: id,
            productType,
            section,
          },
        },
        update: {
          isActive: true,
          displayOrder: payload.displayOrder ?? 0,
        },
        create: {
          productId: id,
          productType,
          section,
          displayOrder: payload.displayOrder ?? 0,
          isActive: true,
        },
      });

      return res.json({
        success: true,
        message: 'Product marked as featured.',
        data: featured,
      });
    }

    await prisma.featuredProduct.deleteMany({
      where: {
        productId: id,
        productType,
        ...(payload.section ? { section: payload.section } : {}),
      },
    });

    return res.json({
      success: true,
      message: 'Product removed from featured list.',
    });
  } catch (error) {
    return next(error);
  }
});

// ==================== PRODUCT CATEGORIES ====================

// Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// Create category
router.post('/categories', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
      sortOrder: z.number().default(0),
    });

    const data = schema.parse(req.body);

    const category = await prisma.productCategory.create({
      data,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

// Update category
router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, sortOrder } = req.body;

    const category = await prisma.productCategory.update({
      where: { id },
      data: { name, description, isActive, sortOrder },
    });

    res.json({
      success: true,
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

// Delete category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.productCategory.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== MATERIAL TYPES ====================

// Get all material types
router.get('/materials', async (req, res, next) => {
  try {
    const materials = await prisma.materialType.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

// Create material type
router.post('/materials', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const material = await prisma.materialType.create({
      data,
    });

    res.status(201).json({
      success: true,
      message: 'Material type created successfully.',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// Update material type
router.patch('/materials/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const material = await prisma.materialType.update({
      where: { id },
      data: { name, description, isActive },
    });

    res.json({
      success: true,
      message: 'Material type updated successfully.',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// Delete material type
router.delete('/materials/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.materialType.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Material type deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PRICING RULES ====================

// Get all pricing rules
router.get('/pricing-rules', async (req, res, next) => {
  try {
    const rules = await prisma.pricingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

// Create pricing rule
router.post('/pricing-rules', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      ruleType: z.enum(['GLOBAL_MARKUP', 'CATEGORY_MARKUP', 'COUNTRY_MARKUP', 'DATE_BASED']),
      productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
      country: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      isSale: z.boolean().default(false),
      adjustmentType: z.enum(['PERCENTAGE_MARKUP', 'PERCENTAGE_DISCOUNT', 'FIXED_MARKUP', 'FIXED_DISCOUNT']),
      value: z.number().positive(),
      priority: z.number().default(0),
    });

    const data = schema.parse(req.body);

    const rule = await prisma.pricingRule.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        createdById: req.user!.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Pricing rule created successfully.',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

// Update pricing rule
router.patch('/pricing-rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const rule = await prisma.pricingRule.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Pricing rule updated successfully.',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

// Delete pricing rule
router.delete('/pricing-rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.pricingRule.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Pricing rule deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ORDERS ====================

// Get all orders
router.get('/orders', async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const pagination = parsePagination(page, limit, 20);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
          designOrder: {
            include: {
              design: {
                select: { name: true },
              },
            },
          },
          fabricOrder: {
            include: {
              fabric: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Assign QA to order
router.patch('/orders/:id/assign-qa', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      qaId: z.string().uuid(),
    });
    const { qaId } = schema.parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { qaId },
      include: {
        qa: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    res.json({
      success: true,
      message: 'QA assigned successfully.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// Homepage top strip compatibility aliases
router.get('/top-strip', async (_req, res) => {
  try {
    const { settings } = await readAdminTopStripSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top strip settings.' });
  }
});

router.put('/top-strip', async (req, res) => {
  try {
    const settings = await saveAdminTopStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update top strip settings.' });
  }
});

router.patch('/top-strip', async (req, res) => {
  try {
    const settings = await saveAdminTopStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update top strip settings.' });
  }
});

export default router;
