import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  CATEGORY_PAGE_TYPES,
  listCategoryPageProductOptions,
  readCategoryFeaturedProducts,
  readCategoryPageSettings,
  resolveCategoryPageType,
  writeCategoryPageSettings,
} from '../utils/category-page-settings';

const router = Router();

const updateCategoryPageSettingsSchema = z
  .object({
    bannerTitle: z.string().trim().max(120).optional(),
    bannerSubtitle: z.string().trim().max(320).optional(),
    bannerImage: z.string().trim().max(2048).optional(),
    bannerHeight: z.number().int().min(220).max(560).optional(),
    pageSize: z.number().int().min(8).max(120).optional(),
    columns: z.number().int().min(2).max(6).optional(),
    showPagination: z.boolean().optional(),
    featuredProductIds: z.array(z.string().trim().min(1)).max(3).optional(),
    featuredSlots: z
      .array(
        z.object({
          productId: z.string().trim().max(120).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .max(3)
      .optional(),
    rotatingProductIds: z.array(z.string().trim().min(1)).max(24).optional(),
    rotatingColumns: z.number().int().min(1).max(6).optional(),
    rotatingRows: z.number().int().min(1).max(6).optional(),
    rotatingTitleSize: z.number().int().min(16).max(64).optional(),
    recommendationProductIds: z.array(z.string().trim().min(1)).max(120).optional(),
    recommendationDisplayCount: z.number().int().min(1).max(24).optional(),
    recommendationConfiguredOnly: z.boolean().optional(),
    recommendationPreferSameCountry: z.boolean().optional(),
    recommendationPreferDifferentSeller: z.boolean().optional(),
  })
  .strict();

const resolveActiveFeaturedIds = (settings: any) => {
  if (Array.isArray(settings?.featuredSlots)) {
    return settings.featuredSlots
      .map((slot: any) => ({
        productId: String(slot?.productId || '').trim(),
        isActive: slot?.isActive !== false,
      }))
      .filter((slot: any) => slot.isActive && slot.productId)
      .map((slot: any) => slot.productId)
      .slice(0, 3);
  }
  return Array.isArray(settings?.featuredProductIds) ? settings.featuredProductIds.slice(0, 3) : [];
};

const resolvePageTypeOrRespond = (token: string, res: any) => {
  const pageType = resolveCategoryPageType(token);
  if (!pageType) {
    res.status(400).json({
      success: false,
      message: 'Unsupported category page type.',
      supported: CATEGORY_PAGE_TYPES,
    });
    return null;
  }
  return pageType;
};

router.get('/admin/page-types', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), (_req, res) => {
  res.json({
    success: true,
    data: CATEGORY_PAGE_TYPES,
  });
});

router.get('/admin/:pageType/options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const search = String(req.query.search || '').trim();
    const limit = Number.parseInt(String(req.query.limit || '80'), 10);
    const options = await listCategoryPageProductOptions(pageType, { search, limit });
    res.json({ success: true, data: options });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/:pageType', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const snapshot = await readCategoryPageSettings(pageType);
    const featuredProducts = await readCategoryFeaturedProducts(pageType, resolveActiveFeaturedIds(snapshot.settings));
    const rotatingProducts = await readCategoryFeaturedProducts(pageType, snapshot.settings.rotatingProductIds);
    res.json({
      success: true,
      data: {
        pageType,
        ...snapshot,
        featuredProducts,
        rotatingProducts,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/:pageType', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const payload = updateCategoryPageSettingsSchema.parse(req.body || {});
    const settings = await writeCategoryPageSettings(pageType, payload, false);
    const featuredProducts = await readCategoryFeaturedProducts(pageType, resolveActiveFeaturedIds(settings));
    const rotatingProducts = await readCategoryFeaturedProducts(pageType, settings.rotatingProductIds);
    res.json({
      success: true,
      data: {
        pageType,
        settings,
        featuredProducts,
        rotatingProducts,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    next(error);
  }
});

router.patch('/admin/:pageType', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const payload = updateCategoryPageSettingsSchema.parse(req.body || {});
    const settings = await writeCategoryPageSettings(pageType, payload, true);
    const featuredProducts = await readCategoryFeaturedProducts(pageType, resolveActiveFeaturedIds(settings));
    const rotatingProducts = await readCategoryFeaturedProducts(pageType, settings.rotatingProductIds);
    res.json({
      success: true,
      data: {
        pageType,
        settings,
        featuredProducts,
        rotatingProducts,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    next(error);
  }
});

router.get('/:pageType', async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const snapshot = await readCategoryPageSettings(pageType);
    const featuredProducts = await readCategoryFeaturedProducts(pageType, resolveActiveFeaturedIds(snapshot.settings));
    const rotatingProducts = await readCategoryFeaturedProducts(pageType, snapshot.settings.rotatingProductIds);
    res.json({
      success: true,
      data: {
        pageType,
        ...snapshot,
        featuredProducts,
        rotatingProducts,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
