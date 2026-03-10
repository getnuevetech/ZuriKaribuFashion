import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma, UserRole, ProductStatus } from '../db';
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

const router = Router();
let sellerGovernanceSchemaEnsured = false;

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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileField_pkey" PRIMARY KEY ("id")
    )`
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role","userId")`
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
    `ALTER TABLE "VendorProfileSubmission" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "VendorProfileSubmission" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileField_role_key_key" ON "VendorProfileField"("role","key")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VendorProfileField_role_sortOrder_idx" ON "VendorProfileField"("role","sortOrder")`
  );
  sellerGovernanceSchemaEnsured = true;
}

type VendorProfileStatus = 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const normalizeVendorProfileStatus = (value: unknown): VendorProfileStatus => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOMPLETE' || normalized === 'SUBMITTED' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'INCOMPLETE';
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
  await ensureSellerGovernanceSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes"
     FROM "VendorProfileSubmission"
     WHERE "role" = 'FABRIC_SELLER' AND "userId" = $1
     LIMIT 1`,
    userId
  );
  return rows[0] || null;
}

async function readSellerProfileFields() {
  try {
    await ensureSellerGovernanceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
       FROM "VendorProfileField"
       WHERE "role" = 'FABRIC_SELLER'
       ORDER BY "sortOrder" ASC, "createdAt" ASC`
    );
    const legacyRows =
      rows.length > 0
        ? []
        : await prisma.$queryRawUnsafe<Array<any>>(
            `SELECT "id","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
             FROM "VendorProfileField"
             WHERE UPPER("role") IN ('FABRIC_SELLER','SELLER')
             ORDER BY "sortOrder" ASC, "createdAt" ASC`
          );
    const sourceRows = rows.length > 0 ? rows : legacyRows;
    return sourceRows.map((row) => ({
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
  } catch {
    return [];
  }
}

function buildDefaultSellerProfileFields() {
  return [
    { id: 'default-business-name', key: 'businessName', label: 'Business Name', fieldType: 'TEXT', required: true, options: [], isActive: true, sortOrder: 1 },
    { id: 'default-business-email', key: 'businessEmail', label: 'Business Email', fieldType: 'TEXT', required: true, options: [], isActive: true, sortOrder: 2 },
    { id: 'default-business-phone', key: 'businessPhone', label: 'Business Phone', fieldType: 'TEXT', required: true, options: [], isActive: true, sortOrder: 3 },
    { id: 'default-country', key: 'country', label: 'Country', fieldType: 'TEXT', required: true, options: [], isActive: true, sortOrder: 4 },
    { id: 'default-city', key: 'city', label: 'City', fieldType: 'TEXT', required: true, options: [], isActive: true, sortOrder: 5 },
    { id: 'default-address', key: 'address', label: 'Address', fieldType: 'TEXTAREA', required: false, options: [], isActive: true, sortOrder: 6 },
  ] as Array<any>;
}

async function getSellerProfileCompletion(userId: string) {
  const profile = await resolveSellerProfile(userId);
  if (!profile) return null;

  const [submission, fieldsRaw] = await Promise.all([readSellerSubmission(userId), readSellerProfileFields()]);
  const fields = fieldsRaw.length > 0 ? fieldsRaw : buildDefaultSellerProfileFields();
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
    : profile.isVerified
      ? 'APPROVED'
      : 'INCOMPLETE';
  const canUpload = status === 'APPROVED' || Boolean(profile.isVerified);
  const brandSlug = slugify(profile.businessName || '');
  const storefrontPath = `/store/seller/${encodeURIComponent(profile.id)}/${encodeURIComponent(brandSlug || 'store')}`;

  return {
    role: 'FABRIC_SELLER',
    canUpload,
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
    fields,
  };
}

async function ensureSellerCanUpload(userId: string) {
  const completion = await getSellerProfileCompletion(userId);
  if (!completion) {
    return {
      allowed: false,
      statusCode: 404,
      message: 'Seller profile not found.',
    };
  }
  if (completion.canUpload) {
    return { allowed: true, completion };
  }
  return {
    allowed: false,
    statusCode: 403,
    message:
      completion.profileStatus === 'REJECTED'
        ? 'Your vendor profile was rejected. Please update your profile and resubmit for approval.'
        : 'Complete and submit your full vendor profile for admin approval before uploading products.',
    completion,
  };
}

async function computeFinalFabricPrice(baseSellerPrice: number, sellerCountry: string) {
  const markupRule = await prisma.pricingRule.findFirst({
    where: {
      ruleType: 'GLOBAL_MARKUP',
      isActive: true,
    },
  });

  let finalPrice = baseSellerPrice;
  if (markupRule && markupRule.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = baseSellerPrice * (1 + Number(markupRule.value) / 100);
  }

  const countryRule = await prisma.pricingRule.findFirst({
    where: {
      ruleType: 'COUNTRY_MARKUP',
      country: sellerCountry,
      isActive: true,
    },
  });

  if (countryRule && countryRule.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = finalPrice * (1 + Number(countryRule.value) / 100);
  }

  return finalPrice;
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
        stats: {
          totalFabrics,
          totalOrders,
          pendingOrders,
          totalRevenue: totalRevenue._sum.totalPrice || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

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
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const featuredRows =
      fabrics.length > 0
        ? await prisma.featuredProduct.findMany({
            where: {
              productType: 'FABRIC',
              productId: { in: fabrics.map((item) => item.id) },
              isActive: true,
            },
            select: {
              productId: true,
              section: true,
            },
          })
        : [];

    const featuredByFabricId = new Map<string, string[]>();
    for (const row of featuredRows) {
      const existing = featuredByFabricId.get(row.productId) || [];
      if (!existing.includes(row.section)) existing.push(row.section);
      featuredByFabricId.set(row.productId, existing);
    }
    const metadataRows = await Promise.all(
      fabrics.map(async (item) => [item.id, await getProductCurrencyMetadata('FABRIC', item.id)] as const)
    );
    const metadataByFabricId = new Map<string, any>(metadataRows);

    res.json({
      success: true,
      data: fabrics.map((item) => {
        const featuredSections = featuredByFabricId.get(item.id) || [];
        const currencyMeta = metadataByFabricId.get(item.id) || null;
        return {
          ...item,
          isFeatured: featuredSections.length > 0,
          featuredSections,
          listingCurrencyCode: String(currencyMeta?.currencyCode || 'USD'),
          listingLocalPrice: Number(currencyMeta?.localPrice || item.sellerPrice || 0),
          listingUsdPrice: Number(currencyMeta?.usdPrice || item.sellerPrice || 0),
          listingExchangeRate: Number(currencyMeta?.exchangeRate || 1),
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
        ("id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","updatedAt")
       VALUES ($1,'FABRIC_SELLER',$2,$3,'SUBMITTED',$4::jsonb,$5,NULL,NULL,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "businessName" = EXCLUDED."businessName",
         "profileStatus" = EXCLUDED."profileStatus",
         "profileData" = EXCLUDED."profileData",
         "profileSubmittedAt" = EXCLUDED."profileSubmittedAt",
         "profileReviewedAt" = NULL,
         "profileReviewNotes" = NULL,
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
      sellerPrice: z.number().positive(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      minYards: z.number().min(1),
      stockYards: z.number().min(0),
      images: z.array(z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      })).min(3).max(4),
    });

    const data = schema.parse(req.body);

    const uploadAccess = await ensureSellerCanUpload(req.user!.id);
    if (!uploadAccess.allowed) {
      return res.status(Number(uploadAccess.statusCode || 403)).json({
        success: false,
        message: uploadAccess.message,
        data: uploadAccess.completion || null,
      });
    }
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
        minYards: data.minYards,
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

    res.status(201).json({
      success: true,
      message: 'Fabric submitted for review.',
      data: fabric,
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
      sellerPrice: z.number().positive().optional(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      minYards: z.number().min(1).optional(),
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

    const uploadAccess = await ensureSellerCanUpload(req.user!.id);
    if (!uploadAccess.allowed) {
      return res.status(Number(uploadAccess.statusCode || 403)).json({
        success: false,
        message: uploadAccess.message,
        data: uploadAccess.completion || null,
      });
    }

    const profile = await resolveSellerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      });
    }

    const existing = await prisma.fabric.findFirst({
      where: { id, sellerId: profile.id },
      select: { id: true, sellerPrice: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
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
        ...(data.minYards !== undefined ? { minYards: data.minYards } : {}),
        ...(data.stockYards !== undefined ? { stockYards: data.stockYards } : {}),
        finalPrice: nextFinalPrice,
        status: ProductStatus.PENDING_REVIEW,
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
    res.json({
      success: true,
      message: 'Fabric updated successfully.',
      data: updated,
    });
  } catch (error) {
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
