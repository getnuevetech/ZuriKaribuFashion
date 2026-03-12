import { prisma } from '../db';

export type TryOnInsightRole = 'ADMIN' | 'QA' | 'DESIGNER' | 'SELLER';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const maskCustomerName = (name: string, email: string) => {
  const trimmedName = String(name || '').trim();
  if (trimmedName) return trimmedName;
  const token = String(email || '').trim();
  if (!token) return 'Customer';
  return `Customer ${token.slice(0, 3)}***`;
};

const toMeasurementSummary = (input: unknown) => {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    output[String(key)] = Number(parsed.toFixed(2));
  }
  return output;
};

export async function readTryOnInsights(params: {
  role: TryOnInsightRole;
  userId?: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(250, Number(params.limit || 80)));
  const rows = await prisma.virtualTryOn.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      customerMeasurement: {
        include: {
          customerProfile: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });
  const designIds = Array.from(
    new Set(
      rows
        .filter((row) => String(row.fabricId || '').toUpperCase() !== 'READY_TO_WEAR')
        .map((row) => String(row.designId || '').trim())
        .filter(Boolean)
    )
  );
  const readyToWearIds = Array.from(
    new Set(
      rows
        .filter((row) => String(row.fabricId || '').toUpperCase() === 'READY_TO_WEAR')
        .map((row) => String(row.designId || '').trim())
        .filter(Boolean)
    )
  );
  const [designRows, readyRows] = await Promise.all([
    designIds.length > 0
      ? prisma.design.findMany({
          where: { id: { in: designIds } },
          select: {
            id: true,
            name: true,
            designer: { select: { userId: true, businessName: true, country: true } },
          },
        })
      : [],
    readyToWearIds.length > 0
      ? prisma.readyToWear.findMany({
          where: { id: { in: readyToWearIds } },
          select: {
            id: true,
            name: true,
            designer: { select: { userId: true, businessName: true, country: true } },
          },
        })
      : [],
  ]);
  const designById = new Map(designRows.map((row) => [row.id, row] as const));
  const readyById = new Map(readyRows.map((row) => [row.id, row] as const));

  const scopedRows = rows.filter((row) => {
    if (params.role === 'ADMIN' || params.role === 'QA') return true;
    if (params.role === 'SELLER') return true;
    if (params.role === 'DESIGNER') {
      const isReady = String(row.fabricId || '').toUpperCase() === 'READY_TO_WEAR';
      if (isReady) {
        const ready = readyById.get(String(row.designId || '').trim());
        return ready?.designer?.userId === params.userId;
      }
      const design = designById.get(String(row.designId || '').trim());
      return design?.designer?.userId === params.userId;
    }
    return false;
  });

  const measurementsAccumulator = new Map<string, { sum: number; count: number }>();
  for (const row of scopedRows) {
    const measurementMap = toMeasurementSummary(row.customerMeasurement?.measurements);
    for (const [key, value] of Object.entries(measurementMap)) {
      const current = measurementsAccumulator.get(key) || { sum: 0, count: 0 };
      current.sum += Number(value);
      current.count += 1;
      measurementsAccumulator.set(key, current);
    }
  }
  const measurementAverages: Record<string, number> = {};
  for (const [key, value] of measurementsAccumulator.entries()) {
    if (value.count <= 0) continue;
    measurementAverages[key] = Number((value.sum / value.count).toFixed(2));
  }

  const recentTryOns = scopedRows.slice(0, limit).map((row) => {
    const customerUser = row.customerMeasurement?.customerProfile?.user;
    const fullName = `${String(customerUser?.firstName || '').trim()} ${String(customerUser?.lastName || '').trim()}`.trim();
    const customerName =
      params.role === 'ADMIN' || params.role === 'QA'
        ? fullName || String(customerUser?.email || '').trim() || 'Customer'
        : maskCustomerName(fullName, String(customerUser?.email || ''));
    const isReady = String(row.fabricId || '').toUpperCase() === 'READY_TO_WEAR';
    const design = designById.get(String(row.designId || '').trim());
    const ready = readyById.get(String(row.designId || '').trim());
    const productName = isReady ? ready?.name || 'Ready-To-Wear' : design?.name || 'Design';
    const ownerName = isReady
      ? ready?.designer?.businessName || 'Designer'
      : design?.designer?.businessName || 'Designer';
    const country = isReady
      ? String(ready?.designer?.country || '')
      : String(design?.designer?.country || '');
    return {
      id: row.id,
      createdAt: row.createdAt,
      productType: isReady ? 'READY_TO_WEAR' : 'DESIGN',
      productId: String(row.designId || ''),
      productName,
      ownerName,
      country,
      customerName,
      measurements: toMeasurementSummary(row.customerMeasurement?.measurements),
      likes: row.isLiked === true,
    };
  });

  return {
    totalTryOns: scopedRows.length,
    measurementAverages,
    recentTryOns,
  };
}

export const readCustomerTryOnProfileState = (avatarData: unknown) => {
  const source = avatarData && typeof avatarData === 'object' ? (avatarData as Record<string, unknown>) : {};
  return {
    freeUsedCount: Math.max(0, Math.floor(toNumber(source.tryOnFreeUsedCount))),
    paidCreditsRemaining: Math.max(0, Math.floor(toNumber(source.tryOnPaidCreditsRemaining))),
    totalRuns: Math.max(0, Math.floor(toNumber(source.tryOnTotalRuns))),
    purchaseCount: Math.max(0, Math.floor(toNumber(source.tryOnPurchaseCount))),
  };
};
