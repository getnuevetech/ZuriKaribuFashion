import { randomUUID } from 'crypto';
import { prisma, ProductStatus, ProductType } from '../db';

const STOCK_MONITOR_SETTINGS_KEY = 'stock_monitor_settings_v1';

export type StockMonitorSettings = {
  threshold: number;
};

export type StockMonitorRow = {
  productId: string;
  productType: 'FABRIC' | 'READY_TO_WEAR';
  name: string;
  ownerName: string;
  ownerCountry: string;
  ownerUserId: string | null;
  stockValue: number;
  status: ProductStatus;
  isAvailable: boolean;
  updatedAt: string;
};

let stockMonitorSchemaEnsured = false;

const normalizeThreshold = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100000, Math.floor(parsed)));
};

const normalizeStatusToken = (value: unknown): ProductStatus => {
  const token = String(value || '')
    .trim()
    .toUpperCase() as ProductStatus;
  return Object.values(ProductStatus).includes(token) ? token : ProductStatus.DRAFT;
};

const computeReadyToWearTotalStock = (rows: Array<{ stock: number }> | undefined | null) =>
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Math.max(0, Number(row?.stock || 0)), 0);

const computeAvailability = (stockValue: number, status: ProductStatus) => {
  const stock = Math.max(0, Number(stockValue || 0));
  return stock > 0 && status === ProductStatus.APPROVED;
};

const ensureStockMonitorSchema = async () => {
  if (stockMonitorSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AdminStockSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "threshold" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminStockSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AdminStockSetting_key_key"
     ON "AdminStockSetting"("key")`
  );
  stockMonitorSchemaEnsured = true;
};

const sendVendorOutOfStockNotification = async (params: {
  userId: string | null | undefined;
  productName: string;
  productType: 'FABRIC' | 'READY_TO_WEAR';
}) => {
  const userId = String(params.userId || '').trim();
  if (!userId) return;
  await prisma.notification.create({
    data: {
      userId,
      type: 'SYSTEM',
      title: 'Product auto-disabled: out of stock',
      message: `${params.productType === 'FABRIC' ? 'Fabric' : 'Ready-to-wear'} product "${params.productName}" was automatically disabled because stock reached 0.`,
    },
  });
};

export async function readStockMonitorSettings() {
  await ensureStockMonitorSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; threshold: number; updatedAt: Date | string }>>(
    `SELECT "id", "threshold", "updatedAt"
     FROM "AdminStockSetting"
     WHERE "key" = $1
     LIMIT 1`,
    STOCK_MONITOR_SETTINGS_KEY
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      updatedAt: null as string | null,
      settings: {
        threshold: 0,
      } satisfies StockMonitorSettings,
    };
  }
  return {
    rowId: String(row.id),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    settings: {
      threshold: normalizeThreshold(row.threshold),
    } satisfies StockMonitorSettings,
  };
}

export async function writeStockMonitorSettings(input: Partial<StockMonitorSettings>) {
  await ensureStockMonitorSchema();
  const existing = await readStockMonitorSettings();
  const threshold =
    input.threshold === undefined ? normalizeThreshold(existing.settings.threshold) : normalizeThreshold(input.threshold);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "AdminStockSetting"
       SET "threshold" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2`,
      threshold,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AdminStockSetting" ("id", "key", "threshold", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      randomUUID(),
      STOCK_MONITOR_SETTINGS_KEY,
      threshold
    );
  }
  const latest = await readStockMonitorSettings();
  return latest.settings;
}

export async function syncFabricAvailabilityById(
  fabricId: string,
  options?: { notifyVendor?: boolean }
): Promise<{ productId: string; changed: boolean; isAvailable: boolean; stockValue: number } | null> {
  const row = await prisma.fabric.findUnique({
    where: { id: fabricId },
    select: {
      id: true,
      name: true,
      stockYards: true,
      status: true,
      isAvailable: true,
      seller: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!row) return null;
  const stockValue = Math.max(0, Number(row.stockYards || 0));
  const status = normalizeStatusToken(row.status);
  const nextAvailability = computeAvailability(stockValue, status);
  const previousAvailability = Boolean(row.isAvailable);
  if (previousAvailability !== nextAvailability) {
    await prisma.fabric.update({
      where: { id: row.id },
      data: { isAvailable: nextAvailability },
    });
    if (!nextAvailability && previousAvailability && stockValue <= 0 && options?.notifyVendor !== false) {
      await sendVendorOutOfStockNotification({
        userId: row.seller?.userId || null,
        productName: row.name,
        productType: 'FABRIC',
      });
    }
  }
  return {
    productId: row.id,
    changed: previousAvailability !== nextAvailability,
    isAvailable: nextAvailability,
    stockValue,
  };
}

export async function syncReadyToWearAvailabilityById(
  readyToWearId: string,
  options?: { notifyVendor?: boolean }
): Promise<{ productId: string; changed: boolean; isAvailable: boolean; stockValue: number } | null> {
  const row = await prisma.readyToWear.findUnique({
    where: { id: readyToWearId },
    select: {
      id: true,
      name: true,
      status: true,
      isAvailable: true,
      sizeVariations: { select: { stock: true } },
      designer: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!row) return null;
  const stockValue = computeReadyToWearTotalStock(row.sizeVariations as Array<{ stock: number }>);
  const status = normalizeStatusToken(row.status);
  const nextAvailability = computeAvailability(stockValue, status);
  const previousAvailability = Boolean(row.isAvailable);
  if (previousAvailability !== nextAvailability) {
    await prisma.readyToWear.update({
      where: { id: row.id },
      data: { isAvailable: nextAvailability },
    });
    if (!nextAvailability && previousAvailability && stockValue <= 0 && options?.notifyVendor !== false) {
      await sendVendorOutOfStockNotification({
        userId: row.designer?.userId || null,
        productName: row.name,
        productType: 'READY_TO_WEAR',
      });
    }
  }
  return {
    productId: row.id,
    changed: previousAvailability !== nextAvailability,
    isAvailable: nextAvailability,
    stockValue,
  };
}

export async function syncProductAvailabilityByType(
  productType: ProductType | 'FABRIC' | 'READY_TO_WEAR',
  productId: string,
  options?: { notifyVendor?: boolean }
) {
  if (String(productType).toUpperCase() === 'FABRIC') {
    return syncFabricAvailabilityById(productId, options);
  }
  if (String(productType).toUpperCase() === 'READY_TO_WEAR') {
    return syncReadyToWearAvailabilityById(productId, options);
  }
  return null;
}

export async function syncAllStockAvailability(options?: { notifyVendor?: boolean }) {
  const [fabrics, readyRows] = await Promise.all([
    prisma.fabric.findMany({
      select: { id: true },
    }),
    prisma.readyToWear.findMany({
      select: { id: true },
    }),
  ]);
  let changed = 0;
  let disabledOutOfStock = 0;
  let reenabledInStock = 0;
  for (const row of fabrics) {
    const result = await syncFabricAvailabilityById(row.id, options);
    if (!result?.changed) continue;
    changed += 1;
    if (result.isAvailable) reenabledInStock += 1;
    else disabledOutOfStock += 1;
  }
  for (const row of readyRows) {
    const result = await syncReadyToWearAvailabilityById(row.id, options);
    if (!result?.changed) continue;
    changed += 1;
    if (result.isAvailable) reenabledInStock += 1;
    else disabledOutOfStock += 1;
  }
  return {
    changed,
    disabledOutOfStock,
    reenabledInStock,
  };
}

export async function listStockMonitorRows(threshold: number): Promise<StockMonitorRow[]> {
  const normalizedThreshold = normalizeThreshold(threshold);
  const [fabrics, readyRows] = await Promise.all([
    prisma.fabric.findMany({
      select: {
        id: true,
        name: true,
        stockYards: true,
        status: true,
        isAvailable: true,
        updatedAt: true,
        seller: {
          select: {
            userId: true,
            businessName: true,
            country: true,
          },
        },
      },
    }),
    prisma.readyToWear.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        isAvailable: true,
        updatedAt: true,
        sizeVariations: {
          select: { stock: true },
        },
        designer: {
          select: {
            userId: true,
            businessName: true,
            country: true,
          },
        },
      },
    }),
  ]);

  const fabricRows: StockMonitorRow[] = fabrics
    .map((row) => ({
      productId: row.id,
      productType: 'FABRIC' as const,
      name: row.name,
      ownerName: String(row.seller?.businessName || 'Fabric Seller'),
      ownerCountry: String(row.seller?.country || ''),
      ownerUserId: row.seller?.userId ? String(row.seller.userId) : null,
      stockValue: Math.max(0, Number(row.stockYards || 0)),
      status: normalizeStatusToken(row.status),
      isAvailable: Boolean(row.isAvailable),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    }))
    .filter((row) => row.stockValue <= normalizedThreshold);

  const readyToWearRows: StockMonitorRow[] = readyRows
    .map((row) => ({
      productId: row.id,
      productType: 'READY_TO_WEAR' as const,
      name: row.name,
      ownerName: String(row.designer?.businessName || 'Designer'),
      ownerCountry: String(row.designer?.country || ''),
      ownerUserId: row.designer?.userId ? String(row.designer.userId) : null,
      stockValue: computeReadyToWearTotalStock(row.sizeVariations as Array<{ stock: number }>),
      status: normalizeStatusToken(row.status),
      isAvailable: Boolean(row.isAvailable),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    }))
    .filter((row) => row.stockValue <= normalizedThreshold);

  return [...fabricRows, ...readyToWearRows].sort((a, b) => {
    if (a.stockValue !== b.stockValue) return a.stockValue - b.stockValue;
    return Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt));
  });
}
