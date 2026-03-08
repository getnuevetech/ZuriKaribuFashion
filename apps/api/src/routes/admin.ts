import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, UserRole, UserStatus, ProductStatus } from '../db';
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
  if (path.startsWith('/users/pending')) return [Permissions.USERS_READ];
  if (path.startsWith('/users')) {
    return method === 'GET' ? [Permissions.USERS_READ] : [Permissions.USERS_MANAGE];
  }
  if (path.startsWith('/products') || path.startsWith('/categories') || path.startsWith('/materials')) {
    return [Permissions.PRODUCTS_MANAGE];
  }
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

export default router;
