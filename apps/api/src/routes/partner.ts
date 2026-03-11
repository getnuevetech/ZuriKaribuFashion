import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus } from '../db';
import {
  authenticatePartnerRequest,
  listPartnerCatalogDesigns,
  listPartnerCatalogFabrics,
  listPartnerOrders,
  partnerVariableCatalog,
  readIdempotencyReplay,
  requirePartnerScope,
  saveIdempotencyReplay,
  updatePartnerOrderStatus,
} from '../utils/partner-api';

const router = Router();

router.use(authenticatePartnerRequest);

router.get('/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
});

router.get('/v1/capabilities', (req, res) => {
  res.json({
    success: true,
    data: {
      appId: req.partner?.appId,
      appName: req.partner?.appName,
      scopes: req.partner?.scopes || [],
      rateLimitPerMinute: req.partner?.rateLimitPerMinute || 0,
      docs: '/api/partner/v1/variables',
    },
  });
});

router.get('/v1/variables', (_req, res) => {
  res.json({
    success: true,
    data: partnerVariableCatalog,
  });
});

router.get('/v1/catalog/fabrics', requirePartnerScope('catalog:read'), async (req, res, next) => {
  try {
    const schema = z.object({
      country: z.string().optional(),
      materialTypeId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    });
    const query = schema.parse(req.query || {});
    const result = await listPartnerCatalogFabrics(query);
    res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/v1/catalog/designs', requirePartnerScope('catalog:read'), async (req, res, next) => {
  try {
    const schema = z.object({
      categoryId: z.string().uuid().optional(),
      country: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    });
    const query = schema.parse(req.query || {});
    const result = await listPartnerCatalogDesigns(query);
    res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/v1/orders', requirePartnerScope('orders:read'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.nativeEnum(OrderStatus).optional(),
      updatedSince: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    });
    const query = schema.parse(req.query || {});
    const result = await listPartnerOrders({
      status: query.status,
      updatedSince: query.updatedSince ? new Date(query.updatedSince) : null,
      page: query.page,
      limit: query.limit,
    });
    res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/v1/orders/:id/status', requirePartnerScope('orders:write'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.nativeEnum(OrderStatus),
      notes: z.string().max(2000).optional(),
    });
    const payload = schema.parse(req.body || {});
    const partner = req.partner!;
    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Idempotency-Key header is required for write operations.',
      });
    }
    const replay = await readIdempotencyReplay({
      partnerAppId: partner.appId,
      idempotencyKey,
      method: req.method,
      path: req.path,
      requestPayload: payload,
    });
    if (replay.replay) {
      return res.status(replay.replay.status).json(replay.replay.body as any);
    }

    const updated = await updatePartnerOrderStatus({
      orderId: req.params.id,
      nextStatus: payload.status,
      notes: payload.notes,
      actorAppId: partner.appId,
    });
    const body = {
      success: true,
      message: 'Order status updated via partner API.',
      data: updated,
    };
    await saveIdempotencyReplay({
      partnerAppId: partner.appId,
      idempotencyKey,
      method: req.method,
      path: req.path,
      requestHash: replay.requestHash,
      responseStatus: 200,
      responseBody: body,
    });
    res.json(body);
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('idempotency key')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
});

export default router;
