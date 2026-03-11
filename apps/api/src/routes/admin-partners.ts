import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  createPartnerApp,
  listPartnerApps,
  listPartnerAudit,
  listPartnerWebhookDeliveries,
  PartnerScope,
  rotatePartnerCredential,
  rotatePartnerWebhookSecret,
  sendPartnerTestWebhook,
  updatePartnerApp,
  partnerSupportedScopes,
} from '../utils/partner-api';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.USERS_MANAGE));

const createPartnerSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  scopes: z
    .array(
      z
        .string()
        .refine((value) => partnerSupportedScopes.includes(value as any), 'Unsupported partner scope')
    )
    .optional(),
  rateLimitPerMinute: z.number().int().min(10).max(5000).optional(),
  allowedIps: z.array(z.string().max(120)).max(200).optional(),
  webhookUrl: z.string().url().optional(),
});

const updatePartnerSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    scopes: z
      .array(
        z
          .string()
          .refine((value) => partnerSupportedScopes.includes(value as any), 'Unsupported partner scope')
      )
      .optional(),
    rateLimitPerMinute: z.number().int().min(10).max(5000).optional(),
    allowedIps: z.array(z.string().max(120)).max(200).optional(),
    webhookUrl: z.string().url().nullable().optional(),
  })
  .strict();

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const rotateCredentialSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

router.get('/apps', async (_req, res, next) => {
  try {
    const apps = await listPartnerApps();
    res.json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
});

router.post('/apps', async (req, res, next) => {
  try {
    const payload = createPartnerSchema.parse(req.body);
    const scopes = Array.isArray(payload.scopes) ? (payload.scopes as PartnerScope[]) : undefined;
    const created = await createPartnerApp({
      ...payload,
      scopes,
      createdById: req.user?.id,
    });
    res.status(201).json({
      success: true,
      message: 'Partner app created.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/apps/:id', async (req, res, next) => {
  try {
    const payload = updatePartnerSchema.parse(req.body);
    const scopes = Array.isArray(payload.scopes) ? (payload.scopes as PartnerScope[]) : undefined;
    const updated = await updatePartnerApp(req.params.id, { ...payload, scopes });
    res.json({ success: true, message: 'Partner app updated.', data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/apps/:id/rotate-key', async (req, res, next) => {
  try {
    const payload = rotateCredentialSchema.parse(req.body || {});
    const credential = await rotatePartnerCredential(
      req.params.id,
      payload.expiresAt ? new Date(payload.expiresAt) : null
    );
    res.status(201).json({
      success: true,
      message: 'Partner credential rotated.',
      data: credential,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/apps/:id/rotate-webhook-secret', async (req, res, next) => {
  try {
    const secret = await rotatePartnerWebhookSecret(req.params.id);
    res.status(201).json({
      success: true,
      message: 'Webhook secret rotated.',
      data: secret,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/apps/:id/test-webhook', async (req, res, next) => {
  try {
    const result = await sendPartnerTestWebhook(req.params.id);
    res.json({
      success: true,
      message: result.success ? 'Test webhook delivered.' : 'Test webhook failed.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/apps/:id/audit', async (req, res, next) => {
  try {
    const pagination = pageQuerySchema.parse(req.query || {});
    const result = await listPartnerAudit(req.params.id, pagination.page, pagination.limit);
    res.json({ success: true, data: result.rows, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

router.get('/apps/:id/webhook-deliveries', async (req, res, next) => {
  try {
    const pagination = pageQuerySchema.parse(req.query || {});
    const result = await listPartnerWebhookDeliveries(req.params.id, pagination.page, pagination.limit);
    res.json({ success: true, data: result.rows, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

export default router;
