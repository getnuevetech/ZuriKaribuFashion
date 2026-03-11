import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  listDesignerFabricCountryAccessMap,
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

export default router;

