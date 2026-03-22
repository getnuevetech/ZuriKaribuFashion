import { randomUUID } from 'crypto';
import { prisma } from '../db';

export type ProductChangeRole = 'FABRIC_SELLER' | 'FASHION_DESIGNER';
export type ProductChangeProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';

type ProductEditPolicySettings = {
  defaultGrantDurationHours: number;
  allowedFieldsByRole: Record<ProductChangeRole, Record<ProductChangeProductType, string[]>>;
};

type ActiveProductEditGrant = {
  requestId: string;
  grantAllChanges: boolean;
  grantedFields: string[];
  grantEndsAt: string | null;
};

type ProductEditFieldCatalogEntry = {
  key: string;
  label: string;
  productType: ProductChangeProductType;
};

const PRODUCT_EDIT_FIELD_CATALOG: Record<ProductChangeProductType, ProductEditFieldCatalogEntry[]> = {
  FABRIC: [
    { key: 'name', label: 'Product name', productType: 'FABRIC' },
    { key: 'description', label: 'Description', productType: 'FABRIC' },
    { key: 'materialTypeId', label: 'Material type', productType: 'FABRIC' },
    { key: 'fabricCategoryId', label: 'Fabric category', productType: 'FABRIC' },
    { key: 'predominantColor', label: 'Predominant color', productType: 'FABRIC' },
    { key: 'sellerPrice', label: 'Price', productType: 'FABRIC' },
    { key: 'minYards', label: 'Minimum yard', productType: 'FABRIC' },
    { key: 'stockYards', label: 'Stock level', productType: 'FABRIC' },
    { key: 'images', label: 'Images', productType: 'FABRIC' },
  ],
  DESIGN: [
    { key: 'name', label: 'Product name', productType: 'DESIGN' },
    { key: 'description', label: 'Description', productType: 'DESIGN' },
    { key: 'categoryId', label: 'Style/category', productType: 'DESIGN' },
    { key: 'predominantColor', label: 'Predominant color', productType: 'DESIGN' },
    { key: 'basePrice', label: 'Price', productType: 'DESIGN' },
    { key: 'suitableFabricIds', label: 'Suitable fabrics', productType: 'DESIGN' },
    { key: 'measurementVariables', label: 'Required measurements', productType: 'DESIGN' },
    { key: 'images', label: 'Images', productType: 'DESIGN' },
  ],
  READY_TO_WEAR: [
    { key: 'name', label: 'Product name', productType: 'READY_TO_WEAR' },
    { key: 'description', label: 'Description', productType: 'READY_TO_WEAR' },
    { key: 'categoryId', label: 'Style/category', productType: 'READY_TO_WEAR' },
    { key: 'materialTypeId', label: 'Material type', productType: 'READY_TO_WEAR' },
    { key: 'fabricCategoryId', label: 'Fabric category', productType: 'READY_TO_WEAR' },
    { key: 'predominantColor', label: 'Predominant color', productType: 'READY_TO_WEAR' },
    { key: 'basePrice', label: 'Price', productType: 'READY_TO_WEAR' },
    { key: 'sizes', label: 'Variants (add/edit)', productType: 'READY_TO_WEAR' },
    { key: 'images', label: 'Images', productType: 'READY_TO_WEAR' },
  ],
};

const PRODUCT_EDIT_POLICY_DEFAULTS: ProductEditPolicySettings = {
  defaultGrantDurationHours: 48,
  allowedFieldsByRole: {
    FABRIC_SELLER: {
      FABRIC: ['sellerPrice', 'stockYards', 'minYards', 'materialTypeId', 'fabricCategoryId'],
      DESIGN: [],
      READY_TO_WEAR: [],
    },
    FASHION_DESIGNER: {
      FABRIC: [],
      DESIGN: ['basePrice', 'measurementVariables'],
      READY_TO_WEAR: ['basePrice', 'sizes', 'materialTypeId', 'fabricCategoryId'],
    },
  },
};

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeFieldKeysForProductType = (
  productType: ProductChangeProductType,
  value: unknown,
  fallback: string[]
): string[] => {
  const allowed = new Set(PRODUCT_EDIT_FIELD_CATALOG[productType].map((entry) => entry.key));
  const normalized = Array.from(
    new Set(
      parseStringArray(value)
        .map((entry) => String(entry || '').trim())
        .filter((entry) => allowed.has(entry))
    )
  );
  return normalized.length > 0 || fallback.length === 0 ? normalized : [...fallback];
};

const normalizePolicySettings = (raw: unknown): ProductEditPolicySettings => {
  const row = parseObject(raw);
  const allowedFieldsByRoleRaw = parseObject(row.allowedFieldsByRole);
  const normalized: ProductEditPolicySettings = {
    defaultGrantDurationHours: Math.max(
      1,
      Math.min(24 * 30, Number(row.defaultGrantDurationHours || PRODUCT_EDIT_POLICY_DEFAULTS.defaultGrantDurationHours))
    ),
    allowedFieldsByRole: {
      FABRIC_SELLER: {
        FABRIC: normalizeFieldKeysForProductType(
          'FABRIC',
          parseObject(allowedFieldsByRoleRaw.FABRIC_SELLER).FABRIC,
          PRODUCT_EDIT_POLICY_DEFAULTS.allowedFieldsByRole.FABRIC_SELLER.FABRIC
        ),
        DESIGN: normalizeFieldKeysForProductType('DESIGN', parseObject(allowedFieldsByRoleRaw.FABRIC_SELLER).DESIGN, []),
        READY_TO_WEAR: normalizeFieldKeysForProductType(
          'READY_TO_WEAR',
          parseObject(allowedFieldsByRoleRaw.FABRIC_SELLER).READY_TO_WEAR,
          []
        ),
      },
      FASHION_DESIGNER: {
        FABRIC: normalizeFieldKeysForProductType('FABRIC', parseObject(allowedFieldsByRoleRaw.FASHION_DESIGNER).FABRIC, []),
        DESIGN: normalizeFieldKeysForProductType(
          'DESIGN',
          parseObject(allowedFieldsByRoleRaw.FASHION_DESIGNER).DESIGN,
          PRODUCT_EDIT_POLICY_DEFAULTS.allowedFieldsByRole.FASHION_DESIGNER.DESIGN
        ),
        READY_TO_WEAR: normalizeFieldKeysForProductType(
          'READY_TO_WEAR',
          parseObject(allowedFieldsByRoleRaw.FASHION_DESIGNER).READY_TO_WEAR,
          PRODUCT_EDIT_POLICY_DEFAULTS.allowedFieldsByRole.FASHION_DESIGNER.READY_TO_WEAR
        ),
      },
    },
  };
  return normalized;
};

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureProductChangeRequestSchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ProductChangeRequestConfig" (
          "id" TEXT NOT NULL,
          "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "updatedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ProductChangeRequestConfig_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ProductChangeRequestConfig" ("id","settings","createdAt","updatedAt")
         VALUES ('default',$1::jsonb,NOW(),NOW())
         ON CONFLICT ("id") DO NOTHING`,
        JSON.stringify(PRODUCT_EDIT_POLICY_DEFAULTS)
      );
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ProductChangeRequest" (
          "id" TEXT NOT NULL,
          "requesterUserId" TEXT NOT NULL,
          "requesterRole" TEXT NOT NULL,
          "productType" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "requestedFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "message" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "grantAllChanges" BOOLEAN NOT NULL DEFAULT false,
          "grantedFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "grantStartsAt" TIMESTAMP(3),
          "grantEndsAt" TIMESTAMP(3),
          "reviewNote" TEXT,
          "reviewedById" TEXT,
          "reviewedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ProductChangeRequest_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductChangeRequest_requester_idx"
         ON "ProductChangeRequest"("requesterUserId","status","updatedAt")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductChangeRequest_product_idx"
         ON "ProductChangeRequest"("productType","productId","status","updatedAt")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductChangeRequest_createdAt_idx"
         ON "ProductChangeRequest"("createdAt")`
      );
      schemaEnsured = true;
    })();
  }
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

export async function readProductEditPolicySettings(): Promise<ProductEditPolicySettings> {
  await ensureProductChangeRequestSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ settings: unknown }>>(
    `SELECT "settings" FROM "ProductChangeRequestConfig" WHERE "id" = 'default' LIMIT 1`
  );
  return normalizePolicySettings(rows[0]?.settings || PRODUCT_EDIT_POLICY_DEFAULTS);
}

export async function saveProductEditPolicySettings(settings: unknown, updatedById?: string | null) {
  await ensureProductChangeRequestSchema();
  const normalized = normalizePolicySettings(settings);
  await prisma.$executeRawUnsafe(
    `UPDATE "ProductChangeRequestConfig"
     SET "settings" = $2::jsonb,
         "updatedById" = $3,
         "updatedAt" = NOW()
     WHERE "id" = 'default'`,
    'default',
    JSON.stringify(normalized),
    updatedById || null
  );
  return normalized;
}

export function getProductEditFieldCatalog() {
  return (Object.keys(PRODUCT_EDIT_FIELD_CATALOG) as ProductChangeProductType[]).flatMap((productType) =>
    PRODUCT_EDIT_FIELD_CATALOG[productType].map((entry) => ({ ...entry }))
  );
}

export function getFieldKeysForProductType(productType: ProductChangeProductType): string[] {
  return PRODUCT_EDIT_FIELD_CATALOG[productType].map((entry) => entry.key);
}

export function normalizeRequestedFieldKeys(productType: ProductChangeProductType, value: unknown): string[] {
  return normalizeFieldKeysForProductType(productType, value, []);
}

export function getAllowedFieldsForApprovedProduct(params: {
  role: ProductChangeRole;
  productType: ProductChangeProductType;
  policy: ProductEditPolicySettings;
  activeGrant?: ActiveProductEditGrant | null;
}): string[] {
  const base = [...(params.policy.allowedFieldsByRole[params.role]?.[params.productType] || [])];
  // Keep designer required-measurement edits available on approved CTW products.
  if (params.role === 'FASHION_DESIGNER' && params.productType === 'DESIGN' && !base.includes('measurementVariables')) {
    base.push('measurementVariables');
  }
  const allTypeFields = getFieldKeysForProductType(params.productType);
  const grantFields =
    params.activeGrant?.grantAllChanges === true ? allTypeFields : params.activeGrant?.grantedFields || [];
  return Array.from(new Set([...base, ...grantFields]));
}

export async function readActiveProductEditGrant(params: {
  requesterUserId: string;
  requesterRole: ProductChangeRole;
  productType: ProductChangeProductType;
  productId: string;
}): Promise<ActiveProductEditGrant | null> {
  await ensureProductChangeRequestSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","grantAllChanges","grantedFields","grantEndsAt"
     FROM "ProductChangeRequest"
     WHERE "requesterUserId" = $1
       AND "requesterRole" = $2
       AND "productType" = $3
       AND "productId" = $4
       AND "status" = 'APPROVED'
       AND ("grantStartsAt" IS NULL OR "grantStartsAt" <= NOW())
       AND ("grantEndsAt" IS NULL OR "grantEndsAt" >= NOW())
     ORDER BY COALESCE("reviewedAt","updatedAt","createdAt") DESC
     LIMIT 1`,
    params.requesterUserId,
    params.requesterRole,
    params.productType,
    params.productId
  );
  const row = rows[0];
  if (!row) return null;
  return {
    requestId: String(row.id || ''),
    grantAllChanges: row.grantAllChanges === true,
    grantedFields: normalizeRequestedFieldKeys(params.productType, row.grantedFields),
    grantEndsAt: row.grantEndsAt ? new Date(row.grantEndsAt).toISOString() : null,
  };
}

export async function readActiveProductEditGrantsForProducts(params: {
  requesterUserId: string;
  requesterRole: ProductChangeRole;
  productType: ProductChangeProductType;
  productIds: string[];
}): Promise<Record<string, ActiveProductEditGrant>> {
  await ensureProductChangeRequestSchema();
  const productIds = Array.from(new Set((params.productIds || []).map((entry) => String(entry || '').trim()).filter(Boolean)));
  if (productIds.length === 0) return {};
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT DISTINCT ON ("productId")
        "id","productId","grantAllChanges","grantedFields","grantEndsAt","reviewedAt","updatedAt","createdAt"
     FROM "ProductChangeRequest"
     WHERE "requesterUserId" = $1
       AND "requesterRole" = $2
       AND "productType" = $3
       AND "productId" = ANY($4::text[])
       AND "status" = 'APPROVED'
       AND ("grantStartsAt" IS NULL OR "grantStartsAt" <= NOW())
       AND ("grantEndsAt" IS NULL OR "grantEndsAt" >= NOW())
     ORDER BY "productId", COALESCE("reviewedAt","updatedAt","createdAt") DESC`,
    params.requesterUserId,
    params.requesterRole,
    params.productType,
    productIds
  );
  return (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => {
      const productId = String(row.productId || '').trim();
      if (!productId) return acc;
      acc[productId] = {
        requestId: String(row.id || ''),
        grantAllChanges: row.grantAllChanges === true,
        grantedFields: normalizeRequestedFieldKeys(params.productType, row.grantedFields),
        grantEndsAt: row.grantEndsAt ? new Date(row.grantEndsAt).toISOString() : null,
      };
      return acc;
    },
    {} as Record<string, ActiveProductEditGrant>
  );
}

export async function createProductChangeRequest(params: {
  requesterUserId: string;
  requesterRole: ProductChangeRole;
  productType: ProductChangeProductType;
  productId: string;
  message: string;
  requestedFields: string[];
}) {
  await ensureProductChangeRequestSchema();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductChangeRequest"
      ("id","requesterUserId","requesterRole","productType","productId","requestedFields","message","status","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'PENDING',NOW(),NOW())`,
    id,
    params.requesterUserId,
    params.requesterRole,
    params.productType,
    params.productId,
    JSON.stringify(normalizeRequestedFieldKeys(params.productType, params.requestedFields)),
    String(params.message || '').trim()
  );
  return id;
}

