import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma, UserRole, ProductStatus, ProductType } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  convertLocalToUsd,
  getAllowedCurrenciesForVendor,
  getCurrencyState,
  getProductCurrencyMetadata,
  getUsdPerUnit,
  setProductCurrencyMetadata,
} from '../utils/currency';
import { readTryOnInsights } from '../utils/try-on-insights';
import { readTryOnSettings } from '../utils/try-on-settings';
import { readVendorDashboardGovernanceSettings } from '../utils/vendor-dashboard-governance';
import { readFabricPredominantColorMap, writeFabricPredominantColor } from '../utils/fabric-attributes';
import { applyActivePricingRules, readActivePricingRules } from '../utils/pricing-rules';
import {
  getAllowedFieldsForApprovedProduct,
  getFieldKeysForProductType,
  readActiveProductEditGrant,
  readActiveProductEditGrantsForProducts,
  readProductEditPolicySettings,
} from '../utils/product-change-requests';
import { syncFabricAvailabilityById } from '../utils/product-stock-monitor';
import {
  clearProductAutomationOutcome,
  evaluateProductAutomationChecks,
  notifyVendorAboutProductAutomationFailure,
  readProductAutomationOutcomesForProducts,
  readAutomationApprovalSettings,
  saveProductAutomationOutcome,
} from '../utils/automation-approval';

const router = Router();
let sellerGovernanceSchemaEnsured = false;
const executeBestEffort = async (sql: string) => {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // Keep compatibility with restricted deployments.
  }
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

router.use(authenticate);
router.use(authorizePermissions(Permissions.SELLER_ACCESS));

async function resolveSellerProfile(userId: string) {
  const existing = await prisma.fabricSellerProfile.findFirst({
    where: { userId },
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  if (!user) return null;

  return prisma.fabricSellerProfile.create({
    data: {
      userId,
      businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      businessEmail: user.email,
      businessPhone: user.phone || 'N/A',
      country: 'Not specified',
      city: 'Not specified',
      address: 'Not specified',
      isVerified: false,
    },
  });
}

async function ensureSellerGovernanceSchema() {
  if (sellerGovernanceSchemaEnsured) return;
  await executeBestEffort(
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileField_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role","userId")`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "createdById" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "updatedById" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileField" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `UPDATE "VendorProfileField" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionType" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionReasonCode" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "rejectionReasonLabel" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "profileReviewMessage" TEXT`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "permanentRejectionAt" TIMESTAMP(3)`
  );
  await executeBestEffort(
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "permanentDisableAt" TIMESTAMP(3)`
  );
  await executeBestEffort(
    `UPDATE "VendorProfileSubmission" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileField_role_key_key" ON "VendorProfileField"("role","key")`
  );
  await executeBestEffort(
    `CREATE INDEX IF NOT EXISTS "VendorProfileField_role_sortOrder_idx" ON "VendorProfileField"("role","sortOrder")`
  );
  sellerGovernanceSchemaEnsured = true;
}

type VendorProfileStatus = 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type VendorRejectionType = 'TEMPORARY' | 'PERMANENT';

const normalizeVendorProfileStatus = (value: unknown): VendorProfileStatus => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOMPLETE' || normalized === 'SUBMITTED' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'INCOMPLETE';
};
const normalizeVendorRejectionType = (value: unknown): VendorRejectionType | null => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'TEMPORARY' || normalized === 'PERMANENT') return normalized;
  return null;
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const normalizeCurrencyCode = (value: unknown) => String(value || '').trim().toUpperCase();

async function resolveSellerListingPrice(params: {
  userId: string;
  country: string;
  localPriceInput: number;
  requestedCurrencyCode?: string;
}) {
  const { matrix, rules } = await getCurrencyState();
  const { defaultCurrency, allowedCurrencies } = getAllowedCurrenciesForVendor({
    role: UserRole.FABRIC_SELLER,
    userId: params.userId,
    country: params.country,
    matrix,
    rules,
    includeUsdFallback: false,
  });
  const requested = normalizeCurrencyCode(params.requestedCurrencyCode);
  const selectedCurrency =
    requested && allowedCurrencies.includes(requested) ? requested : defaultCurrency;
  const localPrice = Number(params.localPriceInput || 0);
  const usdPrice = convertLocalToUsd(localPrice, selectedCurrency, matrix);
  return {
    selectedCurrency,
    localPrice,
    usdPrice,
    usdPerUnit: getUsdPerUnit(selectedCurrency, matrix) || 1,
    defaultCurrency,
    allowedCurrencies,
  };
}

const normalizeFieldKey = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const PROFILE_FIELD_ALIASES = {
  businessName: ['businessname', 'brandname', 'companyname'],
  businessEmail: ['businessemail', 'brandemail', 'companyemail', 'email'],
  businessPhone: ['businessphone', 'brandphone', 'companyphone', 'phone', 'phonenumber'],
  country: ['country'],
  city: ['city', 'town'],
  address: ['address', 'streetaddress'],
} as const;

const getProfileDataObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const isEmptyProfileValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value ?? '').trim().length === 0;
};

const findKeyByAlias = (keys: string[], aliases: readonly string[]) => {
  const aliasSet = new Set(aliases.map((item) => normalizeFieldKey(item)));
  return keys.find((key) => aliasSet.has(normalizeFieldKey(key)));
};

const readAliasValue = (profileData: Record<string, unknown>, aliases: readonly string[]) => {
  const key = findKeyByAlias(Object.keys(profileData), aliases);
  if (!key) return undefined;
  return profileData[key];
};

const writeAliasValue = (
  profileData: Record<string, unknown>,
  aliases: readonly string[],
  value: unknown,
  fieldKeys: string[]
) => {
  const existingKey = findKeyByAlias(Object.keys(profileData), aliases);
  if (existingKey) {
    profileData[existingKey] = value;
    return;
  }
  const configuredKey = findKeyByAlias(fieldKeys, aliases);
  if (configuredKey) {
    profileData[configuredKey] = value;
    return;
  }
  profileData[aliases[0]] = value;
};

async function readSellerSubmission(userId: string) {
  try {
    await ensureSellerGovernanceSchema();
    const columns = await readTableColumns('VendorProfileSubmission');
    if (!columns.has('id') || !columns.has('role') || !columns.has('userid')) return null;
    const selectParts = [
      `"id"`,
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
    ];
    const orderBy = columns.has('updatedat') ? `"updatedAt" DESC` : columns.has('profilesubmittedat') ? `"profileSubmittedAt" DESC` : `"id" ASC`;
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT ${selectParts.join(', ')}
       FROM "VendorProfileSubmission"
       WHERE "role" = 'FABRIC_SELLER' AND "userId" = $1
       ORDER BY ${orderBy}
       LIMIT 1`,
      userId
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function readSellerProfileFields() {
  try {
    await ensureSellerGovernanceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
       FROM "VendorProfileField"
       ORDER BY "sortOrder" ASC, "key" ASC`
    );
    const normalizeRoleToken = (value: unknown) =>
      String(value || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const allowedRoles = new Set(['FABRICSELLER', 'SELLER']);
    const sourceRows = rows.filter((row) => allowedRoles.has(normalizeRoleToken(row.role)));
    const mapped = sourceRows.map((row) => ({
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
    return mapped;
  } catch {
    return [];
  }
}

async function getSellerProfileCompletion(userId: string) {
  const profile = await resolveSellerProfile(userId);
  if (!profile) return null;

  const [submission, fields] = await Promise.all([readSellerSubmission(userId), readSellerProfileFields()]);
  const fieldKeys = (fields || []).map((field: any) => String(field?.key || '')).filter(Boolean);
  const profileData = {
    ...getProfileDataObject(submission?.profileData),
  };
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.businessName, profile.businessName || '', fieldKeys);
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.businessEmail, profile.businessEmail || '', fieldKeys);
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.businessPhone, profile.businessPhone || '', fieldKeys);
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.country, profile.country || '', fieldKeys);
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.city, profile.city || '', fieldKeys);
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.address, profile.address || '', fieldKeys);
  const status = submission
    ? normalizeVendorProfileStatus(submission.profileStatus)
    : 'INCOMPLETE';
  const rejectionType = normalizeVendorRejectionType(submission?.rejectionType);
  const canUpload = status === 'APPROVED';
  const canResubmitProfile = status !== 'REJECTED' || rejectionType !== 'PERMANENT';
  const canOperateAccount = status === 'APPROVED';
  const brandSlug = slugify(profile.businessName || '');
  const storefrontPath = `/store/seller/${encodeURIComponent(profile.id)}/${encodeURIComponent(brandSlug || 'store')}`;

  return {
    role: 'FABRIC_SELLER',
    canUpload,
    canResubmitProfile,
    canOperateAccount,
    profileStatus: status,
    profile: {
      id: profile.id,
      businessName: profile.businessName,
      businessEmail: profile.businessEmail,
      businessPhone: profile.businessPhone,
      country: profile.country,
      city: profile.city,
      address: profile.address,
      isVerified: profile.isVerified,
      storefrontPath,
      storefrontSlug: brandSlug,
    },
    profileData,
    profileSubmittedAt: submission?.profileSubmittedAt || null,
    profileReviewedAt: submission?.profileReviewedAt || null,
    profileReviewNotes: submission?.profileReviewNotes || null,
    rejectionType,
    rejectionReasonCode: submission?.rejectionReasonCode || null,
    rejectionReasonLabel: submission?.rejectionReasonLabel || null,
    profileReviewMessage: submission?.profileReviewMessage || null,
    permanentRejectionAt: submission?.permanentRejectionAt || null,
    permanentDisableAt: submission?.permanentDisableAt || null,
    fields,
  };
}

async function assertSellerCanManageCatalog(userId: string, action: string) {
  const completion = await getSellerProfileCompletion(userId);
  if (!completion) {
    throw Object.assign(new Error('Seller profile not found.'), { status: 404 });
  }
  if (!completion.canUpload) {
    const guidance =
      completion.profileStatus === 'REJECTED'
        ? completion.rejectionType === 'PERMANENT'
          ? 'Your vendor account was permanently rejected. Please contact the administrator.'
          : 'Your vendor profile was temporarily rejected. Please apply the requested corrections and resubmit your profile.'
        : 'Complete and submit your vendor governance profile for admin approval.';
    throw Object.assign(
      new Error(
        `Profile approval is required before you can ${action}. ${guidance}`
      ),
      { status: 403 }
    );
  }
}

async function assertSellerMutationAllowed(userId: string) {
  const completion = await getSellerProfileCompletion(userId);
  if (!completion || completion.profileStatus !== 'REJECTED') return;
  if (completion.rejectionType === 'PERMANENT') {
    throw Object.assign(
      new Error('Your vendor account is permanently rejected. You cannot perform actions on this dashboard.'),
      { status: 403 }
    );
  }
  throw Object.assign(
    new Error('Your profile is temporarily rejected. Please correct your vendor profile and resubmit for review.'),
    { status: 403 }
  );
}

async function computeFinalFabricPrice(baseSellerPrice: number, sellerCountry: string) {
  const activeRules = await readActivePricingRules();
  return applyActivePricingRules(baseSellerPrice, { productType: 'FABRIC', country: sellerCountry }, activeRules);
}

// Get seller dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const completion = await getSellerProfileCompletion(req.user!.id);
    const profile = completion?.profile;

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const [totalFabrics, totalOrders, pendingOrders, totalRevenue] = await Promise.all([
      prisma.fabric.count({ where: { sellerId: profile.id } }),
      prisma.fabricOrderItem.count({ where: { sellerId: profile.id } }),
      prisma.fabricOrderItem.count({
        where: { sellerId: profile.id, status: 'PENDING' },
      }),
      prisma.fabricOrderItem.aggregate({
        where: { sellerId: profile.id },
        _sum: { totalPrice: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        profile,
        profileCompletion: completion,
        governanceFields: Array.isArray((completion as any)?.fields) ? (completion as any).fields : [],
        profileStatus: completion?.profileStatus || 'INCOMPLETE',
        canUpload: Boolean(completion?.canUpload),
        stats: {
          totalFabrics,
          totalOrders,
          pendingOrders,
          totalRevenue: totalRevenue._sum.totalPrice || 0,
        },
      },
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.get('/dashboard-governance', async (_req, res, next) => {
  try {
    const payload = await readVendorDashboardGovernanceSettings();
    res.json({
      success: true,
      data: payload.settings.seller,
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

const handleGetSellerTryOnInsights = async (req: any, res: any, next: any) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (settingsPayload.settings.applyLocations.sellerDashboard === false) {
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
    const insights = await readTryOnInsights({
      role: 'SELLER',
      userId: req.user?.id,
    });
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
};
router.get('/try-on/insights', handleGetSellerTryOnInsights);
router.get('/tryon/insights', handleGetSellerTryOnInsights);
router.get('/3d-try-on/insights', handleGetSellerTryOnInsights);
router.get('/3d-tryon/insights', handleGetSellerTryOnInsights);

// Get seller fabrics
router.get('/fabrics', async (req, res, next) => {
  try {
    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const fabrics = await prisma.fabric.findMany({
      where: { sellerId: profile.id },
      include: {
        materialType: true,
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    let featuredRows: Array<{ productId: string; section: string }> = [];
    if (fabrics.length > 0) {
      try {
        featuredRows = await prisma.featuredProduct.findMany({
          where: {
            productType: 'FABRIC',
            productId: { in: fabrics.map((item) => item.id) },
            isActive: true,
          },
          select: {
            productId: true,
            section: true,
          },
        });
      } catch (featuredError) {
        console.warn('[seller/fabrics] Skipping featuredProduct lookup:', featuredError);
      }
    }

    const featuredByFabricId = new Map<string, string[]>();
    for (const row of featuredRows) {
      const existing = featuredByFabricId.get(row.productId) || [];
      if (!existing.includes(row.section)) existing.push(row.section);
      featuredByFabricId.set(row.productId, existing);
    }
    const [metadataRows, policy, grantsByFabricId, automationOutcomesByFabricId] = await Promise.all([
      Promise.all(fabrics.map(async (item) => [item.id, await getProductCurrencyMetadata('FABRIC', item.id)] as const)),
      readProductEditPolicySettings(),
      readActiveProductEditGrantsForProducts({
        requesterUserId: req.user!.id,
        requesterRole: 'FABRIC_SELLER',
        productType: 'FABRIC',
        productIds: fabrics.map((item) => item.id),
      }),
      readProductAutomationOutcomesForProducts({
        productType: ProductType.FABRIC as any,
        productIds: fabrics.map((item) => item.id),
      }),
    ]);
    const metadataByFabricId = new Map<string, any>(metadataRows);
    const colorMap = await readFabricPredominantColorMap(fabrics.map((item) => item.id));

    res.json({
      success: true,
      data: fabrics.map((item) => {
        const featuredSections = featuredByFabricId.get(item.id) || [];
        const currencyMeta = metadataByFabricId.get(item.id) || null;
        const status = String(item.status || '').toUpperCase();
        const activeGrant = grantsByFabricId[item.id];
        const approvedEditableFields =
          status === 'APPROVED'
            ? getAllowedFieldsForApprovedProduct({
                role: 'FABRIC_SELLER',
                productType: 'FABRIC',
                policy,
                activeGrant,
              })
            : getFieldKeysForProductType('FABRIC');
        return {
          ...item,
          isFeatured: featuredSections.length > 0,
          featuredSections,
          listingCurrencyCode: String(currencyMeta?.currencyCode || 'USD'),
          listingLocalPrice: Number(currencyMeta?.localPrice || item.sellerPrice || 0),
          listingUsdPrice: Number(currencyMeta?.usdPrice || item.sellerPrice || 0),
          listingExchangeRate: Number(currencyMeta?.exchangeRate || 1),
          predominantColor: colorMap[item.id] || null,
          approvedEditableFields,
          approvedEditAccessEndsAt: activeGrant?.grantEndsAt || null,
          automationOutcome: automationOutcomesByFabricId[item.id] || null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile-completion', async (req, res, next) => {
  try {
    const completion = await getSellerProfileCompletion(req.user!.id);
    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }
    res.json({
      success: true,
      data: completion,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile-fields', async (_req, res, next) => {
  try {
    const fields = await readSellerProfileFields();
    res.json({
      success: true,
      data: {
        role: 'FABRIC_SELLER',
        fields,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.use(async (req, res, next) => {
  try {
    if (!req.user?.id) return next();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (req.path === '/profile-completion' && req.method === 'PATCH') {
      const completion = await getSellerProfileCompletion(req.user.id);
      if (completion?.profileStatus === 'REJECTED' && completion?.rejectionType === 'PERMANENT') {
        return res.status(403).json({
          success: false,
          message: 'Your vendor account is permanently rejected. Please contact the administrator.',
        });
      }
      return next();
    }
    await assertSellerMutationAllowed(req.user.id);
    return next();
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request not allowed.' });
    }
    return next(error);
  }
});

router.patch('/profile-completion', async (req, res, next) => {
  try {
    const payload = z
      .object({
        businessName: z.string().min(2).optional(),
        businessEmail: z.string().email().optional(),
        businessPhone: z.string().min(3).optional(),
        country: z.string().min(2).optional(),
        city: z.string().min(2).optional(),
        address: z.string().min(3).optional(),
        profileData: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])).optional(),
      })
      .parse(req.body);

    const current = await getSellerProfileCompletion(req.user!.id);
    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }
    if (current.profileStatus === 'REJECTED' && current.rejectionType === 'PERMANENT') {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account is permanently rejected. Please contact the administrator.',
      });
    }

    const mergedProfileData: Record<string, unknown> = {
      ...getProfileDataObject(current.profileData),
      ...getProfileDataObject(payload.profileData),
    };
    const fieldKeys = (current.fields || []).map((field: any) => String(field?.key || '')).filter(Boolean);

    const businessName = String(
      payload.businessName ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessName) ??
        current.profile.businessName ??
        ''
    ).trim();
    const businessEmail = String(
      payload.businessEmail ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessEmail) ??
        current.profile.businessEmail ??
        ''
    ).trim();
    const businessPhone = String(
      payload.businessPhone ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessPhone) ??
        current.profile.businessPhone ??
        ''
    ).trim();
    const country = String(
      payload.country ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.country) ??
        current.profile.country ??
        ''
    ).trim();
    const city = String(
      payload.city ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.city) ??
        current.profile.city ??
        ''
    ).trim();
    const address = String(
      payload.address ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.address) ??
        current.profile.address ??
        ''
    ).trim();

    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessName, businessName, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessEmail, businessEmail, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessPhone, businessPhone, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.country, country, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.city, city, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.address, address, fieldKeys);

    const activeFields = (current.fields || []).filter((field: any) => field.isActive !== false);
    const requiredFields = activeFields.filter((field: any) => field.required);
    const missingGovernanceRequired = requiredFields
      .filter((field: any) => isEmptyProfileValue(mergedProfileData[String(field.key)]))
      .map((field: any) => field.label || field.key);

    const hasGovernanceFields = activeFields.length > 0;
    const missingFallbackRequired: string[] = [];
    if (!hasGovernanceFields) {
      if (!businessName) missingFallbackRequired.push('Business name');
      if (!country) missingFallbackRequired.push('Country');
      if (!city) missingFallbackRequired.push('City');
    }
    const missing = [...missingGovernanceRequired, ...missingFallbackRequired];
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete required fields: ${missing.join(', ')}`,
      });
    }

    await prisma.fabricSellerProfile.update({
      where: { id: current.profile.id },
      data: {
        businessName,
        businessEmail: businessEmail || String(current.profile.businessEmail || '').trim() || 'not-provided@example.com',
        businessPhone: businessPhone || String(current.profile.businessPhone || '').trim() || 'N/A',
        country,
        city,
        address,
        isVerified: false,
      },
    });

    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","profileReviewMessage","rejectionType","rejectionReasonCode","rejectionReasonLabel","permanentRejectionAt","permanentDisableAt","updatedAt")
       VALUES ($1,'FABRIC_SELLER',$2,$3,'SUBMITTED',$4::jsonb,$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "businessName" = EXCLUDED."businessName",
         "profileStatus" = EXCLUDED."profileStatus",
         "profileData" = EXCLUDED."profileData",
         "profileSubmittedAt" = EXCLUDED."profileSubmittedAt",
         "profileReviewedAt" = NULL,
         "profileReviewNotes" = NULL,
         "profileReviewMessage" = NULL,
         "rejectionType" = NULL,
         "rejectionReasonCode" = NULL,
         "rejectionReasonLabel" = NULL,
         "permanentRejectionAt" = NULL,
         "permanentDisableAt" = NULL,
         "updatedAt" = NOW()`,
      randomUUID(),
      req.user!.id,
      businessName,
      JSON.stringify(mergedProfileData),
      now
    );

    const completion = await getSellerProfileCompletion(req.user!.id);
    res.json({
      success: true,
      message: 'Profile submitted successfully. Admin review is now required before product uploads.',
      data: completion,
    });
  } catch (error) {
    next(error);
  }
});

// Update fabric stock
router.patch('/fabrics/:id/stock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      stock: z.number().min(0),
    });
    const { stock } = schema.parse(req.body);

    await assertSellerCanManageCatalog(req.user!.id, 'update stock');
    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const fabric = await prisma.fabric.findFirst({
      where: { id, sellerId: profile.id },
      select: { id: true },
    });

    if (!fabric) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }

    const updated = await prisma.fabric.update({
      where: { id },
      data: { stockYards: stock },
    });
    await syncFabricAvailabilityById(id, { notifyVendor: true });

    res.json({
      success: true,
      message: 'Fabric stock updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Create fabric
router.post('/fabrics', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(10),
      materialTypeId: z.string().uuid(),
      predominantColor: z.string().trim().min(2).max(40).optional(),
      sellerPrice: z.number().positive(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      minYards: z.number().min(3),
      stockYards: z.number().min(0),
      images: z.array(z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      })).min(3).max(4),
    });

    const data = schema.parse(req.body);
    await assertSellerCanManageCatalog(req.user!.id, 'upload products');
    const profile = await resolveSellerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    }

    const pricing = await resolveSellerListingPrice({
      userId: req.user!.id,
      country: profile.country,
      localPriceInput: data.sellerPrice,
      requestedCurrencyCode: data.priceCurrencyCode,
    });
    const finalPrice = await computeFinalFabricPrice(pricing.usdPrice, profile.country);

    const fabric = await prisma.fabric.create({
      data: {
        sellerId: profile.id,
        name: data.name,
        description: data.description,
        materialTypeId: data.materialTypeId,
        sellerPrice: pricing.usdPrice,
        finalPrice,
        minYards: Math.max(3, Number(data.minYards || 3)),
        stockYards: data.stockYards,
        status: ProductStatus.PENDING_REVIEW,
        images: {
          create: data.images.map((img, i) => ({
            url: img.url,
            alt: img.alt || data.name,
            sortOrder: i,
          })),
        },
      },
      include: {
        materialType: true,
        images: true,
      },
    });
    await syncFabricAvailabilityById(fabric.id, { notifyVendor: false });

    // Update seller fabric count
    await prisma.fabricSellerProfile.update({
      where: { id: profile.id },
      data: { totalFabrics: { increment: 1 } },
    });
    await setProductCurrencyMetadata({
      userId: req.user!.id,
      productType: 'FABRIC',
      productId: fabric.id,
      currencyCode: pricing.selectedCurrency,
      localPrice: pricing.localPrice,
      usdPrice: pricing.usdPrice,
      exchangeRate: pricing.usdPerUnit,
    });
    await writeFabricPredominantColor(fabric.id, data.predominantColor || null);

    let responseStatus = fabric.status;
    let responseAvailability = fabric.isAvailable;
    let automation: any = null;
    let automationOutcome: any = null;
    let responseMessage = 'Fabric submitted for review.';
    try {
      const automationSettings = (await readAutomationApprovalSettings()).settings;
      if (automationSettings.enabled && automationSettings.autoRunOnProductSubmit) {
        const evaluation = await evaluateProductAutomationChecks({
          productType: 'FABRIC' as any,
          productId: fabric.id,
          settingsOverride: automationSettings,
        });
        automation = evaluation;
        if (evaluation.canAutoApprove && automationSettings.autoApproveOnPass) {
          await prisma.fabric.update({
            where: { id: fabric.id },
            data: {
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
          });
          responseStatus = ProductStatus.APPROVED;
          responseAvailability = true;
          responseMessage = 'Fabric auto-approved by automation.';
          automation = { ...evaluation, action: 'AUTO_APPROVED' };
          automationOutcome = await saveProductAutomationOutcome({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            evaluationStatus: evaluation.status,
            action: 'AUTO_APPROVED',
            report: evaluation.report,
            changeReport: evaluation.changeReport,
            failureSeverity: 'NONE',
            needsCorrection: false,
            summaryMessage: 'All automation checks passed. Product auto-approved.',
          });
          await notifyVendorAboutProductAutomationFailure({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            report: evaluation.report,
            changeReport: evaluation.changeReport,
            outcome: automationOutcome,
          });
        } else if (!evaluation.canAutoApprove) {
          await prisma.fabric.update({
            where: { id: fabric.id },
            data: {
              status: ProductStatus.REJECTED,
              isAvailable: false,
            },
          });
          responseStatus = ProductStatus.REJECTED;
          responseAvailability = false;
          responseMessage = 'Fabric auto-rejected by automation checks.';
          automation = { ...evaluation, action: 'AUTO_REJECTED' };
          automationOutcome = await saveProductAutomationOutcome({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            evaluationStatus: evaluation.status,
            action: 'AUTO_REJECTED',
            report: evaluation.report,
            changeReport: evaluation.changeReport,
          });
          await notifyVendorAboutProductAutomationFailure({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            report: evaluation.report,
            changeReport: evaluation.changeReport,
            outcome: automationOutcome,
          });
        } else {
          automation = { ...evaluation, action: 'NONE' };
          automationOutcome = await saveProductAutomationOutcome({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            evaluationStatus: evaluation.status,
            action: 'NONE',
            report: evaluation.report,
            changeReport: evaluation.changeReport,
            failureSeverity: 'NONE',
            needsCorrection: false,
            summaryMessage: 'Automation checks passed. Pending manual approval because auto-approve is disabled.',
          });
          await notifyVendorAboutProductAutomationFailure({
            productType: ProductType.FABRIC as any,
            productId: fabric.id,
            report: evaluation.report,
            changeReport: evaluation.changeReport,
            outcome: automationOutcome,
          });
        }
      }
    } catch (automationError: any) {
      const automationMessage = String(
        automationError?.message || 'Automation processing failed. Manual review is required.'
      );
      const errorRow = {
        key: 'automation_runtime_error',
        label: 'Automation runtime processing',
        status: 'FAIL' as const,
        message: automationMessage,
      };
      automation = {
        canAutoApprove: false,
        status: 'AUTOMATION_ERROR',
        report: [errorRow],
        action: 'ERROR',
      };
      automationOutcome = await saveProductAutomationOutcome({
        productType: ProductType.FABRIC as any,
        productId: fabric.id,
        evaluationStatus: 'AUTOMATION_ERROR',
        action: 'ERROR',
        report: [errorRow],
        changeReport: [],
        failureSeverity: 'MAJOR',
        needsCorrection: true,
        summaryMessage: automationMessage,
      });
      await notifyVendorAboutProductAutomationFailure({
        productType: ProductType.FABRIC as any,
        productId: fabric.id,
        report: [errorRow],
        changeReport: [],
        outcome: automationOutcome,
        errorMessage: automationMessage,
      });
    }

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        ...fabric,
        status: responseStatus,
        isAvailable: responseAvailability,
        predominantColor: data.predominantColor ? String(data.predominantColor).trim().toUpperCase() : null,
        automation,
        automationOutcome,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update fabric
router.patch('/fabrics/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().min(10).optional(),
      materialTypeId: z.string().uuid().optional(),
      predominantColor: z.string().trim().min(2).max(40).optional(),
      sellerPrice: z.number().positive().optional(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      minYards: z.number().min(3).optional(),
      stockYards: z.number().min(0).optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            alt: z.string().optional(),
          })
        )
        .min(3)
        .max(4)
        .optional(),
    });
    const data = schema.parse(req.body);
    await assertSellerCanManageCatalog(req.user!.id, 'edit products');

    const profile = await resolveSellerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const existing = await prisma.fabric.findFirst({
      where: { id, sellerId: profile.id },
      select: { id: true, sellerPrice: true, status: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }
    if (String(existing.status || '').toUpperCase() === 'APPROVED') {
      const [policy, activeGrant] = await Promise.all([
        readProductEditPolicySettings(),
        readActiveProductEditGrant({
          requesterUserId: req.user!.id,
          requesterRole: 'FABRIC_SELLER',
          productType: 'FABRIC',
          productId: id,
        }),
      ]);
      const allowedFields = new Set(
        getAllowedFieldsForApprovedProduct({
          role: 'FABRIC_SELLER',
          productType: 'FABRIC',
          policy,
          activeGrant,
        })
      );
      const attemptedFields = Object.entries(data)
        .filter(([key, value]) => key !== 'priceCurrencyCode' && value !== undefined)
        .map(([key]) => key);
      if (data.priceCurrencyCode !== undefined && data.sellerPrice === undefined) {
        attemptedFields.push('priceCurrencyCode');
      }
      const disallowed = attemptedFields.filter((field) => !allowedFields.has(field));
      if (disallowed.length > 0) {
        return res.status(403).json({
          success: false,
          message:
            'For approved products, you can only edit admin-allowed fields. Submit a Product Change Request for additional changes.',
          data: {
            disallowedFields: disallowed,
            allowedFields: Array.from(allowedFields),
          },
        });
      }
    }
    const pricing =
      data.sellerPrice !== undefined
        ? await resolveSellerListingPrice({
            userId: req.user!.id,
            country: profile.country,
            localPriceInput: data.sellerPrice,
            requestedCurrencyCode: data.priceCurrencyCode,
          })
        : null;

    const nextSellerPriceUsd = Number(pricing?.usdPrice ?? existing.sellerPrice);
    const nextFinalPrice = await computeFinalFabricPrice(nextSellerPriceUsd, profile.country);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.images) {
        await tx.fabricImage.deleteMany({ where: { fabricId: id } });
      }
      const payload: any = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.materialTypeId !== undefined ? { materialTypeId: data.materialTypeId } : {}),
        ...(data.sellerPrice !== undefined ? { sellerPrice: nextSellerPriceUsd } : {}),
        ...(data.minYards !== undefined ? { minYards: Math.max(3, Number(data.minYards || 3)) } : {}),
        ...(data.stockYards !== undefined ? { stockYards: data.stockYards } : {}),
        finalPrice: nextFinalPrice,
        status:
          String(existing.status || '').toUpperCase() === 'APPROVED'
            ? ProductStatus.APPROVED
            : ProductStatus.PENDING_REVIEW,
      };
      if (data.images) {
        payload.images = {
          create: data.images.map((img, index) => ({
            url: img.url,
            alt: img.alt || data.name || 'Fabric image',
            sortOrder: index,
          })),
        };
      }
      return tx.fabric.update({
        where: { id },
        data: payload,
        include: {
          materialType: true,
          images: true,
        },
      });
    });
    await syncFabricAvailabilityById(id, { notifyVendor: true });

    if (pricing) {
      await setProductCurrencyMetadata({
        userId: req.user!.id,
        productType: 'FABRIC',
        productId: id,
        currencyCode: pricing.selectedCurrency,
        localPrice: pricing.localPrice,
        usdPrice: pricing.usdPrice,
        exchangeRate: pricing.usdPerUnit,
      });
    }
    if (data.predominantColor !== undefined) {
      await writeFabricPredominantColor(id, data.predominantColor);
    }
    await clearProductAutomationOutcome({
      productType: ProductType.FABRIC as any,
      productId: id,
    });
    const colorMap = await readFabricPredominantColorMap([id]);
    res.json({
      success: true,
      message: 'Fabric updated successfully.',
      data: {
        ...updated,
        predominantColor: colorMap[id] || null,
      },
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

// Get fabric orders
router.get('/orders', async (req, res, next) => {
  try {
    const profile = await resolveSellerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const orders = await prisma.fabricOrderItem.findMany({
      where: { sellerId: profile.id },
      include: {
        fabric: {
          select: { name: true, images: { take: 1 } },
        },
        order: {
          select: {
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
