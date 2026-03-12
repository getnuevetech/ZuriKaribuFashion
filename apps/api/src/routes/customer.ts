import { Router } from 'express';
import { z } from 'zod';
import { prisma, ProductStatus, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { autoCloseOverdueDeliveredOrders } from '../utils/order-workflow';
import { readCustomerTryOnProfileState } from '../utils/try-on-insights';
import { readTryOnSettings } from '../utils/try-on-settings';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.CUSTOMER_ACCESS));

function parsePagination(pageValue: unknown, limitValue: unknown, defaultLimit = 10) {
  const page = Math.max(1, Number.parseInt(String(pageValue ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(limitValue ?? defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const normalizeMeasurementMap = (input: unknown) => {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    output[String(key).trim().toLowerCase()] = Number(parsed.toFixed(2));
  }
  return output;
};

const resolveCustomerProfile = async (userId: string) => {
  const existing = await prisma.customerProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.customerProfile.create({
    data: {
      userId,
      totalOrders: 0,
      totalSpent: 0,
    },
  });
};

const buildTryOnSummaryData = async (userId: string) => {
  const settingsPayload = await readTryOnSettings();
  const settings = settingsPayload.settings;
  const profile = await resolveCustomerProfile(userId);
  const measurement = await prisma.customerMeasurement.findUnique({
    where: { customerProfileId: profile.id },
    include: {
      tryOnHistory: {
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  });
  const usage = readCustomerTryOnProfileState(measurement?.avatarData);
  const freeRemaining = Math.max(0, settings.freeTryOnsPerCustomer - usage.freeUsedCount);
  return {
    settings: {
      enabled: settings.enabled,
      freeTryOnsPerCustomer: settings.freeTryOnsPerCustomer,
      additionalTryOnBundleSize: settings.additionalTryOnBundleSize,
      additionalTryOnBundlePriceUsd: settings.additionalTryOnBundlePriceUsd,
      maxProductsPerBatch: settings.maxProductsPerBatch,
      requiredMeasurementFields: settings.requiredMeasurementFields,
      chargeNoticeText: settings.chargeNoticeText,
      applyLocations: settings.applyLocations,
      activeProviders: (settings.apiProviders || []).filter((provider) => provider.isActive).map((provider) => ({
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        appliesTo: provider.appliesTo,
      })),
    },
    usage: {
      freeUsedCount: usage.freeUsedCount,
      freeRemaining,
      paidCreditsRemaining: usage.paidCreditsRemaining,
      totalRuns: usage.totalRuns,
      purchaseCount: usage.purchaseCount,
    },
    measurements: normalizeMeasurementMap(measurement?.measurements),
    recent: (measurement?.tryOnHistory || []).map((row) => ({
      id: row.id,
      productType: String(row.fabricId || '').toUpperCase() === 'READY_TO_WEAR' ? 'READY_TO_WEAR' : 'DESIGN',
      productId: row.designId,
      createdAt: row.createdAt,
      resultImages: row.resultImages || [],
    })),
  };
};

// Get customer profile
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        addresses: true,
        measurements: {
          include: {
            tryOnHistory: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// Get customer addresses
router.get('/addresses', async (req, res, next) => {
  try {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const addresses = await prisma.address.findMany({
      where: { customerProfileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
});

// Add address
router.post('/addresses', async (req, res, next) => {
  try {
    const schema = z.object({
      label: z.string().min(1),
      fullName: z.string().min(2),
      phone: z.string().min(1),
      country: z.string().min(1),
      city: z.string().min(1),
      address: z.string().min(1),
      postalCode: z.string().optional(),
      isDefault: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { customerProfileId: profile.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        ...data,
        customerProfileId: profile.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Address added successfully.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
});

// Update address
router.patch('/addresses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      label: z.string().min(1).optional(),
      fullName: z.string().min(2).optional(),
      phone: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      postalCode: z.string().optional(),
      isDefault: z.boolean().optional(),
    });
    const updateData = schema.parse(req.body);

    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await prisma.address.updateMany({
        where: { customerProfileId: profile.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id, customerProfileId: profile.id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Address updated successfully.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
});

// Delete address
router.delete('/addresses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    await prisma.address.delete({
      where: { id, customerProfileId: profile.id },
    });

    res.json({
      success: true,
      message: 'Address deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// Save measurements
router.post('/measurements', async (req, res, next) => {
  try {
    const schema = z.object({
      height: z.number().optional(),
      weight: z.number().optional(),
      measurements: z.record(z.number()).optional(),
    });

    const data = schema.parse(req.body);

    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const measurements = await prisma.customerMeasurement.upsert({
      where: { customerProfileId: profile.id },
      create: {
        ...data,
        customerProfileId: profile.id,
      },
      update: data,
    });

    res.json({
      success: true,
      message: 'Measurements saved successfully.',
      data: measurements,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/try-on/summary', async (req, res, next) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (!settingsPayload.settings.enabled || settingsPayload.settings.applyLocations.customerDashboard === false) {
      return res.json({
        success: true,
        data: {
          settings: settingsPayload.settings,
          usage: { freeUsedCount: 0, freeRemaining: 0, paidCreditsRemaining: 0, totalRuns: 0, purchaseCount: 0 },
          measurements: {},
          recent: [],
          disabled: true,
        },
      });
    }
    const data = await buildTryOnSummaryData(req.user!.id);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/try-on/catalog', async (req, res, next) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (!settingsPayload.settings.enabled || settingsPayload.settings.applyLocations.customerDashboard === false) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 0, total: 0, pages: 1 },
      });
    }
    const query = z
      .object({
        search: z.string().optional(),
        productType: z.enum(['ALL', 'DESIGN', 'READY_TO_WEAR']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(24),
      })
      .parse(req.query || {});
    const search = String(query.search || '').trim().toLowerCase();
    const productType = query.productType || 'ALL';
    const [designs, readyProducts] = await Promise.all([
      productType === 'READY_TO_WEAR'
        ? []
        : prisma.design.findMany({
            where: { status: ProductStatus.APPROVED },
            orderBy: { createdAt: 'desc' },
            take: 250,
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
              category: true,
              designer: { select: { businessName: true, country: true } },
            },
          }),
      productType === 'DESIGN'
        ? []
        : prisma.readyToWear.findMany({
            where: { status: ProductStatus.APPROVED },
            orderBy: { createdAt: 'desc' },
            take: 250,
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
              category: true,
              designer: { select: { businessName: true, country: true } },
            },
          }),
    ]);
    const rows = [
      ...designs.map((item) => ({
        id: item.id,
        productType: 'DESIGN' as const,
        name: item.name,
        description: item.description,
        image: item.images?.[0]?.url || '',
        priceUsd: Number((item as any).finalPrice || item.basePrice || 0),
        ownerName: item.designer?.businessName || 'Designer',
        country: item.designer?.country || '',
        style: item.category?.name || '',
      })),
      ...readyProducts.map((item) => ({
        id: item.id,
        productType: 'READY_TO_WEAR' as const,
        name: item.name,
        description: item.description,
        image: item.images?.[0]?.url || '',
        priceUsd: Number((item as any).finalPrice || item.basePrice || 0),
        ownerName: item.designer?.businessName || 'Designer',
        country: item.designer?.country || '',
        style: item.category?.name || '',
      })),
    ].filter((row) => {
      if (!search) return true;
      return (
        String(row.name || '').toLowerCase().includes(search) ||
        String(row.description || '').toLowerCase().includes(search) ||
        String(row.ownerName || '').toLowerCase().includes(search) ||
        String(row.country || '').toLowerCase().includes(search) ||
        String(row.style || '').toLowerCase().includes(search)
      );
    });
    const start = (query.page - 1) * query.limit;
    const data = rows.slice(start, start + query.limit);
    res.json({
      success: true,
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: rows.length,
        pages: Math.max(1, Math.ceil(rows.length / query.limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/try-on/purchase', async (req, res, next) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (!settingsPayload.settings.enabled || settingsPayload.settings.applyLocations.customerDashboard === false) {
      return res.status(403).json({
        success: false,
        message: 'Try-On purchasing is disabled by admin settings.',
      });
    }
    const payload = z
      .object({
        bundles: z.number().int().min(1).max(100).default(1),
      })
      .parse(req.body || {});
    const settings = settingsPayload.settings;
    const profile = await resolveCustomerProfile(req.user!.id);
    const measurement = await prisma.customerMeasurement.upsert({
      where: { customerProfileId: profile.id },
      create: {
        customerProfileId: profile.id,
        measurements: {},
        avatarData: {},
      },
      update: {},
    });
    const usage = readCustomerTryOnProfileState(measurement.avatarData);
    const creditIncrement = payload.bundles * settings.additionalTryOnBundleSize;
    const nextAvatar = {
      ...(measurement.avatarData && typeof measurement.avatarData === 'object' ? (measurement.avatarData as any) : {}),
      tryOnPaidCreditsRemaining: usage.paidCreditsRemaining + creditIncrement,
      tryOnPurchaseCount: usage.purchaseCount + payload.bundles,
      tryOnLastPurchaseAt: new Date().toISOString(),
      tryOnTotalChargedUsd:
        Number(
          (
            Number(
              (measurement.avatarData && typeof measurement.avatarData === 'object'
                ? (measurement.avatarData as any).tryOnTotalChargedUsd
                : 0) || 0
            ) + payload.bundles * settings.additionalTryOnBundlePriceUsd
          ).toFixed(2)
        ),
    };
    await prisma.customerMeasurement.update({
      where: { id: measurement.id },
      data: {
        avatarData: nextAvatar as any,
      },
    });
    res.json({
      success: true,
      message: 'Try-On credits purchased successfully.',
      data: {
        bundles: payload.bundles,
        creditsAdded: creditIncrement,
        amountChargedUsd: Number((payload.bundles * settings.additionalTryOnBundlePriceUsd).toFixed(2)),
        paidCreditsRemaining: usage.paidCreditsRemaining + creditIncrement,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/try-on/batch', async (req, res, next) => {
  try {
    const settingsPayload = await readTryOnSettings();
    const settings = settingsPayload.settings;
    if (!settings.enabled || settings.applyLocations.customerDashboard === false) {
      return res.status(403).json({
        success: false,
        message: 'Try-On is currently disabled by admin settings.',
      });
    }
    const payload = z
      .object({
        measurements: z.record(z.number().positive()).optional(),
        selectedProducts: z
          .array(
            z.object({
              productType: z.enum(['DESIGN', 'READY_TO_WEAR']),
              productId: z.string().uuid(),
            })
          )
          .min(1),
      })
      .parse(req.body || {});
    const dedupedSelections = Array.from(
      new Map(
        (payload.selectedProducts || []).map((item) => [`${item.productType}:${item.productId}`, item] as const)
      ).values()
    );
    if (dedupedSelections.length > settings.maxProductsPerBatch) {
      return res.status(400).json({
        success: false,
        message: `You can run up to ${settings.maxProductsPerBatch} TryON products per batch.`,
      });
    }
    const normalizedMeasurements = normalizeMeasurementMap(payload.measurements || {});
    const missingRequiredMeasurements = (settings.requiredMeasurementFields || []).filter(
      (field) => !normalizedMeasurements[String(field || '').trim().toLowerCase()]
    );
    if (missingRequiredMeasurements.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required measurements: ${missingRequiredMeasurements.join(', ')}`,
      });
    }
    const designIds = dedupedSelections
      .filter((item) => item.productType === 'DESIGN')
      .map((item) => item.productId);
    const readyIds = dedupedSelections
      .filter((item) => item.productType === 'READY_TO_WEAR')
      .map((item) => item.productId);
    const [designs, readyProducts] = await Promise.all([
      designIds.length > 0
        ? prisma.design.findMany({
            where: { id: { in: designIds }, status: ProductStatus.APPROVED },
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
              designer: { select: { businessName: true, country: true } },
            },
          })
        : [],
      readyIds.length > 0
        ? prisma.readyToWear.findMany({
            where: { id: { in: readyIds }, status: ProductStatus.APPROVED },
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
              designer: { select: { businessName: true, country: true } },
            },
          })
        : [],
    ]);
    if (designs.length !== designIds.length || readyProducts.length !== readyIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected products are unavailable for Try-On.',
      });
    }
    const designById = new Map(designs.map((row) => [row.id, row] as const));
    const readyById = new Map(readyProducts.map((row) => [row.id, row] as const));
    const profile = await resolveCustomerProfile(req.user!.id);
    const measurement = await prisma.customerMeasurement.upsert({
      where: { customerProfileId: profile.id },
      create: {
        customerProfileId: profile.id,
        measurements: normalizedMeasurements,
        avatarData: {},
      },
      update: {
        measurements: normalizedMeasurements,
      },
    });
    const usage = readCustomerTryOnProfileState(measurement.avatarData);
    const requestedCount = dedupedSelections.length;
    const freeRemaining = Math.max(0, settings.freeTryOnsPerCustomer - usage.freeUsedCount);
    const consumeFromFree = Math.min(freeRemaining, requestedCount);
    const consumeFromPaid = Math.max(0, requestedCount - consumeFromFree);
    if (consumeFromPaid > usage.paidCreditsRemaining) {
      const creditsMissing = consumeFromPaid - usage.paidCreditsRemaining;
      const bundlesNeeded = Math.max(1, Math.ceil(creditsMissing / settings.additionalTryOnBundleSize));
      return res.status(402).json({
        success: false,
        requiresPayment: true,
        message:
          `You have used your free TryON quota. Purchase ${bundlesNeeded} additional bundle(s) to continue.`,
        data: {
          creditsMissing,
          bundlesNeeded,
          amountRequiredUsd: Number((bundlesNeeded * settings.additionalTryOnBundlePriceUsd).toFixed(2)),
          bundleSize: settings.additionalTryOnBundleSize,
          bundlePriceUsd: settings.additionalTryOnBundlePriceUsd,
          chargeNoticeText: settings.chargeNoticeText,
        },
      });
    }
    const nextAvatar = {
      ...(measurement.avatarData && typeof measurement.avatarData === 'object' ? (measurement.avatarData as any) : {}),
      tryOnFreeUsedCount: usage.freeUsedCount + consumeFromFree,
      tryOnPaidCreditsRemaining: usage.paidCreditsRemaining - consumeFromPaid,
      tryOnTotalRuns: usage.totalRuns + requestedCount,
      tryOnLastRunAt: new Date().toISOString(),
    };
    await prisma.customerMeasurement.update({
      where: { id: measurement.id },
      data: { avatarData: nextAvatar as any },
    });
    const previews = dedupedSelections.map((selection) => {
      const isReady = selection.productType === 'READY_TO_WEAR';
      const product = isReady ? readyById.get(selection.productId) : designById.get(selection.productId);
      return {
        productType: selection.productType,
        productId: selection.productId,
        productName: product?.name || 'Product',
        ownerName: product?.designer?.businessName || 'Designer',
        country: product?.designer?.country || '',
        resultImages: [product?.images?.[0]?.url || ''],
      };
    });
    await prisma.virtualTryOn.createMany({
      data: dedupedSelections.map((selection, index) => ({
        customerMeasurementId: measurement.id,
        designId: selection.productId,
        fabricId: selection.productType,
        resultImages: previews[index]?.resultImages?.filter(Boolean) || [],
        notes: JSON.stringify({ source: 'CUSTOMER_DASHBOARD', productType: selection.productType }),
      })),
    });
    const summary = await buildTryOnSummaryData(req.user!.id);
    res.json({
      success: true,
      message: 'TryON previews generated successfully.',
      data: {
        previews,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get customer orders
router.get('/orders', async (req, res, next) => {
  try {
    await autoCloseOverdueDeliveredOrders();
    const { page, limit } = req.query;
    const pagination = parsePagination(page, limit, 10);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: req.user!.id },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          designOrder: {
            include: {
              design: {
                select: { name: true, images: { take: 1 } },
              },
            },
          },
          fabricOrder: {
            include: {
              fabric: {
                select: { name: true, images: { take: 1 } },
              },
            },
          },
          readyToWearItems: {
            include: {
              readyToWear: {
                select: { name: true, images: { take: 1 } },
              },
            },
          },
          timeline: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      prisma.order.count({ where: { customerId: req.user!.id } }),
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

// Accept order delivery
router.post('/orders/:id/accept', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.update({
      where: {
        id,
        customerId: req.user!.id,
        status: 'DELIVERED',
      },
      data: {
        status: 'COMPLETED',
        customerAcceptedAt: new Date(),
      },
    });

    // Add timeline entry
    await prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: 'COMPLETED',
        notes: 'Customer accepted the order',
        updatedById: req.user!.id,
        updatedByRole: UserRole.CUSTOMER,
      },
    });

    res.json({
      success: true,
      message: 'Order accepted. Thank you for shopping with us!',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// Request refund
router.post('/orders/:id/refund', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.update({
      where: {
        id,
        customerId: req.user!.id,
        status: { in: ['DELIVERED', 'COMPLETED'] },
      },
      data: {
        status: 'REFUND_REQUESTED',
        refundReason: reason,
      },
    });

    // Add timeline entry
    await prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: 'REFUND_REQUESTED',
        notes: `Refund requested: ${reason}`,
        updatedById: req.user!.id,
        updatedByRole: UserRole.CUSTOMER,
      },
    });

    res.json({
      success: true,
      message: 'Refund request submitted. Our team will review your request.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
