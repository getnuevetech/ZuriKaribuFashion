import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  CATEGORY_PAGE_V2_FILTER_KEYS,
  CATEGORY_PAGE_V2_FILTER_INPUT_TYPES,
  CATEGORY_PAGE_V2_TYPES,
  listCategoryPageV2ProductOptions,
  listCategoryPageV2Products,
  readCategoryPageV2Runtime,
  resolveCategoryPageV2Type,
  writeCategoryPageV2Settings,
} from '../utils/category-pages-v2';

const router = Router();

const updateSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    subtitle: z.string().trim().max(500).optional(),
    bannerImage: z.string().trim().max(2048).optional(),
    bannerHeight: z.number().int().min(320).max(1200).optional(),
    searchPlaceholder: z.string().trim().max(120).optional(),
    pageSize: z.number().int().min(8).max(120).optional(),
    columns: z.number().int().min(1).max(6).optional(),
    showPagination: z.boolean().optional(),
    primaryGridRows: z.number().int().min(1).max(2).optional(),
    primaryGridColumns: z.number().int().min(1).max(6).optional(),
    primaryGridProductIds: z.array(z.string().trim().min(1)).max(60).optional(),
    countryRowCount: z.number().int().min(4).max(30).optional(),
    productCard: z
      .object({
        fieldOrder: z
          .array(
            z.object({
              key: z.enum([
                'IMAGE',
                'LABEL',
                'LIKES_ICON',
                'COUNTRY_ICON',
                'DESIGNER_NAME',
                'PRODUCT_NAME',
                'SHORT_DESCRIPTION',
                'PRICE',
              ]),
              enabled: z.boolean(),
              order: z.number().int().min(1).max(99),
            })
          )
          .max(8)
          .optional(),
        designerNameFontSize: z.number().int().min(8).max(72).optional(),
        designerNameColor: z.string().trim().max(40).optional(),
        productNameFontSize: z.number().int().min(8).max(72).optional(),
        productNameColor: z.string().trim().max(40).optional(),
        shortDescriptionFontSize: z.number().int().min(8).max(72).optional(),
        shortDescriptionColor: z.string().trim().max(40).optional(),
        priceFontSize: z.number().int().min(8).max(72).optional(),
        priceColor: z.string().trim().max(40).optional(),
        labelFontSize: z.number().int().min(8).max(72).optional(),
        labelColor: z.string().trim().max(40).optional(),
        labelBackgroundColor: z.string().trim().max(40).optional(),
        likesIconSize: z.number().int().min(8).max(72).optional(),
        likesIconColor: z.string().trim().max(40).optional(),
        countryIconSize: z.number().int().min(8).max(96).optional(),
      })
      .optional(),
    filterDefinitions: z
      .array(
        z.object({
          id: z.string().trim().max(120),
          key: z.enum(CATEGORY_PAGE_V2_FILTER_KEYS),
          label: z.string().trim().max(80),
          inputType: z.enum(CATEGORY_PAGE_V2_FILTER_INPUT_TYPES),
          enabled: z.boolean(),
          options: z.array(z.string().trim().max(80)).max(100),
          displayOrder: z.number().int().min(0).max(999),
        })
      )
      .max(20)
      .optional(),
  })
  .strict();

const resolvePageTypeOrRespond = (token: string, res: any) => {
  const pageType = resolveCategoryPageV2Type(token);
  if (!pageType) {
    res.status(400).json({
      success: false,
      message: 'Unsupported category page type.',
      supported: CATEGORY_PAGE_V2_TYPES,
    });
    return null;
  }
  return pageType;
};

const parseStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const token = String(value || '').trim();
  if (!token) return [];
  return token
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

router.get('/admin/page-types', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), (_req, res) => {
  res.json({ success: true, data: CATEGORY_PAGE_V2_TYPES });
});

router.get('/admin/:pageType/options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const search = String(req.query.search || '').trim();
    const limit = Number.parseInt(String(req.query.limit || '120'), 10);
    const data = await listCategoryPageV2ProductOptions(pageType, { search, limit });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/:pageType', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const data = await readCategoryPageV2Runtime(pageType);
    res.json({ success: true, data: { pageType, ...data } });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/:pageType', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const payload = updateSchema.parse(req.body || {});
    const settings = await writeCategoryPageV2Settings(pageType, payload, false);
    const runtime = await readCategoryPageV2Runtime(pageType);
    res.json({
      success: true,
      data: { pageType, settings, source: runtime.source, updatedAt: runtime.updatedAt, countryIcons: runtime.countryIcons },
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
    const payload = updateSchema.parse(req.body || {});
    const settings = await writeCategoryPageV2Settings(pageType, payload, true);
    const runtime = await readCategoryPageV2Runtime(pageType);
    res.json({
      success: true,
      data: { pageType, settings, source: runtime.source, updatedAt: runtime.updatedAt, countryIcons: runtime.countryIcons },
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
    const runtime = await readCategoryPageV2Runtime(pageType);
    res.json({
      success: true,
      data: {
        pageType,
        source: runtime.source,
        updatedAt: runtime.updatedAt,
        settings: runtime.settings,
        countryIcons: runtime.countryIcons,
        primaryGridProducts: runtime.primaryGridProducts,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:pageType/products', async (req, res, next) => {
  try {
    const pageType = resolvePageTypeOrRespond(req.params.pageType, res);
    if (!pageType) return;
    const input = {
      search: String(req.query.search || '').trim(),
      page: Number.parseInt(String(req.query.page || '1'), 10),
      limit: Number.parseInt(String(req.query.limit || '24'), 10),
      style: parseStringList(req.query.style),
      fabricType: parseStringList(req.query.fabricType),
      material: parseStringList(req.query.material),
      country: parseStringList(req.query.country),
      price: parseStringList(req.query.price),
      color: parseStringList(req.query.color),
      category: parseStringList(req.query.category),
    };
    const data = await listCategoryPageV2Products(pageType, input);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
