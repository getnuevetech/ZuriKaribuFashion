import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';

const EXCLUDED_PATH_PREFIXES = [
  '/health',
  '/api/health',
  '/uploads',
  '/api/admin/activity-logs',
  '/api/enterprise/activity-logs',
];

const shouldSkipAudit = (req: Request) => {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return true;
  const path = String(req.originalUrl || req.url || '')
    .split('?')[0]
    .toLowerCase();
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const pickIpAddress = (req: Request) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return String(req.ip || '').trim() || null;
};

export function activityAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (shouldSkipAudit(req)) return;
    if (!req.user?.id) return;
    const actorUserId = String(req.user.actorUserId || req.user.id || '').trim();
    if (!actorUserId) return;

    const path = String(req.originalUrl || req.url || '').split('?')[0];
    const query = req.query && typeof req.query === 'object' ? req.query : {};
    const queryKeys = Object.keys(query).slice(0, 20);
    const action = 'API_REQUEST';
    const details = {
      method: String(req.method || 'GET').toUpperCase(),
      path,
      statusCode: Number(res.statusCode || 0),
      durationMs: Math.max(0, Date.now() - startedAt),
      role: req.user.role,
      actorUserId,
      effectiveUserId: req.user.id,
      enterpriseOwnerUserId: req.user.enterpriseOwnerUserId || null,
      enterpriseSubAccountId: req.user.enterpriseSubAccountId || null,
      queryKeys,
    };

    void prisma.activityLog
      .create({
        data: {
          userId: actorUserId,
          action,
          details,
          ipAddress: pickIpAddress(req),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 512) || null,
        },
      })
      .catch(() => undefined);
  });
  next();
}

