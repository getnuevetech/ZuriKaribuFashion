import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

const parsePagination = (pageInput: unknown, limitInput: unknown, fallbackLimit = 20) => {
  const page = Math.max(1, Number(pageInput || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitInput || fallbackLimit) || fallbackLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const normalizeRoleToken = (value: unknown) => String(value || '').trim().toUpperCase();

let dispatchSchemaEnsured = false;
let dispatchSchemaPromise: Promise<void> | null = null;

const ensureNotificationDispatchSchema = async () => {
  if (dispatchSchemaEnsured) return;
  if (!dispatchSchemaPromise) {
    dispatchSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "NotificationDispatch" (
          "id" TEXT NOT NULL,
          "templateKey" TEXT,
          "title" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "bodyHtml" TEXT NOT NULL,
          "bodyText" TEXT NOT NULL,
          "recipientRole" TEXT NOT NULL DEFAULT 'ALL',
          "recipientUserId" TEXT,
          "sentEmail" BOOLEAN NOT NULL DEFAULT false,
          "sentPush" BOOLEAN NOT NULL DEFAULT false,
          "sentInApp" BOOLEAN NOT NULL DEFAULT false,
          "deliveryStatus" TEXT NOT NULL DEFAULT 'SENT',
          "createdById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "NotificationDispatch_recipientRole_idx"
         ON "NotificationDispatch"("recipientRole")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "NotificationDispatch_createdAt_idx"
         ON "NotificationDispatch"("createdAt")`
      );
      dispatchSchemaEnsured = true;
    })();
  }
  try {
    await dispatchSchemaPromise;
  } finally {
    dispatchSchemaPromise = null;
  }
};

router.use(authenticate);

router.get('/inbox', async (req, res, next) => {
  try {
    await ensureNotificationDispatchSchema();
    const query = z
      .object({
        page: z.coerce.number().int().min(1).max(500).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        unreadOnly: z.union([z.literal('1'), z.literal('true')]).optional(),
      })
      .parse(req.query || {});
    const pagination = parsePagination(query.page, query.limit, 20);
    const role = normalizeRoleToken(req.user?.role);
    const roleTargets = Array.from(
      new Set(
        [
          'ALL',
          role,
          role === 'FABRIC_SELLER' || role === 'FASHION_DESIGNER' ? 'VENDORS' : null,
        ].filter(Boolean) as string[]
      )
    );
    const unreadOnly = Boolean(query.unreadOnly);

    const [notifications, dispatchRows] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: req.user!.id,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
      prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","templateKey","title","subject","bodyText","recipientRole","recipientUserId","sentEmail","sentPush","sentInApp","deliveryStatus","createdAt"
         FROM "NotificationDispatch"
         WHERE "recipientUserId" = $1
            OR "recipientRole" = ANY($2::text[])
         ORDER BY "createdAt" DESC
         LIMIT 400`,
        req.user!.id,
        roleTargets
      ),
    ]);

    const rows = [
      ...(Array.isArray(notifications) ? notifications : []).map((item) => ({
        id: `notification:${item.id}`,
        source: 'IN_APP' as const,
        title: String(item.title || 'Notification'),
        subject: String(item.title || 'Notification'),
        body: String(item.message || ''),
        roleTarget: role,
        userTarget: req.user!.id,
        sentEmail: false,
        sentPush: false,
        sentInApp: true,
        deliveryStatus: 'SENT',
        isRead: item.isRead === true,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString(),
        relatedType: item.relatedType || null,
        relatedId: item.relatedId || null,
      })),
      ...(Array.isArray(dispatchRows) ? dispatchRows : []).map((item) => ({
        id: `dispatch:${String(item.id || '')}`,
        source: 'DISPATCH' as const,
        title: String(item.title || 'Message'),
        subject: String(item.subject || item.title || 'Message'),
        body: String(item.bodyText || ''),
        roleTarget: String(item.recipientRole || ''),
        userTarget: item.recipientUserId ? String(item.recipientUserId) : null,
        sentEmail: item.sentEmail === true,
        sentPush: item.sentPush === true,
        sentInApp: item.sentInApp === true,
        deliveryStatus: String(item.deliveryStatus || 'SENT').toUpperCase(),
        isRead: false,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        relatedType: 'SYSTEM',
        relatedId: String(item.templateKey || ''),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = rows.length;
    const paged = rows.slice(pagination.skip, pagination.skip + pagination.limit);
    return res.json({
      success: true,
      data: {
        messages: paged,
        unreadCount: rows.filter((entry) => entry.source === 'IN_APP' && entry.isRead !== true).length,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.max(1, Math.ceil(total / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/inbox/read', async (req, res, next) => {
  try {
    const payload = z
      .object({
        notificationIds: z.array(z.string().trim().min(1)).max(200).optional(),
        markAll: z.boolean().optional(),
      })
      .parse(req.body || {});
    if (payload.markAll) {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true },
      });
      return res.json({ success: true, message: 'All inbox notifications marked as read.' });
    }
    const ids = Array.from(new Set((payload.notificationIds || []).map((entry) => String(entry || '').trim()).filter(Boolean)));
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No notification IDs provided.' });
    }
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, id: { in: ids } },
      data: { isRead: true },
    });
    return res.json({ success: true, message: 'Selected notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

export default router;
