import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { OrderStatus } from '../db';
import {
  autoCloseOverdueDeliveredOrders,
  readOrderWorkflowSettings,
  writeOrderWorkflowSettings,
} from '../utils/order-workflow';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.ORDERS_MANAGE));

const updateWorkflowSchema = z
  .object({
    processingMode: z.enum(['MANUAL', 'AUTO']).optional(),
    autoProcessCriteria: z
      .object({
        requirePaid: z.boolean().optional(),
        requireShippingProvider: z.boolean().optional(),
        requireCustomerAddress: z.boolean().optional(),
        requireItems: z.boolean().optional(),
      })
      .optional(),
    slaHours: z
      .object({
        adminReview: z.number().int().min(1).max(24 * 60).optional(),
        vendorFulfillment: z.number().int().min(1).max(24 * 60).optional(),
        qaReview: z.number().int().min(1).max(24 * 60).optional(),
        customerConcernWindow: z.number().int().min(1).max(24 * 60).optional(),
      })
      .optional(),
    reminderLeadHours: z.number().int().min(1).max(24 * 30).optional(),
    autoCloseDays: z.number().int().min(1).max(60).optional(),
    customerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).optional(),
    sellerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).optional(),
    designerNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).optional(),
    qaNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).optional(),
    adminNotifyStatuses: z.array(z.nativeEnum(OrderStatus)).optional(),
    qaChecklistTemplate: z
      .array(
        z.object({
          key: z.string().min(1).max(80),
          label: z.string().min(1).max(160),
          required: z.boolean().optional(),
        })
      )
      .max(30)
      .optional(),
    orderLimits: z
      .object({
        maxReadyToWearUnitsPerOrder: z.number().int().min(1).max(200).optional(),
        maxCustomToWearItemsPerCheckout: z.number().int().min(1).max(200).optional(),
        maxSuitableFabricsPerDesign: z.number().int().min(1).max(50).optional(),
        minFabricYardsPerOrder: z.number().int().min(1).max(500).optional(),
        maxFabricYardsPerOrder: z.number().int().min(1).max(5000).optional(),
      })
      .optional(),
  })
  .strict();

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await readOrderWorkflowSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const payload = updateWorkflowSchema.parse(req.body);
    const settings = await writeOrderWorkflowSettings(payload, false);
    res.json({ success: true, message: 'Order workflow settings updated.', data: settings });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const payload = updateWorkflowSchema.parse(req.body);
    const settings = await writeOrderWorkflowSettings(payload, true);
    res.json({ success: true, message: 'Order workflow settings updated.', data: settings });
  } catch (error) {
    next(error);
  }
});

router.post('/auto-close-overdue', async (req, res, next) => {
  try {
    const result = await autoCloseOverdueDeliveredOrders(req.user?.id);
    res.json({
      success: true,
      message:
        result.closedCount > 0
          ? `${result.closedCount} delivered order(s) auto-closed.`
          : 'No overdue delivered orders found.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
