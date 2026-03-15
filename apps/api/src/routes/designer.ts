import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { prisma, UserRole, UserStatus, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  createDesignerFabricCountryAccessRequest,
  getAllowedFabricCountriesForDesigner,
  listDesignerFabricCountryAccessRequests,
} from '../utils/designer-fabric-country-access';
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
import { readOrderWorkflowSettings } from '../utils/order-workflow';

const router = Router();
let designerGovernanceSchemaEnsured = false;
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
router.use(authorizePermissions(Permissions.DESIGNER_ACCESS));

async function resolveDesignerProfile(userId: string) {
  const existing = await prisma.designerProfile.findFirst({
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

  return prisma.designerProfile.create({
    data: {
      userId,
      businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      businessEmail: user.email,
      businessPhone: user.phone || 'N/A',
      country: 'Not specified',
      city: 'Not specified',
      address: 'Not specified',
      isVerified: false,
      totalDesigns: 0,
      totalSales: 0,
      rating: 0,
    },
  });
}

async function ensureDesignerGovernanceSchema() {
  if (designerGovernanceSchemaEnsured) return;
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
  designerGovernanceSchemaEnsured = true;
}

type MeasurementTemplateOption = {
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
};

const DEFAULT_MEASUREMENT_TEMPLATE_OPTIONS: MeasurementTemplateOption[] = [
  { name: 'Chest', unit: 'cm', isRequired: true, instructions: '' },
  { name: 'Waist', unit: 'cm', isRequired: true, instructions: '' },
  { name: 'Hips', unit: 'cm', isRequired: true, instructions: '' },
];

const normalizeCountryToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeCountryName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const dedupeCountryList = (values: unknown[]) => {
  const deduped = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeCountryName(value);
    const token = normalizeCountryToken(normalized);
    if (!normalized || !token) continue;
    if (!deduped.has(token)) deduped.set(token, normalized);
  }
  return Array.from(deduped.values());
};

const normalizeMeasurementNameToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

async function readActiveMeasurementTemplateOptions(): Promise<MeasurementTemplateOption[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "name","unit","isRequired","instructions"
       FROM "MeasurementTemplate"
       WHERE "isActive" = true
       ORDER BY "displayOrder" ASC, "name" ASC`
    );
    const normalized = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        name: String(row?.name || '').trim(),
        unit: String(row?.unit || 'cm').trim() || 'cm',
        isRequired: Boolean(row?.isRequired ?? true),
        instructions: String(row?.instructions || '').trim(),
      }))
      .filter((row) => row.name.length > 0);
    return normalized.length > 0 ? normalized : [...DEFAULT_MEASUREMENT_TEMPLATE_OPTIONS];
  } catch {
    return [...DEFAULT_MEASUREMENT_TEMPLATE_OPTIONS];
  }
}

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
const DEFAULT_READY_TO_WEAR_STANDARD_SIZES = ['S', 'M', 'L', 'XL'];
const HOMEPAGE_READY_TO_WEAR_SIZES_SETTINGS_KEY = 'HOMEPAGE_READY_TO_WEAR_SIZES';
const normalizeReadyToWearSize = (value: unknown) => String(value || '').trim().toUpperCase();
const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';
const LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS = [' / ', '/', '|'] as const;
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

async function readAllowedReadyToWearSizes() {
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
  const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
    `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    HOMEPAGE_READY_TO_WEAR_SIZES_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) return [...DEFAULT_READY_TO_WEAR_STANDARD_SIZES];
  try {
    const parsed = JSON.parse(String(row.value || '{}')) as any;
    const list = Array.isArray(parsed?.sizes) ? parsed.sizes : [];
    const normalized = Array.from(
      new Set(
        list
          .map((entry: any) => normalizeReadyToWearSize(entry))
          .filter((entry: string) => entry.length > 0 && entry.length <= 20)
      )
    );
    if (normalized.length < 3 || normalized.length > 20) return [...DEFAULT_READY_TO_WEAR_STANDARD_SIZES];
    return normalized;
  } catch {
    return [...DEFAULT_READY_TO_WEAR_STANDARD_SIZES];
  }
}

async function resolveDesignerListingPrice(params: {
  userId: string;
  country: string;
  localPriceInput: number;
  requestedCurrencyCode?: string;
}) {
  const { matrix, rules } = await getCurrencyState();
  const { defaultCurrency, allowedCurrencies } = getAllowedCurrenciesForVendor({
    role: UserRole.FASHION_DESIGNER,
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
  bio: ['bio', 'about', 'description'],
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

const normalizeHomeCountryValue = (value: unknown) => {
  const country = String(value || '').trim().replace(/\s+/g, ' ');
  const token = country.toLowerCase();
  if (!country) return '';
  if (token === 'not specified' || token === 'not set' || token === 'n/a' || token === 'na') return '';
  return country;
};

const countryNameFromIso2 = (value: unknown) => {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    return String(new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || '').trim();
  } catch {
    return '';
  }
};

const countryCandidateSet = (value: unknown) => {
  const base = String(value || '').trim().replace(/\s+/g, ' ');
  const set = new Set<string>();
  if (!base) return set;
  set.add(base.toLowerCase());
  const isoName = countryNameFromIso2(base);
  if (isoName) set.add(isoName.toLowerCase());
  return set;
};

const isEquivalentCountry = (left: unknown, right: unknown) => {
  const leftSet = countryCandidateSet(left);
  const rightSet = countryCandidateSet(right);
  if (leftSet.size === 0 || rightSet.size === 0) return false;
  for (const token of leftSet) {
    if (rightSet.has(token)) return true;
  }
  return false;
};

async function resolveDesignerHomeCountry(userId: string, profile: { country?: string | null }) {
  const current = normalizeHomeCountryValue(profile?.country);
  if (current) return current;
  const submission = await readDesignerSubmission(userId);
  const profileData = getProfileDataObject(submission?.profileData);
  const fromProfileData = normalizeHomeCountryValue(readAliasValue(profileData, PROFILE_FIELD_ALIASES.country));
  if (fromProfileData) return fromProfileData;
  return current;
}

async function readDesignerSubmission(userId: string) {
  try {
    await ensureDesignerGovernanceSchema();
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
       WHERE "role" = 'FASHION_DESIGNER' AND "userId" = $1
       ORDER BY ${orderBy}
       LIMIT 1`,
      userId
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function readDesignerProfileFields() {
  try {
    await ensureDesignerGovernanceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","role","key","label","fieldType","placeholder","helpText","required","options","sortOrder","isActive"
       FROM "VendorProfileField"
       ORDER BY "sortOrder" ASC, "key" ASC`
    );
    const normalizeRoleToken = (value: unknown) =>
      String(value || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const allowedRoles = new Set(['FASHIONDESIGNER', 'DESIGNER']);
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

async function getDesignerProfileCompletion(userId: string) {
  const profile = await resolveDesignerProfile(userId);
  if (!profile) return null;
  const [submission, fields] = await Promise.all([readDesignerSubmission(userId), readDesignerProfileFields()]);
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
  writeAliasValue(profileData, PROFILE_FIELD_ALIASES.bio, profile.bio || '', fieldKeys);
  const status = submission
    ? normalizeVendorProfileStatus(submission.profileStatus)
    : profile.isVerified
      ? 'APPROVED'
      : 'INCOMPLETE';
  const rejectionType = normalizeVendorRejectionType(submission?.rejectionType);
  const canUpload = status === 'APPROVED' || Boolean(profile.isVerified);
  const canResubmitProfile = status !== 'REJECTED' || rejectionType !== 'PERMANENT';
  const canOperateAccount = status === 'APPROVED' || Boolean(profile.isVerified);
  const brandSlug = slugify(profile.businessName || '');
  const storefrontPath = `/store/designer/${encodeURIComponent(profile.id)}/${encodeURIComponent(brandSlug || 'store')}`;

  return {
    role: 'FASHION_DESIGNER',
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
      bio: profile.bio,
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

async function assertDesignerCanManageCatalog(userId: string, action: string) {
  const completion = await getDesignerProfileCompletion(userId);
  if (!completion) {
    throw Object.assign(new Error('Designer profile not found.'), { status: 404 });
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

async function assertDesignerMutationAllowed(userId: string) {
  const completion = await getDesignerProfileCompletion(userId);
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

async function computeFinalDesignPrice(basePrice: number, designerCountry: string) {
  let finalPrice = basePrice;
  const markupRule = await prisma.pricingRule.findFirst({
    where: { ruleType: 'GLOBAL_MARKUP', isActive: true },
  });

  if (markupRule?.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = basePrice * (1 + Number(markupRule.value) / 100);
  }

  const countryRule = await prisma.pricingRule.findFirst({
    where: { ruleType: 'COUNTRY_MARKUP', country: designerCountry, isActive: true },
  });

  if (countryRule?.adjustmentType === 'PERCENTAGE_MARKUP') {
    finalPrice = finalPrice * (1 + Number(countryRule.value) / 100);
  }
  return finalPrice;
}

async function readMaxSuitableFabricsPerDesign(): Promise<number> {
  try {
    const settings = await readOrderWorkflowSettings();
    return Math.max(1, Math.min(50, Number(settings.orderLimits?.maxSuitableFabricsPerDesign || 5)));
  } catch {
    return 5;
  }
}

// Get designer dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const completion = await getDesignerProfileCompletion(req.user!.id);
    const profile = completion?.profile;

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const [totalDesigns, totalReadyToWear, totalOrders, pendingOrders, totalRevenue] = await Promise.all([
      prisma.design.count({ where: { designerId: profile.id } }),
      prisma.readyToWear.count({ where: { designerId: profile.id } }),
      prisma.designOrderItem.count({ where: { designerId: profile.id } }),
      prisma.designOrderItem.count({
        where: { designerId: profile.id, status: 'PENDING' },
      }),
      prisma.designOrderItem.aggregate({
        where: { designerId: profile.id },
        _sum: { price: true },
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
          totalDesigns,
          totalReadyToWear,
          totalOrders,
          pendingOrders,
          totalRevenue: totalRevenue._sum.price || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard-governance', async (_req, res, next) => {
  try {
    const payload = await readVendorDashboardGovernanceSettings();
    res.json({
      success: true,
      data: payload.settings.designer,
    });
  } catch (error) {
    next(error);
  }
});

const handleGetDesignerTryOnInsights = async (req: any, res: any, next: any) => {
  try {
    const settingsPayload = await readTryOnSettings();
    if (settingsPayload.settings.applyLocations.designerDashboard === false) {
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
      role: 'DESIGNER',
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
router.get('/try-on/insights', handleGetDesignerTryOnInsights);
router.get('/tryon/insights', handleGetDesignerTryOnInsights);
router.get('/3d-try-on/insights', handleGetDesignerTryOnInsights);
router.get('/3d-tryon/insights', handleGetDesignerTryOnInsights);

router.get('/measurement-template-options', async (_req, res, next) => {
  try {
    const templates = await readActiveMeasurementTemplateOptions();
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/fabric-options', async (req, res, next) => {
  try {
    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const requestedCountry = normalizeCountryName(req.query.country);
    const materialTypeIdRaw = String(req.query.materialTypeId || '').trim();
    const search = String(req.query.search || '').trim();
    const parsedLimit = Number(req.query.limit || 200);
    const limit = Number.isFinite(parsedLimit) ? Math.min(500, Math.max(1, Math.floor(parsedLimit))) : 200;

    if (materialTypeIdRaw) {
      const validation = z.string().uuid().safeParse(materialTypeIdRaw);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'materialTypeId must be a valid UUID.',
        });
      }
    }

    const homeCountry = await resolveDesignerHomeCountry(req.user!.id, profile);
    const allowedCountries = await getAllowedFabricCountriesForDesigner({
      designerUserId: req.user!.id,
      homeCountry,
    });
    if (requestedCountry && !allowedCountries.some((country) => isEquivalentCountry(country, requestedCountry))) {
      return res.status(403).json({
        success: false,
        message: 'Selected fabric seller country is not allowed for this designer.',
      });
    }

    const sellerCountryRows = await prisma.fabricSellerProfile.findMany({
      select: { country: true },
    });
    const allSellerCountries = dedupeCountryList(sellerCountryRows.map((row) => row.country));
    const countryScope = requestedCountry ? [requestedCountry] : allowedCountries;
    const resolvedCountryScope = dedupeCountryList([
      ...countryScope,
      ...allSellerCountries.filter((sellerCountry) =>
        countryScope.some((entry) => isEquivalentCountry(entry, sellerCountry))
      ),
    ]);
    const scopedCountryFilters = resolvedCountryScope.map((entry) => ({
      seller: {
        country: {
          equals: entry,
          mode: 'insensitive' as const,
        },
      },
    }));

    const baseWhere: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
      ...(scopedCountryFilters.length > 0 ? { OR: scopedCountryFilters } : {}),
    };
    const filteredWhere: any = {
      ...baseWhere,
      ...(materialTypeIdRaw ? { materialTypeId: materialTypeIdRaw } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [optionRows, fabricRows] = await Promise.all([
      prisma.fabric.findMany({
        where: baseWhere,
        select: {
          seller: {
            select: {
              country: true,
            },
          },
          materialType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.fabric.findMany({
        where: filteredWhere,
        include: {
          seller: {
            select: {
              country: true,
              businessName: true,
            },
          },
          materialType: {
            select: {
              id: true,
              name: true,
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: limit,
      }),
    ]);

    const countryOptions = dedupeCountryList([
      ...resolvedCountryScope,
      ...optionRows.map((row) => row.seller?.country),
    ]);
    const materialMap = new Map<string, { id: string; name: string }>();
    for (const row of optionRows) {
      const id = String(row.materialType?.id || '').trim();
      const name = String(row.materialType?.name || '').trim();
      if (!id || !name || materialMap.has(id)) continue;
      materialMap.set(id, { id, name });
    }
    const materialOptions = Array.from(materialMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        allowedCountries,
        countries: countryOptions,
        materials: materialOptions,
        fabrics: fabricRows.map((row) => ({
          id: row.id,
          name: row.name,
          materialTypeId: row.materialTypeId,
          materialTypeName: row.materialType?.name || 'Material',
          sellerCountry: row.seller?.country || '',
          sellerName: row.seller?.businessName || 'Fabric Seller',
          priceUsd: Number(row.finalPrice || row.sellerPrice || 0),
          image: row.images?.[0]?.url || '',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/fabric-country-access', async (req, res, next) => {
  try {
    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }
    const homeCountry = await resolveDesignerHomeCountry(req.user!.id, profile);
    const [allowedCountries, sellerRows, requests] = await Promise.all([
      getAllowedFabricCountriesForDesigner({
        designerUserId: req.user!.id,
        homeCountry,
      }),
      prisma.fabricSellerProfile.findMany({
        select: { country: true },
      }),
      listDesignerFabricCountryAccessRequests({ designerUserId: req.user!.id }),
    ]);
    const availableCountries = dedupeCountryList([
      homeCountry || profile.country,
      ...sellerRows.map((row) => row.country).filter((value) => String(value || '').trim()),
    ]);
    res.json({
      success: true,
      data: {
        homeCountry: homeCountry || profile.country,
        allowedCountries,
        availableCountries,
        requests,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/fabric-country-access/requests', async (req, res, next) => {
  try {
    await assertDesignerMutationAllowed(req.user!.id);
    const payload = z
      .object({
        requestedCountries: z.array(z.string()).min(1),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }
    const homeCountry = await resolveDesignerHomeCountry(req.user!.id, profile);
    const [allowedCountries, sellerRows, existingRequests] = await Promise.all([
      getAllowedFabricCountriesForDesigner({
        designerUserId: req.user!.id,
        homeCountry,
      }),
      prisma.fabricSellerProfile.findMany({
        select: { country: true },
      }),
      listDesignerFabricCountryAccessRequests({ designerUserId: req.user!.id }),
    ]);
    const availableCountries = dedupeCountryList([
      homeCountry || profile.country,
      ...sellerRows.map((row) => row.country).filter((value) => String(value || '').trim()),
    ]);
    const allowedTokens = new Set(allowedCountries.map((entry) => normalizeCountryToken(entry)));
    const availableTokens = new Set(availableCountries.map((entry) => normalizeCountryToken(entry)));
    const pendingTokens = new Set(
      existingRequests
        .filter((entry) => entry.status === 'PENDING')
        .flatMap((entry) => entry.requestedCountries)
        .map((entry) => normalizeCountryToken(entry))
    );
    const requestedCountries = dedupeCountryList(payload.requestedCountries).filter((entry) => {
      const token = normalizeCountryToken(entry);
      if (!token) return false;
      if (allowedTokens.has(token)) return false;
      if (pendingTokens.has(token)) return false;
      if (availableTokens.size > 0 && !availableTokens.has(token)) return false;
      return true;
    });
    if (requestedCountries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No new eligible countries to request. Countries may already be allowed, pending, or unavailable.',
      });
    }
    const created = await createDesignerFabricCountryAccessRequest({
      designerUserId: req.user!.id,
      requestedCountries,
      reason: payload.reason,
    });
    const adminUsers = await prisma.user.findMany({
      where: {
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });
    if (adminUsers.length > 0) {
      await Promise.all(
        adminUsers.map((admin) =>
          prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: 'New designer country access request',
              message: `${profile.businessName || 'Designer'} requested fabric country access for ${requestedCountries.join(', ')}.`,
              relatedType: 'DESIGNER_FABRIC_COUNTRY_ACCESS_REQUEST',
              relatedId: created.id,
            },
          })
        )
      );
      await Promise.all(
        adminUsers.map(async (admin) => {
          try {
            await sendEmail({
              to: admin.email,
              subject: 'New designer fabric country access request',
              text: `${profile.businessName || 'Designer'} submitted a request for ${requestedCountries.join(', ')}.${payload.reason ? `\nReason: ${payload.reason}` : ''}`,
              html: `<p><strong>${profile.businessName || 'Designer'}</strong> submitted a fabric country access request for <strong>${requestedCountries.join(', ')}</strong>.</p>${payload.reason ? `<p>Reason: ${payload.reason}</p>` : ''}`,
            });
          } catch (emailError) {
            console.error('Failed to send admin country-access request email:', emailError);
          }
        })
      );
    }
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DESIGNER_FABRIC_COUNTRY_ACCESS_REQUEST_CREATED',
        details: {
          requestId: created.id,
          requestedCountries,
          reason: payload.reason || null,
        },
      },
    });
    res.status(201).json({
      success: true,
      message: 'Country access request submitted successfully.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// Get designer designs
router.get('/designs', async (req, res, next) => {
  try {
    const profile = await resolveDesignerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const designs = await prisma.design.findMany({
      where: { designerId: profile.id },
      include: {
        category: true,
        images: true,
        suitableFabrics: {
          include: {
            fabric: {
              select: {
                name: true,
                materialTypeId: true,
                materialType: { select: { id: true, name: true } },
                seller: { select: { country: true } },
              },
            },
          },
        },
        measurementVariables: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    let featuredRows: Array<{ productId: string; section: string }> = [];
    if (designs.length > 0) {
      try {
        featuredRows = await prisma.featuredProduct.findMany({
          where: {
            productType: 'DESIGN',
            productId: { in: designs.map((item) => item.id) },
            isActive: true,
          },
          select: {
            productId: true,
            section: true,
          },
        });
      } catch (featuredError) {
        console.warn('[designer/designs] Skipping featuredProduct lookup:', featuredError);
      }
    }
    const featuredByProductId = new Map<string, string[]>();
    for (const row of featuredRows) {
      const existing = featuredByProductId.get(row.productId) || [];
      if (!existing.includes(row.section)) existing.push(row.section);
      featuredByProductId.set(row.productId, existing);
    }
    const metadataRows = await Promise.all(
      designs.map(async (item) => [item.id, await getProductCurrencyMetadata('DESIGN', item.id)] as const)
    );
    const metadataByDesignId = new Map<string, any>(metadataRows);

    res.json({
      success: true,
      data: designs.map((item) => {
        const featuredSections = featuredByProductId.get(item.id) || [];
        const currencyMeta = metadataByDesignId.get(item.id) || null;
        return {
          ...item,
          isFeatured: featuredSections.length > 0,
          featuredSections,
          listingCurrencyCode: String(currencyMeta?.currencyCode || 'USD'),
          listingLocalPrice: Number(currencyMeta?.localPrice || item.basePrice || 0),
          listingUsdPrice: Number(currencyMeta?.usdPrice || item.basePrice || 0),
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
    const completion = await getDesignerProfileCompletion(req.user!.id);
    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
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
    const fields = await readDesignerProfileFields();
    res.json({
      success: true,
      data: {
        role: 'FASHION_DESIGNER',
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
      const completion = await getDesignerProfileCompletion(req.user.id);
      if (completion?.profileStatus === 'REJECTED' && completion?.rejectionType === 'PERMANENT') {
        return res.status(403).json({
          success: false,
          message: 'Your vendor account is permanently rejected. Please contact the administrator.',
        });
      }
      return next();
    }
    await assertDesignerMutationAllowed(req.user.id);
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
        bio: z.string().optional(),
        profileData: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])).optional(),
      })
      .parse(req.body);

    const current = await getDesignerProfileCompletion(req.user!.id);
    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
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
    const bio = String(
      payload.bio ??
        readAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.bio) ??
        current.profile.bio ??
        ''
    ).trim();

    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessName, businessName, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessEmail, businessEmail, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.businessPhone, businessPhone, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.country, country, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.city, city, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.address, address, fieldKeys);
    writeAliasValue(mergedProfileData, PROFILE_FIELD_ALIASES.bio, bio, fieldKeys);

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

    await prisma.designerProfile.update({
      where: { id: current.profile.id },
      data: {
        businessName,
        businessEmail: businessEmail || String(current.profile.businessEmail || '').trim() || 'not-provided@example.com',
        businessPhone: businessPhone || String(current.profile.businessPhone || '').trim() || 'N/A',
        country,
        city,
        address,
        bio: bio || null,
        isVerified: false,
      },
    });

    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","profileReviewMessage","rejectionType","rejectionReasonCode","rejectionReasonLabel","permanentRejectionAt","permanentDisableAt","updatedAt")
       VALUES ($1,'FASHION_DESIGNER',$2,$3,'SUBMITTED',$4::jsonb,$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW())
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

    const completion = await getDesignerProfileCompletion(req.user!.id);
    res.json({
      success: true,
      message: 'Profile submitted successfully. Admin review is now required before product uploads.',
      data: completion,
    });
  } catch (error) {
    next(error);
  }
});

// Create design
router.post('/designs', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(10),
      categoryId: z.string().uuid(),
      basePrice: z.number().positive(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      suitableFabricIds: z.array(z.object({
        fabricId: z.string().uuid(),
        yardsNeeded: z.number().min(1),
      })),
      measurementVariables: z.array(z.object({
        name: z.string(),
        unit: z.string().default('cm'),
        isRequired: z.boolean().default(true),
        instructions: z.string().optional(),
      })),
      images: z.array(z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      })).min(4).max(6),
    });

    const data = schema.parse(req.body);
    await assertDesignerCanManageCatalog(req.user!.id, 'upload products');
    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Designer profile not found.' });
    }

    const homeCountry = await resolveDesignerHomeCountry(req.user!.id, profile);
    const allowedCountries = await getAllowedFabricCountriesForDesigner({
      designerUserId: req.user!.id,
      homeCountry,
    });
    const selectedFabricIds = Array.from(
      new Set((data.suitableFabricIds || []).map((item) => String(item.fabricId || '').trim()).filter(Boolean))
    );
    const maxSuitableFabricsPerDesign = await readMaxSuitableFabricsPerDesign();
    if (selectedFabricIds.length > maxSuitableFabricsPerDesign) {
      return res.status(400).json({
        success: false,
        message: `You can select a maximum of ${maxSuitableFabricsPerDesign} suitable fabrics per Custom To Wear product.`,
      });
    }
    if (selectedFabricIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one suitable fabric.',
      });
    }
    const selectedFabricRows = await prisma.fabric.findMany({
      where: {
        id: { in: selectedFabricIds },
        status: ProductStatus.APPROVED,
        isAvailable: true,
      },
      select: {
        id: true,
        seller: {
          select: {
            country: true,
          },
        },
      },
    });
    if (selectedFabricRows.length !== selectedFabricIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected fabrics are unavailable.',
      });
    }
    const hasDisallowedFabric = selectedFabricRows.some(
      (row) => !allowedCountries.some((country) => isEquivalentCountry(country, row.seller?.country))
    );
    if (hasDisallowedFabric) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected fabrics are outside your allowed country access scope.',
      });
    }
    const suitableFabricById = new Map<string, number>();
    for (const item of data.suitableFabricIds || []) {
      const fabricId = String(item.fabricId || '').trim();
      if (!fabricId || suitableFabricById.has(fabricId)) continue;
      suitableFabricById.set(fabricId, Math.max(1, Number(item.yardsNeeded || 1)));
    }
    const normalizedSuitableFabrics = Array.from(suitableFabricById.entries()).map(([fabricId, yardsNeeded]) => ({
      fabricId,
      yardsNeeded,
    }));

    const templateRows = await readActiveMeasurementTemplateOptions();
    const templateByName = new Map(
      templateRows.map((item) => [normalizeMeasurementNameToken(item.name), item] as const)
    );
    const sanitizedMeasurementVariables = (data.measurementVariables || []).map((row) => {
      const matched = templateByName.get(normalizeMeasurementNameToken(row.name));
      return matched
        ? {
            name: matched.name,
            unit: matched.unit,
            isRequired: matched.isRequired,
            instructions: matched.instructions || undefined,
          }
        : null;
    });
    if (sanitizedMeasurementVariables.some((row) => !row)) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected measurement fields are not allowed. Please use admin-defined templates only.',
      });
    }
    const normalizedMeasurements = sanitizedMeasurementVariables.filter(Boolean) as Array<{
      name: string;
      unit: string;
      isRequired: boolean;
      instructions?: string;
    }>;
    if (normalizedMeasurements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one measurement field.',
      });
    }
    if (new Set(normalizedMeasurements.map((row) => normalizeMeasurementNameToken(row.name))).size !== normalizedMeasurements.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate measurement fields are not allowed.',
      });
    }

    const pricing = await resolveDesignerListingPrice({
      userId: req.user!.id,
      country: profile.country,
      localPriceInput: data.basePrice,
      requestedCurrencyCode: data.priceCurrencyCode,
    });
    const finalPrice = await computeFinalDesignPrice(pricing.usdPrice, profile.country);

    const design = await prisma.design.create({
      data: {
        designerId: profile.id,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        basePrice: pricing.usdPrice,
        finalPrice,
        status: ProductStatus.PENDING_REVIEW,
        suitableFabrics: {
          create: normalizedSuitableFabrics,
        },
        measurementVariables: {
          create: normalizedMeasurements.map((v, i) => ({ ...v, sortOrder: i })),
        },
        images: {
          create: data.images.map((img, i) => ({
            url: img.url,
            alt: img.alt || data.name,
            sortOrder: i,
          })),
        },
      },
      include: {
        category: true,
        suitableFabrics: { include: { fabric: true } },
        measurementVariables: true,
        images: true,
      },
    });

    await prisma.designerProfile.update({
      where: { id: profile.id },
      data: { totalDesigns: { increment: 1 } },
    });
    await setProductCurrencyMetadata({
      userId: req.user!.id,
      productType: 'DESIGN',
      productId: design.id,
      currencyCode: pricing.selectedCurrency,
      localPrice: pricing.localPrice,
      usdPrice: pricing.usdPrice,
      exchangeRate: pricing.usdPerUnit,
    });

    res.status(201).json({
      success: true,
      message: 'Design submitted for review.',
      data: design,
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

// Update design
router.patch('/designs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().min(10).optional(),
      categoryId: z.string().uuid().optional(),
      basePrice: z.number().positive().optional(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      suitableFabricIds: z
        .array(
          z.object({
            fabricId: z.string().uuid(),
            yardsNeeded: z.number().min(1),
          })
        )
        .optional(),
      measurementVariables: z
        .array(
          z.object({
            name: z.string(),
            unit: z.string().default('cm'),
            isRequired: z.boolean().default(true),
            instructions: z.string().optional(),
          })
        )
        .optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            alt: z.string().optional(),
          })
        )
        .min(4)
        .max(6)
        .optional(),
    });
    const data = schema.parse(req.body);
    await assertDesignerCanManageCatalog(req.user!.id, 'edit products');

    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const existing = await prisma.design.findFirst({
      where: { id, designerId: profile.id },
      select: { id: true, basePrice: true, status: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Design not found.',
      });
    }
    let normalizedSuitableFabrics:
      | Array<{
          fabricId: string;
          yardsNeeded: number;
        }>
      | undefined = undefined;
    if (data.suitableFabricIds) {
      const maxSuitableFabricsPerDesign = await readMaxSuitableFabricsPerDesign();
      const homeCountry = await resolveDesignerHomeCountry(req.user!.id, profile);
      const allowedCountries = await getAllowedFabricCountriesForDesigner({
        designerUserId: req.user!.id,
        homeCountry,
      });
      const selectedFabricIds = Array.from(
        new Set(data.suitableFabricIds.map((item) => String(item.fabricId || '').trim()).filter(Boolean))
      );
      if (selectedFabricIds.length > maxSuitableFabricsPerDesign) {
        return res.status(400).json({
          success: false,
          message: `You can select a maximum of ${maxSuitableFabricsPerDesign} suitable fabrics per Custom To Wear product.`,
        });
      }
      const selectedFabricRows = await prisma.fabric.findMany({
        where: {
          id: { in: selectedFabricIds },
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        select: {
          id: true,
          seller: {
            select: {
              country: true,
            },
          },
        },
      });
      if (selectedFabricRows.length !== selectedFabricIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected fabrics are unavailable.',
        });
      }
      const hasDisallowedFabric = selectedFabricRows.some(
        (row) => !allowedCountries.some((country) => isEquivalentCountry(country, row.seller?.country))
      );
      if (hasDisallowedFabric) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected fabrics are outside your allowed country access scope.',
        });
      }
      const suitableFabricById = new Map<string, number>();
      for (const item of data.suitableFabricIds) {
        const fabricId = String(item.fabricId || '').trim();
        if (!fabricId || suitableFabricById.has(fabricId)) continue;
        suitableFabricById.set(fabricId, Math.max(1, Number(item.yardsNeeded || 1)));
      }
      normalizedSuitableFabrics = Array.from(suitableFabricById.entries()).map(([fabricId, yardsNeeded]) => ({
        fabricId,
        yardsNeeded,
      }));
      if (normalizedSuitableFabrics.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one suitable fabric.',
        });
      }
    }

    let normalizedMeasurements:
      | Array<{
          name: string;
          unit: string;
          isRequired: boolean;
          instructions?: string;
        }>
      | undefined = undefined;
    if (data.measurementVariables) {
      const templateRows = await readActiveMeasurementTemplateOptions();
      const templateByName = new Map(
        templateRows.map((item) => [normalizeMeasurementNameToken(item.name), item] as const)
      );
      const sanitized = data.measurementVariables.map((row) => {
        const matched = templateByName.get(normalizeMeasurementNameToken(row.name));
        return matched
          ? {
              name: matched.name,
              unit: matched.unit,
              isRequired: matched.isRequired,
              instructions: matched.instructions || undefined,
            }
          : null;
      });
      if (sanitized.some((row) => !row)) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected measurement fields are not allowed. Please use admin-defined templates only.',
        });
      }
      const casted = sanitized.filter(Boolean) as Array<{
        name: string;
        unit: string;
        isRequired: boolean;
        instructions?: string;
      }>;
      if (casted.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one measurement field.',
        });
      }
      if (new Set(casted.map((row) => normalizeMeasurementNameToken(row.name))).size !== casted.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate measurement fields are not allowed.',
        });
      }
      normalizedMeasurements = casted;
    }

    const pricing =
      data.basePrice !== undefined
        ? await resolveDesignerListingPrice({
            userId: req.user!.id,
            country: profile.country,
            localPriceInput: data.basePrice,
            requestedCurrencyCode: data.priceCurrencyCode,
          })
        : null;
    const nextBasePriceUsd = Number(pricing?.usdPrice ?? existing.basePrice);
    const nextFinalPrice = await computeFinalDesignPrice(nextBasePriceUsd, profile.country);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.suitableFabricIds) {
        await tx.designFabric.deleteMany({ where: { designId: id } });
      }
      if (data.measurementVariables) {
        await tx.designMeasurementVariable.deleteMany({ where: { designId: id } });
      }
      if (data.images) {
        await tx.designImage.deleteMany({ where: { designId: id } });
      }

      const payload: any = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.basePrice !== undefined ? { basePrice: nextBasePriceUsd } : {}),
        finalPrice: nextFinalPrice,
        status: ProductStatus.PENDING_REVIEW,
      };

      if (data.suitableFabricIds) {
        payload.suitableFabrics = { create: normalizedSuitableFabrics || [] };
      }
      if (data.measurementVariables) {
        payload.measurementVariables = {
          create: (normalizedMeasurements || []).map((variable, index) => ({
            ...variable,
            sortOrder: index,
          })),
        };
      }
      if (data.images) {
        payload.images = {
          create: data.images.map((img, index) => ({
            url: img.url,
            alt: img.alt || data.name || 'Design image',
            sortOrder: index,
          })),
        };
      }

      return tx.design.update({
        where: { id },
        data: payload,
        include: {
          category: true,
          suitableFabrics: { include: { fabric: true } },
          measurementVariables: true,
          images: true,
        },
      });
    });

    if (pricing) {
      await setProductCurrencyMetadata({
        userId: req.user!.id,
        productType: 'DESIGN',
        productId: id,
        currencyCode: pricing.selectedCurrency,
        localPrice: pricing.localPrice,
        usdPrice: pricing.usdPrice,
        exchangeRate: pricing.usdPerUnit,
      });
    }
    res.json({
      success: true,
      message: 'Design updated successfully.',
      data: updated,
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

// Get ready-to-wear products
router.get('/ready-to-wear', async (req, res, next) => {
  try {
    const profile = await resolveDesignerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const products = await prisma.readyToWear.findMany({
      where: { designerId: profile.id },
      include: {
        category: true,
        images: true,
        sizeVariations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    let featuredRows: Array<{ productId: string; section: string }> = [];
    if (products.length > 0) {
      try {
        featuredRows = await prisma.featuredProduct.findMany({
          where: {
            productType: 'READY_TO_WEAR',
            productId: { in: products.map((item) => item.id) },
            isActive: true,
          },
          select: {
            productId: true,
            section: true,
          },
        });
      } catch (featuredError) {
        console.warn('[designer/ready-to-wear] Skipping featuredProduct lookup:', featuredError);
      }
    }
    const featuredByProductId = new Map<string, string[]>();
    for (const row of featuredRows) {
      const existing = featuredByProductId.get(row.productId) || [];
      if (!existing.includes(row.section)) existing.push(row.section);
      featuredByProductId.set(row.productId, existing);
    }
    const metadataRows = await Promise.all(
      products.map(async (item) => [item.id, await getProductCurrencyMetadata('READY_TO_WEAR', item.id)] as const)
    );
    const metadataByProductId = new Map<string, any>(metadataRows);

    res.json({
      success: true,
      data: products.map((item) => {
        const featuredSections = featuredByProductId.get(item.id) || [];
        const currencyMeta = metadataByProductId.get(item.id) || null;
        return {
          ...item,
          sizeVariations: Array.isArray(item.sizeVariations)
            ? item.sizeVariations.map((variation: any) => {
                const decoded = decodeReadyToWearVariantKey(variation?.size);
                return {
                  ...variation,
                  size: decoded.size,
                  color: decoded.color,
                  variantKey: decoded.variantKey,
                };
              })
            : [],
          colors: Array.from(
            new Set(
              (Array.isArray(item.sizeVariations) ? item.sizeVariations : [])
                .filter((variation: any) => Number(variation?.stock || 0) > 0)
                .map((variation: any) => decodeReadyToWearVariantKey(variation?.size).color)
                .filter(Boolean)
            )
          ),
          isFeatured: featuredSections.length > 0,
          featuredSections,
          listingCurrencyCode: String(currencyMeta?.currencyCode || 'USD'),
          listingLocalPrice: Number(currencyMeta?.localPrice || item.basePrice || 0),
          listingUsdPrice: Number(currencyMeta?.usdPrice || item.basePrice || 0),
          listingExchangeRate: Number(currencyMeta?.exchangeRate || 1),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Create ready-to-wear product
router.get('/ready-to-wear-size-options', async (_req, res, next) => {
  try {
    const allowedSizes = await readAllowedReadyToWearSizes();
    res.json({
      success: true,
      data: {
        sizes: allowedSizes,
        standardSizes: [...DEFAULT_READY_TO_WEAR_STANDARD_SIZES],
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create ready-to-wear product
router.post('/ready-to-wear', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(10),
      categoryId: z.string().uuid(),
      basePrice: z.number().positive(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      sizes: z.array(z.object({
        size: z.string(),
        color: z.string().max(30).optional(),
        price: z.number().positive(),
        stock: z.number().min(0),
      })).min(1).max(20),
      images: z.array(z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      })).min(3).max(5),
    });

    const data = schema.parse(req.body);
    await assertDesignerCanManageCatalog(req.user!.id, 'upload products');
    const allowedSizes = await readAllowedReadyToWearSizes();
    const normalizedSizes = data.sizes.map((row) => ({
      ...row,
      size: normalizeReadyToWearSize(row.size),
      color: normalizeReadyToWearColor(row.color),
      variantKey: encodeReadyToWearVariantKey(row.size, row.color),
    }));
    const invalidSize = normalizedSizes.find((row) => !allowedSizes.includes(row.size as any));
    if (invalidSize) {
      return res.status(400).json({
        success: false,
        message: `Invalid size "${invalidSize.size}". Allowed sizes: ${allowedSizes.join(', ')}`,
      });
    }
    if (new Set(normalizedSizes.map((row) => row.variantKey)).size !== normalizedSizes.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate ready-to-wear size + color variants are not allowed.',
      });
    }
    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Designer profile not found.' });
    }

    const pricing = await resolveDesignerListingPrice({
      userId: req.user!.id,
      country: profile.country,
      localPriceInput: data.basePrice,
      requestedCurrencyCode: data.priceCurrencyCode,
    });
    const product = await prisma.readyToWear.create({
      data: {
        designerId: profile.id,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        basePrice: pricing.usdPrice,
        status: ProductStatus.PENDING_REVIEW,
        sizeVariations: {
          create: normalizedSizes.map((row) => ({
            size: row.variantKey,
            price: Number((Number(row.price || 0) * pricing.usdPerUnit).toFixed(2)),
            stock: row.stock,
          })),
        },
        images: {
          create: data.images.map((img, i) => ({
            url: img.url,
            alt: img.alt || data.name,
            sortOrder: i,
          })),
        },
      },
      include: {
        category: true,
        sizeVariations: true,
        images: true,
      },
    });
    await setProductCurrencyMetadata({
      userId: req.user!.id,
      productType: 'READY_TO_WEAR',
      productId: product.id,
      currencyCode: pricing.selectedCurrency,
      localPrice: pricing.localPrice,
      usdPrice: pricing.usdPrice,
      exchangeRate: pricing.usdPerUnit,
    });

    res.status(201).json({
      success: true,
      message: 'Ready-to-wear product submitted for review.',
      data: {
        ...product,
        sizeVariations: Array.isArray(product.sizeVariations)
          ? product.sizeVariations.map((variation: any) => {
              const decoded = decodeReadyToWearVariantKey(variation?.size);
              return {
                ...variation,
                size: decoded.size,
                color: decoded.color,
                variantKey: decoded.variantKey,
              };
            })
          : [],
      },
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

// Update ready-to-wear product
router.patch('/ready-to-wear/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().min(10).optional(),
      categoryId: z.string().uuid().optional(),
      basePrice: z.number().positive().optional(),
      priceCurrencyCode: z.string().min(3).max(8).optional(),
      sizes: z
        .array(
          z.object({
            size: z.string(),
            color: z.string().max(30).optional(),
            price: z.number().positive(),
            stock: z.number().min(0),
          })
        )
        .min(1)
        .max(20)
        .optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            alt: z.string().optional(),
          })
        )
        .min(3)
        .max(5)
        .optional(),
    });
    const data = schema.parse(req.body);
    await assertDesignerCanManageCatalog(req.user!.id, 'edit products');
    const allowedSizes = await readAllowedReadyToWearSizes();
    const normalizedSizes = data.sizes
      ? data.sizes.map((row) => ({
          ...row,
          size: normalizeReadyToWearSize(row.size),
          color: normalizeReadyToWearColor(row.color),
          variantKey: encodeReadyToWearVariantKey(row.size, row.color),
        }))
      : undefined;
    if (normalizedSizes) {
      const invalidSize = normalizedSizes.find((row) => !allowedSizes.includes(row.size as any));
      if (invalidSize) {
        return res.status(400).json({
          success: false,
          message: `Invalid size "${invalidSize.size}". Allowed sizes: ${allowedSizes.join(', ')}`,
        });
      }
      if (new Set(normalizedSizes.map((row) => row.variantKey)).size !== normalizedSizes.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate ready-to-wear size + color variants are not allowed.',
        });
      }
    }

    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const existing = await prisma.readyToWear.findFirst({
      where: { id, designerId: profile.id },
      select: { id: true, status: true, basePrice: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Ready-to-wear product not found.',
      });
    }
    const existingCurrencyMeta = await getProductCurrencyMetadata('READY_TO_WEAR', id);
    const pricing =
      data.basePrice !== undefined
        ? await resolveDesignerListingPrice({
            userId: req.user!.id,
            country: profile.country,
            localPriceInput: data.basePrice,
            requestedCurrencyCode: data.priceCurrencyCode,
          })
        : null;
    const nextBasePriceUsd = Number(pricing?.usdPrice ?? existing.basePrice ?? 0);
    const effectiveUsdPerUnit = Number(pricing?.usdPerUnit ?? existingCurrencyMeta?.exchangeRate ?? 1);
    const effectiveCurrencyCode = String(pricing?.selectedCurrency || existingCurrencyMeta?.currencyCode || 'USD');

    const updated = await prisma.$transaction(async (tx) => {
      if (data.sizes) {
        await tx.readyToWearSize.deleteMany({ where: { readyToWearId: id } });
      }
      if (data.images) {
        await tx.readyToWearImage.deleteMany({ where: { readyToWearId: id } });
      }

      const payload: any = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.basePrice !== undefined ? { basePrice: nextBasePriceUsd } : {}),
        status: ProductStatus.PENDING_REVIEW,
      };
      if (normalizedSizes) {
        payload.sizeVariations = {
          create: normalizedSizes.map((row) => ({
            size: row.variantKey,
            price:
              effectiveCurrencyCode === 'USD'
                ? Number(row.price || 0)
                : Number((Number(row.price || 0) * effectiveUsdPerUnit).toFixed(2)),
            stock: row.stock,
          })),
        };
      }
      if (data.images) {
        payload.images = {
          create: data.images.map((img, index) => ({
            url: img.url,
            alt: img.alt || data.name || 'Ready-to-wear image',
            sortOrder: index,
          })),
        };
      }

      return tx.readyToWear.update({
        where: { id },
        data: payload,
        include: {
          category: true,
          sizeVariations: true,
          images: true,
        },
      });
    });

    if (pricing) {
      await setProductCurrencyMetadata({
        userId: req.user!.id,
        productType: 'READY_TO_WEAR',
        productId: id,
        currencyCode: pricing.selectedCurrency,
        localPrice: pricing.localPrice,
        usdPrice: pricing.usdPrice,
        exchangeRate: pricing.usdPerUnit,
      });
    }
    res.json({
      success: true,
      message: 'Ready-to-wear product updated successfully.',
      data: {
        ...updated,
        sizeVariations: Array.isArray(updated.sizeVariations)
          ? updated.sizeVariations.map((variation: any) => {
              const decoded = decodeReadyToWearVariantKey(variation?.size);
              return {
                ...variation,
                size: decoded.size,
                color: decoded.color,
                variantKey: decoded.variantKey,
              };
            })
          : [],
      },
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

const handleReadyToWearSizeStockUpdate = async (req: any, res: any, next: any) => {
  try {
    await assertDesignerCanManageCatalog(req.user!.id, 'update stock');
    const { id } = req.params;
    const schema = z.object({
      sizes: z
        .array(
          z.object({
            size: z.string().min(1),
            color: z.string().max(30).optional(),
            stock: z.number().min(0),
          })
        )
        .min(1)
        .max(20),
    });
    const payload = schema.parse(req.body);
    const normalizedSizes = payload.sizes.map((entry) => ({
      size: normalizeReadyToWearSize(entry.size),
      color: normalizeReadyToWearColor(entry.color),
      stock: Number(entry.stock || 0),
      variantKey: encodeReadyToWearVariantKey(entry.size, entry.color),
    }));
    if (new Set(normalizedSizes.map((entry) => entry.variantKey)).size !== normalizedSizes.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate ready-to-wear size + color variants are not allowed.',
      });
    }

    const profile = await resolveDesignerProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const existing = await prisma.readyToWear.findFirst({
      where: { id, designerId: profile.id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Ready-to-wear product not found.',
      });
    }

    const sizeRows = await prisma.readyToWearSize.findMany({
      where: { readyToWearId: id },
      select: { id: true, size: true },
    });
    const sizeIdByVariantKey = new Map(
      sizeRows.map((row) => [String(row.size || '').trim().toUpperCase(), String(row.id)] as const)
    );

    for (const entry of normalizedSizes) {
      if (!sizeIdByVariantKey.has(entry.variantKey)) {
        return res.status(400).json({
          success: false,
          message: `Variant "${entry.size}/${entry.color}" does not exist on this product.`,
        });
      }
    }

    await prisma.$transaction(
      normalizedSizes.map((entry) =>
        prisma.readyToWearSize.update({
          where: { id: sizeIdByVariantKey.get(entry.variantKey)! },
          data: { stock: entry.stock },
        })
      )
    );

    const updated = await prisma.readyToWear.findFirst({
      where: { id, designerId: profile.id },
      include: {
        sizeVariations: true,
      },
    });

    res.json({
      success: true,
      message: 'Ready-to-wear size stock updated.',
      data: {
        ...updated,
        sizeVariations: Array.isArray(updated?.sizeVariations)
          ? updated!.sizeVariations.map((variation: any) => {
              const decoded = decodeReadyToWearVariantKey(variation?.size);
              return {
                ...variation,
                size: decoded.size,
                color: decoded.color,
                variantKey: decoded.variantKey,
              };
            })
          : [],
      },
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
};
router.patch('/ready-to-wear/:id/size-stock', handleReadyToWearSizeStockUpdate);
router.patch('/ready-to-wear/:id/stock', handleReadyToWearSizeStockUpdate);
router.patch('/ready-to-wear/:id/sizes/stock', handleReadyToWearSizeStockUpdate);

// Get design orders
router.get('/orders', async (req, res, next) => {
  try {
    const profile = await resolveDesignerProfile(req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found.',
      });
    }

    const [designOrders, readyToWearOrders] = await Promise.all([
      prisma.designOrderItem.findMany({
        where: { designerId: profile.id },
        include: {
          design: {
            select: { name: true, images: { take: 1 } },
          },
          order: {
            select: {
              id: true,
              type: true,
              orderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.readyToWearOrderItem.findMany({
        where: {
          readyToWear: {
            designerId: profile.id,
          },
        },
        include: {
          readyToWear: {
            select: { name: true, images: { take: 1 } },
          },
          order: {
            select: {
              id: true,
              type: true,
              orderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const combinedOrders = [
      ...designOrders.map((item) => ({
        ...item,
        kind: 'DESIGN_ORDER',
      })),
      ...readyToWearOrders.map((item) => ({
        ...item,
        kind: 'READY_TO_WEAR_ORDER',
      })),
    ].sort(
      (a, b) =>
        new Date(String(b.order?.createdAt || b.createdAt)).getTime() -
        new Date(String(a.order?.createdAt || a.createdAt)).getTime()
    );

    res.json({
      success: true,
      data: combinedOrders,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
