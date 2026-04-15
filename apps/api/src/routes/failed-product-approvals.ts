import { Router } from 'express';
import { z } from 'zod';
import { ProductStatus, ProductType, UserRole, prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  evaluateProductAutomationChecks,
  notifyVendorAboutProductAutomationFailure,
  readAutomationApprovalSettings,
  saveProductAutomationOutcome,
} from '../utils/automation-approval';
import {
  canAccessFailedProductTicket,
  createFailedProductApprovalTicketMessage,
  ensureFailedProductApprovalTicketSchema,
  getFailedProductApprovalTicketById,
  listFailedProductApprovalTicketMessages,
  listFailedProductApprovalTicketsForAdmin,
  listFailedProductApprovalTicketsForOwner,
} from '../utils/failed-product-approval';

const router = Router();
router.use(authenticate);

const parsePagination = (pageInput: unknown, limitInput: unknown, fallbackLimit = 20) => {
  const page = Math.max(1, Number(pageInput || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitInput || fallbackLimit) || fallbackLimit));
  return { page, limit };
};

const listQuerySchema = z.object({
  search: z.string().optional(),
  productType: z.nativeEnum(ProductType).optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const rerunPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        productType: z.nativeEnum(ProductType),
        productId: z.string().uuid(),
      })
    )
    .min(1)
    .max(200),
  applyDecision: z.boolean().optional(),
});

const messagePayloadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

const updateProductApprovalState = async (input: {
  productType: ProductType;
  productId: string;
  approved: boolean;
}) => {
  const status = input.approved ? ProductStatus.APPROVED : ProductStatus.REJECTED;
  const isAvailable = input.approved;
  if (input.productType === ProductType.FABRIC) {
    await prisma.fabric.update({
      where: { id: input.productId },
      data: { status, isAvailable },
    });
    return;
  }
  if (input.productType === ProductType.READY_TO_WEAR) {
    await prisma.readyToWear.update({
      where: { id: input.productId },
      data: { status, isAvailable },
    });
    return;
  }
  await prisma.design.update({
    where: { id: input.productId },
    data: { status, isAvailable },
  });
};

router.get('/admin', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query || {});
    const { page, limit } = parsePagination(query.page, query.limit, 20);
    const payload = await listFailedProductApprovalTicketsForAdmin({
      search: query.search,
      productType: query.productType,
      category: query.category,
      page,
      limit,
    });
    const ticketIds = payload.rows.map((row) => row.id);
    const messageCountRows =
      ticketIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ ticketId: string; count: number }>>(
            `SELECT "ticketId", COUNT(*)::int AS "count"
             FROM "FailedProductApprovalTicketMessage"
             WHERE "ticketId" = ANY($1::text[])
             GROUP BY "ticketId"`,
            ticketIds
          )
        : [];
    const countByTicket = new Map(
      (Array.isArray(messageCountRows) ? messageCountRows : []).map((entry) => [String(entry.ticketId), Number(entry.count || 0)])
    );
    res.json({
      success: true,
      data: {
        rows: payload.rows.map((row) => ({
          ...row,
          messageCount: Number(countByTicket.get(row.id) || 0),
        })),
        categories: payload.categories,
        pagination: payload.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/rerun', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    const payload = rerunPayloadSchema.parse(req.body || {});
    const applyDecision = payload.applyDecision !== false;
    const settingsPayload = await readAutomationApprovalSettings();
    const results: Array<{
      productType: ProductType;
      productId: string;
      action: 'NONE' | 'AUTO_APPROVED' | 'AUTO_REJECTED';
      canAutoApprove: boolean;
      status: string;
      summaryMessage: string;
      technicalFailure: boolean;
      technicalFailureReason: string;
      retryExhausted: boolean;
      autoRetryCount: number;
      success: boolean;
      error?: string;
    }> = [];
    for (const item of payload.items) {
      try {
        const evaluation = await evaluateProductAutomationChecks({
          productType: item.productType,
          productId: item.productId,
          settingsOverride: settingsPayload.settings,
        });
        let action: 'NONE' | 'AUTO_APPROVED' | 'AUTO_REJECTED' = 'NONE';
        if (applyDecision) {
          if (evaluation.canAutoApprove && settingsPayload.settings.autoApproveOnPass) {
            await updateProductApprovalState({
              productType: item.productType,
              productId: item.productId,
              approved: true,
            });
            action = 'AUTO_APPROVED';
          } else if (!evaluation.canAutoApprove) {
            await updateProductApprovalState({
              productType: item.productType,
              productId: item.productId,
              approved: false,
            });
            action = 'AUTO_REJECTED';
          }
        }
        const automationOutcome = await saveProductAutomationOutcome({
          productType: item.productType,
          productId: item.productId,
          evaluationStatus: evaluation.status,
          action,
          report: evaluation.report,
          changeReport: evaluation.changeReport,
          failureSeverity: evaluation.canAutoApprove ? 'NONE' : undefined,
          needsCorrection: evaluation.canAutoApprove ? false : undefined,
          technicalFailure: Boolean((evaluation as any).technicalFailure),
          technicalFailureReason: String((evaluation as any).technicalFailureReason || ''),
          autoRetryCount: Math.max(0, Number((evaluation as any).autoRetryCount || 0)),
          retryExhausted: Boolean((evaluation as any).retryExhausted),
          summaryMessage: evaluation.canAutoApprove ? 'Automation checks passed after rerun.' : undefined,
        });
        await notifyVendorAboutProductAutomationFailure({
          productType: item.productType as any,
          productId: item.productId,
          report: evaluation.report,
          changeReport: evaluation.changeReport,
          outcome: automationOutcome,
        });
        results.push({
          productType: item.productType,
          productId: item.productId,
          action,
          canAutoApprove: Boolean(evaluation.canAutoApprove),
          status: String(evaluation.status || ''),
          summaryMessage: String(automationOutcome?.summaryMessage || ''),
          technicalFailure: Boolean((evaluation as any).technicalFailure),
          technicalFailureReason: String((evaluation as any).technicalFailureReason || ''),
          retryExhausted: Boolean((evaluation as any).retryExhausted),
          autoRetryCount: Math.max(0, Number((evaluation as any).autoRetryCount || 0)),
          success: true,
        });
      } catch (itemError: any) {
        results.push({
          productType: item.productType,
          productId: item.productId,
          action: 'NONE',
          canAutoApprove: false,
          status: 'ERROR',
          summaryMessage: '',
          technicalFailure: true,
          technicalFailureReason: String(itemError?.message || 'Automation rerun failed.'),
          retryExhausted: true,
          autoRetryCount: 1,
          success: false,
          error: String(itemError?.message || 'Automation rerun failed.'),
        });
      }
    }
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successCount: results.filter((row) => row.success).length,
          failedCount: results.filter((row) => !row.success).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/tickets/:ticketId/messages', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    await ensureFailedProductApprovalTicketSchema();
    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    }
    const ticket = await getFailedProductApprovalTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    const messages = await listFailedProductApprovalTicketMessages(ticket.id);
    return res.json({
      success: true,
      data: {
        ticket,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/tickets/:ticketId/messages', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res, next) => {
  try {
    await ensureFailedProductApprovalTicketSchema();
    const ticketId = String(req.params.ticketId || '').trim();
    const payload = messagePayloadSchema.parse(req.body || {});
    const ticket = await getFailedProductApprovalTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    const message = await createFailedProductApprovalTicketMessage({
      ticketId: ticket.id,
      senderUserId: String(req.user?.actorUserId || req.user?.id || 'system'),
      senderRole: String(req.user?.role || UserRole.ADMINISTRATOR),
      body: payload.body,
    });
    return res.json({
      success: true,
      message: 'Ticket message sent.',
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    await ensureFailedProductApprovalTicketSchema();
    const role = String(req.user?.role || '').toUpperCase();
    if (role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER) {
      return res.status(403).json({ success: false, message: 'Only sellers/designers can access failed product approvals.' });
    }
    const query = listQuerySchema.parse(req.query || {});
    const { page, limit } = parsePagination(query.page, query.limit, 20);
    const payload = await listFailedProductApprovalTicketsForOwner({
      ownerUserId: String(req.user?.id || ''),
      ownerRole: role === UserRole.FASHION_DESIGNER ? UserRole.FASHION_DESIGNER : UserRole.FABRIC_SELLER,
      search: query.search,
      category: query.category,
      page,
      limit,
    });
    const ticketIds = payload.rows.map((row) => row.id);
    const messageCountRows =
      ticketIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ ticketId: string; count: number }>>(
            `SELECT "ticketId", COUNT(*)::int AS "count"
             FROM "FailedProductApprovalTicketMessage"
             WHERE "ticketId" = ANY($1::text[])
             GROUP BY "ticketId"`,
            ticketIds
          )
        : [];
    const countByTicket = new Map(
      (Array.isArray(messageCountRows) ? messageCountRows : []).map((entry) => [String(entry.ticketId), Number(entry.count || 0)])
    );
    return res.json({
      success: true,
      data: {
        rows: payload.rows.map((row) => ({
          ...row,
          messageCount: Number(countByTicket.get(row.id) || 0),
        })),
        categories: payload.categories,
        pagination: payload.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my/tickets/:ticketId/messages', async (req, res, next) => {
  try {
    await ensureFailedProductApprovalTicketSchema();
    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    const ticket = await getFailedProductApprovalTicketById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    const canAccess = canAccessFailedProductTicket(ticket, {
      userId: String(req.user?.id || ''),
      role: String(req.user?.role || ''),
    });
    if (!canAccess) return res.status(403).json({ success: false, message: 'You do not have access to this ticket.' });
    const messages = await listFailedProductApprovalTicketMessages(ticket.id);
    return res.json({
      success: true,
      data: {
        ticket,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/my/tickets/:ticketId/messages', async (req, res, next) => {
  try {
    await ensureFailedProductApprovalTicketSchema();
    const ticketId = String(req.params.ticketId || '').trim();
    const payload = messagePayloadSchema.parse(req.body || {});
    const ticket = await getFailedProductApprovalTicketById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    const canAccess = canAccessFailedProductTicket(ticket, {
      userId: String(req.user?.id || ''),
      role: String(req.user?.role || ''),
    });
    if (!canAccess) return res.status(403).json({ success: false, message: 'You do not have access to this ticket.' });
    const message = await createFailedProductApprovalTicketMessage({
      ticketId: ticket.id,
      senderUserId: String(req.user?.id || ''),
      senderRole: String(req.user?.role || ''),
      body: payload.body,
    });
    return res.json({
      success: true,
      message: 'Message sent.',
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

