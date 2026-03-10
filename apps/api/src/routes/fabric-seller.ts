import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma, UserRole, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();
let sellerGovernanceSchemaEnsured = false;

router.use(authenticate);
router.use(authorizePermissions(Permissions.SELLER_ACCESS));

async function resolveSellerProfile(userId: string) {
  const existing = await prisma.fabricSellerProfile.findFirst({
    where: { userId },
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  if (!user) return null;

  return prisma.fabricSellerProfile.create({
    data: {
      userId,
      businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      businessEmail: user.email,
      businessPhone: user.phone || 'N/A',
      country: 'Not specified',
      city: 'Not specified',
      address: 'Not specified',
      isVerified: false,
    },
  });
}

async function ensureSellerGovernanceSchema() {
  if (sellerGovernanceSchemaEnsured) return;
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileField_pkey" PRIMARY KEY ("id")
    )`
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role","userId")`
  );
  sellerGovernanceSchemaEnsured = true;
}

type VendorProfileStatus = 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const normalizeVendorProfileStatus = (value: unknown): VendorProfileStatus => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOMPLETE' || normalized === 'SUBMITTED' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'INCOMPLETE';
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

async function readSellerSubmission(userId: string) {
  await ensureSellerGovernanceSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes"
     FROM "VendorProfileSubmission"
     WHERE "role" = 'FABRIC_SELLER' AND "userId" = $1
     LIMIT 1`,
    userId
  );
  return rows[0] || null;
}

async function readSellerProfileFields() {
  try {
    await ensureSellerGovernanceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
       FROM "VendorProfileField"
       WHERE "role" = 'FABRIC_SELLER'
       ORDER BY "sortOrder" ASC, "createdAt" ASC`
    );
    return rows.map((row) => ({
      ...row,
      required: Boolean(row.required),
      isActive: Boolean(row.isActive),
      options: Array.isArray(row.options) ? row.options : [],
    }));
  } catch {
    return [];
  }
}

async function getSellerProfileCompletion(userId: string) {
  const profile = await resolveSellerProfile(userId);
  if (!profile) return null;

  const [submission, fields] = await Promise.all([readSellerSubmission(userId), readSellerProfileFields()]);
  const status = submission
    ? normalizeVendorProfileStatus(submission.profileStatus)
    : profile.isVerified
      ? 'APPROVED'
      : 'INCOMPLETE';
  const canUpload = status === 'APPROVED' || Boolean(profile.isVerified);
  const brandSlug = slugify(profile.businessName || '');
  const storefrontPath = `/store/seller/${encodeURIComponent(profile.id)}/${encodeURIComponent(brandSlug || 'store')}`;

  return {
    role: 'FABRIC_SELLER',
    canUpload,
    profileStatus: status,
    profile: {
      id: profile.id,
      businessName: profile.businessName,
      businessEmail: profile.businessEmail,
      businessPhone: profile.businessPhone,
      country: profile.country,
      city: profile.city,
      address: profile.address,
      isVerified: profile.isVerified,
      storefrontPath,
      storefrontSlug: brandSlug,
    },
    profileData: submission?.profileData || {},
    profileSubmittedAt: submission?.profileSubmittedAt || null,
    profileReviewedAt: submission?.profileReviewedAt || null,
    profileReviewNotes: submission?.profileReviewNotes || null,
    fields,
  };
}

async function ensureSellerCanUpload(userId: string) {
  const completion = await getSellerProfileCompletion(userId);
  if (!completion) {
    return {
      allowed: false,
      statusCode: 404,
      message: 'Seller profile not found.',
    };
  }
  if (completion.canUpload) {
    return { allowed: true, completion };
  }
  return {
    allowed: false,
    statusCode: 403,
    message:
      completion.profileStatus === 'REJECTED'
        ? 'Your vendor profile was rejected. Please update your profile and resubmit for approval.'
        : 'Complete and submit your full vendor profile for admin approval before uploading products.',
    completion,
  };
}

async function computeFinalFabricPrice(baseSellerPrice: number, sellerCountry: string) {
  const markupRule = await prisma.pricingRule.findFirst({
    where: {
      ruleType: 'GLOBAL_MARKUP',
      isActive: true,
    },
  });

  let finalPrice = baseSellerPrice;
  if (markupRule && markupRule.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = baseSellerPrice * (1 + Number(markupRule.value) / 100);
  }

  const countryRule = await prisma.pricingRule.findFirst({
    where: {
      ruleType: 'COUNTRY_MARKUP',
      country: sellerCountry,
      isActive: true,
    },
  });

  if (countryRule && countryRule.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = finalPrice * (1 + Number(countryRule.value) / 100);
  }

  return finalPrice;
}

// Get seller dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const completion = await getSellerProfileCompletion(req.user!.id);
    const profile = completion?.profile;

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const [totalFabrics, totalOrders, pendingOrders, totalRevenue] = await Promise.all([
      prisma.fabric.count({ where: { sellerId: profile.id } }),
      prisma.fabricOrderItem.count({ where: { sellerId: profile.id } }),
      prisma.fabricOrderItem.count({
        where: { sellerId: profile.id, status: 'PENDING' },
      }),
      prisma.fabricOrderItem.aggregate({
        where: { sellerId: profile.id },
        _sum: { totalPrice: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        profile,
        profileCompletion: completion,
        stats: {
          totalFabrics,
          totalOrders,
          pendingOrders,
          totalRevenue: totalRevenue._sum.totalPrice || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get seller fabrics
router.get('/fabrics', async (req, res, next) => {
  try {
    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const fabrics = await prisma.fabric.findMany({
      where: { sellerId: profile.id },
      include: {
        materialType: true,
        images: true,
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const featuredRows =
      fabrics.length > 0
        ? await prisma.featuredProduct.findMany({
            where: {
              productType: 'FABRIC',
              productId: { in: fabrics.map((item) => item.id) },
              isActive: true,
            },
            select: {
              productId: true,
              section: true,
            },
          })
        : [];

    const featuredByFabricId = new Map<string, string[]>();
    for (const row of featuredRows) {
      const existing = featuredByFabricId.get(row.productId) || [];
      if (!existing.includes(row.section)) existing.push(row.section);
      featuredByFabricId.set(row.productId, existing);
    }

    res.json({
      success: true,
      data: fabrics.map((item) => {
        const featuredSections = featuredByFabricId.get(item.id) || [];
        return {
          ...item,
          isFeatured: featuredSections.length > 0,
          featuredSections,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile-completion', async (req, res, next) => {
  try {
    const completion = await getSellerProfileCompletion(req.user!.id);
    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }
    res.json({
      success: true,
      data: completion,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile-completion', async (req, res, next) => {
  try {
    const payload = z
      .object({
        businessName: z.string().min(2).optional(),
        businessEmail: z.string().email().optional(),
        businessPhone: z.string().min(3).optional(),
        country: z.string().min(2).optional(),
        city: z.string().min(2).optional(),
        address: z.string().min(3).optional(),
        profileData: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
      })
      .parse(req.body);

    const current = await getSellerProfileCompletion(req.user!.id);
    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const mergedProfileData = {
      ...(current.profileData && typeof current.profileData === 'object' ? current.profileData : {}),
      ...(payload.profileData || {}),
    };
    const missingDynamicRequired = (current.fields || [])
      .filter((field: any) => field.isActive && field.required)
      .filter((field: any) => {
        const value = (mergedProfileData as Record<string, unknown>)[field.key];
        if (Array.isArray(value)) return value.length === 0;
        return String(value ?? '').trim().length === 0;
      })
      .map((field: any) => field.label || field.key);

    const businessName = payload.businessName ?? current.profile.businessName ?? '';
    const country = payload.country ?? current.profile.country ?? '';
    const city = payload.city ?? current.profile.city ?? '';
    const missingCoreRequired = [];
    if (!String(businessName).trim()) missingCoreRequired.push('Business name');
    if (!String(country).trim()) missingCoreRequired.push('Country');
    if (!String(city).trim()) missingCoreRequired.push('City');
    const missing = [...missingCoreRequired, ...missingDynamicRequired];
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete required fields: ${missing.join(', ')}`,
      });
    }

    await prisma.fabricSellerProfile.update({
      where: { id: current.profile.id },
      data: {
        businessName: String(businessName).trim(),
        businessEmail: payload.businessEmail ?? current.profile.businessEmail ?? null,
        businessPhone: payload.businessPhone ?? current.profile.businessPhone ?? null,
        country: String(country).trim(),
        city: String(city).trim(),
        address: payload.address ?? current.profile.address ?? '',
        isVerified: false,
      },
    });

    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","updatedAt")
       VALUES ($1,'FABRIC_SELLER',$2,$3,'SUBMITTED',$4::jsonb,$5,NULL,NULL,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "businessName" = EXCLUDED."businessName",
         "profileStatus" = EXCLUDED."profileStatus",
         "profileData" = EXCLUDED."profileData",
         "profileSubmittedAt" = EXCLUDED."profileSubmittedAt",
         "profileReviewedAt" = NULL,
         "profileReviewNotes" = NULL,
         "updatedAt" = NOW()`,
      randomUUID(),
      req.user!.id,
      String(businessName).trim(),
      JSON.stringify(mergedProfileData),
      now
    );

    const completion = await getSellerProfileCompletion(req.user!.id);
    res.json({
      success: true,
      message: 'Profile submitted successfully. Admin review is now required before product uploads.',
      data: completion,
    });
  } catch (error) {
    next(error);
  }
});

// Update fabric stock
router.patch('/fabrics/:id/stock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      stock: z.number().min(0),
    });
    const { stock } = schema.parse(req.body);

    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const fabric = await prisma.fabric.findFirst({
      where: { id, sellerId: profile.id },
      select: { id: true },
    });

    if (!fabric) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }

    const updated = await prisma.fabric.update({
      where: { id },
      data: { stockYards: stock },
    });

    res.json({
      success: true,
      message: 'Fabric stock updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Create fabric
router.post('/fabrics', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(10),
      materialTypeId: z.string().uuid(),
      sellerPrice: z.number().positive(),
      minYards: z.number().min(1),
      stockYards: z.number().min(0),
      images: z.array(z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      })).min(3).max(4),
    });

    const data = schema.parse(req.body);

    const uploadAccess = await ensureSellerCanUpload(req.user!.id);
    if (!uploadAccess.allowed) {
      return res.status(Number(uploadAccess.statusCode || 403)).json({
        success: false,
        message: uploadAccess.message,
        data: uploadAccess.completion || null,
      });
    }
    const profile = await resolveSellerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    }

    const finalPrice = await computeFinalFabricPrice(data.sellerPrice, profile.country);

    const fabric = await prisma.fabric.create({
      data: {
        sellerId: profile.id,
        name: data.name,
        description: data.description,
        materialTypeId: data.materialTypeId,
        sellerPrice: data.sellerPrice,
        finalPrice,
        minYards: data.minYards,
        stockYards: data.stockYards,
        status: ProductStatus.PENDING_REVIEW,
        images: {
          create: data.images.map((img, i) => ({
            url: img.url,
            alt: img.alt || data.name,
            sortOrder: i,
          })),
        },
      },
      include: {
        materialType: true,
        images: true,
      },
    });

    // Update seller fabric count
    await prisma.fabricSellerProfile.update({
      where: { id: profile.id },
      data: { totalFabrics: { increment: 1 } },
    });

    res.status(201).json({
      success: true,
      message: 'Fabric submitted for review.',
      data: fabric,
    });
  } catch (error) {
    next(error);
  }
});

// Update fabric
router.patch('/fabrics/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().min(10).optional(),
      materialTypeId: z.string().uuid().optional(),
      sellerPrice: z.number().positive().optional(),
      minYards: z.number().min(1).optional(),
      stockYards: z.number().min(0).optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            alt: z.string().optional(),
          })
        )
        .min(3)
        .max(4)
        .optional(),
    });
    const data = schema.parse(req.body);

    const uploadAccess = await ensureSellerCanUpload(req.user!.id);
    if (!uploadAccess.allowed) {
      return res.status(Number(uploadAccess.statusCode || 403)).json({
        success: false,
        message: uploadAccess.message,
        data: uploadAccess.completion || null,
      });
    }

    const profile = await resolveSellerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const existing = await prisma.fabric.findFirst({
      where: { id, sellerId: profile.id },
      select: { id: true, sellerPrice: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }

    const nextSellerPrice = Number(data.sellerPrice ?? existing.sellerPrice);
    const nextFinalPrice = await computeFinalFabricPrice(nextSellerPrice, profile.country);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.images) {
        await tx.fabricImage.deleteMany({ where: { fabricId: id } });
      }
      const payload: any = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.materialTypeId !== undefined ? { materialTypeId: data.materialTypeId } : {}),
        ...(data.sellerPrice !== undefined ? { sellerPrice: data.sellerPrice } : {}),
        ...(data.minYards !== undefined ? { minYards: data.minYards } : {}),
        ...(data.stockYards !== undefined ? { stockYards: data.stockYards } : {}),
        finalPrice: nextFinalPrice,
        status: ProductStatus.PENDING_REVIEW,
      };
      if (data.images) {
        payload.images = {
          create: data.images.map((img, index) => ({
            url: img.url,
            alt: img.alt || data.name || 'Fabric image',
            sortOrder: index,
          })),
        };
      }
      return tx.fabric.update({
        where: { id },
        data: payload,
        include: {
          materialType: true,
          images: true,
        },
      });
    });

    res.json({
      success: true,
      message: 'Fabric updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Get fabric orders
router.get('/orders', async (req, res, next) => {
  try {
    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const orders = await prisma.fabricOrderItem.findMany({
      where: { sellerId: profile.id },
      include: {
        fabric: {
          select: { name: true, images: { take: 1 } },
        },
        order: {
          select: {
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
