import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.SELLER_ACCESS));

// Get seller dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId: req.user!.id },
    });

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
    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId: req.user!.id },
    });

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

    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });

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
      })).min(4).max(6),
    });

    const data = schema.parse(req.body);

    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    // Apply global markup to get final price
    const markupRule = await prisma.pricingRule.findFirst({
      where: {
        ruleType: 'GLOBAL_MARKUP',
        isActive: true,
      },
    });

    let finalPrice = data.sellerPrice;
    if (markupRule && markupRule.adjustmentType === 'PERCENTAGE_MARKUP') {
      finalPrice = data.sellerPrice * (1 + Number(markupRule.value) / 100);
    }

    // Check for country-specific markup
    const countryRule = await prisma.pricingRule.findFirst({
      where: {
        ruleType: 'COUNTRY_MARKUP',
        country: profile.country,
        isActive: true,
      },
    });

    if (countryRule && countryRule.adjustmentType === 'PERCENTAGE_MARKUP') {
      finalPrice = finalPrice * (1 + Number(countryRule.value) / 100);
    }

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

// Get fabric orders
router.get('/orders', async (req, res, next) => {
  try {
    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId: req.user!.id },
    });

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
