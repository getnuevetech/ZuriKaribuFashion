import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma, ProductStatus } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY = 'HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE';
const DEFAULT_READY_TO_WEAR_SIZE_GUIDE = {
  title: 'Ready-To-Wear Size Guide',
  content:
    'Use your body measurements to select your best standard size.\n\nS: Bust 84-90cm, Waist 66-72cm, Hips 90-96cm\nM: Bust 91-98cm, Waist 73-80cm, Hips 97-104cm\nL: Bust 99-106cm, Waist 81-88cm, Hips 105-112cm\nXL: Bust 107-115cm, Waist 89-98cm, Hips 113-122cm',
};

type CanonicalProductType = 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';

const PRODUCT_TYPE_BY_TOKEN: Record<string, CanonicalProductType> = {
  DESIGN: 'DESIGN',
  DESIGNS: 'DESIGN',
  FABRIC: 'FABRIC',
  FABRICS: 'FABRIC',
  READY_TO_WEAR: 'READY_TO_WEAR',
  READYTOWEAR: 'READY_TO_WEAR',
  READY_TO_WEAR_PRODUCT: 'READY_TO_WEAR',
  RTW: 'READY_TO_WEAR',
};

function normalizeProductTypeToken(value: unknown): CanonicalProductType | null {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  if (!token) return null;
  return PRODUCT_TYPE_BY_TOKEN[token] || null;
}

let ensureProductEngagementSchemaPromise: Promise<void> | null = null;

async function ensureProductEngagementSchema() {
  if (!ensureProductEngagementSchemaPromise) {
    ensureProductEngagementSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductLike" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "productType" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductLike_userId_productId_productType_key" ON "ProductLike" ("userId", "productId", "productType")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductLike_productType_productId_idx" ON "ProductLike" ("productType", "productId")`
      );
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Review" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL,
          "designerId" TEXT,
          "fabricSellerId" TEXT,
          "productId" TEXT,
          "productType" TEXT,
          "orderId" TEXT NOT NULL,
          "rating" INTEGER NOT NULL,
          "title" TEXT,
          "comment" TEXT NOT NULL,
          "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          "isVerified" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productType" TEXT`);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Review_productType_productId_idx" ON "Review" ("productType", "productId")`
      );
    })();
  }
  return ensureProductEngagementSchemaPromise;
}

async function ensureProductExists(productType: CanonicalProductType, id: string) {
  if (productType === 'DESIGN') {
    return prisma.design.findUnique({ where: { id }, select: { id: true, categoryId: true } });
  }
  if (productType === 'FABRIC') {
    return prisma.fabric.findUnique({ where: { id }, select: { id: true, materialTypeId: true } });
  }
  return prisma.readyToWear.findUnique({ where: { id }, select: { id: true, categoryId: true } });
}

function parsePagination(pageValue: unknown, limitValue: unknown, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(String(pageValue ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(limitValue ?? defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function readReadyToWearSizeGuide() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
      HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return { ...DEFAULT_READY_TO_WEAR_SIZE_GUIDE };
    const parsed = JSON.parse(String(row.value || '{}')) as Record<string, unknown>;
    const title = String(parsed.title || '').trim();
    const content = String(parsed.content || '').trim();
    return {
      title: title.length >= 3 ? title.slice(0, 120) : DEFAULT_READY_TO_WEAR_SIZE_GUIDE.title,
      content: content.length >= 20 ? content.slice(0, 6000) : DEFAULT_READY_TO_WEAR_SIZE_GUIDE.content,
    };
  } catch {
    return { ...DEFAULT_READY_TO_WEAR_SIZE_GUIDE };
  }
}

// Public routes (no auth required)

// Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
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

// Get all material types
router.get('/materials', async (req, res, next) => {
  try {
    const materials = await prisma.materialType.findMany({
      where: { isActive: true },
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

router.get('/ready-to-wear-size-guide', async (_req, res) => {
  const data = await readReadyToWearSizeGuide();
  res.json({ success: true, data });
});

// Get fabrics with filters
router.get('/fabrics', async (req, res, next) => {
  try {
    const { country, materialTypeId, sellerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (country) {
      where.seller = { country: country as string };
    }

    if (materialTypeId) {
      where.materialTypeId = materialTypeId as string;
    }
    if (sellerId) {
      where.sellerId = sellerId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pagination = parsePagination(page, limit, 20);

    const [fabrics, total] = await Promise.all([
      prisma.fabric.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          materialType: true,
          seller: {
            select: { id: true, country: true, city: true, businessName: true },
          },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fabric.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        fabrics,
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

// Get single fabric
router.get('/fabrics/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const fabric = await prisma.fabric.findUnique({
      where: { id },
      include: {
        materialType: true,
        seller: {
          select: {
            id: true,
            businessName: true,
            country: true,
            city: true,
            rating: true,
          },
        },
        images: true,
        designFabrics: {
          include: {
            design: {
              select: {
                id: true,
                name: true,
                images: { take: 1 },
              },
            },
          },
        },
      },
    });

    if (!fabric) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }

    res.json({
      success: true,
      data: fabric,
    });
  } catch (error) {
    next(error);
  }
});

// Get designs with filters
router.get('/designs', async (req, res, next) => {
  try {
    const { categoryId, country, designerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (country) where.designer = { country: country as string };
    if (designerId) where.designerId = designerId as string;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pagination = parsePagination(page, limit, 20);

    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          category: true,
          designer: {
            select: {
              id: true,
              businessName: true,
              country: true,
              city: true,
              rating: true,
            },
          },
          images: true,
          suitableFabrics: {
            include: {
              fabric: {
                select: {
                  id: true,
                  name: true,
                  finalPrice: true,
                  images: { take: 1 },
                  seller: { select: { country: true } },
                },
              },
            },
          },
          measurementVariables: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.design.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        designs,
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

// Get single design
router.get('/designs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const design = await prisma.design.findUnique({
      where: { id },
      include: {
        category: true,
        designer: {
          select: {
            id: true,
            businessName: true,
            bio: true,
            country: true,
            city: true,
            rating: true,
          },
        },
        images: true,
        suitableFabrics: {
          include: {
            fabric: {
              include: {
                materialType: true,
                images: { take: 1 },
                seller: {
                  select: {
                    businessName: true,
                    country: true,
                    city: true,
                  },
                },
              },
            },
          },
        },
        measurementVariables: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found.',
      });
    }

    res.json({
      success: true,
      data: design,
    });
  } catch (error) {
    next(error);
  }
});

// Get ready-to-wear with filters
router.get('/ready-to-wear', async (req, res, next) => {
  try {
    const { categoryId, country, designerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (country) where.designer = { country: country as string };
    if (designerId) where.designerId = designerId as string;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pagination = parsePagination(page, limit, 20);

    const [products, total] = await Promise.all([
      prisma.readyToWear.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          category: true,
          designer: {
            select: {
              id: true,
              businessName: true,
              country: true,
              city: true,
              rating: true,
            },
          },
          images: true,
          sizeVariations: {
            where: { stock: { gt: 0 } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.readyToWear.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        products,
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

// Get single ready-to-wear product
router.get('/ready-to-wear/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.readyToWear.findUnique({
      where: { id },
      include: {
        category: true,
        designer: {
          select: {
            id: true,
            businessName: true,
            bio: true,
            country: true,
            city: true,
            rating: true,
          },
        },
        images: true,
        sizeVariations: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

// Get countries list (for filtering)
router.get('/countries', async (req, res, next) => {
  try {
    const [fabricCountries, designerCountries] = await Promise.all([
      prisma.fabricSellerProfile.groupBy({
        by: ['country'],
        where: { isVerified: true },
      }),
      prisma.designerProfile.groupBy({
        by: ['country'],
        where: { isVerified: true },
      }),
    ]);

    const countries = Array.from(new Set([
      ...fabricCountries.map((c) => c.country),
      ...designerCountries.map((c) => c.country),
    ])).sort();

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    next(error);
  }
});

// Get featured products
router.get('/featured', async (req, res, next) => {
  try {
    const [fabrics, designs, readyToWear] = await Promise.all([
      prisma.fabric.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          materialType: true,
          images: { take: 1 },
          seller: { select: { country: true } },
        },
        orderBy: { totalSold: 'desc' },
      }),
      prisma.design.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          category: true,
          images: { take: 1 },
          designer: { select: { businessName: true, country: true } },
        },
        orderBy: { totalOrders: 'desc' },
      }),
      prisma.readyToWear.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          category: true,
          images: { take: 1 },
          designer: { select: { businessName: true, country: true } },
        },
        orderBy: { totalSold: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        fabrics,
        designs,
        readyToWear,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:productType/:id/likes', optionalAuth, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const [countRows, likedRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
        `SELECT COUNT(*)::bigint AS count FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2`,
        productType,
        productId
      ),
      req.user
        ? prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2 AND "userId" = $3 LIMIT 1`,
            productType,
            productId,
            req.user.id
          )
        : Promise.resolve([]),
    ]);
    const countRaw = countRows[0]?.count ?? 0;
    const count = Number(typeof countRaw === 'bigint' ? countRaw.toString() : countRaw) || 0;
    res.json({
      success: true,
      data: {
        count,
        likedByMe: likedRows.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:productType/:id/likes/toggle', authenticate, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const product = await ensureProductExists(productType, productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2 AND "userId" = $3 LIMIT 1`,
      productType,
      productId,
      req.user!.id
    );
    let likedByMe = false;
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ProductLike" WHERE "id" = $1`, existing[0].id);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ProductLike" ("id", "userId", "productId", "productType") VALUES ($1, $2, $3, $4)`,
        randomUUID(),
        req.user!.id,
        productId,
        productType
      );
      likedByMe = true;
    }
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
      `SELECT COUNT(*)::bigint AS count FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2`,
      productType,
      productId
    );
    const countRaw = countRows[0]?.count ?? 0;
    const count = Number(typeof countRaw === 'bigint' ? countRaw.toString() : countRaw) || 0;
    res.json({ success: true, data: { count, likedByMe } });
  } catch (error) {
    next(error);
  }
});

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120).optional(),
  comment: z.string().trim().min(1).max(2000),
  orderId: z.string().trim().min(1).optional(),
  images: z.array(z.string().url()).max(6).optional(),
});

router.get('/:productType/:id/reviews', async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const limitRaw = Number.parseInt(String(req.query.limit ?? '12'), 10) || 12;
    const limit = Math.min(50, Math.max(1, limitRaw));
    const rows = await prisma.review.findMany({
      where: { productType, productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const customerIds = Array.from(new Set(rows.map((row) => row.customerId).filter(Boolean)));
    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const customerMap = new Map(customers.map((item) => [item.id, item]));
    const withCustomer = rows.map((row) => {
      const customer = customerMap.get(row.customerId);
      return {
        ...row,
        customer: customer
          ? {
              id: customer.id,
              name: `${String(customer.firstName || '').trim()} ${String(customer.lastName || '').trim()}`.trim() || customer.email,
            }
          : null,
      };
    });
    const aggregate = withCustomer.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.ratingSum += Number(row.rating || 0);
        return acc;
      },
      { count: 0, ratingSum: 0 }
    );
    res.json({
      success: true,
      data: {
        reviews: withCustomer,
        summary: {
          count: aggregate.count,
          averageRating: aggregate.count > 0 ? Number((aggregate.ratingSum / aggregate.count).toFixed(2)) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:productType/:id/reviews', authenticate, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const product = await ensureProductExists(productType, productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const data = createReviewSchema.parse(req.body);
    const review = await prisma.review.create({
      data: {
        id: randomUUID(),
        customerId: req.user!.id,
        productId,
        productType,
        orderId: data.orderId || `MANUAL-${Date.now()}`,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment,
        images: data.images || [],
        isVerified: false,
      },
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed.', issues: error.issues });
    }
    next(error);
  }
});

router.get('/:productType/:id/discover', async (req, res, next) => {
  try {
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const limitRaw = Number.parseInt(String(req.query.limit ?? '12'), 10) || 12;
    const limit = Math.min(30, Math.max(1, limitRaw));

    if (productType === 'DESIGN') {
      const current = await prisma.design.findUnique({ where: { id: productId }, select: { id: true, categoryId: true } });
      if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
      const primary = await prisma.design.findMany({
        where: {
          id: { not: productId },
          status: ProductStatus.APPROVED,
          isAvailable: true,
          ...(current.categoryId ? { categoryId: current.categoryId } : {}),
        },
        include: {
          images: { take: 1 },
          designer: { select: { country: true, businessName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      });
      const fallback =
        primary.length < limit
          ? await prisma.design.findMany({
              where: {
                id: { not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1 },
                designer: { select: { country: true, businessName: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 150,
            })
          : [];
      const merged = [...primary, ...fallback];
      const seenCountries = new Set<string>();
      const items: any[] = [];
      for (const row of merged) {
        const country = String(row.designer?.country || '').trim() || 'Unknown';
        if (seenCountries.has(country)) continue;
        seenCountries.add(country);
        items.push({
          id: row.id,
          name: row.name,
          image: row.images?.[0]?.url || '',
          priceUsd: Number(row.finalPrice || row.basePrice || 0),
          country,
          ownerName: row.designer?.businessName || 'Designer',
          productType: 'DESIGN',
        });
        if (items.length >= limit) break;
      }
      return res.json({ success: true, data: items });
    }

    if (productType === 'FABRIC') {
      const current = await prisma.fabric.findUnique({ where: { id: productId }, select: { id: true, materialTypeId: true } });
      if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
      const primary = await prisma.fabric.findMany({
        where: {
          id: { not: productId },
          status: ProductStatus.APPROVED,
          isAvailable: true,
          ...(current.materialTypeId ? { materialTypeId: current.materialTypeId } : {}),
        },
        include: {
          images: { take: 1 },
          seller: { select: { country: true, businessName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      });
      const fallback =
        primary.length < limit
          ? await prisma.fabric.findMany({
              where: {
                id: { not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1 },
                seller: { select: { country: true, businessName: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 150,
            })
          : [];
      const merged = [...primary, ...fallback];
      const seenCountries = new Set<string>();
      const items: any[] = [];
      for (const row of merged) {
        const country = String(row.seller?.country || '').trim() || 'Unknown';
        if (seenCountries.has(country)) continue;
        seenCountries.add(country);
        items.push({
          id: row.id,
          name: row.name,
          image: row.images?.[0]?.url || '',
          priceUsd: Number(row.finalPrice || 0),
          country,
          ownerName: row.seller?.businessName || 'Seller',
          productType: 'FABRIC',
        });
        if (items.length >= limit) break;
      }
      return res.json({ success: true, data: items });
    }

    const current = await prisma.readyToWear.findUnique({ where: { id: productId }, select: { id: true, categoryId: true } });
    if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
    const primary = await prisma.readyToWear.findMany({
      where: {
        id: { not: productId },
        status: ProductStatus.APPROVED,
        isAvailable: true,
        ...(current.categoryId ? { categoryId: current.categoryId } : {}),
      },
      include: {
        images: { take: 1 },
        designer: { select: { country: true, businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    const fallback =
      primary.length < limit
        ? await prisma.readyToWear.findMany({
            where: {
              id: { not: productId },
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
            include: {
              images: { take: 1 },
              designer: { select: { country: true, businessName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 150,
          })
        : [];
    const merged = [...primary, ...fallback];
    const seenCountries = new Set<string>();
    const items: any[] = [];
    for (const row of merged) {
      const country = String(row.designer?.country || '').trim() || 'Unknown';
      if (seenCountries.has(country)) continue;
      seenCountries.add(country);
      items.push({
        id: row.id,
        name: row.name,
        image: row.images?.[0]?.url || '',
        priceUsd: Number(row.basePrice || 0),
        country,
        ownerName: row.designer?.businessName || 'Designer',
        productType: 'READY_TO_WEAR',
      });
      if (items.length >= limit) break;
    }
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

export default router;
