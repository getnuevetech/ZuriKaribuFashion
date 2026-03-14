import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, UserRole, UserStatus, ProductStatus, ProductType } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { autoCloseOverdueDeliveredOrders } from '../utils/order-workflow';
import {
  getPermissionCatalog,
  hasPermissionFromGrants,
  Permissions,
  sanitizePermissionGrants,
} from '../rbac';
import {
  readVendorDashboardGovernanceSettings,
  saveVendorDashboardGovernanceSettings,
} from '../utils/vendor-dashboard-governance';
import { readTryOnInsights } from '../utils/try-on-insights';
import { readTryOnSettings, saveTryOnSettings } from '../utils/try-on-settings';

const router = Router();
const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';
const LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS = [' / ', '/', '|'] as const;
const normalizeReadyToWearSize = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeReadyToWearColor = (value: unknown) =>
  String(value || DEFAULT_READY_TO_WEAR_COLOR)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') || DEFAULT_READY_TO_WEAR_COLOR;
const encodeReadyToWearVariantKey = (size: unknown, color?: unknown) =>
  `${normalizeReadyToWearSize(size)}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizeReadyToWearColor(color)}`;
const decodeReadyToWearVariantKey = (variantKey: unknown) => {
  const raw = String(variantKey || '').trim().toUpperCase();
  if (raw.includes(READY_TO_WEAR_VARIANT_SEPARATOR)) {
    const [sizePart, colorPart] = raw.split(READY_TO_WEAR_VARIANT_SEPARATOR);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: encodeReadyToWearVariantKey(normalizedSize, normalizedColor),
    };
  }
  for (const separator of LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS) {
    if (!raw.includes(separator)) continue;
    const [sizePart, colorPart] = raw.split(separator);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: encodeReadyToWearVariantKey(normalizedSize, normalizedColor),
    };
  }
  const normalizedSize = normalizeReadyToWearSize(raw);
  return {
    size: normalizedSize,
    color: DEFAULT_READY_TO_WEAR_COLOR,
    variantKey: encodeReadyToWearVariantKey(normalizedSize, DEFAULT_READY_TO_WEAR_COLOR),
  };
};

const isSchemaDriftError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2022');

function parsePagination(pageValue: unknown, limitValue: unknown, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(String(pageValue ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(limitValue ?? defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const getVendorDisplayName = (input: {
  id: string;
  roleLabel: 'Designer' | 'Fabric Seller';
  businessName?: string | null;
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
}) => {
  const businessName = String(input.businessName || '').trim();
  if (businessName) return businessName;
  const fullName = `${input.user?.firstName || ''} ${input.user?.lastName || ''}`.trim();
  if (fullName) return fullName;
  if (input.user?.email) return input.user.email;
  return `${input.roleLabel} ${String(input.id || '').slice(0, 8)}`;
};

const ensureVendorProfilesForRoleUsers = async () => {
  const users = await prisma.user.findMany({
    where: { role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] } },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
  });
  if (users.length === 0) return;

  const [sellerProfiles, designerProfiles] = await Promise.all([
    prisma.fabricSellerProfile.findMany({ select: { userId: true } }),
    prisma.designerProfile.findMany({ select: { userId: true } }),
  ]);
  const sellerUserIds = new Set(sellerProfiles.map((row) => row.userId));
  const designerUserIds = new Set(designerProfiles.map((row) => row.userId));

  const missingSellerProfiles = users.filter(
    (user) => user.role === UserRole.FABRIC_SELLER && !sellerUserIds.has(user.id)
  );
  const missingDesignerProfiles = users.filter(
    (user) => user.role === UserRole.FASHION_DESIGNER && !designerUserIds.has(user.id)
  );

  if (missingSellerProfiles.length > 0) {
    await prisma.fabricSellerProfile.createMany({
      data: missingSellerProfiles.map((user) => ({
        userId: user.id,
        businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Fabric Seller',
        businessEmail: user.email,
        businessPhone: user.phone || '',
        country: '',
        city: '',
        address: '',
      })),
      skipDuplicates: true,
    });
  }

  if (missingDesignerProfiles.length > 0) {
    await prisma.designerProfile.createMany({
      data: missingDesignerProfiles.map((user) => ({
        userId: user.id,
        businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Designer',
        businessEmail: user.email,
        businessPhone: user.phone || '',
        country: '',
        city: '',
        address: '',
      })),
      skipDuplicates: true,
    });
  }
};

const HOMEPAGE_TOP_STRIP_SETTINGS_KEY = 'HOMEPAGE_TOP_STRIP';
const HOMEPAGE_STATS_STRIP_SETTINGS_KEY = 'HOMEPAGE_STATS_STRIP';
const HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY = 'HOMEPAGE_COUNTRY_IMAGE_GENERATION';
const HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY = 'HOMEPAGE_HOW_IT_WORKS_STYLE';
const HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY = 'HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION';
const HOMEPAGE_READY_TO_WEAR_SIZES_SETTINGS_KEY = 'HOMEPAGE_READY_TO_WEAR_SIZES';
const HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY = 'HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE';
const HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY = 'HOMEPAGE_PRODUCT_LABELS';
const DEFAULT_READY_TO_WEAR_SIZES = ['S', 'M', 'L', 'XL'];
const ADMIN_TOP_STRIP_DEFAULTS = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  fontSize: 12,
  isBold: false,
  pauseOnHover: true,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};
const adminTopStripUpdateSchema = z.object({
  messages: z.array(z.string().trim().min(1)).min(1),
  separator: z.string().trim().min(1).max(8).optional(),
  repeatCount: z.coerce.number().int().min(2).max(12).optional(),
  animationSeconds: z.coerce.number().int().min(8).max(120).optional(),
  fontSize: z.coerce.number().int().min(10).max(40).optional(),
  isBold: z.boolean().optional(),
  pauseOnHover: z.boolean().optional(),
  textColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS = {
  enabled: true,
  apiUrl: 'https://image.pollinations.ai/prompt/{prompt}',
  apiKey: '',
  model: 'flux',
  promptTemplate: 'High quality fashion editorial image inspired by {country}. Keywords: {keywords}. Fabrics: {fabrics}.',
  responseImagePath: 'url',
  requestMethod: 'GET' as 'GET' | 'POST',
};
const ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS = {
  enabled: false,
  iconColor: '#111827',
  iconHoverColor: '#ffffff',
};
const ADMIN_STATS_STRIP_DEFAULTS = {
  items: [
    { value: '120', suffix: '+', label: 'COUNTRIES', displayOrder: 0, isActive: true },
    { value: '50', suffix: 'K+', label: 'DESIGNERS', displayOrder: 1, isActive: true },
    { value: '1', suffix: 'M+', label: 'FABRICS', displayOrder: 2, isActive: true },
    { value: '100', suffix: 'K+', label: 'PRODUCTS', displayOrder: 3, isActive: true },
  ],
  backgroundImage: '',
  backgroundColor: '#111827',
  overlayColor: '#000000',
  overlayOpacity: 45,
  valueColor: '#ffffff',
  suffixColor: '#facc15',
  labelColor: '#d1d5db',
};
const ADMIN_FEATURED_PRODUCT_DESCRIPTION_DEFAULTS = {
  wordLimit: 12,
};
const ADMIN_READY_TO_WEAR_SIZES_DEFAULTS = {
  sizes: [...DEFAULT_READY_TO_WEAR_SIZES],
};
const ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS = {
  title: 'Ready-To-Wear Size Guide',
  content:
    'Use your body measurements to select your best standard size.\n\nS: Bust 84-90cm, Waist 66-72cm, Hips 90-96cm\nM: Bust 91-98cm, Waist 73-80cm, Hips 97-104cm\nL: Bust 99-106cm, Waist 81-88cm, Hips 105-112cm\nXL: Bust 107-115cm, Waist 89-98cm, Hips 113-122cm',
};
const ADMIN_PRODUCT_LABEL_DEFAULTS = {
  newTagDays: 14,
  labels: [
    {
      id: 'new',
      name: 'NEW',
      mode: 'AUTO_NEW' as const,
      textColor: '#ffffff',
      backgroundColor: '#111827',
      isActive: true,
    },
    {
      id: 'sale',
      name: 'SALE',
      mode: 'AUTO_SALE' as const,
      textColor: '#ffffff',
      backgroundColor: '#dc2626',
      isActive: true,
    },
  ],
  assignments: [] as Array<{
    labelId: string;
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    productIds: string[];
  }>,
};
const BLOG_AUDIENCE_TYPES = ['SELLER', 'DESIGNER', 'COUNTRY', 'OTHER'] as const;
type BlogAudienceType = (typeof BLOG_AUDIENCE_TYPES)[number];
const adminCountryImageGenerationUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().optional(),
  promptTemplate: z.string().trim().min(1).optional(),
  responseImagePath: z.string().trim().min(1).optional(),
  requestMethod: z.enum(['GET', 'POST']).optional(),
});
const adminHowItWorksStyleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  iconColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  iconHoverColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const adminStatsStripItemUpdateSchema = z.object({
  value: z.string().trim().min(1).max(20),
  suffix: z.string().trim().max(8).optional(),
  label: z.string().trim().min(1).max(40),
  displayOrder: z.coerce.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
const adminStatsStripUpdateSchema = z.object({
  items: z.array(adminStatsStripItemUpdateSchema).min(1).max(8),
  backgroundImage: z.string().trim().optional(),
  backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  overlayColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  overlayOpacity: z.coerce.number().int().min(0).max(100).optional(),
  valueColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  suffixColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  labelColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const adminFeaturedProductDescriptionUpdateSchema = z.object({
  wordLimit: z.coerce.number().int().min(5).max(60),
});
const adminReadyToWearSizesUpdateSchema = z.object({
  sizes: z
    .array(z.string().trim().min(1).max(20))
    .min(3)
    .max(20),
});
const adminReadyToWearSizeGuideUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(20).max(6000),
});
const adminProductLabelUpdateSchema = z.object({
  newTagDays: z.coerce.number().int().min(1).max(120),
  labels: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        name: z.string().trim().min(1).max(24),
        mode: z.enum(['AUTO_NEW', 'AUTO_SALE', 'MANUAL']),
        textColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        isActive: z.boolean().optional(),
      })
    )
    .min(1)
    .max(24),
  assignments: z
    .array(
      z.object({
        labelId: z.string().trim().min(1).max(64),
        productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']),
        productIds: z.array(z.string().trim().min(1)).max(1000),
      })
    )
    .max(2000)
    .optional(),
});
const adminBlogCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(1),
  audienceType: z.enum(BLOG_AUDIENCE_TYPES),
  targetName: z.string().trim().max(120).optional(),
  targetEntityId: z.string().trim().max(120).optional(),
  coverImage: z.string().trim().url().optional(),
  isPublished: z.boolean().optional(),
});
const adminBlogUpdateSchema = adminBlogCreateSchema.partial();

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

const normalizeAdminTopStripSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_TOP_STRIP_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages)
    ? row.messages
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
  return {
    messages: messages.length > 0 ? messages : [...ADMIN_TOP_STRIP_DEFAULTS.messages],
    separator:
      typeof row.separator === 'string' && row.separator.trim()
        ? row.separator.trim().slice(0, 8)
        : ADMIN_TOP_STRIP_DEFAULTS.separator,
    repeatCount: Number.isFinite(Number(row.repeatCount))
      ? Math.max(2, Math.min(12, Math.round(Number(row.repeatCount))))
      : ADMIN_TOP_STRIP_DEFAULTS.repeatCount,
    animationSeconds: Number.isFinite(Number(row.animationSeconds))
      ? Math.max(8, Math.min(120, Math.round(Number(row.animationSeconds))))
      : ADMIN_TOP_STRIP_DEFAULTS.animationSeconds,
    fontSize: Number.isFinite(Number(row.fontSize))
      ? Math.max(10, Math.min(40, Math.round(Number(row.fontSize))))
      : ADMIN_TOP_STRIP_DEFAULTS.fontSize,
    isBold: typeof row.isBold === 'boolean' ? row.isBold : ADMIN_TOP_STRIP_DEFAULTS.isBold,
    pauseOnHover:
      typeof row.pauseOnHover === 'boolean' ? row.pauseOnHover : ADMIN_TOP_STRIP_DEFAULTS.pauseOnHover,
    textColor: normalizeHexColor(row.textColor, ADMIN_TOP_STRIP_DEFAULTS.textColor),
    backgroundColor: normalizeHexColor(row.backgroundColor, ADMIN_TOP_STRIP_DEFAULTS.backgroundColor),
  };
};

const normalizeAdminCountryImageGenerationSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const requestMethod = String(row.requestMethod || '').toUpperCase();
  return {
    enabled:
      typeof row.enabled === 'boolean' ? row.enabled : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.enabled,
    apiUrl: typeof row.apiUrl === 'string' ? row.apiUrl.trim() : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.apiUrl,
    apiKey: typeof row.apiKey === 'string' ? row.apiKey.trim() : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.apiKey,
    model: typeof row.model === 'string' ? row.model.trim() : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.model,
    promptTemplate:
      typeof row.promptTemplate === 'string' && row.promptTemplate.trim().length > 0
        ? row.promptTemplate.trim()
        : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.promptTemplate,
    responseImagePath:
      typeof row.responseImagePath === 'string' && row.responseImagePath.trim().length > 0
        ? row.responseImagePath.trim()
        : ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS.responseImagePath,
    requestMethod: requestMethod === 'POST' ? 'POST' : 'GET',
  };
};

const normalizeAdminHowItWorksStyleSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS.enabled,
    iconColor: normalizeHexColor(row.iconColor, ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS.iconColor),
    iconHoverColor: normalizeHexColor(row.iconHoverColor, ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS.iconHoverColor),
  };
};
const normalizeAdminStatsStripSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') {
    return { ...ADMIN_STATS_STRIP_DEFAULTS, items: [...ADMIN_STATS_STRIP_DEFAULTS.items] };
  }
  const row = raw as Record<string, unknown>;
  const items = Array.isArray(row.items)
    ? row.items
        .map((entry, index) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          const value = String(item.value || '').trim();
          const label = String(item.label || '').trim().toUpperCase();
          if (!value || !label) return null;
          const suffix = String(item.suffix || '').trim();
          const displayOrderRaw = Number(item.displayOrder);
          return {
            value: value.slice(0, 20),
            suffix: suffix.slice(0, 8),
            label: label.slice(0, 40),
            displayOrder: Number.isFinite(displayOrderRaw) ? Math.max(0, Math.min(100, Math.round(displayOrderRaw))) : index,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
          };
        })
        .filter((entry): entry is (typeof ADMIN_STATS_STRIP_DEFAULTS.items)[number] => Boolean(entry))
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  return {
    items: items.length > 0 ? items : [...ADMIN_STATS_STRIP_DEFAULTS.items],
    backgroundImage: typeof row.backgroundImage === 'string' ? row.backgroundImage.trim() : ADMIN_STATS_STRIP_DEFAULTS.backgroundImage,
    backgroundColor: normalizeHexColor(row.backgroundColor, ADMIN_STATS_STRIP_DEFAULTS.backgroundColor),
    overlayColor: normalizeHexColor(row.overlayColor, ADMIN_STATS_STRIP_DEFAULTS.overlayColor),
    overlayOpacity: Number.isFinite(Number(row.overlayOpacity))
      ? Math.max(0, Math.min(100, Math.round(Number(row.overlayOpacity))))
      : ADMIN_STATS_STRIP_DEFAULTS.overlayOpacity,
    valueColor: normalizeHexColor(row.valueColor, ADMIN_STATS_STRIP_DEFAULTS.valueColor),
    suffixColor: normalizeHexColor(row.suffixColor, ADMIN_STATS_STRIP_DEFAULTS.suffixColor),
    labelColor: normalizeHexColor(row.labelColor, ADMIN_STATS_STRIP_DEFAULTS.labelColor),
  };
};
const normalizeAdminFeaturedProductDescriptionSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_FEATURED_PRODUCT_DESCRIPTION_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const wordLimitRaw = Number(row.wordLimit);
  return {
    wordLimit: Number.isFinite(wordLimitRaw)
      ? Math.max(5, Math.min(60, Math.round(wordLimitRaw)))
      : ADMIN_FEATURED_PRODUCT_DESCRIPTION_DEFAULTS.wordLimit,
  };
};
const normalizeAdminReadyToWearSizesSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_READY_TO_WEAR_SIZES_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const parsed = Array.isArray(row.sizes)
    ? row.sizes
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const normalized = Array.from(
    new Set(
      parsed
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => entry.length > 0 && entry.length <= 20)
    )
  );
  if (normalized.length < 3 || normalized.length > 20) {
    return { ...ADMIN_READY_TO_WEAR_SIZES_DEFAULTS };
  }
  return { sizes: normalized };
};
const normalizeAdminReadyToWearSizeGuideSettings = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return { ...ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const title = String(row.title || '').trim();
  const content = String(row.content || '').trim();
  return {
    title: title.length >= 3 ? title.slice(0, 120) : ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS.title,
    content: content.length >= 20 ? content.slice(0, 6000) : ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS.content,
  };
};
const normalizeAdminProductLabelSettings = (raw: unknown) => {
  const fallback = {
    ...ADMIN_PRODUCT_LABEL_DEFAULTS,
    labels: ADMIN_PRODUCT_LABEL_DEFAULTS.labels.map((entry) => ({ ...entry })),
    assignments: [] as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>,
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const row = raw as Record<string, unknown>;
  const newTagDaysRaw = Number(row.newTagDays);
  const parsedLabels = Array.isArray(row.labels) ? row.labels : [];
  const labels = Array.from(
    new Map(
      parsedLabels
        .map((entry) => {
          const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
          const id = String(item.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
          const name = String(item.name || '').trim().slice(0, 24);
          const modeRaw = String(item.mode || '').trim().toUpperCase();
          const mode = modeRaw === 'AUTO_NEW' || modeRaw === 'AUTO_SALE' ? modeRaw : 'MANUAL';
          if (!id || !name) return null;
          return [
            id,
            {
              id,
              name,
              mode: mode as 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL',
              textColor: normalizeHexColor(item.textColor, '#ffffff'),
              backgroundColor:
                mode === 'AUTO_NEW'
                  ? normalizeHexColor(item.backgroundColor, '#111827')
                  : mode === 'AUTO_SALE'
                    ? normalizeHexColor(item.backgroundColor, '#dc2626')
                    : normalizeHexColor(item.backgroundColor, '#1f2937'),
              isActive: item.isActive !== false,
            },
          ] as const;
        })
        .filter(Boolean) as Array<
        readonly [
          string,
          {
            id: string;
            name: string;
            mode: 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';
            textColor: string;
            backgroundColor: string;
            isActive: boolean;
          },
        ]
      >
    ).values()
  );
  const withSystemLabels = [...labels];
  const hasNew = withSystemLabels.some((entry) => entry.mode === 'AUTO_NEW');
  if (!hasNew) {
    withSystemLabels.unshift({
      id: 'new',
      name: 'NEW',
      mode: 'AUTO_NEW',
      textColor: '#ffffff',
      backgroundColor: '#111827',
      isActive: true,
    });
  }
  const hasSale = withSystemLabels.some((entry) => entry.mode === 'AUTO_SALE');
  if (!hasSale) {
    withSystemLabels.push({
      id: 'sale',
      name: 'SALE',
      mode: 'AUTO_SALE',
      textColor: '#ffffff',
      backgroundColor: '#dc2626',
      isActive: true,
    });
  }
  const validLabelIds = new Set(withSystemLabels.map((entry) => entry.id));
  const parsedAssignments = Array.isArray(row.assignments) ? row.assignments : [];
  const assignments = parsedAssignments
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const labelId = String(item.labelId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
      const productTypeRaw = String(item.productType || '').trim().toUpperCase();
      if (!validLabelIds.has(labelId)) return null;
      if (productTypeRaw !== 'FABRIC' && productTypeRaw !== 'DESIGN' && productTypeRaw !== 'READY_TO_WEAR') {
        return null;
      }
      const productIds = Array.from(
        new Set(
          (Array.isArray(item.productIds) ? item.productIds : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );
      if (productIds.length === 0) return null;
      return {
        labelId,
        productType: productTypeRaw as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
        productIds,
      };
    })
    .filter(Boolean) as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>;

  return {
    newTagDays: Number.isFinite(newTagDaysRaw) ? Math.max(1, Math.min(120, Math.round(newTagDaysRaw))) : fallback.newTagDays,
    labels: withSystemLabels.slice(0, 24),
    assignments,
  };
};

const blogSlugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

const normalizeBlogAudienceType = (value: unknown): BlogAudienceType =>
  BLOG_AUDIENCE_TYPES.includes(String(value || '').toUpperCase() as BlogAudienceType)
    ? (String(value || '').toUpperCase() as BlogAudienceType)
    : 'OTHER';

const toStoryLink = (slug: string) => `/stories/${slug}`;

const ensureBlogPostTable = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BlogPost" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "excerpt" TEXT,
      "content" TEXT NOT NULL,
      "audienceType" TEXT NOT NULL,
      "targetName" TEXT,
      "targetEntityId" TEXT,
      "coverImage" TEXT,
      "isPublished" BOOLEAN NOT NULL DEFAULT false,
      "publishedAt" TIMESTAMP(3),
      "createdBy" TEXT,
      "updatedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlogPost_isPublished_idx" ON "BlogPost"("isPublished")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlogPost_audienceType_idx" ON "BlogPost"("audienceType")`);
};

const generateUniqueBlogSlug = async (title: string, explicit?: string, excludeId?: string) => {
  const base = blogSlugify(explicit || title) || `story-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT "id" FROM "BlogPost" WHERE "slug" = $1 LIMIT 1`, candidate);
    const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!existing || (excludeId && String(existing.id) === excludeId)) {
      return candidate;
    }
    candidate = `${base}-${suffix++}`;
  }
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

const readAdminTopStripSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_TOP_STRIP_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminTopStripSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_TOP_STRIP_DEFAULTS } };
  }
};

const saveAdminTopStripSettings = async (input: unknown) => {
  const parsed = adminTopStripUpdateSchema.parse(input);
  const merged = normalizeAdminTopStripSettings(parsed);
  const existing = await readAdminTopStripSettings();
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
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readAdminCountryImageGenerationSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminCountryImageGenerationSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_COUNTRY_IMAGE_GENERATION_DEFAULTS } };
  }
};

const saveAdminCountryImageGenerationSettings = async (input: unknown) => {
  const parsed = adminCountryImageGenerationUpdateSchema.parse(input);
  const merged = normalizeAdminCountryImageGenerationSettings(parsed);
  const existing = await readAdminCountryImageGenerationSettings();
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
    HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readAdminHowItWorksStyleSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminHowItWorksStyleSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_HOW_IT_WORKS_STYLE_DEFAULTS } };
  }
};

const saveAdminHowItWorksStyleSettings = async (input: unknown) => {
  const parsed = adminHowItWorksStyleUpdateSchema.parse(input);
  const merged = normalizeAdminHowItWorksStyleSettings(parsed);
  const existing = await readAdminHowItWorksStyleSettings();
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
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readAdminFeaturedProductDescriptionSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_FEATURED_PRODUCT_DESCRIPTION_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminFeaturedProductDescriptionSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_FEATURED_PRODUCT_DESCRIPTION_DEFAULTS } };
  }
};
const readAdminStatsStripSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_STATS_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_STATS_STRIP_DEFAULTS, items: [...ADMIN_STATS_STRIP_DEFAULTS.items] } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminStatsStripSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_STATS_STRIP_DEFAULTS, items: [...ADMIN_STATS_STRIP_DEFAULTS.items] } };
  }
};
const saveAdminStatsStripSettings = async (input: unknown) => {
  const parsed = adminStatsStripUpdateSchema.parse(input);
  const merged = normalizeAdminStatsStripSettings(parsed);
  const existing = await readAdminStatsStripSettings();
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
    HOMEPAGE_STATS_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};
const saveAdminFeaturedProductDescriptionSettings = async (input: unknown) => {
  const parsed = adminFeaturedProductDescriptionUpdateSchema.parse(input);
  const merged = normalizeAdminFeaturedProductDescriptionSettings(parsed);
  const existing = await readAdminFeaturedProductDescriptionSettings();
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
    HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readAdminReadyToWearSizesSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_READY_TO_WEAR_SIZES_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_READY_TO_WEAR_SIZES_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminReadyToWearSizesSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_READY_TO_WEAR_SIZES_DEFAULTS } };
  }
};
const saveAdminReadyToWearSizesSettings = async (input: unknown) => {
  const parsed = adminReadyToWearSizesUpdateSchema.parse(input);
  const merged = normalizeAdminReadyToWearSizesSettings(parsed);
  const existing = await readAdminReadyToWearSizesSettings();
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
    HOMEPAGE_READY_TO_WEAR_SIZES_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readAdminReadyToWearSizeGuideSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminReadyToWearSizeGuideSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...ADMIN_READY_TO_WEAR_SIZE_GUIDE_DEFAULTS } };
  }
};
const saveAdminReadyToWearSizeGuideSettings = async (input: unknown) => {
  const parsed = adminReadyToWearSizeGuideUpdateSchema.parse(input);
  const merged = normalizeAdminReadyToWearSizeGuideSettings(parsed);
  const existing = await readAdminReadyToWearSizeGuideSettings();
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
    HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readAdminProductLabelSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: normalizeAdminProductLabelSettings(ADMIN_PRODUCT_LABEL_DEFAULTS),
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeAdminProductLabelSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: normalizeAdminProductLabelSettings(ADMIN_PRODUCT_LABEL_DEFAULTS),
    };
  }
};
const saveAdminProductLabelSettings = async (input: unknown) => {
  const parsed = adminProductLabelUpdateSchema.parse(input);
  const merged = normalizeAdminProductLabelSettings(parsed);
  const existing = await readAdminProductLabelSettings();
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
    HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY,
    payload
  );
  return merged;
};

const adminPermissionListSchema = z.array(z.string()).default([]);
const adminRoleCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  permissions: adminPermissionListSchema,
  isActive: z.boolean().optional().default(true),
});
const adminRoleUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: adminPermissionListSchema.optional(),
  isActive: z.boolean().optional(),
});
const adminUserRoleAssignmentSchema = z.object({
  adminRoleId: z.string().uuid().nullable().optional(),
  permissions: adminPermissionListSchema.optional(),
});

const adminUserCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  phone: z.string().optional(),
});

const adminUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().nullable().optional(),
});

const vendorCreateMinimalSchema = z.object({
  role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  businessName: z.string().min(1),
  country: z.string().min(1),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const adminProductTypeSchema = z.nativeEnum(ProductType);
const featuredSectionSchema = z.enum([
  'FEATURED_DESIGNS',
  'FEATURED_FABRICS',
  'FEATURED_READY_TO_WEAR',
  'TRENDING_NOW',
  'NEW_ARRIVALS',
]);
const productFeaturedSchema = z.object({
  isFeatured: z.boolean(),
  section: featuredSectionSchema.optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const productModerationSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SUSPEND', 'PUBLISH', 'UNPUBLISH']),
  message: z.string().trim().min(1).optional(),
  notifyVendor: z.boolean().default(true),
});

const bulkModerationSchema = z.object({
  productType: adminProductTypeSchema,
  productIds: z.array(z.string().uuid()).min(1),
  action: productModerationSchema.shape.action,
  message: z.string().trim().min(1).optional(),
  notifyVendor: z.boolean().default(true),
});

const adminProductCreateSchema = z.object({
  type: adminProductTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().optional(),
  materialTypeId: z.string().optional(),
  sellerId: z.string().optional(),
  designerId: z.string().optional(),
  price: z.coerce.number().positive().optional(),
  basePrice: z.coerce.number().positive().optional(),
  sellerPrice: z.coerce.number().positive().optional(),
  minYards: z.coerce.number().int().min(1).optional(),
  stockYards: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  size: z.string().optional(),
  variants: z
    .array(
      z.object({
        size: z.string().min(1),
        color: z.string().max(30).optional(),
        price: z.coerce.number().positive(),
        stock: z.coerce.number().int().min(0),
      })
    )
    .max(50)
    .optional(),
  images: z.array(z.string().url()).optional(),
  image: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isAvailable: z.boolean().optional(),
});

const adminProductUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  materialTypeId: z.string().optional(),
  price: z.coerce.number().positive().optional(),
  basePrice: z.coerce.number().positive().optional(),
  sellerPrice: z.coerce.number().positive().optional(),
  minYards: z.coerce.number().int().min(1).optional(),
  stockYards: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  variants: z
    .array(
      z.object({
        size: z.string().min(1),
        color: z.string().max(30).optional(),
        price: z.coerce.number().positive(),
        stock: z.coerce.number().int().min(0),
      })
    )
    .max(50)
    .optional(),
  images: z.array(z.string().url()).optional(),
  image: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isAvailable: z.boolean().optional(),
});

const vendorRoleSchema = z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']);
const vendorProfileStatusSchema = z.enum(['INCOMPLETE', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const vendorRejectionTypeSchema = z.enum(['TEMPORARY', 'PERMANENT']);
const vendorProfileFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.enum([
    'TEXT',
    'TEXTAREA',
    'NUMBER',
    'DATE',
    'SELECT',
    'MULTI_SELECT',
    'EMAIL',
    'PHONE',
    'URL',
    'DOCUMENT',
    'IMAGE',
    'IMAGE_DOCUMENT',
  ]),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

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
const stripHtmlForText = (value: string) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const measurementTemplateSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).default('cm'),
  isRequired: z.boolean().default(true),
  instructions: z.string().optional(),
});

const parseDateValue = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getDefaultFeaturedSectionForType = (productType: ProductType): z.infer<typeof featuredSectionSchema> => {
  if (productType === ProductType.FABRIC) return 'FEATURED_FABRICS';
  if (productType === ProductType.READY_TO_WEAR) return 'FEATURED_READY_TO_WEAR';
  return 'FEATURED_DESIGNS';
};

const getImagePolicyForProductType = (productType: ProductType) => {
  if (productType === ProductType.FABRIC) {
    return { min: 3, max: 4, label: 'Fabrics To Buy' };
  }
  if (productType === ProductType.READY_TO_WEAR) {
    return { min: 3, max: 5, label: 'Ready To Wear' };
  }
  if (productType === ProductType.DESIGN) {
    return { min: 4, max: 6, label: 'Custom To Wear' };
  }
  return { min: 4, max: 6, label: 'Custom To Wear' };
};

let adminRbacSchemaEnsured = false;
let adminRbacSchemaPromise: Promise<void> | null = null;

const ensureAdminRbacSchema = async () => {
  if (adminRbacSchemaEnsured) return;
  if (adminRbacSchemaPromise) {
    await adminRbacSchemaPromise;
    return;
  }

  adminRbacSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "AdminRole" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AdminRole_name_key" ON "AdminRole"("name")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminRole_isActive_idx" ON "AdminRole"("isActive")`);
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'AdminProfile'
            AND column_name = 'adminRoleId'
        ) THEN
          ALTER TABLE "AdminProfile" ADD COLUMN "adminRoleId" TEXT;
        END IF;
      END $$;`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AdminProfile_adminRoleId_idx" ON "AdminProfile"("adminRoleId")`
    );
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'AdminProfile_adminRoleId_fkey'
        ) THEN
          ALTER TABLE "AdminProfile"
          ADD CONSTRAINT "AdminProfile_adminRoleId_fkey"
          FOREIGN KEY ("adminRoleId") REFERENCES "AdminRole"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "VendorProfileField" (
        "id" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "fieldType" TEXT NOT NULL,
        "placeholder" TEXT,
        "helpText" TEXT,
        "required" BOOLEAN NOT NULL DEFAULT false,
        "options" JSONB,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "updatedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VendorProfileField_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileField_role_key_key" ON "VendorProfileField"("role", "key")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "VendorProfileField_role_sortOrder_idx" ON "VendorProfileField"("role", "sortOrder")`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "createdById" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "updatedById" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "VendorProfileField" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "VendorProfileSubmission" (
        "id" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "businessName" TEXT,
        "profileStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
        "profileData" JSONB,
        "profileSubmittedAt" TIMESTAMP(3),
        "profileReviewedAt" TIMESTAMP(3),
        "profileReviewNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role", "userId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "VendorProfileSubmission_status_idx" ON "VendorProfileSubmission"("profileStatus")`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionType" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionReasonCode" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionReasonLabel" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "profileReviewMessage" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "permanentRejectionAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "permanentDisableAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "VendorProfileSubmission" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "MeasurementTemplate" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "unit" TEXT NOT NULL DEFAULT 'cm',
        "isRequired" BOOLEAN NOT NULL DEFAULT true,
        "instructions" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "MeasurementTemplate_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "MeasurementTemplate_name_key" ON "MeasurementTemplate"("name")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MeasurementTemplate_displayOrder_idx" ON "MeasurementTemplate"("displayOrder")`
    );

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "bodyHtml" TEXT NOT NULL,
        "bodyText" TEXT NOT NULL,
        "audienceRole" TEXT NOT NULL DEFAULT 'ALL',
        "channelEmail" BOOLEAN NOT NULL DEFAULT true,
        "channelPush" BOOLEAN NOT NULL DEFAULT true,
        "channelInApp" BOOLEAN NOT NULL DEFAULT true,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "updatedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_key_key" ON "NotificationTemplate"("key")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "NotificationTemplate_audienceRole_idx" ON "NotificationTemplate"("audienceRole")`
    );

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
      `CREATE INDEX IF NOT EXISTS "NotificationDispatch_templateKey_idx" ON "NotificationDispatch"("templateKey")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "NotificationDispatch_recipientRole_idx" ON "NotificationDispatch"("recipientRole")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "NotificationDispatch_createdAt_idx" ON "NotificationDispatch"("createdAt")`
    );

    const defaultNotificationTemplates = [
      {
        key: 'PLATFORM_ANNOUNCEMENT',
        title: 'Platform announcement',
        subject: 'Important update from African Fashion',
        bodyHtml: '<p>Hello,</p><p>This is an important update from African Fashion.</p>',
        bodyText: 'Hello,\n\nThis is an important update from African Fashion.',
        audienceRole: 'ALL',
      },
      {
        key: 'PROMO_OFFER',
        title: 'Promotional offer',
        subject: 'Special offer just for you',
        bodyHtml: '<p>Hello,</p><p>Enjoy our latest promotion now available on African Fashion.</p>',
        bodyText: 'Hello,\n\nEnjoy our latest promotion now available on African Fashion.',
        audienceRole: 'CUSTOMER',
      },
      {
        key: 'VENDOR_POLICY_UPDATE',
        title: 'Vendor policy update',
        subject: 'Vendor policy update from African Fashion',
        bodyHtml: '<p>Hello Vendor,</p><p>Please review the latest vendor policy update.</p>',
        bodyText: 'Hello Vendor,\n\nPlease review the latest vendor policy update.',
        audienceRole: 'VENDORS',
      },
      {
        key: 'ORDER_NOTIFICATION',
        title: 'Order notification',
        subject: 'Order update from African Fashion',
        bodyHtml: '<p>Hello,</p><p>There is an update on your order.</p>',
        bodyText: 'Hello,\n\nThere is an update on your order.',
        audienceRole: 'ALL',
      },
    ];
    for (const template of defaultNotificationTemplates) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "NotificationTemplate"
          ("id","key","title","subject","bodyHtml","bodyText","audienceRole","channelEmail","channelPush","channelInApp","isSystem","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,true,true,true,true,NOW(),NOW())
         ON CONFLICT ("key") DO NOTHING`,
        randomUUID(),
        template.key,
        template.title,
        template.subject,
        template.bodyHtml,
        template.bodyText,
        template.audienceRole
      );
    }

    const allPermissions = JSON.stringify(getPermissionCatalog().map((entry) => entry.key));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AdminRole" ("id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, true, true, NOW(), NOW())
       ON CONFLICT ("name") DO NOTHING`,
      randomUUID(),
      'Super Administrator',
      'Full administrative access across all system modules.',
      allPermissions
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "AdminRole"
       SET "permissions" = $2::jsonb,
           "updatedAt" = NOW()
       WHERE "name" = $1 AND "isSystem" = true`,
      'Super Administrator',
      allPermissions
    );

    adminRbacSchemaEnsured = true;
  })();

  try {
    await adminRbacSchemaPromise;
  } finally {
    adminRbacSchemaPromise = null;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureAdminRbacSchema();
  } catch (error) {
    console.error('Failed to ensure admin RBAC schema:', error);
  }
  next();
});

// All admin routes require admin role
router.use(authenticate);
router.use(authorizePermissions(Permissions.ADMIN_ACCESS));

const resolveAdminRoutePermissions = (method: string, path: string) => {
  if (/^\/users\/[^/]+\/admin-access$/.test(path) || path.startsWith('/roles') || path.startsWith('/permission-catalog')) {
    return [Permissions.ADMIN_ROLE_MANAGE];
  }
  if (path.startsWith('/dashboard')) return [Permissions.ADMIN_DASHBOARD_READ];
  if (path.startsWith('/traffic-report')) return [Permissions.TRAFFIC_READ];
  if (path.startsWith('/security/session-audit')) return [Permissions.SESSION_AUDIT_READ];
  if (path.startsWith('/users/pending')) return [Permissions.USERS_READ];
  if (path.startsWith('/users')) {
    return method === 'GET' ? [Permissions.USERS_READ] : [Permissions.USERS_MANAGE];
  }
  if (path.startsWith('/vendor-profile/fields')) {
    return method === 'GET' ? [Permissions.VENDOR_PROFILES_READ] : [Permissions.VENDOR_PROFILES_REVIEW];
  }
  if (path.startsWith('/vendor-dashboard-governance')) {
    return method === 'GET' ? [Permissions.VENDOR_PROFILES_READ] : [Permissions.VENDOR_PROFILES_REVIEW];
  }
  if (
    path.startsWith('/try-on') ||
    path.startsWith('/tryon') ||
    path.startsWith('/3d-try-on') ||
    path.startsWith('/3d-tryon')
  ) {
    return [Permissions.PRODUCTS_MANAGE];
  }
  if (path.startsWith('/vendor-profiles')) {
    return method === 'GET' ? [Permissions.VENDOR_PROFILES_READ] : [Permissions.VENDOR_PROFILES_REVIEW];
  }
  if (path.startsWith('/products') || path.startsWith('/categories') || path.startsWith('/materials')) {
    return method === 'GET' ? [Permissions.ADMIN_DASHBOARD_READ] : [Permissions.PRODUCTS_MANAGE];
  }
  if (path.startsWith('/product-labels')) return [Permissions.PRODUCTS_MANAGE];
  if (path.startsWith('/measurement-templates')) return [Permissions.MEASUREMENT_TEMPLATES_MANAGE];
  if (path.startsWith('/pricing-rules')) return [Permissions.PRICING_MANAGE];
  if (path.startsWith('/notification-center')) return [Permissions.NOTIFICATIONS_MANAGE];
  if (path.startsWith('/backups')) return [Permissions.BACKUPS_MANAGE];
  if (path.startsWith('/orders')) return [Permissions.ORDERS_MANAGE];
  return [];
};

router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }
  const grants = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  const routePermissions = resolveAdminRoutePermissions(req.method, req.path);
  const missing = routePermissions.filter((permission) => !hasPermissionFromGrants(grants, permission));
  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource.',
    });
  }
  return next();
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalFabricSellers,
      totalDesigners,
      totalQa,
      pendingApprovals,
      totalOrders,
      totalRevenue,
      totalProducts,
      recentOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.user.count({ where: { role: UserRole.FABRIC_SELLER } }),
      prisma.user.count({ where: { role: UserRole.FASHION_DESIGNER } }),
      prisma.user.count({ where: { role: UserRole.QA_TEAM } }),
      prisma.user.count({
        where: {
          role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] },
          status: UserStatus.PENDING,
        },
      }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { paymentStatus: 'COMPLETED' },
        _sum: { total: true },
      }),
      prisma.$transaction([
        prisma.fabric.count(),
        prisma.design.count(),
        prisma.readyToWear.count(),
      ]).then(([fabrics, designs, rtw]) => fabrics + designs + rtw),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          fabricSellers: totalFabricSellers,
          designers: totalDesigners,
          qa: totalQa,
          pendingApprovals,
        },
        orders: {
          total: totalOrders,
          revenue: totalRevenue._sum.total || 0,
        },
        products: {
          total: totalProducts,
        },
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users with filters
router.get('/users', async (req, res, next) => {
  try {
    const { role, status, search, page, limit } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pagination = parsePagination(page, limit, 20);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          lastLogin: true,
          adminProfile: {
            select: {
              permissions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const adminRoleRows =
      userIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ userId: string; adminRoleId: string | null }>>(
            `SELECT "userId", "adminRoleId" FROM "AdminProfile" WHERE "userId" = ANY($1::text[])`,
            userIds
          )
        : [];
    const adminRoleByUserId = new Map(adminRoleRows.map((row) => [String(row.userId), row.adminRoleId || null]));
    const usersWithAdminMeta = users.map((user) => ({
      ...user,
      adminProfile: user.adminProfile
        ? {
            ...user.adminProfile,
            permissions: sanitizePermissionGrants(user.adminProfile.permissions),
            adminRoleId: adminRoleByUserId.get(user.id) ?? null,
          }
        : null,
    }));

    res.json({
      success: true,
      data: {
        users: usersWithAdminMeta,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const data = adminUserCreateSchema.parse(req.body);
    const password = await bcrypt.hash(data.password, 10);

    const created = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        password,
        role: data.role,
        status: data.status,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (created.role === UserRole.ADMINISTRATOR) {
      await prisma.adminProfile.upsert({
        where: { userId: created.id },
        create: { userId: created.id },
        update: {},
      });
    }

    if (created.role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          businessName: `${created.firstName} ${created.lastName}`.trim(),
          businessEmail: created.email,
          businessPhone: data.phone?.trim() || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (created.role === UserRole.FASHION_DESIGNER) {
      await prisma.designerProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          businessName: `${created.firstName} ${created.lastName}`.trim(),
          businessEmail: created.email,
          businessPhone: data.phone?.trim() || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (created.role === UserRole.QA_TEAM) {
      await prisma.qAProfile.upsert({
        where: { userId: created.id },
        create: {
          userId: created.id,
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: created,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }
    next(error);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const data = adminUserUpdateSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        email: data.email ? data.email.toLowerCase().trim() : undefined,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        role: data.role,
        status: data.status,
        phone: data.phone === null ? null : data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (updated.role === UserRole.ADMINISTRATOR) {
      await prisma.adminProfile.upsert({
        where: { userId: updated.id },
        create: { userId: updated.id },
        update: {},
      });
    }

    if (updated.role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          businessName: `${updated.firstName} ${updated.lastName}`.trim(),
          businessEmail: updated.email,
          businessPhone: updated.phone || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (updated.role === UserRole.FASHION_DESIGNER) {
      await prisma.designerProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          businessName: `${updated.firstName} ${updated.lastName}`.trim(),
          businessEmail: updated.email,
          businessPhone: updated.phone || '',
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    if (updated.role === UserRole.QA_TEAM) {
      await prisma.qAProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          country: '',
          city: '',
          address: '',
        },
        update: {},
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: updated,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }
    next(error);
  }
});

const handleCreateMinimalVendor = async (req: any, res: any, next: any) => {
  try {
    const payload = vendorCreateMinimalSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const role = payload.role === 'FABRIC_SELLER' ? UserRole.FABRIC_SELLER : UserRole.FASHION_DESIGNER;

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        role,
        status: UserStatus.PENDING,
        phone: payload.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (role === UserRole.FABRIC_SELLER) {
      await prisma.fabricSellerProfile.create({
        data: {
          userId: user.id,
          businessName: payload.businessName.trim(),
          businessEmail: payload.email.toLowerCase().trim(),
          businessPhone: payload.phone?.trim() || '',
          country: payload.country.trim(),
          city: payload.city?.trim() || '',
          address: payload.address?.trim() || '',
        },
      });
    } else {
      await prisma.designerProfile.create({
        data: {
          userId: user.id,
          businessName: payload.businessName.trim(),
          businessEmail: payload.email.toLowerCase().trim(),
          businessPhone: payload.phone?.trim() || '',
          country: payload.country.trim(),
          city: payload.city?.trim() || '',
          address: payload.address?.trim() || '',
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vendor created. Vendor can complete profile after first login.',
      data: user,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }
    next(error);
  }
};

router.post('/vendor-profiles/create-minimal', handleCreateMinimalVendor);
router.post('/vendor-profile/create-minimal', handleCreateMinimalVendor);
router.post('/vendors/create-minimal', handleCreateMinimalVendor);

// Get pending approvals
router.get('/users/pending', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: UserStatus.PENDING,
        role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] },
      },
      include: {
        fabricSellerProfile: true,
        designerProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

// Approve/reject user
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.nativeEnum(UserStatus),
      reason: z.string().optional(),
    });
    const { status, reason } = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    // TODO: Send notification email to user

    res.json({
      success: true,
      message: `User ${status.toLowerCase()} successfully.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

const parseStoredPermissions = (value: unknown) => {
  if (Array.isArray(value)) {
    return sanitizePermissionGrants(value);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return sanitizePermissionGrants(parsed);
    } catch {
      return [];
    }
  }
  return [];
};

type VendorRole = z.infer<typeof vendorRoleSchema>;
type VendorProfileStatus = z.infer<typeof vendorProfileStatusSchema>;
type VendorRejectionType = z.infer<typeof vendorRejectionTypeSchema>;
const vendorRoleSqlLiteral = (role: VendorRole) =>
  role === 'FABRIC_SELLER' ? 'FABRIC_SELLER' : 'FASHION_DESIGNER';

const normalizeVendorProfileStatus = (value: unknown): VendorProfileStatus => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOMPLETE' || normalized === 'SUBMITTED' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'SUBMITTED';
};
const normalizeVendorRejectionType = (value: unknown): VendorRejectionType | null => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'TEMPORARY' || normalized === 'PERMANENT') return normalized;
  return null;
};

const readTableColumns = async (tableName: string): Promise<Set<string>> => {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT "column_name"
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1`,
      tableName
    );
    return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.column_name || '').toLowerCase()));
  } catch {
    return new Set();
  }
};

const getVendorProfileFields = async (role: VendorRole) => {
  const columns = await readTableColumns('VendorProfileField');
  if (!columns.has('id') || !columns.has('role') || !columns.has('key') || !columns.has('label') || !columns.has('fieldtype')) {
    return [];
  }
  const optionalSelects = [
    columns.has('placeholder') ? `"placeholder"` : `NULL AS "placeholder"`,
    columns.has('helptext') ? `"helpText"` : `NULL AS "helpText"`,
    columns.has('required') ? `"required"` : `false AS "required"`,
    columns.has('options') ? `"options"` : `NULL AS "options"`,
    columns.has('sortorder') ? `"sortOrder"` : `0 AS "sortOrder"`,
    columns.has('isactive') ? `"isActive"` : `true AS "isActive"`,
  ];
  const orderBy = [
    columns.has('sortorder') ? `"sortOrder" ASC` : null,
    columns.has('createdat') ? `"createdAt" ASC` : `"key" ASC`,
  ]
    .filter(Boolean)
    .join(', ');
  let rows: any[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","role","key","label","fieldType",${optionalSelects.join(', ')}
       FROM "VendorProfileField"
       WHERE "role"::text = $1
       ORDER BY ${orderBy}`,
      role
    );
  } catch {
    rows = [];
  }
  const mappedRows = rows.map((row) => ({
    ...row,
    required: Boolean(row.required),
    isActive: row.isActive !== false,
    options:
      Array.isArray(row.options)
        ? row.options
        : typeof row.options === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(row.options);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [],
  }));
  return mappedRows;
};

const getVendorSubmissionRows = async () => {
  const columns = await readTableColumns('VendorProfileSubmission');
  if (!columns.has('id') || !columns.has('role') || !columns.has('userid')) {
    return new Map<string, any>();
  }
  const selectParts = [
    `"id"`,
    `"role"`,
    `"userId"`,
    columns.has('businessname') ? `"businessName"` : `NULL AS "businessName"`,
    columns.has('profilestatus') ? `"profileStatus"` : `'INCOMPLETE' AS "profileStatus"`,
    columns.has('profiledata') ? `"profileData"` : `NULL AS "profileData"`,
    columns.has('profilesubmittedat') ? `"profileSubmittedAt"` : `NULL AS "profileSubmittedAt"`,
    columns.has('profilereviewedat') ? `"profileReviewedAt"` : `NULL AS "profileReviewedAt"`,
    columns.has('profilereviewnotes') ? `"profileReviewNotes"` : `NULL AS "profileReviewNotes"`,
    columns.has('rejectiontype') ? `"rejectionType"` : `NULL AS "rejectionType"`,
    columns.has('rejectionreasoncode') ? `"rejectionReasonCode"` : `NULL AS "rejectionReasonCode"`,
    columns.has('rejectionreasonlabel') ? `"rejectionReasonLabel"` : `NULL AS "rejectionReasonLabel"`,
    columns.has('profilereviewmessage') ? `"profileReviewMessage"` : `NULL AS "profileReviewMessage"`,
    columns.has('permanentrejectionat') ? `"permanentRejectionAt"` : `NULL AS "permanentRejectionAt"`,
    columns.has('permanentdisableat') ? `"permanentDisableAt"` : `NULL AS "permanentDisableAt"`,
    columns.has('updatedat') ? `"updatedAt"` : `NOW() AS "updatedAt"`,
  ];
  let rows: any[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT ${selectParts.join(', ')}
       FROM "VendorProfileSubmission"`
    );
  } catch {
    rows = [];
  }
  return new Map(rows.map((row) => [`${row.role}:${row.userId}`, row]));
};

type NotificationAudienceRole =
  | 'ALL'
  | 'CUSTOMER'
  | 'FABRIC_SELLER'
  | 'FASHION_DESIGNER'
  | 'VENDORS'
  | 'ADMINISTRATOR'
  | 'QA_TEAM';
const normalizeNotificationAudienceRole = (value: unknown): NotificationAudienceRole => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (
    normalized === 'ALL' ||
    normalized === 'CUSTOMER' ||
    normalized === 'FABRIC_SELLER' ||
    normalized === 'FASHION_DESIGNER' ||
    normalized === 'VENDORS' ||
    normalized === 'ADMINISTRATOR' ||
    normalized === 'QA_TEAM'
  ) {
    return normalized;
  }
  return 'ALL';
};
const normalizeRecipientRoleToken = (value: unknown): UserRole | null => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'CUSTOMER') return UserRole.CUSTOMER;
  if (normalized === 'FABRIC_SELLER') return UserRole.FABRIC_SELLER;
  if (normalized === 'FASHION_DESIGNER') return UserRole.FASHION_DESIGNER;
  if (normalized === 'ADMINISTRATOR') return UserRole.ADMINISTRATOR;
  if (normalized === 'QA_TEAM') return UserRole.QA_TEAM;
  return null;
};
const notificationTemplateSchema = z.object({
  title: z.string().trim().min(2).max(180),
  subject: z.string().trim().min(2).max(220),
  bodyHtml: z.string().trim().min(4).max(20000),
  bodyText: z.string().trim().min(4).max(8000),
  audienceRole: z
    .enum(['ALL', 'CUSTOMER', 'FABRIC_SELLER', 'FASHION_DESIGNER', 'VENDORS', 'ADMINISTRATOR', 'QA_TEAM'])
    .default('ALL'),
  channelEmail: z.boolean().default(true),
  channelPush: z.boolean().default(true),
  channelInApp: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
const notificationDispatchSchema = z.object({
  templateKey: z.string().trim().max(120).optional(),
  title: z.string().trim().min(2).max(180).optional(),
  subject: z.string().trim().min(2).max(220).optional(),
  bodyHtml: z.string().trim().min(4).max(20000).optional(),
  bodyText: z.string().trim().min(4).max(8000).optional(),
  audienceRole: z
    .enum(['ALL', 'CUSTOMER', 'FABRIC_SELLER', 'FASHION_DESIGNER', 'VENDORS', 'ADMINISTRATOR', 'QA_TEAM'])
    .default('ALL'),
  recipientUserIds: z.array(z.string()).max(1000).default([]),
  channelEmail: z.boolean().optional(),
  channelPush: z.boolean().optional(),
  channelInApp: z.boolean().optional(),
});

const getUsersForAudience = async (audienceRole: NotificationAudienceRole) => {
  if (audienceRole === 'ALL') {
    return prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (audienceRole === 'VENDORS') {
    return prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER] },
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  const roleToken = normalizeRecipientRoleToken(audienceRole);
  if (!roleToken) return [];
  return prisma.user.findMany({
    where: { status: UserStatus.ACTIVE, role: roleToken },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
    orderBy: { createdAt: 'desc' },
  });
};

// ==================== TRAFFIC / AUDIT / VENDOR GOVERNANCE ====================

router.get('/traffic-report', async (req, res, next) => {
  try {
    const querySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
      vendorUserId: z.string().uuid().optional(),
      page: z.string().optional(),
    });
    const filters = querySchema.parse(req.query);

    const where: any = {};
    const startDate = parseDateValue(filters.startDate);
    const endDate = parseDateValue(filters.endDate);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        designOrder: {
          include: {
            design: {
              select: {
                id: true,
                name: true,
                designer: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
        fabricOrder: {
          include: {
            fabric: {
              select: {
                id: true,
                name: true,
                seller: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
        readyToWearItems: {
          include: {
            readyToWear: {
              select: {
                id: true,
                name: true,
                designer: { select: { userId: true, businessName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type Entry = {
      orderId: string;
      productId: string;
      productName: string;
      productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      page: string;
      vendorUserId: string;
      vendorName: string;
      vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
      revenue: number;
    };

    const entries: Entry[] = [];
    for (const order of orders) {
      if (order.designOrder?.design?.designer?.userId) {
        entries.push({
          orderId: order.id,
          productId: order.designOrder.design.id,
          productName: order.designOrder.design.name,
          productType: 'DESIGN',
          page: `/designs/${order.designOrder.design.id}`,
          vendorUserId: order.designOrder.design.designer.userId,
          vendorName: order.designOrder.design.designer.businessName || 'Designer',
          vendorRole: 'FASHION_DESIGNER',
          revenue: Number(order.designOrder.price || 0),
        });
      }
      if (order.fabricOrder?.fabric?.seller?.userId) {
        entries.push({
          orderId: order.id,
          productId: order.fabricOrder.fabric.id,
          productName: order.fabricOrder.fabric.name,
          productType: 'FABRIC',
          page: `/fabrics/${order.fabricOrder.fabric.id}`,
          vendorUserId: order.fabricOrder.fabric.seller.userId,
          vendorName: order.fabricOrder.fabric.seller.businessName || 'Fabric Seller',
          vendorRole: 'FABRIC_SELLER',
          revenue: Number(order.fabricOrder.totalPrice || 0),
        });
      }
      for (const item of order.readyToWearItems || []) {
        if (!item.readyToWear?.designer?.userId) continue;
        entries.push({
          orderId: order.id,
          productId: item.readyToWear.id,
          productName: item.readyToWear.name,
          productType: 'READY_TO_WEAR',
          page: `/ready-to-wear/${item.readyToWear.id}`,
          vendorUserId: item.readyToWear.designer.userId,
          vendorName: item.readyToWear.designer.businessName || 'Designer',
          vendorRole: 'FASHION_DESIGNER',
          revenue: Number(item.price || 0) * Number(item.quantity || 1),
        });
      }
    }

    const filtered = entries.filter((entry) => {
      if (filters.productType && entry.productType !== filters.productType) return false;
      if (filters.vendorUserId && entry.vendorUserId !== filters.vendorUserId) return false;
      if (filters.page && entry.page !== filters.page) return false;
      return true;
    });

    const vendors = new Map<string, any>();
    const products = new Map<string, any>();
    const pages = new Map<string, any>();
    const uniqueOrders = new Set<string>();
    let totalRevenue = 0;

    for (const entry of filtered) {
      uniqueOrders.add(entry.orderId);
      totalRevenue += entry.revenue;

      const vendorKey = `${entry.vendorRole}:${entry.vendorUserId}`;
      const vendorAgg = vendors.get(vendorKey) || {
        vendorUserId: entry.vendorUserId,
        vendorName: entry.vendorName,
        vendorRole: entry.vendorRole,
        orderCount: 0,
        revenue: 0,
      };
      vendorAgg.orderCount += 1;
      vendorAgg.revenue += entry.revenue;
      vendors.set(vendorKey, vendorAgg);

      const productKey = `${entry.productType}:${entry.productId}`;
      const productAgg = products.get(productKey) || {
        productId: entry.productId,
        productName: entry.productName,
        productType: entry.productType,
        page: entry.page,
        orderCount: 0,
        revenue: 0,
      };
      productAgg.orderCount += 1;
      productAgg.revenue += entry.revenue;
      products.set(productKey, productAgg);

      const pageAgg = pages.get(entry.page) || {
        page: entry.page,
        orderCount: 0,
        revenue: 0,
      };
      pageAgg.orderCount += 1;
      pageAgg.revenue += entry.revenue;
      pages.set(entry.page, pageAgg);
    }

    res.json({
      success: true,
      data: {
        filters: {
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
          productType: filters.productType || null,
          vendorUserId: filters.vendorUserId || null,
          page: filters.page || null,
        },
        summary: {
          totalOrders: uniqueOrders.size,
          totalLineItems: filtered.length,
          totalRevenue,
        },
        vendors: Array.from(vendors.values()).sort((a, b) => b.revenue - a.revenue),
        products: Array.from(products.values()).sort((a, b) => b.orderCount - a.orderCount),
        pages: Array.from(pages.values()).sort((a, b) => b.orderCount - a.orderCount),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/security/session-audit', async (req, res, next) => {
  try {
    const querySchema = z.object({
      action: z.enum(['VENDOR_SESSION_STARTED', 'VENDOR_SESSION_REPLACED', 'VENDOR_SESSION_LOGOUT']).optional(),
      role: z.enum(['FABRIC_SELLER', 'FASHION_DESIGNER']).optional(),
      userId: z.string().uuid().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const filters = querySchema.parse(req.query);
    const pagination = parsePagination(filters.page, filters.limit, 20);

    const where: any = {
      action: filters.action
        ? filters.action
        : {
            in: ['VENDOR_SESSION_STARTED', 'VENDOR_SESSION_REPLACED', 'VENDOR_SESSION_LOGOUT'],
          },
    };
    if (filters.userId) where.userId = filters.userId;
    if (filters.role) where.user = { role: filters.role };

    const [events, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        events: events.map((event) => {
          const details = (event.details as any) || {};
          return {
            id: event.id,
            action: event.action,
            createdAt: event.createdAt,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            user: event.user,
            details: {
              role: details.role || event.user?.role || null,
              deviceType: details.deviceType || 'unknown',
              sessionIssuedAt: details.sessionIssuedAt || null,
              previousSessionAt: details.previousSessionAt || null,
            },
          };
        }),
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

router.get('/vendor-profile/fields', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.query.role || 'FABRIC_SELLER'));
    const fields = await getVendorProfileFields(role);
    res.json({
      success: true,
      data: {
        role,
        fields,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        issues: error.issues,
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load vendor profile fields.',
    });
  }
});

router.put('/vendor-profile/fields', async (req, res, next) => {
  try {
    const schema = z.object({
      role: vendorRoleSchema,
      fields: z.array(vendorProfileFieldSchema).min(1),
    });
    const payload = schema.parse(req.body);
    await prisma.$executeRawUnsafe(`DELETE FROM "VendorProfileField" WHERE "role"::text = $1`, payload.role);
    for (let index = 0; index < payload.fields.length; index += 1) {
      const field = payload.fields[index];
      const roleLiteral = vendorRoleSqlLiteral(payload.role);
      const params = [
        randomUUID(),
        String(field.key).trim(),
        String(field.label).trim(),
        field.fieldType,
        field.placeholder || null,
        field.helpText || null,
        Boolean(field.required),
        JSON.stringify(field.options || []),
        field.sortOrder ?? index + 1,
        field.isActive !== false,
        req.user?.id || null,
        req.user?.id || null,
      ];
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "VendorProfileField"
            ("id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive","createdById","updatedById","createdAt","updatedAt")
           VALUES ($1,'${roleLiteral}',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,NOW(),NOW())`,
          ...params
        );
      } catch {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "VendorProfileField"
            ("id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive","createdById","updatedById","createdAt","updatedAt")
           VALUES ($1,'${roleLiteral}',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
          ...params
        );
      }
    }
    const fields = await getVendorProfileFields(payload.role);
    res.json({
      success: true,
      message: 'Vendor profile fields updated successfully.',
      data: { role: payload.role, fields },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        issues: error.issues,
      });
    }
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message || 'Failed to save vendor profile fields.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to save vendor profile fields.',
    });
  }
});

router.get('/vendor-dashboard-governance', async (_req, res, next) => {
  try {
    const payload = await readVendorDashboardGovernanceSettings();
    res.json({
      success: true,
      data: {
        source: payload.source,
        updatedAt: payload.updatedAt,
        settings: payload.settings,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/vendor-dashboard-governance', async (req, res, next) => {
  try {
    const settings = await saveVendorDashboardGovernanceSettings(req.body?.settings ?? req.body);
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'VENDOR_DASHBOARD_GOVERNANCE_UPDATED',
        details: settings,
      },
    });
    res.json({
      success: true,
      message: 'Vendor dashboard governance updated successfully.',
      data: settings,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        issues: error.issues,
      });
    }
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message || 'Failed to update vendor dashboard governance settings.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update vendor dashboard governance settings.',
    });
  }
});

const handleGetTryOnSettings = async (_req: any, res: any, next: any) => {
  try {
    const payload = await readTryOnSettings();
    res.json({
      success: true,
      data: {
        source: payload.source,
        updatedAt: payload.updatedAt,
        settings: payload.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

const handleUpdateTryOnSettings = async (req: any, res: any, next: any) => {
  try {
    const settings = await saveTryOnSettings(req.body?.settings ?? req.body);
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'TRY_ON_SETTINGS_UPDATED',
        details: settings as any,
      },
    });
    res.json({
      success: true,
      message: 'Try-On settings updated successfully.',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const handleGetTryOnInsights = async (req: any, res: any, next: any) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (settingsPayload.settings.applyLocations.adminDashboard === false) {
      return res.json({
        success: true,
        data: {
          disabled: true,
          totalTryOns: 0,
          measurementAverages: {},
          recentTryOns: [],
        },
      });
    }
    const insights = await readTryOnInsights({ role: 'ADMIN', userId: req.user?.id });
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
};

router.get('/try-on/settings', handleGetTryOnSettings);
router.get('/tryon/settings', handleGetTryOnSettings);
router.get('/3d-try-on/settings', handleGetTryOnSettings);
router.get('/3d-tryon/settings', handleGetTryOnSettings);

router.put('/try-on/settings', handleUpdateTryOnSettings);
router.put('/tryon/settings', handleUpdateTryOnSettings);
router.put('/3d-try-on/settings', handleUpdateTryOnSettings);
router.put('/3d-tryon/settings', handleUpdateTryOnSettings);
router.patch('/try-on/settings', handleUpdateTryOnSettings);
router.patch('/tryon/settings', handleUpdateTryOnSettings);
router.patch('/3d-try-on/settings', handleUpdateTryOnSettings);
router.patch('/3d-tryon/settings', handleUpdateTryOnSettings);

router.get('/try-on/insights', handleGetTryOnInsights);
router.get('/tryon/insights', handleGetTryOnInsights);
router.get('/3d-try-on/insights', handleGetTryOnInsights);
router.get('/3d-tryon/insights', handleGetTryOnInsights);

router.get('/vendor-profiles', async (req, res, next) => {
  try {
    const schema = z.object({
      role: vendorRoleSchema.optional(),
      status: vendorProfileStatusSchema.optional(),
      search: z.string().trim().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const query = schema.parse(req.query);
    const pagination = parsePagination(query.page, query.limit, 20);
    const search = query.search?.trim().toLowerCase();

    const [sellers, designers, submissions] = await Promise.all([
      query.role && query.role !== 'FABRIC_SELLER'
        ? Promise.resolve([])
        : prisma.fabricSellerProfile.findMany({
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, status: true },
              },
            },
            orderBy: { updatedAt: 'desc' },
          }),
      query.role && query.role !== 'FASHION_DESIGNER'
        ? Promise.resolve([])
        : prisma.designerProfile.findMany({
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, status: true },
              },
            },
            orderBy: { updatedAt: 'desc' },
          }),
      getVendorSubmissionRows(),
    ]);

    const rows = [
      ...sellers.map((profile) => {
        const submission = submissions.get(`FABRIC_SELLER:${profile.userId}`);
        const profileStatus = submission
          ? normalizeVendorProfileStatus(submission.profileStatus)
          : profile.isVerified
            ? 'APPROVED'
            : profile.user.status === UserStatus.PENDING
              ? 'SUBMITTED'
              : 'INCOMPLETE';
        return {
          role: 'FABRIC_SELLER' as const,
          userId: profile.userId,
          profileId: profile.id,
          businessName: profile.businessName,
          profileStatus,
          isVerified: profile.isVerified,
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
          rejectionType: normalizeVendorRejectionType(submission?.rejectionType),
          rejectionReasonCode: submission?.rejectionReasonCode || null,
          rejectionReasonLabel: submission?.rejectionReasonLabel || null,
          profileReviewMessage: submission?.profileReviewMessage || null,
          permanentRejectionAt: submission?.permanentRejectionAt || null,
          permanentDisableAt: submission?.permanentDisableAt || null,
          profileData: submission?.profileData || {},
          user: profile.user,
          updatedAt: submission?.updatedAt || profile.updatedAt,
        };
      }),
      ...designers.map((profile) => {
        const submission = submissions.get(`FASHION_DESIGNER:${profile.userId}`);
        const profileStatus = submission
          ? normalizeVendorProfileStatus(submission.profileStatus)
          : profile.isVerified
            ? 'APPROVED'
            : profile.user.status === UserStatus.PENDING
              ? 'SUBMITTED'
              : 'INCOMPLETE';
        return {
          role: 'FASHION_DESIGNER' as const,
          userId: profile.userId,
          profileId: profile.id,
          businessName: profile.businessName,
          profileStatus,
          isVerified: profile.isVerified,
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
          rejectionType: normalizeVendorRejectionType(submission?.rejectionType),
          rejectionReasonCode: submission?.rejectionReasonCode || null,
          rejectionReasonLabel: submission?.rejectionReasonLabel || null,
          profileReviewMessage: submission?.profileReviewMessage || null,
          permanentRejectionAt: submission?.permanentRejectionAt || null,
          permanentDisableAt: submission?.permanentDisableAt || null,
          profileData: submission?.profileData || {},
          user: profile.user,
          updatedAt: submission?.updatedAt || profile.updatedAt,
        };
      }),
    ]
      .filter((row) => {
        if (query.status && row.profileStatus !== query.status) return false;
        if (!search) return true;
        return (
          row.businessName?.toLowerCase().includes(search) ||
          row.user.email?.toLowerCase().includes(search) ||
          `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim().toLowerCase().includes(search)
        );
      })
      .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)));

    const paged = rows.slice(pagination.skip, pagination.skip + pagination.limit);
    res.json({
      success: true,
      data: {
        profiles: paged,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: rows.length,
          pages: Math.max(1, Math.ceil(rows.length / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor-profiles/:role/:userId', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.params.role || ''));
    const userId = String(req.params.userId || '');
    const submissionColumns = await readTableColumns('VendorProfileSubmission');
    const submissionSelect = [
      `"id"`,
      `"role"`,
      `"userId"`,
      submissionColumns.has('businessname') ? `"businessName"` : `NULL AS "businessName"`,
      submissionColumns.has('profilestatus') ? `"profileStatus"` : `'SUBMITTED' AS "profileStatus"`,
      submissionColumns.has('profiledata') ? `"profileData"` : `NULL AS "profileData"`,
      submissionColumns.has('profilesubmittedat') ? `"profileSubmittedAt"` : `NULL AS "profileSubmittedAt"`,
      submissionColumns.has('profilereviewedat') ? `"profileReviewedAt"` : `NULL AS "profileReviewedAt"`,
      submissionColumns.has('profilereviewnotes') ? `"profileReviewNotes"` : `NULL AS "profileReviewNotes"`,
      submissionColumns.has('rejectiontype') ? `"rejectionType"` : `NULL AS "rejectionType"`,
      submissionColumns.has('rejectionreasoncode') ? `"rejectionReasonCode"` : `NULL AS "rejectionReasonCode"`,
      submissionColumns.has('rejectionreasonlabel') ? `"rejectionReasonLabel"` : `NULL AS "rejectionReasonLabel"`,
      submissionColumns.has('profilereviewmessage') ? `"profileReviewMessage"` : `NULL AS "profileReviewMessage"`,
      submissionColumns.has('permanentrejectionat') ? `"permanentRejectionAt"` : `NULL AS "permanentRejectionAt"`,
      submissionColumns.has('permanentdisableat') ? `"permanentDisableAt"` : `NULL AS "permanentDisableAt"`,
    ];
    const [submissionRows, fields] = await Promise.all([
      prisma.$queryRawUnsafe<Array<any>>(
        `SELECT ${submissionSelect.join(', ')}
         FROM "VendorProfileSubmission"
         WHERE "role"::text = $1 AND "userId" = $2
         LIMIT 1`,
        role,
        userId
      ),
      getVendorProfileFields(role),
    ]);
    const submission = submissionRows[0] || null;

    if (role === 'FABRIC_SELLER') {
      const profile = await prisma.fabricSellerProfile.findFirst({
        where: { userId },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
      });
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
      }
      return res.json({
        success: true,
        data: {
          role,
          user: profile.user,
          profile: {
            ...profile,
            profileStatus: submission ? normalizeVendorProfileStatus(submission.profileStatus) : profile.isVerified ? 'APPROVED' : 'SUBMITTED',
            profileData: submission?.profileData || {},
            profileSubmittedAt: submission?.profileSubmittedAt || null,
            profileReviewedAt: submission?.profileReviewedAt || null,
            profileReviewNotes: submission?.profileReviewNotes || null,
            rejectionType: normalizeVendorRejectionType(submission?.rejectionType),
            rejectionReasonCode: submission?.rejectionReasonCode || null,
            rejectionReasonLabel: submission?.rejectionReasonLabel || null,
            profileReviewMessage: submission?.profileReviewMessage || null,
            permanentRejectionAt: submission?.permanentRejectionAt || null,
            permanentDisableAt: submission?.permanentDisableAt || null,
          },
          fields,
        },
      });
    }

    const profile = await prisma.designerProfile.findFirst({
      where: { userId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }
    return res.json({
      success: true,
      data: {
        role,
        user: profile.user,
        profile: {
          ...profile,
          profileStatus: submission ? normalizeVendorProfileStatus(submission.profileStatus) : profile.isVerified ? 'APPROVED' : 'SUBMITTED',
          profileData: submission?.profileData || {},
          profileSubmittedAt: submission?.profileSubmittedAt || null,
          profileReviewedAt: submission?.profileReviewedAt || null,
          profileReviewNotes: submission?.profileReviewNotes || null,
          rejectionType: normalizeVendorRejectionType(submission?.rejectionType),
          rejectionReasonCode: submission?.rejectionReasonCode || null,
          rejectionReasonLabel: submission?.rejectionReasonLabel || null,
          profileReviewMessage: submission?.profileReviewMessage || null,
          permanentRejectionAt: submission?.permanentRejectionAt || null,
          permanentDisableAt: submission?.permanentDisableAt || null,
        },
        fields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/vendor-profiles/:role/:userId/review', async (req, res, next) => {
  try {
    const role = vendorRoleSchema.parse(String(req.params.role || ''));
    const userId = String(req.params.userId || '');
    const payload = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        notes: z.string().optional(),
        rejectionType: vendorRejectionTypeSchema.optional(),
        rejectionReasonCode: z.string().trim().max(80).optional(),
        rejectionReasonLabel: z.string().trim().max(180).optional(),
        messageHtml: z.string().trim().max(20000).optional(),
      })
      .parse(req.body);

    const now = new Date();
    const permanentDisableAt =
      payload.status === 'REJECTED' && payload.rejectionType === 'PERMANENT'
        ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        : null;
    const normalizedRejectionType =
      payload.status === 'REJECTED'
        ? payload.rejectionType || 'TEMPORARY'
        : null;
    const rejectionReasonCode =
      payload.status === 'REJECTED' ? String(payload.rejectionReasonCode || '').trim() || null : null;
    const rejectionReasonLabel =
      payload.status === 'REJECTED' ? String(payload.rejectionReasonLabel || '').trim() || null : null;
    if (payload.status === 'REJECTED' && !rejectionReasonCode && !rejectionReasonLabel) {
      return res.status(400).json({
        success: false,
        message: 'Please select a rejection reason before rejecting the vendor profile.',
      });
    }
    const customMessageHtml =
      payload.status === 'REJECTED' ? String(payload.messageHtml || '').trim() || null : null;
    const rejectionDisplayMessage =
      payload.status !== 'REJECTED'
        ? null
        : normalizedRejectionType === 'PERMANENT'
          ? 'Your vendor account has been permanently rejected. Please contact the administrator for further guidance.'
          : customMessageHtml ||
            payload.notes ||
            'Your vendor profile was temporarily rejected. Please review the rejection reason, make corrections, and resubmit for verification.';
    const reviewNoteValue =
      payload.status === 'REJECTED'
        ? payload.notes || rejectionReasonLabel || rejectionReasonCode || null
        : payload.notes || null;

    const roleLiteral = vendorRoleSqlLiteral(role);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","profileStatus","profileReviewNotes","profileReviewMessage","rejectionType","rejectionReasonCode","rejectionReasonLabel","permanentRejectionAt","permanentDisableAt","profileReviewedAt","updatedAt")
       VALUES ($1,'${roleLiteral}',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "profileStatus" = EXCLUDED."profileStatus",
         "profileReviewNotes" = EXCLUDED."profileReviewNotes",
         "profileReviewMessage" = EXCLUDED."profileReviewMessage",
         "rejectionType" = EXCLUDED."rejectionType",
         "rejectionReasonCode" = EXCLUDED."rejectionReasonCode",
         "rejectionReasonLabel" = EXCLUDED."rejectionReasonLabel",
         "permanentRejectionAt" = EXCLUDED."permanentRejectionAt",
         "permanentDisableAt" = EXCLUDED."permanentDisableAt",
         "profileReviewedAt" = EXCLUDED."profileReviewedAt",
         "updatedAt" = NOW()`,
      randomUUID(),
      userId,
      payload.status,
      reviewNoteValue,
      rejectionDisplayMessage,
      normalizedRejectionType,
      rejectionReasonCode,
      rejectionReasonLabel,
      normalizedRejectionType === 'PERMANENT' ? now : null,
      permanentDisableAt,
      now
    );

    if (role === 'FABRIC_SELLER') {
      await prisma.fabricSellerProfile.updateMany({
        where: { userId },
        data: { isVerified: payload.status === 'APPROVED' },
      });
    } else {
      await prisma.designerProfile.updateMany({
        where: { userId },
        data: { isVerified: payload.status === 'APPROVED' },
      });
    }

    if (payload.status === 'APPROVED') {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
    }

    const vendorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const vendorDisplayName =
      `${String(vendorUser?.firstName || '').trim()} ${String(vendorUser?.lastName || '').trim()}`.trim() ||
      String(vendorUser?.email || '').trim() ||
      'Vendor';
    const notificationMessage =
      payload.status === 'APPROVED'
        ? 'Your vendor profile has been approved. You can now upload products.'
        : rejectionDisplayMessage ||
          'Your vendor profile requires corrections before approval.';

    await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId,
          type: payload.status === 'APPROVED' ? 'SYSTEM' : 'NEW_MESSAGE',
          title: payload.status === 'APPROVED' ? 'Vendor profile approved' : 'Vendor profile rejected',
          message: notificationMessage,
          relatedType: 'PROFILE',
          relatedId: userId,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'VENDOR_PROFILE_REVIEWED',
          details: {
            role,
            vendorUserId: userId,
            status: payload.status,
            notes: reviewNoteValue,
            rejectionType: normalizedRejectionType,
            rejectionReasonCode,
            rejectionReasonLabel,
            permanentDisableAt: permanentDisableAt ? permanentDisableAt.toISOString() : null,
          },
        },
      }),
    ]);
    if (vendorUser?.email) {
      const subject =
        payload.status === 'APPROVED'
          ? 'Your vendor profile has been approved'
          : normalizedRejectionType === 'PERMANENT'
            ? 'Your vendor profile has been permanently rejected'
            : 'Vendor profile correction required';
      const textBody =
        payload.status === 'APPROVED'
          ? `Hello ${vendorDisplayName}, your vendor profile has been approved. You can now access vendor functionality.`
          : normalizedRejectionType === 'PERMANENT'
            ? `Hello ${vendorDisplayName}, your vendor profile has been permanently rejected. Please contact the administrator.`
            : `Hello ${vendorDisplayName}, your vendor profile requires corrections before approval.\n\nReason: ${rejectionReasonLabel || rejectionReasonCode || 'Profile correction required'}\n\nDetails: ${stripHtmlForText(notificationMessage)}`;
      const htmlBody =
        payload.status === 'APPROVED'
          ? `<p>Hello ${vendorDisplayName},</p><p>Your vendor profile has been approved. You can now access vendor functionality.</p>`
          : normalizedRejectionType === 'PERMANENT'
            ? `<p>Hello ${vendorDisplayName},</p><p>Your vendor profile has been <strong>permanently rejected</strong>.</p><p>Please contact the administrator for further guidance.</p>`
            : `<p>Hello ${vendorDisplayName},</p><p>Your vendor profile was <strong>temporarily rejected</strong> and requires corrections before approval.</p><p><strong>Reason:</strong> ${rejectionReasonLabel || rejectionReasonCode || 'Profile correction required'}</p><div>${notificationMessage}</div>`;
      void sendEmail({
        to: vendorUser.email,
        subject,
        text: textBody,
        html: htmlBody,
      }).catch((error) => {
        console.error('Failed to send vendor review email:', error);
      });
    }

    res.json({
      success: true,
      message: `Vendor profile ${payload.status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/notification-center/templates', async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","key","title","subject","bodyHtml","bodyText","audienceRole","channelEmail","channelPush","channelInApp","isSystem","isActive","updatedAt"
       FROM "NotificationTemplate"
       ORDER BY "isSystem" DESC, "key" ASC`
    );
    return res.json({
      success: true,
      data: (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        key: row.key,
        title: row.title,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText,
        audienceRole: normalizeNotificationAudienceRole(row.audienceRole),
        channelEmail: Boolean(row.channelEmail),
        channelPush: Boolean(row.channelPush),
        channelInApp: Boolean(row.channelInApp),
        isSystem: Boolean(row.isSystem),
        isActive: row.isActive !== false,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/notification-center/templates/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    const payload = notificationTemplateSchema.parse(req.body || {});
    const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","isSystem"
       FROM "NotificationTemplate"
       WHERE "key" = $1
       LIMIT 1`,
      key
    );
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    if (!existing) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "NotificationTemplate"
          ("id","key","title","subject","bodyHtml","bodyText","audienceRole","channelEmail","channelPush","channelInApp","isSystem","isActive","createdById","updatedById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$12,NOW(),NOW())`,
        randomUUID(),
        key,
        payload.title,
        payload.subject,
        payload.bodyHtml,
        payload.bodyText,
        normalizeNotificationAudienceRole(payload.audienceRole),
        Boolean(payload.channelEmail),
        Boolean(payload.channelPush),
        Boolean(payload.channelInApp),
        Boolean(payload.isActive),
        req.user!.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "NotificationTemplate"
         SET "title" = $2,
             "subject" = $3,
             "bodyHtml" = $4,
             "bodyText" = $5,
             "audienceRole" = $6,
             "channelEmail" = $7,
             "channelPush" = $8,
             "channelInApp" = $9,
             "isActive" = $10,
             "updatedById" = $11,
             "updatedAt" = NOW()
         WHERE "key" = $1`,
        key,
        payload.title,
        payload.subject,
        payload.bodyHtml,
        payload.bodyText,
        normalizeNotificationAudienceRole(payload.audienceRole),
        Boolean(payload.channelEmail),
        Boolean(payload.channelPush),
        Boolean(payload.channelInApp),
        Boolean(payload.isActive),
        req.user!.id
      );
    }
    return res.json({
      success: true,
      message: 'Notification template saved successfully.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/notification-center/dispatches', async (req, res, next) => {
  try {
    const query = z
      .object({
        role: z.enum(['ALL', 'CUSTOMER', 'FABRIC_SELLER', 'FASHION_DESIGNER', 'VENDORS', 'ADMINISTRATOR', 'QA_TEAM']).optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(req.query);
    const pagination = parsePagination(query.page, query.limit, 20);
    const clauses: string[] = [];
    const values: any[] = [];
    if (query.role) {
      values.push(query.role);
      clauses.push(`"recipientRole" = $${values.length}`);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","templateKey","title","subject","recipientRole","recipientUserId","sentEmail","sentPush","sentInApp","deliveryStatus","createdAt"
       FROM "NotificationDispatch"
       ${whereSql}
       ORDER BY "createdAt" DESC
       LIMIT ${pagination.limit}
       OFFSET ${pagination.skip}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS "count"
       FROM "NotificationDispatch"
       ${whereSql}`,
      ...values
    );
    const total = Number(countRows?.[0]?.count || 0);
    return res.json({
      success: true,
      data: {
        dispatches: Array.isArray(rows) ? rows : [],
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

router.post('/notification-center/send', async (req, res, next) => {
  try {
    const payload = notificationDispatchSchema.parse(req.body || {});
    let template: any = null;
    if (payload.templateKey) {
      const templateRows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","key","title","subject","bodyHtml","bodyText","audienceRole","channelEmail","channelPush","channelInApp","isActive"
         FROM "NotificationTemplate"
         WHERE "key" = $1
         LIMIT 1`,
        String(payload.templateKey || '')
          .trim()
          .toUpperCase()
      );
      template = Array.isArray(templateRows) && templateRows.length > 0 ? templateRows[0] : null;
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Notification template was not found.',
        });
      }
      if (template.isActive === false) {
        return res.status(400).json({
          success: false,
          message: 'Selected notification template is inactive.',
        });
      }
    }

    const finalAudience = normalizeNotificationAudienceRole(
      payload.audienceRole || template?.audienceRole || 'ALL'
    );
    const finalTitle = String(payload.title || template?.title || '').trim();
    const finalSubject = String(payload.subject || template?.subject || '').trim();
    const finalBodyHtml = String(payload.bodyHtml || template?.bodyHtml || '').trim();
    const finalBodyText = String(payload.bodyText || template?.bodyText || '').trim();
    const channelEmail = payload.channelEmail ?? Boolean(template?.channelEmail ?? true);
    const channelPush = payload.channelPush ?? Boolean(template?.channelPush ?? true);
    const channelInApp = payload.channelInApp ?? Boolean(template?.channelInApp ?? true);

    if (!finalTitle || !finalSubject || !finalBodyHtml || !finalBodyText) {
      return res.status(400).json({
        success: false,
        message: 'Notification title, subject, and body are required.',
      });
    }

    const users = await getUsersForAudience(finalAudience);
    const explicitRecipientIds = new Set((payload.recipientUserIds || []).map((value) => String(value || '').trim()));
    const recipients =
      explicitRecipientIds.size > 0
        ? users.filter((user) => explicitRecipientIds.has(String(user.id)))
        : users;

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active recipients found for the selected audience.',
      });
    }

    const dispatchPromises: Promise<unknown>[] = [];
    const emailPromises: Promise<unknown>[] = [];
    for (const recipient of recipients) {
      const recipientName =
        `${String(recipient.firstName || '').trim()} ${String(recipient.lastName || '').trim()}`.trim() ||
        String(recipient.email || '').trim() ||
        'User';
      if (channelInApp || channelPush) {
        dispatchPromises.push(
          prisma.notification.create({
            data: {
              userId: recipient.id,
              type: 'SYSTEM',
              title: finalTitle,
              message: finalBodyText,
              relatedType: 'SYSTEM',
              relatedId: String(template?.key || 'MANUAL'),
            },
          })
        );
      }
      if (channelEmail && recipient.email) {
        emailPromises.push(
          sendEmail({
            to: recipient.email,
            subject: finalSubject,
            text: finalBodyText,
            html: `<p>Hello ${recipientName},</p>${finalBodyHtml}`,
          })
        );
      }
      dispatchPromises.push(
        prisma.$executeRawUnsafe(
          `INSERT INTO "NotificationDispatch"
            ("id","templateKey","title","subject","bodyHtml","bodyText","recipientRole","recipientUserId","sentEmail","sentPush","sentInApp","deliveryStatus","createdById","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SENT',$12,NOW())`,
          randomUUID(),
          template?.key ? String(template.key) : null,
          finalTitle,
          finalSubject,
          finalBodyHtml,
          finalBodyText,
          finalAudience,
          recipient.id,
          Boolean(channelEmail),
          Boolean(channelPush),
          Boolean(channelInApp),
          req.user!.id
        )
      );
    }

    await Promise.all(dispatchPromises);
    await Promise.allSettled(emailPromises);

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADMIN_NOTIFICATION_SENT',
        details: {
          templateKey: template?.key || null,
          audienceRole: finalAudience,
          recipientCount: recipients.length,
          channelEmail,
          channelPush,
          channelInApp,
        },
      },
    });

    return res.json({
      success: true,
      message: `Notification sent to ${recipients.length} recipient(s).`,
      data: {
        recipientCount: recipients.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/measurement-templates', async (_req, res, next) => {
  try {
    const templates = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","name","unit","isRequired","instructions","displayOrder","isActive"
       FROM "MeasurementTemplate"
       WHERE "isActive" = true
       ORDER BY "displayOrder" ASC, "name" ASC`
    );
    res.json({
      success: true,
      data: templates.map((item) => ({
        name: item.name,
        unit: item.unit,
        isRequired: Boolean(item.isRequired),
        instructions: item.instructions || '',
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/measurement-templates', async (req, res, next) => {
  try {
    const schema = z.object({
      templates: z.array(measurementTemplateSchema).min(1),
    });
    const payload = schema.parse(req.body);
    await prisma.$executeRawUnsafe(`DELETE FROM "MeasurementTemplate"`);
    for (let index = 0; index < payload.templates.length; index += 1) {
      const item = payload.templates[index];
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MeasurementTemplate"
          ("id","name","unit","isRequired","instructions","displayOrder","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW())`,
        randomUUID(),
        item.name.trim(),
        item.unit.trim(),
        Boolean(item.isRequired),
        item.instructions?.trim() || '',
        index + 1
      );
    }
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'MEASUREMENT_TEMPLATES_UPDATED',
        details: { templates: payload.templates },
      },
    });
    res.json({
      success: true,
      message: 'Measurement templates updated successfully.',
      data: payload.templates,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ready-to-wear-sizes', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminReadyToWearSizesSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching ready-to-wear sizes settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ready-to-wear sizes settings.' });
  }
});

router.put('/ready-to-wear-sizes', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminReadyToWearSizesSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating ready-to-wear sizes settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update ready-to-wear sizes settings.' });
  }
});

router.patch('/ready-to-wear-sizes', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminReadyToWearSizesSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating ready-to-wear sizes settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update ready-to-wear sizes settings.' });
  }
});

router.get('/ready-to-wear-size-guide', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminReadyToWearSizeGuideSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching ready-to-wear size guide settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ready-to-wear size guide settings.' });
  }
});

router.put('/ready-to-wear-size-guide', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminReadyToWearSizeGuideSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating ready-to-wear size guide settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update ready-to-wear size guide settings.' });
  }
});

router.patch('/ready-to-wear-size-guide', authorizePermissions(Permissions.MEASUREMENT_TEMPLATES_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminReadyToWearSizeGuideSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating ready-to-wear size guide settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update ready-to-wear size guide settings.' });
  }
});

router.get('/product-labels', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminProductLabelSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching product label settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product label settings.' });
  }
});

router.put('/product-labels', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminProductLabelSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating product label settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update product label settings.' });
  }
});

router.patch('/product-labels', authorizePermissions(Permissions.PRODUCTS_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminProductLabelSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating product label settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update product label settings.' });
  }
});

// ==================== ADMIN ROLES & PERMISSIONS ====================

router.get('/permission-catalog', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (_req, res) => {
  const catalog = getPermissionCatalog();
  res.json({
    success: true,
    data: {
      catalog,
      groups: Array.from(new Set(catalog.map((item) => item.group))),
    },
  });
});

router.get('/roles', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (_req, res, next) => {
  try {
    const roles = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        assignedAdmins: number;
      }>
    >(
      `SELECT r."id",
              r."name",
              r."description",
              r."permissions",
              r."isSystem",
              r."isActive",
              r."createdAt",
              r."updatedAt",
              COALESCE(COUNT(ap."id"), 0)::int AS "assignedAdmins"
       FROM "AdminRole" r
       LEFT JOIN "AdminProfile" ap ON ap."adminRoleId" = r."id"
       GROUP BY r."id", r."name", r."description", r."permissions", r."isSystem", r."isActive", r."createdAt", r."updatedAt"
       ORDER BY r."isSystem" DESC, r."name" ASC`
    );

    res.json({
      success: true,
      data: roles.map((role) => ({
        ...role,
        permissions: parseStoredPermissions(role.permissions),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/roles', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminRoleCreateSchema.parse(req.body);
    const permissions = sanitizePermissionGrants(payload.permissions);
    const roleRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      `INSERT INTO "AdminRole" ("id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, false, $5, NOW(), NOW())
       RETURNING "id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt"`,
      randomUUID(),
      payload.name.trim(),
      payload.description?.trim() || null,
      JSON.stringify(permissions),
      payload.isActive ?? true
    );

    const created = roleRows[0];
    res.status(201).json({
      success: true,
      data: {
        ...created,
        permissions: parseStoredPermissions(created?.permissions),
        assignedAdmins: 0,
      },
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An admin role with this name already exists.',
      });
    }
    next(error);
  }
});

router.patch('/roles/:id', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminRoleUpdateSchema.parse(req.body);
    const existingRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; isSystem: boolean; permissions: unknown }>
    >(`SELECT "id", "isSystem", "permissions" FROM "AdminRole" WHERE "id" = $1 LIMIT 1`, req.params.id);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin role not found.' });
    }
    if (existing.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be modified.' });
    }

    const permissions =
      payload.permissions !== undefined
        ? sanitizePermissionGrants(payload.permissions)
        : parseStoredPermissions(existing.permissions);

    const roleRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        permissions: unknown;
        isSystem: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      `UPDATE "AdminRole"
       SET "name" = COALESCE($1, "name"),
           "description" = CASE WHEN $2::boolean THEN NULL ELSE COALESCE($3, "description") END,
           "permissions" = $4::jsonb,
           "isActive" = COALESCE($5, "isActive"),
           "updatedAt" = NOW()
       WHERE "id" = $6
       RETURNING "id", "name", "description", "permissions", "isSystem", "isActive", "createdAt", "updatedAt"`,
      payload.name?.trim() || null,
      payload.description === null,
      payload.description?.trim() || null,
      JSON.stringify(permissions),
      payload.isActive ?? null,
      req.params.id
    );

    const updated = roleRows[0];
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(COUNT(*), 0)::int AS "total" FROM "AdminProfile" WHERE "adminRoleId" = $1`,
      req.params.id
    );
    res.json({
      success: true,
      data: {
        ...updated,
        permissions: parseStoredPermissions(updated?.permissions),
        assignedAdmins: Number(countRows[0]?.total || 0),
      },
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An admin role with this name already exists.',
      });
    }
    next(error);
  }
});

router.delete('/roles/:id', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; isSystem: boolean }>>(
      `SELECT "id", "isSystem" FROM "AdminRole" WHERE "id" = $1 LIMIT 1`,
      req.params.id
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin role not found.' });
    }
    if (existing.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be deleted.' });
    }

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(COUNT(*), 0)::int AS "total" FROM "AdminProfile" WHERE "adminRoleId" = $1`,
      req.params.id
    );
    if (Number(countRows[0]?.total || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: 'This role is still assigned to one or more administrators.',
      });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "AdminRole" WHERE "id" = $1`, req.params.id);
    res.json({ success: true, message: 'Admin role deleted.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/admin-access', authorizePermissions(Permissions.ADMIN_ROLE_MANAGE), async (req, res, next) => {
  try {
    const payload = adminUserRoleAssignmentSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role !== UserRole.ADMINISTRATOR) {
      return res.status(400).json({
        success: false,
        message: 'Only administrator users can receive admin role assignments.',
      });
    }

    let rolePermissions: string[] = [];
    let selectedRole: { id: string; name: string; isActive: boolean } | null = null;
    if (payload.adminRoleId) {
      const roleRows = await prisma.$queryRawUnsafe<
        Array<{ id: string; name: string; permissions: unknown; isActive: boolean }>
      >(
        `SELECT "id", "name", "permissions", "isActive"
         FROM "AdminRole"
         WHERE "id" = $1
         LIMIT 1`,
        payload.adminRoleId
      );
      const role = roleRows[0];
      if (!role || !role.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Selected admin role is invalid or inactive.',
        });
      }
      rolePermissions = parseStoredPermissions(role.permissions);
      selectedRole = { id: role.id, name: role.name, isActive: role.isActive };
    }

    const nextPermissions =
      payload.permissions !== undefined
        ? sanitizePermissionGrants(payload.permissions)
        : payload.adminRoleId !== undefined
          ? rolePermissions
          : undefined;

    const profile = await prisma.adminProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        permissions: nextPermissions ?? [],
      },
      update: nextPermissions !== undefined ? { permissions: nextPermissions } : {},
      select: {
        userId: true,
        permissions: true,
      },
    });

    if (payload.adminRoleId !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "AdminProfile"
         SET "adminRoleId" = $1, "updatedAt" = NOW()
         WHERE "userId" = $2`,
        payload.adminRoleId || null,
        user.id
      );
    }

    res.json({
      success: true,
      message: 'Admin access updated.',
      data: {
        userId: user.id,
        adminRoleId: payload.adminRoleId ?? null,
        adminRole: payload.adminRoleId ? selectedRole : null,
        permissions: sanitizePermissionGrants(profile.permissions),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PRODUCTS (LIST/CREATE/EDIT) ====================

router.get('/products/options', async (_req, res, next) => {
  try {
    await ensureVendorProfilesForRoleUsers();
    const [categories, materials, sellersRaw, designersRaw] = await Promise.all([
      prisma.productCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.materialType.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.fabricSellerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.designerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const sellers = sellersRaw.map((item) => {
      return {
        id: item.id,
        ownerUserId: item.user?.id || item.id,
        businessName: getVendorDisplayName({
          id: item.id,
          roleLabel: 'Fabric Seller',
          businessName: item.businessName,
          user: item.user,
        }),
        country: item.country || '',
      };
    });

    const designers = designersRaw.map((item) => {
      return {
        id: item.id,
        ownerUserId: item.user?.id || item.id,
        businessName: getVendorDisplayName({
          id: item.id,
          roleLabel: 'Designer',
          businessName: item.businessName,
          user: item.user,
        }),
        country: item.country || '',
      };
    });

    res.json({
      success: true,
      data: {
        categories,
        materials,
        sellers,
        designers,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/designer-options', async (_req, res, next) => {
  try {
    await ensureVendorProfilesForRoleUsers();
    const [designersRaw, sellersRaw] = await Promise.all([
      prisma.designerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fabricSellerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const designers = designersRaw.map((item) => ({
      id: item.id,
      ownerUserId: item.user?.id || item.id,
      businessName: getVendorDisplayName({
        id: item.id,
        roleLabel: 'Designer',
        businessName: item.businessName,
        user: item.user,
      }),
      country: String(item.country || '').trim(),
      vendorType: 'DESIGNER' as const,
    }));
    const sellers = sellersRaw.map((item) => ({
      id: item.id,
      ownerUserId: item.user?.id || item.id,
      businessName: getVendorDisplayName({
        id: item.id,
        roleLabel: 'Fabric Seller',
        businessName: item.businessName,
        user: item.user,
      }),
      country: String(item.country || '').trim(),
      vendorType: 'SELLER' as const,
    }));
    res.json({
      success: true,
      data: [...designers, ...sellers].sort((a, b) => a.businessName.localeCompare(b.businessName)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const querySchema = z.object({
      search: z.string().optional(),
      status: z.nativeEnum(ProductStatus).optional(),
      type: adminProductTypeSchema.optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    });
    const query = querySchema.parse(req.query);
    const pagination = parsePagination(query.page, query.limit, 20);
    const search = String(query.search || '').trim();

    const [fabrics, designs, readyToWear] = await Promise.all([
      !query.type || query.type === ProductType.FABRIC
        ? prisma.fabric.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              seller: { select: { id: true, businessName: true, country: true } },
              materialType: { select: { name: true } },
              images: { select: { url: true }, orderBy: { sortOrder: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      !query.type || query.type === ProductType.DESIGN
        ? prisma.design.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              designer: { select: { id: true, businessName: true, country: true } },
              category: { select: { name: true } },
              images: { select: { url: true }, orderBy: { sortOrder: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      !query.type || query.type === ProductType.READY_TO_WEAR
        ? prisma.readyToWear.findMany({
            where: {
              ...(query.status ? { status: query.status } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: {
              designer: { select: { id: true, businessName: true, country: true } },
              category: { select: { id: true, name: true } },
              images: { select: { url: true }, orderBy: { sortOrder: 'asc' } },
              sizeVariations: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const rows = [
      ...fabrics.map((item) => ({
        id: item.id,
        type: ProductType.FABRIC,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.sellerPrice || 0),
        finalPrice: Number(item.finalPrice || 0),
        sellerId: item.seller?.id || '',
        ownerName: item.seller?.businessName || 'Fabric Seller',
        ownerCountry: item.seller?.country || null,
        category: item.materialType?.name || 'Material',
        orderCount: Number((item as any)?.totalSold || 0),
        images: (Array.isArray(item.images) ? item.images : []).map((entry) => entry?.url).filter(Boolean),
        image: item.images?.[0]?.url || null,
        createdAt: item.createdAt,
      })),
      ...designs.map((item) => ({
        id: item.id,
        type: ProductType.DESIGN,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.basePrice || 0),
        finalPrice: Number(item.finalPrice || 0),
        designerId: item.designer?.id || '',
        ownerName: item.designer?.businessName || 'Designer',
        ownerCountry: item.designer?.country || null,
        category: item.category?.name || 'Category',
        orderCount: Number((item as any)?.totalSold || 0),
        images: (Array.isArray(item.images) ? item.images : []).map((entry) => entry?.url).filter(Boolean),
        image: item.images?.[0]?.url || null,
        createdAt: item.createdAt,
      })),
      ...readyToWear.map((item) => ({
        id: item.id,
        type: ProductType.READY_TO_WEAR,
        name: item.name,
        description: item.description,
        status: item.status,
        isAvailable: item.isAvailable,
        basePrice: Number(item.basePrice || 0),
        finalPrice: Number(item.basePrice || 0),
        designerId: item.designer?.id || '',
        ownerName: item.designer?.businessName || 'Designer',
        ownerCountry: item.designer?.country || null,
        categoryId: item.category?.id || null,
        category: item.category?.name || 'Category',
        orderCount: Number((item as any)?.totalSold || 0),
        images: (Array.isArray(item.images) ? item.images : []).map((entry) => entry?.url).filter(Boolean),
        image: item.images?.[0]?.url || null,
        sizeVariations: Array.isArray(item.sizeVariations)
          ? item.sizeVariations.map((variation: any) => {
              const decoded = decodeReadyToWearVariantKey(variation?.size);
              return {
                id: variation?.id,
                size: decoded.size,
                color: decoded.color,
                variantKey: decoded.variantKey,
                price: Number(variation?.price || 0),
                stock: Number(variation?.stock || 0),
              };
            })
          : [],
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    let featuredRows: Array<{
      productId: string;
      productType: ProductType;
      section: string;
      isActive: boolean;
    }> = [];
    if (rows.length > 0) {
      try {
        featuredRows = await prisma.featuredProduct.findMany({
          where: {
            OR: [
              {
                productType: ProductType.FABRIC,
                productId: {
                  in: rows.filter((row) => row.type === ProductType.FABRIC).map((row) => row.id),
                },
              },
              {
                productType: ProductType.DESIGN,
                productId: {
                  in: rows.filter((row) => row.type === ProductType.DESIGN).map((row) => row.id),
                },
              },
              {
                productType: ProductType.READY_TO_WEAR,
                productId: {
                  in: rows.filter((row) => row.type === ProductType.READY_TO_WEAR).map((row) => row.id),
                },
              },
            ],
          },
          select: {
            productId: true,
            productType: true,
            section: true,
            isActive: true,
          },
        });
      } catch (featuredError) {
        console.warn('[admin/products] Prisma featuredProduct lookup failed, trying SQL fallback:', featuredError);
        try {
          const fallbackRows = await prisma.$queryRawUnsafe<Array<{
            productId: string;
            productType: string;
            section: string;
            isActive: boolean;
          }>>(
            `SELECT "productId", "productType", "section", "isActive"
             FROM "FeaturedProduct"
             WHERE "productId" = ANY($1::text[])`,
            rows.map((row) => row.id)
          );
          featuredRows = (Array.isArray(fallbackRows) ? fallbackRows : []).map((row) => ({
            productId: String(row.productId || ''),
            productType: String(row.productType || '').toUpperCase() as ProductType,
            section: String(row.section || ''),
            isActive: Boolean(row.isActive),
          }));
        } catch (fallbackError) {
          console.warn('[admin/products] SQL featuredProduct fallback also failed:', fallbackError);
        }
      }
    }

    const featuredMap = new Map<string, string[]>();
    for (const row of featuredRows) {
      if (!row.isActive) continue;
      const key = `${row.productType}:${row.productId}`;
      const existing = featuredMap.get(key) || [];
      if (!existing.includes(row.section)) {
        existing.push(row.section);
      }
      featuredMap.set(key, existing);
    }

    const rowsWithFeatured = rows.map((row) => {
      const key = `${row.type}:${row.id}`;
      const featuredSections = featuredMap.get(key) || [];
      return {
        ...row,
        isFeatured: featuredSections.length > 0,
        featuredSections,
      };
    });

    const paged = rowsWithFeatured.slice(pagination.skip, pagination.skip + pagination.limit);
    res.json({
      success: true,
      data: {
        products: paged,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: rowsWithFeatured.length,
          pages: Math.max(1, Math.ceil(rowsWithFeatured.length / pagination.limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const payload = adminProductCreateSchema.parse(req.body);
    const resolvedPrice = Number(payload.price ?? payload.basePrice ?? payload.sellerPrice);
    if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'price/basePrice is required and must be greater than 0.',
      });
    }
    const normalizedImages = Array.from(
      new Set(
        [
          ...(Array.isArray(payload.images) ? payload.images : []),
          payload.image || '',
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    const imagePolicy = getImagePolicyForProductType(payload.type);
    if (normalizedImages.length < imagePolicy.min || normalizedImages.length > imagePolicy.max) {
      return res.status(400).json({
        success: false,
        message: `${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`,
      });
    }
    if (payload.type === ProductType.FABRIC) {
      if (!payload.sellerId || !payload.materialTypeId) {
        return res.status(400).json({ success: false, message: 'sellerId and materialTypeId are required for fabric.' });
      }
      const created = await prisma.fabric.create({
        data: {
          sellerId: payload.sellerId,
          materialTypeId: payload.materialTypeId,
          name: payload.name.trim(),
          description: payload.description.trim(),
          sellerPrice: resolvedPrice,
          finalPrice: resolvedPrice,
          minYards: payload.minYards ?? 1,
          stockYards: payload.stockYards ?? 0,
          status: payload.status ?? ProductStatus.DRAFT,
          isAvailable: payload.isAvailable ?? true,
          images: normalizedImages.length > 0
            ? {
                create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
              }
            : undefined,
        },
      });
      return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
    }

    if (payload.type === ProductType.DESIGN) {
      if (!payload.designerId || !payload.categoryId) {
        return res.status(400).json({ success: false, message: 'designerId and categoryId are required for design.' });
      }
      const created = await prisma.design.create({
        data: {
          designerId: payload.designerId,
          categoryId: payload.categoryId,
          materialTypeId: payload.materialTypeId || null,
          name: payload.name.trim(),
          description: payload.description.trim(),
          basePrice: resolvedPrice,
          finalPrice: resolvedPrice,
          status: payload.status ?? ProductStatus.DRAFT,
          isAvailable: payload.isAvailable ?? true,
          images: normalizedImages.length > 0
            ? {
                create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
              }
            : undefined,
        },
      });
      return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
    }

    if (!payload.designerId || !payload.categoryId) {
      return res.status(400).json({ success: false, message: 'designerId and categoryId are required for ready-to-wear.' });
    }
    const normalizedVariants =
      Array.isArray(payload.variants) && payload.variants.length > 0
        ? payload.variants.map((entry) => ({
            size: normalizeReadyToWearSize(entry.size),
            color: normalizeReadyToWearColor(entry.color),
            price: Number(entry.price || 0),
            stock: Number(entry.stock || 0),
            variantKey: encodeReadyToWearVariantKey(entry.size, entry.color),
          }))
        : [
            {
              size: normalizeReadyToWearSize(payload.size || 'M'),
              color: DEFAULT_READY_TO_WEAR_COLOR,
              price: resolvedPrice,
              stock: Number(payload.stock ?? 0),
              variantKey: encodeReadyToWearVariantKey(payload.size || 'M', DEFAULT_READY_TO_WEAR_COLOR),
            },
          ];
    if (new Set(normalizedVariants.map((entry) => entry.variantKey)).size !== normalizedVariants.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate ready-to-wear size + color variants are not allowed.',
      });
    }
    const created = await prisma.readyToWear.create({
      data: {
        designerId: payload.designerId,
        categoryId: payload.categoryId,
        name: payload.name.trim(),
        description: payload.description.trim(),
        basePrice: resolvedPrice,
        status: payload.status ?? ProductStatus.DRAFT,
        isAvailable: payload.isAvailable ?? true,
        images: normalizedImages.length > 0
          ? {
              create: normalizedImages.map((url, index) => ({ url, sortOrder: index })),
            }
          : undefined,
        sizeVariations: {
          create: normalizedVariants.map((entry) => ({
            size: entry.variantKey,
            price: entry.price > 0 ? entry.price : resolvedPrice,
            stock: entry.stock,
          })),
        },
      },
    });
    return res.status(201).json({ success: true, data: { id: created.id, type: payload.type }, message: 'Product created.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:type/:id', async (req, res, next) => {
  try {
    const type = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const payload = adminProductUpdateSchema.parse(req.body);
    const resolvedPrice = payload.price ?? payload.basePrice ?? payload.sellerPrice;
    const hasImagesPayload =
      Array.isArray(payload.images) || (typeof payload.image === 'string' && String(payload.image).trim().length > 0);
    const normalizedImages = Array.from(
      new Set(
        [
          ...(Array.isArray(payload.images) ? payload.images : []),
          payload.image || '',
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    if (hasImagesPayload) {
      const imagePolicy = getImagePolicyForProductType(type);
      if (normalizedImages.length < imagePolicy.min || normalizedImages.length > imagePolicy.max) {
        return res.status(400).json({
          success: false,
          message: `${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`,
        });
      }
    }
    if (type === ProductType.FABRIC) {
      const updated = await prisma.fabric.update({
        where: { id: req.params.id },
        data: {
          name: payload.name?.trim(),
          description: payload.description?.trim(),
          materialTypeId: payload.materialTypeId,
          sellerPrice: resolvedPrice,
          finalPrice: resolvedPrice,
          minYards: payload.minYards,
          stockYards: payload.stockYards,
          status: payload.status,
          isAvailable: payload.isAvailable,
        },
      });
      if (hasImagesPayload) {
        await prisma.fabricImage.deleteMany({ where: { fabricId: updated.id } });
        if (normalizedImages.length > 0) {
          await prisma.fabricImage.createMany({
            data: normalizedImages.map((url, index) => ({
              fabricId: updated.id,
              url,
              sortOrder: index,
            })),
          });
        }
      }
      return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
    }

    if (type === ProductType.DESIGN) {
      const updated = await prisma.design.update({
        where: { id: req.params.id },
        data: {
          name: payload.name?.trim(),
          description: payload.description?.trim(),
          categoryId: payload.categoryId,
          materialTypeId: payload.materialTypeId || null,
          basePrice: resolvedPrice,
          finalPrice: resolvedPrice,
          status: payload.status,
          isAvailable: payload.isAvailable,
        },
      });
      if (hasImagesPayload) {
        await prisma.designImage.deleteMany({ where: { designId: updated.id } });
        if (normalizedImages.length > 0) {
          await prisma.designImage.createMany({
            data: normalizedImages.map((url, index) => ({
              designId: updated.id,
              url,
              sortOrder: index,
            })),
          });
        }
      }
      return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
    }

    const updated = await prisma.readyToWear.update({
      where: { id: req.params.id },
      data: {
        name: payload.name?.trim(),
        description: payload.description?.trim(),
        categoryId: payload.categoryId,
        basePrice: resolvedPrice,
        status: payload.status,
        isAvailable: payload.isAvailable,
      },
    });
    if (hasImagesPayload) {
      await prisma.readyToWearImage.deleteMany({ where: { readyToWearId: updated.id } });
      if (normalizedImages.length > 0) {
        await prisma.readyToWearImage.createMany({
          data: normalizedImages.map((url, index) => ({
            readyToWearId: updated.id,
            url,
            sortOrder: index,
          })),
        });
      }
    }
    if (Array.isArray(payload.variants)) {
      if (payload.variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Ready-to-wear variants cannot be empty.',
        });
      }
      const normalizedVariants = payload.variants.map((entry) => ({
        size: normalizeReadyToWearSize(entry.size),
        color: normalizeReadyToWearColor(entry.color),
        price: Number(entry.price || 0),
        stock: Number(entry.stock || 0),
        variantKey: encodeReadyToWearVariantKey(entry.size, entry.color),
      }));
      if (new Set(normalizedVariants.map((entry) => entry.variantKey)).size !== normalizedVariants.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate ready-to-wear size + color variants are not allowed.',
        });
      }
      await prisma.readyToWearSize.deleteMany({ where: { readyToWearId: updated.id } });
      if (normalizedVariants.length > 0) {
        await prisma.readyToWearSize.createMany({
          data: normalizedVariants.map((entry) => ({
            readyToWearId: updated.id,
            size: entry.variantKey,
            price: entry.price > 0 ? entry.price : Number(resolvedPrice || 0),
            stock: entry.stock,
          })),
        });
      }
    } else {
      // Keep base-price edits in sync with all variants when a variant matrix is not explicitly provided.
      if (resolvedPrice !== undefined) {
        await prisma.readyToWearSize.updateMany({
          where: { readyToWearId: updated.id },
          data: { price: Number(resolvedPrice) },
        });
      }
      if (payload.stock !== undefined) {
        const existingSizes = await prisma.readyToWearSize.findMany({
          where: { readyToWearId: updated.id },
          select: { id: true },
          take: 2,
        });
        if (existingSizes.length === 1) {
          await prisma.readyToWearSize.update({
            where: { id: existingSizes[0].id },
            data: { stock: payload.stock },
          });
        }
      }
      const remainingVariantCount = await prisma.readyToWearSize.count({
        where: { readyToWearId: updated.id },
      });
      if (remainingVariantCount === 0 && resolvedPrice !== undefined) {
        await prisma.readyToWearSize.create({
          data: {
            readyToWearId: updated.id,
            size: encodeReadyToWearVariantKey('M', DEFAULT_READY_TO_WEAR_COLOR),
            price: Number(resolvedPrice),
            stock: Number.isFinite(Number(payload.stock)) ? Math.max(0, Math.floor(Number(payload.stock))) : 0,
          },
        });
      }
    }
    return res.json({ success: true, data: { id: updated.id, type }, message: 'Product updated.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:type/:id/moderate', async (req, res, next) => {
  try {
    const productType = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const { id } = req.params;
    const payload = productModerationSchema.parse(req.body);

    let exists = false;
    if (productType === ProductType.FABRIC) {
      exists = (await prisma.fabric.count({ where: { id } })) > 0;
    } else if (productType === ProductType.DESIGN) {
      exists = (await prisma.design.count({ where: { id } })) > 0;
    } else {
      exists = (await prisma.readyToWear.count({ where: { id } })) > 0;
    }

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    let nextStatus: ProductStatus | undefined;
    let nextAvailability: boolean | undefined;
    switch (payload.action) {
      case 'APPROVE':
      case 'PUBLISH':
        nextStatus = ProductStatus.APPROVED;
        nextAvailability = true;
        break;
      case 'REJECT':
        nextStatus = ProductStatus.REJECTED;
        nextAvailability = false;
        break;
      case 'REQUEST_CHANGES':
        nextStatus = ProductStatus.PENDING_REVIEW;
        nextAvailability = false;
        break;
      case 'SUSPEND':
        nextStatus = ProductStatus.ARCHIVED;
        nextAvailability = false;
        break;
      case 'UNPUBLISH':
        nextAvailability = false;
        break;
    }

    const updateData: { status?: ProductStatus; isAvailable?: boolean } = {};
    if (nextStatus) updateData.status = nextStatus;
    if (typeof nextAvailability === 'boolean') updateData.isAvailable = nextAvailability;

    if (productType === ProductType.FABRIC) {
      await prisma.fabric.update({
        where: { id },
        data: updateData,
      });
    } else if (productType === ProductType.DESIGN) {
      await prisma.design.update({
        where: { id },
        data: updateData,
      });
    } else {
      await prisma.readyToWear.update({
        where: { id },
        data: updateData,
      });
    }

    if (payload.action !== 'APPROVE' && payload.action !== 'PUBLISH') {
      await prisma.featuredProduct.deleteMany({
        where: { productId: id, productType },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADMIN_PRODUCT_MODERATE',
        details: {
          productId: id,
          productType,
          action: payload.action,
          message: payload.message || null,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Product moderation action applied.',
      data: {
        productId: id,
        productType,
        action: payload.action,
        status: nextStatus,
        isAvailable: nextAvailability,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/products/moderate-bulk', async (req, res, next) => {
  try {
    const payload = bulkModerationSchema.parse(req.body);
    let nextStatus: ProductStatus | undefined;
    let nextAvailability: boolean | undefined;

    switch (payload.action) {
      case 'APPROVE':
      case 'PUBLISH':
        nextStatus = ProductStatus.APPROVED;
        nextAvailability = true;
        break;
      case 'REJECT':
        nextStatus = ProductStatus.REJECTED;
        nextAvailability = false;
        break;
      case 'REQUEST_CHANGES':
        nextStatus = ProductStatus.PENDING_REVIEW;
        nextAvailability = false;
        break;
      case 'SUSPEND':
        nextStatus = ProductStatus.ARCHIVED;
        nextAvailability = false;
        break;
      case 'UNPUBLISH':
        nextAvailability = false;
        break;
    }

    const updateData: { status?: ProductStatus; isAvailable?: boolean } = {};
    if (nextStatus) updateData.status = nextStatus;
    if (typeof nextAvailability === 'boolean') updateData.isAvailable = nextAvailability;

    if (payload.productType === ProductType.FABRIC) {
      await prisma.fabric.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    } else if (payload.productType === ProductType.DESIGN) {
      await prisma.design.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    } else {
      await prisma.readyToWear.updateMany({
        where: { id: { in: payload.productIds } },
        data: updateData,
      });
    }

    if (payload.action !== 'APPROVE' && payload.action !== 'PUBLISH') {
      await prisma.featuredProduct.deleteMany({
        where: { productType: payload.productType, productId: { in: payload.productIds } },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADMIN_PRODUCT_MODERATE_BULK',
        details: {
          productType: payload.productType,
          productIds: payload.productIds,
          action: payload.action,
          message: payload.message || null,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Bulk moderation action applied.',
      data: { affected: payload.productIds.length },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/products/:type/:id/featured', async (req, res, next) => {
  try {
    const productType = adminProductTypeSchema.parse(String(req.params.type || '').toUpperCase());
    const { id } = req.params;
    const payload = productFeaturedSchema.parse(req.body);

    let exists = false;
    if (productType === ProductType.FABRIC) {
      exists = (await prisma.fabric.count({ where: { id } })) > 0;
    } else if (productType === ProductType.DESIGN) {
      exists = (await prisma.design.count({ where: { id } })) > 0;
    } else {
      exists = (await prisma.readyToWear.count({ where: { id } })) > 0;
    }

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    if (payload.isFeatured) {
      const section = payload.section || getDefaultFeaturedSectionForType(productType);
      try {
        // Avoid strict upsert ON CONFLICT requirement so deployments missing the
        // composite unique index can still toggle featured records.
        const existing = await prisma.featuredProduct.findFirst({
          where: {
            productId: id,
            productType,
            section,
          },
          select: { id: true },
        });
        const featured = existing
          ? await prisma.featuredProduct.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                displayOrder: payload.displayOrder ?? 0,
              },
            })
          : await prisma.featuredProduct.create({
              data: {
                productId: id,
                productType,
                section,
                displayOrder: payload.displayOrder ?? 0,
                isActive: true,
              },
            });

        return res.json({
          success: true,
          message: 'Product marked as featured.',
          data: featured,
        });
      } catch (featuredError) {
        console.warn('[admin/products/featured] Prisma featured write failed, trying SQL fallback:', featuredError);
        try {
          const nextDisplayOrder = payload.displayOrder ?? 0;
          const updated = await prisma.$executeRawUnsafe(
            `UPDATE "FeaturedProduct"
             SET "isActive" = TRUE,
                 "displayOrder" = $1,
                 "updatedAt" = NOW()
             WHERE "productId" = $2
               AND "productType" = $3
               AND "section" = $4`,
            nextDisplayOrder,
            id,
            String(productType),
            section
          );
          if (Number(updated || 0) === 0) {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "FeaturedProduct"
                ("id", "productId", "productType", "section", "displayOrder", "isActive", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())`,
              randomUUID(),
              id,
              String(productType),
              section,
              nextDisplayOrder
            );
          }
          return res.json({
            success: true,
            message: 'Product marked as featured.',
            data: {
              productId: id,
              productType,
              section,
              isFeatured: true,
              displayOrder: nextDisplayOrder,
            },
          });
        } catch (fallbackError) {
          console.error('[admin/products/featured] SQL featured write fallback failed:', fallbackError);
          return res.status(503).json({
            success: false,
            message: 'Featured settings are unavailable on this deployment. Please run latest API database migrations.',
            data: {
              productId: id,
              productType,
              section,
              isFeatured: false,
              warning: isSchemaDriftError(fallbackError)
                ? 'FEATURED_SETTINGS_UNAVAILABLE'
                : 'FEATURED_SETTINGS_WRITE_FAILED',
            },
          });
        }
      }
    }

    try {
      await prisma.featuredProduct.deleteMany({
        where: {
          productId: id,
          productType,
          ...(payload.section ? { section: payload.section } : {}),
        },
      });
    } catch (featuredError) {
      console.warn('[admin/products/featured] Prisma featured delete failed, trying SQL fallback:', featuredError);
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "FeaturedProduct"
           WHERE "productId" = $1
             AND "productType" = $2
             ${payload.section ? `AND "section" = $3` : ''}`,
          ...(payload.section
            ? [id, String(productType), String(payload.section)]
            : [id, String(productType)])
        );
      } catch (fallbackError) {
        console.error('[admin/products/featured] SQL featured delete fallback failed:', fallbackError);
        return res.status(503).json({
          success: false,
          message: 'Featured settings are unavailable on this deployment. Please run latest API database migrations.',
          data: {
            productId: id,
            productType,
            isFeatured: false,
            warning: isSchemaDriftError(fallbackError)
              ? 'FEATURED_SETTINGS_UNAVAILABLE'
              : 'FEATURED_SETTINGS_WRITE_FAILED',
          },
        });
      }
    }

    return res.json({
      success: true,
      message: 'Product removed from featured list.',
    });
  } catch (error) {
    return next(error);
  }
});

// ==================== PRODUCT CATEGORIES ====================

// Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// Create category
router.post('/categories', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
      sortOrder: z.number().default(0),
    });

    const data = schema.parse(req.body);

    const category = await prisma.productCategory.create({
      data,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

// Update category
router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, sortOrder } = req.body;

    const category = await prisma.productCategory.update({
      where: { id },
      data: { name, description, isActive, sortOrder },
    });

    res.json({
      success: true,
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

// Delete category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.productCategory.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== MATERIAL TYPES ====================

// Get all material types
router.get('/materials', async (req, res, next) => {
  try {
    const materials = await prisma.materialType.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

// Create material type
router.post('/materials', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const material = await prisma.materialType.create({
      data,
    });

    res.status(201).json({
      success: true,
      message: 'Material type created successfully.',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// Update material type
router.patch('/materials/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const material = await prisma.materialType.update({
      where: { id },
      data: { name, description, isActive },
    });

    res.json({
      success: true,
      message: 'Material type updated successfully.',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// Delete material type
router.delete('/materials/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.materialType.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Material type deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PRICING RULES ====================

// Get all pricing rules
router.get('/pricing-rules', async (req, res, next) => {
  try {
    const rules = await prisma.pricingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

// Create pricing rule
router.post('/pricing-rules', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      ruleType: z.enum(['GLOBAL_MARKUP', 'CATEGORY_MARKUP', 'COUNTRY_MARKUP', 'DATE_BASED']),
      productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']).optional(),
      country: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      isSale: z.boolean().default(false),
      adjustmentType: z.enum(['PERCENTAGE_MARKUP', 'PERCENTAGE_DISCOUNT', 'FIXED_MARKUP', 'FIXED_DISCOUNT']),
      value: z.number().positive(),
      priority: z.number().default(0),
    });

    const data = schema.parse(req.body);

    const rule = await prisma.pricingRule.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        createdById: req.user!.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Pricing rule created successfully.',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

// Update pricing rule
router.patch('/pricing-rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const rule = await prisma.pricingRule.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Pricing rule updated successfully.',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

// Delete pricing rule
router.delete('/pricing-rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.pricingRule.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Pricing rule deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ORDERS ====================

// Get all orders
router.get('/orders', async (req, res, next) => {
  try {
    await autoCloseOverdueDeliveredOrders(req.user?.id);
    const { status, page, limit } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const pagination = parsePagination(page, limit, 20);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
          designOrder: {
            include: {
              design: {
                select: { name: true },
              },
            },
          },
          fabricOrder: {
            include: {
              fabric: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Assign QA to order
router.patch('/orders/:id/assign-qa', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      qaId: z.string().uuid(),
    });
    const { qaId } = schema.parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { qaId },
      include: {
        qa: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    res.json({
      success: true,
      message: 'QA assigned successfully.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// Homepage top strip compatibility aliases
router.get('/top-strip', async (_req, res) => {
  try {
    const { settings } = await readAdminTopStripSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top strip settings.' });
  }
});

router.put('/top-strip', async (req, res) => {
  try {
    const settings = await saveAdminTopStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update top strip settings.' });
  }
});

router.patch('/top-strip', async (req, res) => {
  try {
    const settings = await saveAdminTopStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update top strip settings.' });
  }
});

router.get('/stats-strip', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminStatsStripSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats strip settings.' });
  }
});

router.put('/stats-strip', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminStatsStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update stats strip settings.' });
  }
});

router.patch('/stats-strip', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminStatsStripSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update stats strip settings.' });
  }
});

router.get('/how-it-works-style', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminHowItWorksStyleSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch how it works style settings.' });
  }
});

router.put('/how-it-works-style', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminHowItWorksStyleSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update how it works style settings.' });
  }
});

router.patch('/how-it-works-style', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminHowItWorksStyleSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update how it works style settings.' });
  }
});

router.get('/country-image-generation', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminCountryImageGenerationSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin country image generation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch country image generation settings.' });
  }
});

router.put('/country-image-generation', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminCountryImageGenerationSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin country image generation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update country image generation settings.' });
  }
});

router.patch('/country-image-generation', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminCountryImageGenerationSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin country image generation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update country image generation settings.' });
  }
});

router.get('/featured-product-description-settings', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readAdminFeaturedProductDescriptionSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching featured product description settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured product description settings.' });
  }
});

router.put('/featured-product-description-settings', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminFeaturedProductDescriptionSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating featured product description settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update featured product description settings.' });
  }
});

router.patch('/featured-product-description-settings', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveAdminFeaturedProductDescriptionSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating featured product description settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update featured product description settings.' });
  }
});

router.get('/blogs', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await ensureBlogPostTable();
    const search = String(req.query.search || '').trim().toLowerCase();
    const audienceType = String(req.query.audienceType || '').trim().toUpperCase();
    const status = String(req.query.status || '').trim().toUpperCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdAt","updatedAt"
       FROM "BlogPost"
       ORDER BY "updatedAt" DESC`
    );
    const filtered = (rows || []).filter((row) => {
      const matchesSearch =
        !search ||
        String(row.title || '').toLowerCase().includes(search) ||
        String(row.slug || '').toLowerCase().includes(search) ||
        String(row.excerpt || '').toLowerCase().includes(search);
      const matchesAudience = !audienceType || String(row.audienceType || '').toUpperCase() === audienceType;
      const matchesStatus =
        !status ||
        (status === 'PUBLISHED' && Boolean(row.isPublished)) ||
        (status === 'DRAFT' && !Boolean(row.isPublished));
      return matchesSearch && matchesAudience && matchesStatus;
    });
    res.json({
      success: true,
      data: filtered.map((row) => ({
        ...row,
        audienceType: normalizeBlogAudienceType(row.audienceType),
        link: toStoryLink(String(row.slug || '')),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin blogs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs.' });
  }
});

router.get('/blogs/options', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await ensureBlogPostTable();
    const audienceType = String(req.query.audienceType || '').trim().toUpperCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","audienceType","isPublished","updatedAt"
       FROM "BlogPost"
       WHERE "isPublished" = true
       ORDER BY "updatedAt" DESC`
    );
    const filtered = (rows || []).filter((row) =>
      audienceType ? String(row.audienceType || '').toUpperCase() === audienceType : true
    );
    res.json({
      success: true,
      data: filtered.map((row) => ({
        id: String(row.id),
        title: String(row.title || ''),
        slug: String(row.slug || ''),
        audienceType: normalizeBlogAudienceType(row.audienceType),
        link: toStoryLink(String(row.slug || '')),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin blog options:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog options.' });
  }
});

router.post('/blogs', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await ensureBlogPostTable();
    const parsed = adminBlogCreateSchema.parse(req.body);
    const slug = await generateUniqueBlogSlug(parsed.title, parsed.slug);
    const now = new Date();
    const actorId = String((req as any)?.user?.id || '').trim() || null;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "BlogPost" ("id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdBy","updatedBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      randomUUID(),
      parsed.title.trim(),
      slug,
      parsed.excerpt?.trim() || null,
      parsed.content.trim(),
      normalizeBlogAudienceType(parsed.audienceType),
      parsed.targetName?.trim() || null,
      parsed.targetEntityId?.trim() || null,
      parsed.coverImage?.trim() || null,
      Boolean(parsed.isPublished),
      parsed.isPublished ? now : null,
      actorId,
      actorId
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdAt","updatedAt"
       FROM "BlogPost" WHERE "slug" = $1 LIMIT 1`,
      slug
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.status(201).json({
      success: true,
      data: row
        ? {
            ...row,
            audienceType: normalizeBlogAudienceType(row.audienceType),
            link: toStoryLink(String(row.slug || '')),
          }
        : null,
      message: 'Blog created.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error creating admin blog:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog.' });
  }
});

router.put('/blogs/:id', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await ensureBlogPostTable();
    const parsed = adminBlogUpdateSchema.parse(req.body);
    const id = String(req.params.id || '').trim();
    const existingRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","isPublished" FROM "BlogPost" WHERE "id" = $1 LIMIT 1`,
      id
    );
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }
    const nextTitle = parsed.title?.trim() || String(existing.title || '');
    const nextSlug = parsed.slug ? await generateUniqueBlogSlug(nextTitle, parsed.slug, id) : String(existing.slug || '');
    const nextPublished = typeof parsed.isPublished === 'boolean' ? parsed.isPublished : Boolean(existing.isPublished);
    const actorId = String((req as any)?.user?.id || '').trim() || null;
    const publishedAt =
      typeof parsed.isPublished === 'boolean'
        ? parsed.isPublished
          ? new Date()
          : null
        : undefined;
    await prisma.$executeRawUnsafe(
      `UPDATE "BlogPost"
       SET "title" = $1,
           "slug" = $2,
           "excerpt" = COALESCE($3, "excerpt"),
           "content" = COALESCE($4, "content"),
           "audienceType" = COALESCE($5, "audienceType"),
           "targetName" = COALESCE($6, "targetName"),
           "targetEntityId" = COALESCE($7, "targetEntityId"),
           "coverImage" = COALESCE($8, "coverImage"),
           "isPublished" = $9,
           "publishedAt" = COALESCE($10, "publishedAt"),
           "updatedBy" = $11,
           "updatedAt" = NOW()
       WHERE "id" = $12`,
      nextTitle,
      nextSlug,
      parsed.excerpt !== undefined ? parsed.excerpt?.trim() || null : null,
      parsed.content !== undefined ? parsed.content.trim() : null,
      parsed.audienceType !== undefined ? normalizeBlogAudienceType(parsed.audienceType) : null,
      parsed.targetName !== undefined ? parsed.targetName?.trim() || null : null,
      parsed.targetEntityId !== undefined ? parsed.targetEntityId?.trim() || null : null,
      parsed.coverImage !== undefined ? parsed.coverImage?.trim() || null : null,
      nextPublished,
      publishedAt === undefined ? null : publishedAt,
      actorId,
      id
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdAt","updatedAt"
       FROM "BlogPost" WHERE "id" = $1 LIMIT 1`,
      id
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.json({
      success: true,
      data: row
        ? {
            ...row,
            audienceType: normalizeBlogAudienceType(row.audienceType),
            link: toStoryLink(String(row.slug || '')),
          }
        : null,
      message: 'Blog updated.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating admin blog:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog.' });
  }
});

router.delete('/blogs/:id', authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await ensureBlogPostTable();
    await prisma.$executeRawUnsafe(`DELETE FROM "BlogPost" WHERE "id" = $1`, String(req.params.id || ''));
    res.json({ success: true, message: 'Blog deleted.' });
  } catch (error) {
    console.error('Error deleting admin blog:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog.' });
  }
});

export default router;
