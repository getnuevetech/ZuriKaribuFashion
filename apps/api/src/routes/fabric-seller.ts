import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

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
    const profile = await resolveSellerProfile(req.user!.id);

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

    res.json({
      success: true,
      data: fabrics,
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

    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
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
