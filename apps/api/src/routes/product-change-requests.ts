import { Router } from 'express';
import { z } from 'zod';
import { prisma, ProductStatus, UserRole, UserStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  createProductChangeRequest,
  ensureProductChangeRequestSchema,
  getFieldKeysForProductType,
  getProductEditFieldCatalog,
  normalizeRequestedFieldKeys,
  readProductEditPolicySettings,
  saveProductEditPolicySettings,
} from '../utils/product-change-requests';

const router = Router();

const parsePagination = (pageInput: unknown, limitInput: unknown, fallbackLimit = 20) => {
  const page = Math.max(1, Number(pageInput || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitInput || fallbackLimit) || fallbackLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const normalizeVendorRole = (value: unknown): 'FABRIC_SELLER' | 'FASHION_DESIGNER' | null => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'FABRIC_SELLER' || token === 'FASHION_DESIGNER') return token;
  return null;
};

const normalizeProductType = (value: unknown): 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' | null => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'FABRIC' || token === 'DESIGN' || token === 'READY_TO_WEAR') return token;
  return null;
};

const fullName = (firstName?: string | null, lastName?: string | null) =>
  `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

router.use(authenticate);

router.get('/policy', async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const role = normalizeVendorRole(req.user?.role);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers and designers can access product change policy.',
      });
    }
    const policy = await readProductEditPolicySettings();
    return res.json({
      success: true,
      data: {
        role,
        allowedFieldsByProductType: policy.allowedFieldsByRole[role],
        defaultGrantDurationHours: policy.defaultGrantDurationHours,
        fieldCatalog: getProductEditFieldCatalog(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/requests/my', async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const role = normalizeVendorRole(req.user?.role);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers and designers can access product change requests.',
      });
    }
    const query = z
      .object({
        status: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).max(500).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const values: any[] = [req.user!.id, role];
    const whereClauses = ['"requesterUserId" = $1', '"requesterRole" = $2'];
    if (query.status) {
      values.push(String(query.status || '').trim().toUpperCase());
      whereClauses.push(`UPPER("status") = $${values.length}`);
    }
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "ProductChangeRequest"
       ${whereSql}
       ORDER BY "createdAt" DESC
       LIMIT ${pagination.limit}
       OFFSET ${pagination.skip}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "ProductChangeRequest"
       ${whereSql}`,
      ...values
    );
    const total = Number(countRows[0]?.count || 0);
    return res.json({
      success: true,
      data: {
        requests: (Array.isArray(rows) ? rows : []).map((row) => ({
          ...row,
          requestedFields: normalizeRequestedFieldKeys(
            (normalizeProductType(row.productType) || 'FABRIC') as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
            row.requestedFields
          ),
          grantedFields: normalizeRequestedFieldKeys(
            (normalizeProductType(row.productType) || 'FABRIC') as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
            row.grantedFields
          ),
        })),
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

router.post('/requests', async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const role = normalizeVendorRole(req.user?.role);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers and designers can create product change requests.',
      });
    }
    const payload = z
      .object({
        productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
        productId: z.string().trim().min(1),
        message: z.string().trim().min(5).max(4000),
        requestedFields: z.array(z.string().trim().min(1)).max(40).optional(),
      })
      .parse(req.body || {});

    const requestedProductType =
      role === UserRole.FABRIC_SELLER
        ? 'FABRIC'
        : (normalizeProductType(payload.productType || 'DESIGN') as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR');
    if (!requestedProductType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product type for change request.',
      });
    }

    if (role === UserRole.FABRIC_SELLER && requestedProductType !== 'FABRIC') {
      return res.status(400).json({
        success: false,
        message: 'Seller product change requests support fabrics only.',
      });
    }

    if (requestedProductType === 'FABRIC') {
      const seller = await prisma.fabricSellerProfile.findFirst({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!seller) {
        return res.status(404).json({ success: false, message: 'Seller profile not found.' });
      }
      const product = await prisma.fabric.findFirst({
        where: { id: payload.productId, sellerId: seller.id },
        select: { id: true },
      });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
    }
    if (requestedProductType === 'DESIGN' || requestedProductType === 'READY_TO_WEAR') {
      const designer = await prisma.designerProfile.findFirst({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!designer) {
        return res.status(404).json({ success: false, message: 'Designer profile not found.' });
      }
      if (requestedProductType === 'DESIGN') {
        const product = await prisma.design.findFirst({
          where: { id: payload.productId, designerId: designer.id },
          select: { id: true },
        });
        if (!product) {
          return res.status(404).json({ success: false, message: 'Design product not found.' });
        }
      } else {
        const product = await prisma.readyToWear.findFirst({
          where: { id: payload.productId, designerId: designer.id },
          select: { id: true },
        });
        if (!product) {
          return res.status(404).json({ success: false, message: 'Ready-to-wear product not found.' });
        }
      }
    }

    const pendingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
       FROM "ProductChangeRequest"
       WHERE "requesterUserId" = $1
         AND "requesterRole" = $2
         AND "productType" = $3
         AND "productId" = $4
         AND "status" = 'PENDING'
       LIMIT 1`,
      req.user!.id,
      role,
      requestedProductType,
      payload.productId
    );
    if (Array.isArray(pendingRows) && pendingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A pending change request already exists for this product.',
      });
    }

    const requestId = await createProductChangeRequest({
      requesterUserId: req.user!.id,
      requesterRole: role,
      productType: requestedProductType,
      productId: payload.productId,
      message: payload.message,
      requestedFields: normalizeRequestedFieldKeys(requestedProductType, payload.requestedFields || []),
    });

    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMINISTRATOR, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        prisma.notification
          .create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: 'New product change request',
              message: 'A seller/designer submitted a product change request for admin review.',
              relatedType: 'PRODUCT',
              relatedId: requestId,
            },
          })
          .catch(() => undefined)
      )
    );

    return res.status(201).json({
      success: true,
      message: 'Product change request submitted successfully.',
      data: { id: requestId },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/config', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (_req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const policy = await readProductEditPolicySettings();
    return res.json({
      success: true,
      data: {
        ...policy,
        fieldCatalog: getProductEditFieldCatalog(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/config', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const payload = z
      .object({
        defaultGrantDurationHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
        allowedFieldsByRole: z
          .object({
            FABRIC_SELLER: z
              .object({
                FABRIC: z.array(z.string().trim().min(1)).optional(),
                DESIGN: z.array(z.string().trim().min(1)).optional(),
                READY_TO_WEAR: z.array(z.string().trim().min(1)).optional(),
              })
              .optional(),
            FASHION_DESIGNER: z
              .object({
                FABRIC: z.array(z.string().trim().min(1)).optional(),
                DESIGN: z.array(z.string().trim().min(1)).optional(),
                READY_TO_WEAR: z.array(z.string().trim().min(1)).optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .parse(req.body || {});
    const current = await readProductEditPolicySettings();
    const merged = {
      ...current,
      ...payload,
      allowedFieldsByRole: {
        ...current.allowedFieldsByRole,
        ...(payload.allowedFieldsByRole || {}),
        FABRIC_SELLER: {
          ...current.allowedFieldsByRole.FABRIC_SELLER,
          ...(payload.allowedFieldsByRole?.FABRIC_SELLER || {}),
        },
        FASHION_DESIGNER: {
          ...current.allowedFieldsByRole.FASHION_DESIGNER,
          ...(payload.allowedFieldsByRole?.FASHION_DESIGNER || {}),
        },
      },
    };
    const saved = await saveProductEditPolicySettings(merged, req.user!.id);
    return res.json({
      success: true,
      message: 'Product edit policy updated successfully.',
      data: {
        ...saved,
        fieldCatalog: getProductEditFieldCatalog(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/requests', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const query = z
      .object({
        status: z.string().trim().optional(),
        role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']).optional(),
        productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
        search: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).max(500).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const values: any[] = [];
    const whereClauses: string[] = ['1=1'];
    if (query.status) {
      values.push(String(query.status).toUpperCase());
      whereClauses.push(`UPPER(r."status") = $${values.length}`);
    }
    if (query.role) {
      values.push(query.role);
      whereClauses.push(`r."requesterRole" = $${values.length}`);
    }
    if (query.productType) {
      values.push(query.productType);
      whereClauses.push(`r."productType" = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      whereClauses.push(
        `(LOWER(COALESCE(u."firstName",'') || ' ' || COALESCE(u."lastName",'')) LIKE $${values.length}
          OR LOWER(COALESCE(u."email",'')) LIKE $${values.length}
          OR LOWER(COALESCE(r."message",'')) LIKE $${values.length}
          OR LOWER(COALESCE(r."productId",'')) LIKE $${values.length})`
      );
    }
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
          r.*,
          u."email" AS "requesterEmail",
          u."firstName" AS "requesterFirstName",
          u."lastName" AS "requesterLastName"
       FROM "ProductChangeRequest" r
       JOIN "User" u ON u."id" = r."requesterUserId"
       ${whereSql}
       ORDER BY r."createdAt" DESC
       LIMIT ${pagination.limit}
       OFFSET ${pagination.skip}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "ProductChangeRequest" r
       JOIN "User" u ON u."id" = r."requesterUserId"
       ${whereSql}`,
      ...values
    );

    const fabrics = Array.from(
      new Set(
        rows
          .filter((row) => String(row.productType || '').toUpperCase() === 'FABRIC')
          .map((row) => String(row.productId || '').trim())
          .filter(Boolean)
      )
    );
    const designs = Array.from(
      new Set(
        rows
          .filter((row) => String(row.productType || '').toUpperCase() === 'DESIGN')
          .map((row) => String(row.productId || '').trim())
          .filter(Boolean)
      )
    );
    const ready = Array.from(
      new Set(
        rows
          .filter((row) => String(row.productType || '').toUpperCase() === 'READY_TO_WEAR')
          .map((row) => String(row.productId || '').trim())
          .filter(Boolean)
      )
    );
    const [fabricRows, designRows, readyRows] = await Promise.all([
      fabrics.length
        ? prisma.fabric.findMany({
            where: { id: { in: fabrics } },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve([]),
      designs.length
        ? prisma.design.findMany({
            where: { id: { in: designs } },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve([]),
      ready.length
        ? prisma.readyToWear.findMany({
            where: { id: { in: ready } },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve([]),
    ]);
    const productMap = new Map<string, { name: string; status: string }>(
      [
        ...fabricRows.map((row) => [`FABRIC:${row.id}`, row] as const),
        ...designRows.map((row) => [`DESIGN:${row.id}`, row] as const),
        ...readyRows.map((row) => [`READY_TO_WEAR:${row.id}`, row] as const),
      ].map(([key, row]) => [
        key,
        {
          name: String((row as any).name || ''),
          status: String((row as any).status || ProductStatus.DRAFT).toUpperCase(),
        },
      ])
    );

    const total = Number(countRows[0]?.count || 0);
    return res.json({
      success: true,
      data: {
        requests: rows.map((row) => {
          const productType = normalizeProductType(row.productType) || 'FABRIC';
          const productKey = `${productType}:${String(row.productId || '')}`;
          const product = productMap.get(productKey);
          const grantEndsAt = row.grantEndsAt ? new Date(row.grantEndsAt).toISOString() : null;
          const grantActive = Boolean(grantEndsAt && new Date(grantEndsAt).getTime() > Date.now());
          return {
            ...row,
            productName: product?.name || null,
            productStatus: product?.status || null,
            requesterName: fullName(row.requesterFirstName, row.requesterLastName) || String(row.requesterEmail || ''),
            requestedFields: normalizeRequestedFieldKeys(productType, row.requestedFields),
            grantedFields: normalizeRequestedFieldKeys(productType, row.grantedFields),
            grantEndsAt,
            grantActive,
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

router.patch('/admin/requests/:id/review', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    await ensureProductChangeRequestSchema();
    const requestId = String(req.params.id || '').trim();
    const payload = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        reviewNote: z.string().trim().max(2000).optional(),
        grantAllChanges: z.boolean().optional(),
        grantedFields: z.array(z.string().trim().min(1)).max(40).optional(),
        grantDurationHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
      })
      .parse(req.body || {});
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "ProductChangeRequest"
       WHERE "id" = $1
       LIMIT 1`,
      requestId
    );
    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product change request not found.' });
    }
    const productType = normalizeProductType(existing.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Invalid product type on request.' });
    }
    const policy = await readProductEditPolicySettings();
    const durationHours =
      payload.status === 'APPROVED'
        ? Math.max(1, Number(payload.grantDurationHours || policy.defaultGrantDurationHours))
        : null;
    const requestedFields = normalizeRequestedFieldKeys(productType, existing.requestedFields);
    const grantedFields = normalizeRequestedFieldKeys(
      productType,
      payload.grantedFields && payload.grantedFields.length > 0 ? payload.grantedFields : requestedFields
    );
    const grantAllChanges = payload.status === 'APPROVED' ? payload.grantAllChanges === true : false;
    const grantStartsAt = payload.status === 'APPROVED' ? new Date() : null;
    const grantEndsAt =
      payload.status === 'APPROVED' && durationHours
        ? new Date(grantStartsAt!.getTime() + durationHours * 60 * 60 * 1000)
        : null;

    await prisma.$executeRawUnsafe(
      `UPDATE "ProductChangeRequest"
       SET "status" = $2,
           "reviewNote" = $3,
           "grantAllChanges" = $4,
           "grantedFields" = $5::jsonb,
           "grantStartsAt" = $6::timestamp,
           "grantEndsAt" = $7::timestamp,
           "reviewedById" = $8,
           "reviewedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      requestId,
      payload.status,
      payload.reviewNote || null,
      grantAllChanges,
      JSON.stringify(grantedFields),
      grantStartsAt ? grantStartsAt.toISOString() : null,
      grantEndsAt ? grantEndsAt.toISOString() : null,
      req.user!.id
    );

    await prisma.notification
      .create({
        data: {
          userId: String(existing.requesterUserId || ''),
          type: 'SYSTEM',
          title: payload.status === 'APPROVED' ? 'Product change request approved' : 'Product change request rejected',
          message:
            payload.status === 'APPROVED'
              ? `Admin approved your product change request. Access expires ${grantEndsAt ? new Date(grantEndsAt).toLocaleString() : 'soon'}.`
              : payload.reviewNote || 'Your product change request was rejected.',
          relatedType: 'PRODUCT',
          relatedId: requestId,
        },
      })
      .catch(() => undefined);

    return res.json({
      success: true,
      message: `Product change request ${payload.status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

