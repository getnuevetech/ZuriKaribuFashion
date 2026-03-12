import { Router } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  listDesignerFabricCountryAccessRequests,
  listDesignerFabricCountryAccessMap,
  reviewDesignerFabricCountryAccessRequest,
  writeDesignerFabricCountryAccessForDesigner,
} from '../utils/designer-fabric-country-access';
import { prisma } from '../db';

const router = Router();

router.use(authenticate);
router.use(authorizePermissions(Permissions.ADMIN_ACCESS));
router.use(authorizePermissions(Permissions.PRODUCTS_MANAGE));

const normalizeCountryToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeCountryName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const dedupeCountries = (list: unknown) => {
  const rows = Array.isArray(list) ? list : [];
  const deduped = new Map<string, string>();
  for (const item of rows) {
    const country = normalizeCountryName(item);
    const token = normalizeCountryToken(country);
    if (!country || !token) continue;
    if (!deduped.has(token)) deduped.set(token, country);
  }
  return Array.from(deduped.values());
};

let cachedTransporter: nodemailer.Transporter | null | undefined;
function getMailer(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return cachedTransporter;
}
async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const transporter = getMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !input.to) return;
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const [designerRows, sellerRows, accessMap] = await Promise.all([
      prisma.designerProfile.findMany({
        select: {
          id: true,
          userId: true,
          businessName: true,
          country: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [{ businessName: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.fabricSellerProfile.findMany({
        select: { country: true },
      }),
      listDesignerFabricCountryAccessMap(),
    ]);

    const availableCountries = dedupeCountries(
      sellerRows
        .map((row) => row.country)
        .filter((value) => String(value || '').trim())
    );

    const designers = designerRows
      .map((row) => {
        const homeCountry = normalizeCountryName(row.country);
        const extraCountries = dedupeCountries(accessMap.get(row.userId) || []).filter(
          (entry) => normalizeCountryToken(entry) !== normalizeCountryToken(homeCountry)
        );
        const allowedCountries = dedupeCountries([homeCountry, ...extraCountries]);
        return {
          designerProfileId: row.id,
          designerUserId: row.userId,
          businessName:
            String(row.businessName || '').trim() ||
            `${String(row.user?.firstName || '').trim()} ${String(row.user?.lastName || '').trim()}`.trim() ||
            String(row.user?.email || '').trim() ||
            `Designer ${row.id.slice(0, 8)}`,
          email: String(row.user?.email || '').trim(),
          homeCountry,
          extraCountries,
          allowedCountries,
        };
      })
      .filter((row) => {
        if (!search) return true;
        return (
          row.businessName.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          row.homeCountry.toLowerCase().includes(search)
        );
      });

    res.json({
      success: true,
      data: {
        designers,
        availableCountries,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:designerUserId', async (req, res, next) => {
  try {
    const designerUserId = String(req.params.designerUserId || '').trim();
    const payload = z
      .object({
        extraCountries: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const designerProfile = await prisma.designerProfile.findFirst({
      where: { userId: designerUserId },
      select: { id: true, userId: true, country: true, businessName: true },
    });
    if (!designerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const normalizedExtras = dedupeCountries(payload.extraCountries).filter(
      (entry) => normalizeCountryToken(entry) !== normalizeCountryToken(designerProfile.country)
    );
    const saved = await writeDesignerFabricCountryAccessForDesigner(designerUserId, normalizedExtras);
    const allowedCountries = dedupeCountries([designerProfile.country, ...saved.extraCountries]);

    res.json({
      success: true,
      message: 'Designer fabric country access updated successfully.',
      data: {
        designerProfileId: designerProfile.id,
        designerUserId: designerProfile.userId,
        businessName: designerProfile.businessName,
        homeCountry: designerProfile.country,
        extraCountries: saved.extraCountries,
        allowedCountries,
      },
    });
  } catch (error) {
    next(error);
  }
});

const handleListRequests = async (req: any, res: any, next: any) => {
  try {
    const query = z
      .object({
        status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query || {});
    const status = String(query.status || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const requestRows = await listDesignerFabricCountryAccessRequests({
      status: status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? (status as any) : undefined,
    });
    const designerUserIds = Array.from(new Set(requestRows.map((row) => row.designerUserId)));
    const reviewedByUserIds = Array.from(
      new Set(requestRows.map((row) => String(row.reviewedByUserId || '').trim()).filter(Boolean))
    );
    const [designers, reviewers] = await Promise.all([
      designerUserIds.length > 0
        ? prisma.designerProfile.findMany({
            where: { userId: { in: designerUserIds } },
            select: {
              userId: true,
              businessName: true,
              country: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          })
        : [],
      reviewedByUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: reviewedByUserIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : [],
    ]);
    const designerByUserId = new Map(
      designers.map((row) => [
        row.userId,
        {
          businessName:
            String(row.businessName || '').trim() ||
            `${String(row.user?.firstName || '').trim()} ${String(row.user?.lastName || '').trim()}`.trim() ||
            String(row.user?.email || '').trim() ||
            `Designer ${row.userId.slice(0, 8)}`,
          homeCountry: String(row.country || '').trim(),
          email: String(row.user?.email || '').trim(),
        },
      ] as const)
    );
    const reviewerByUserId = new Map(
      reviewers.map((row) => [
        row.id,
        `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() ||
          String(row.email || '').trim() ||
          `Admin ${row.id.slice(0, 8)}`,
      ] as const)
    );

    const filtered = requestRows
      .map((row) => {
        const designer = designerByUserId.get(row.designerUserId);
        return {
          ...row,
          businessName: designer?.businessName || `Designer ${row.designerUserId.slice(0, 8)}`,
          email: designer?.email || '',
          homeCountry: designer?.homeCountry || '',
          reviewedByName: row.reviewedByUserId ? reviewerByUserId.get(row.reviewedByUserId) || '' : '',
        };
      })
      .filter((row) => {
        if (!search) return true;
        return (
          row.businessName.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          row.homeCountry.toLowerCase().includes(search) ||
          row.requestedCountries.join(' ').toLowerCase().includes(search)
        );
      });
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const requests = filtered.slice(start, start + limit);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: safePage,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    next(error);
  }
};

router.get('/requests/list', handleListRequests);
router.get('/requests', handleListRequests);
router.get('/request/list', handleListRequests);

const handleReviewRequest = async (req: any, res: any, next: any) => {
  try {
    const requestId = String(req.params.requestId || '').trim();
    const payload = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        reviewNotes: z.string().optional(),
        grantedCountries: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const requestBefore = await listDesignerFabricCountryAccessRequests();
    const previous = requestBefore.find((entry) => entry.id === requestId) || null;
    const updated = await reviewDesignerFabricCountryAccessRequest({
      requestId,
      status: payload.status,
      reviewedByUserId: req.user!.id,
      reviewNotes: payload.reviewNotes,
      grantedCountries: payload.grantedCountries,
    });

    const designerUser = await prisma.user.findUnique({
      where: { id: updated.designerUserId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (designerUser?.id) {
      await prisma.notification.create({
        data: {
          userId: designerUser.id,
          type: payload.status === 'APPROVED' ? 'SYSTEM' : 'NEW_MESSAGE',
          title:
            payload.status === 'APPROVED'
              ? 'Country access request approved'
              : 'Country access request rejected',
          message:
            payload.status === 'APPROVED'
              ? `Your request for access to ${updated.requestedCountries.join(', ')} was approved.`
              : payload.reviewNotes || `Your request for ${updated.requestedCountries.join(', ')} was rejected.`,
          relatedType: 'DESIGNER_FABRIC_COUNTRY_ACCESS_REQUEST',
          relatedId: updated.id,
        },
      });
      try {
        await sendEmail({
          to: designerUser.email,
          subject:
            payload.status === 'APPROVED'
              ? 'Your fabric country access request was approved'
              : 'Your fabric country access request was rejected',
          text:
            payload.status === 'APPROVED'
              ? `Hello ${designerUser.firstName || 'Designer'}, your request for access to ${updated.requestedCountries.join(', ')} has been approved.`
              : `Hello ${designerUser.firstName || 'Designer'}, your request for access to ${updated.requestedCountries.join(', ')} was rejected.\nReason: ${payload.reviewNotes || 'No additional notes provided.'}`,
          html:
            payload.status === 'APPROVED'
              ? `<p>Hello ${designerUser.firstName || 'Designer'},</p><p>Your request for access to <strong>${updated.requestedCountries.join(', ')}</strong> has been approved.</p>`
              : `<p>Hello ${designerUser.firstName || 'Designer'},</p><p>Your request for access to <strong>${updated.requestedCountries.join(', ')}</strong> was rejected.</p><p>Reason: ${payload.reviewNotes || 'No additional notes provided.'}</p>`,
        });
      } catch (emailError) {
        console.error('Failed to send designer country-access review email:', emailError);
      }
    }
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DESIGNER_FABRIC_COUNTRY_ACCESS_REQUEST_REVIEWED',
        details: {
          requestId: updated.id,
          designerUserId: updated.designerUserId,
          status: updated.status,
          requestedCountries: updated.requestedCountries,
          grantedCountries: payload.grantedCountries || updated.requestedCountries,
          previousStatus: previous?.status || 'PENDING',
        },
      },
    });

    res.json({
      success: true,
      message: `Request ${payload.status.toLowerCase()} successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

router.patch('/requests/:requestId/review', handleReviewRequest);
router.patch('/requests/:requestId', handleReviewRequest);
router.put('/requests/:requestId/review', handleReviewRequest);
router.put('/requests/:requestId', handleReviewRequest);

export default router;

