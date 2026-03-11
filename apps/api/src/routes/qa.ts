import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole, OrderStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { appendWorkflowMetadataToShippingAddress, readOrderWorkflowSettings } from '../utils/order-workflow';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.QA_ACCESS));

// Get QA dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const profile = await prisma.qAProfile.findFirst({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'QA profile not found.',
      });
    }

    const [assignedOrders, pendingInspection, completedToday] = await Promise.all([
      prisma.order.count({ where: { qaId: profile.id } }),
      prisma.order.count({
        where: {
          qaId: profile.id,
          status: { in: ['QA_PENDING', 'QA_INSPECTING'] },
        },
      }),
      prisma.order.count({
        where: {
          qaId: profile.id,
          status: 'SHIPPED',
          shippedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        profile,
        stats: {
          assignedOrders,
          pendingInspection,
          completedToday,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get orders assigned to QA
router.get('/orders', async (req, res, next) => {
  try {
    const profile = await prisma.qAProfile.findFirst({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'QA profile not found.',
      });
    }

    const { status } = req.query;

    const where: any = { qaId: profile.id };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
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
              select: { name: true },
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

router.get('/orders/:id/checklist', async (req, res, next) => {
  try {
    const profile = await prisma.qAProfile.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'QA profile not found.' });
    }
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, qaId: profile.id },
      select: { id: true, shippingAddress: true },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or not assigned to you.' });
    }
    const workflowSettings = await readOrderWorkflowSettings();
    const shipping = parseObject(order.shippingAddress);
    const workflow = parseObject(shipping.workflow);
    const persistedChecklist = Array.isArray(workflow.qaChecklist) ? workflow.qaChecklist : [];
    const checklist =
      persistedChecklist.length > 0
        ? persistedChecklist
        : workflowSettings.qaChecklistTemplate.map((entry) => ({
            key: entry.key,
            label: entry.label,
            required: entry.required !== false,
            checked: false,
            notes: '',
          }));
    res.json({ success: true, data: checklist });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id/checklist', async (req, res, next) => {
  try {
    const profile = await prisma.qAProfile.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'QA profile not found.' });
    }
    const schema = z.object({
      items: z
        .array(
          z.object({
            key: z.string().min(1).max(80),
            label: z.string().min(1).max(160),
            required: z.boolean().default(true),
            checked: z.boolean().default(false),
            notes: z.string().max(1000).optional(),
          })
        )
        .max(40),
      notes: z.string().max(2000).optional(),
    });
    const payload = schema.parse(req.body);
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, qaId: profile.id },
      select: { id: true, status: true, shippingAddress: true },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or not assigned to you.' });
    }

    const workflowSettings = await readOrderWorkflowSettings();
    const shipping = parseObject(order.shippingAddress);
    const workflow = parseObject(shipping.workflow);
    const nextShippingAddress = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...shipping,
        workflow: {
          ...workflow,
          qaChecklist: payload.items,
          qaChecklistNotes: payload.notes || '',
          qaChecklistUpdatedAt: new Date().toISOString(),
        },
      },
      settings: workflowSettings,
      status: order.status as OrderStatus,
      note: payload.notes || 'QA checklist updated.',
    });

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { shippingAddress: nextShippingAddress as any },
      }),
      prisma.orderTimeline.create({
        data: {
          orderId: order.id,
          status: order.status,
          notes: payload.notes || 'QA checklist updated.',
          updatedById: req.user!.id,
          updatedByRole: UserRole.QA_TEAM,
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'QA checklist saved.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

// Update order with tracking
router.patch('/orders/:id/ship', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trackingNumber, notes } = req.body;

    const profile = await prisma.qAProfile.findFirst({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'QA profile not found.',
      });
    }

    const order = await prisma.order.findFirst({
      where: { id, qaId: profile.id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you.',
      });
    }

    const workflowSettings = await readOrderWorkflowSettings();
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        trackingNumber,
        shippedAt: new Date(),
        shippingAddress: appendWorkflowMetadataToShippingAddress({
          shippingAddress: order.shippingAddress,
          settings: workflowSettings,
          status: OrderStatus.SHIPPED,
          note: notes || `Shipped with tracking: ${trackingNumber}`,
        }) as any,
      },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: 'SHIPPED',
        notes: notes || `Shipped with tracking: ${trackingNumber}`,
        updatedById: req.user!.id,
        updatedByRole: UserRole.QA_TEAM,
      },
    });

    res.json({
      success: true,
      message: 'Order shipped successfully.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
