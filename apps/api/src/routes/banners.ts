import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { parseStoredJsonValue } from '../utils/parse-stored-json-value';

const router = Router();
const HOMEPAGE_PROMO_BADGE_SETTINGS_KEY = 'HOMEPAGE_PROMO_BADGE';

const promoBadgeUpdateSchema = z.object({
  valueText: z.string().trim().min(1).max(30),
  labelText: z.string().trim().min(1).max(120),
});

type PromoBadgeSettings = {
  valueText: string;
  labelText: string;
};

const PROMO_BADGE_DEFAULTS: PromoBadgeSettings = {
  valueText: '50+',
  labelText: 'New Arrivals',
};

const normalizePromoBadgeSettings = (raw: unknown): PromoBadgeSettings => {
  if (!raw || typeof raw !== 'object') return { ...PROMO_BADGE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const valueText = String(row.valueText || '').trim();
  const labelText = String(row.labelText || '').trim();
  return {
    valueText: valueText.length > 0 ? valueText.slice(0, 30) : PROMO_BADGE_DEFAULTS.valueText,
    labelText: labelText.length > 0 ? labelText.slice(0, 120) : PROMO_BADGE_DEFAULTS.labelText,
  };
};

const ensureHomepageSectionSettingTable = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
};

const readPromoBadgeSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_PROMO_BADGE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...PROMO_BADGE_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizePromoBadgeSettings(parseStoredJsonValue(row.value)),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...PROMO_BADGE_DEFAULTS } };
  }
};

const savePromoBadgeSettings = async (rawInput: unknown) => {
  const parsed = promoBadgeUpdateSchema.parse(rawInput);
  const existing = await readPromoBadgeSettings();
  const merged = normalizePromoBadgeSettings({
    ...existing.settings,
    ...parsed,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_PROMO_BADGE_SETTINGS_KEY,
    payload
  );
  return merged;
};

// Get all banners (public - for frontend display)
router.get('/', async (req, res) => {
  try {
    const { section } = req.query;
    
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        ...(section ? { section: section as string } : {}),
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    // For each banner, randomly select one image if multiple images exist
    const bannersWithRandomImage = banners.map(banner => ({
      ...banner,
      displayImage: banner.images.length > 0 
        ? banner.images[Math.floor(Math.random() * banner.images.length)]
        : null,
    }));

    res.json({
      success: true,
      data: bannersWithRandomImage,
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
    });
  }
});

// Get all banners for admin (including inactive) - MUST be before /:id
router.get('/admin/all', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: {
        displayOrder: 'asc',
      },
    });

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error('Error fetching all banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
    });
  }
});

router.get('/promo-badge', async (_req, res) => {
  try {
    const { settings } = await readPromoBadgeSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching promo badge settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch promo badge settings.' });
  }
});

router.get('/admin/promo-badge', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readPromoBadgeSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin promo badge settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch promo badge settings.' });
  }
});

router.put('/admin/promo-badge', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const settings = await savePromoBadgeSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating promo badge settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update promo badge settings.' });
  }
});

router.patch('/admin/promo-badge', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const settings = await savePromoBadgeSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating promo badge settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update promo badge settings.' });
  }
});

// Create new banner (admin only)
router.post('/', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const { name, section, title, subtitle, ctaText, ctaLink, images, isActive, displayOrder } = req.body;

    // Validate required fields
    if (!name || !section) {
      return res.status(400).json({
        success: false,
        message: 'Name and section are required',
      });
    }

    // Validate images array
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required',
      });
    }

    const banner = await prisma.banner.create({
      data: {
        name,
        section,
        title,
        subtitle,
        ctaText,
        ctaLink,
        images,
        isActive: isActive ?? true,
        displayOrder: displayOrder ?? 0,
      },
    });

    res.status(201).json({
      success: true,
      data: banner,
      message: 'Banner created successfully',
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
    });
  }
});

// Toggle banner active status (admin only) - MUST be before /:id
router.patch('/:id/toggle', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    const updatedBanner = await prisma.banner.update({
      where: { id },
      data: {
        isActive: !banner.isActive,
      },
    });

    res.json({
      success: true,
      data: updatedBanner,
      message: `Banner ${updatedBanner.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle banner status',
    });
  }
});

// Get banner sections (for dropdown) - MUST be before /:id
router.get('/meta/sections', async (req, res) => {
  try {
    const sections = [
      { value: 'BANNER_1', label: 'Banner 1 (After Featured Designs)' },
      { value: 'BANNER_2', label: 'Banner 2 (After Featured Ready To Wear)' },
      { value: 'HERO', label: 'Hero Banner' },
      { value: 'PROMO', label: 'Promotional Banner' },
    ];

    res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
    });
  }
});

// Get banner by ID (admin only) - MUST be after static routes like /admin/all
router.get('/:id', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    res.json({
      success: true,
      data: banner,
    });
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner',
    });
  }
});

// Update banner (admin only)
router.put('/:id', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section, title, subtitle, ctaText, ctaLink, images, isActive, displayOrder } = req.body;

    // Check if banner exists
    const existingBanner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        name,
        section,
        title,
        subtitle,
        ctaText,
        ctaLink,
        images,
        isActive,
        displayOrder,
      },
    });

    res.json({
      success: true,
      data: banner,
      message: 'Banner updated successfully',
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
    });
  }
});

// Delete banner (admin only)
router.delete('/:id', authenticate, authorizePermissions(Permissions.BANNERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if banner exists
    const existingBanner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    await prisma.banner.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner',
    });
  }
});

export default router;
