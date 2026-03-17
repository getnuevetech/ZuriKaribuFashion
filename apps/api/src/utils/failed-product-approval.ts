import { randomUUID } from 'crypto';
import { ProductType, prisma } from '../db';

const ROLE_ADMIN = 'ADMINISTRATOR';
const ROLE_SELLER = 'FABRIC_SELLER';
const ROLE_DESIGNER = 'FASHION_DESIGNER';

type FailedApprovalTicketStatus = 'OPEN' | 'RESOLVED';

export type FailedProductApprovalTicketRow = {
  id: string;
  productType: ProductType;
  productId: string;
  productName: string;
  productCategory: string;
  ownerUserId: string;
  ownerRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
  ownerName: string;
  latestFailureReason: string;
  status: FailedApprovalTicketStatus;
  createdAt: string;
  updatedAt: string;
};

export type FailedProductApprovalTicketMessageRow = {
  id: string;
  ticketId: string;
  senderUserId: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

export const ensureFailedProductApprovalTicketSchema = async () => {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "FailedProductApprovalTicket" (
          "id" TEXT NOT NULL,
          "productType" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "productName" TEXT NOT NULL DEFAULT '',
          "productCategory" TEXT NOT NULL DEFAULT '',
          "ownerUserId" TEXT NOT NULL,
          "ownerRole" TEXT NOT NULL,
          "ownerName" TEXT NOT NULL DEFAULT '',
          "latestFailureReason" TEXT NOT NULL DEFAULT '',
          "status" TEXT NOT NULL DEFAULT 'OPEN',
          "createdById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FailedProductApprovalTicket_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "FailedProductApprovalTicket_product_key"
         ON "FailedProductApprovalTicket"("productType","productId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "FailedProductApprovalTicket_owner_idx"
         ON "FailedProductApprovalTicket"("ownerUserId","status","updatedAt")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "FailedProductApprovalTicketMessage" (
          "id" TEXT NOT NULL,
          "ticketId" TEXT NOT NULL,
          "senderUserId" TEXT NOT NULL,
          "senderRole" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FailedProductApprovalTicketMessage_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "FailedProductApprovalTicketMessage_ticket_idx"
         ON "FailedProductApprovalTicketMessage"("ticketId","createdAt")`
      );
      schemaEnsured = true;
    })();
  }
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
};

const mapTicketRow = (row: any): FailedProductApprovalTicketRow => ({
  id: String(row?.id || ''),
  productType: String(row?.productType || ProductType.FABRIC) as ProductType,
  productId: String(row?.productId || ''),
  productName: String(row?.productName || ''),
  productCategory: String(row?.productCategory || ''),
  ownerUserId: String(row?.ownerUserId || ''),
  ownerRole:
    String(row?.ownerRole || '').toUpperCase() === ROLE_DESIGNER
      ? ROLE_DESIGNER
      : ROLE_SELLER,
  ownerName: String(row?.ownerName || ''),
  latestFailureReason: String(row?.latestFailureReason || ''),
  status: String(row?.status || 'OPEN').toUpperCase() === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
  createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
});

const mapTicketMessageRow = (row: any): FailedProductApprovalTicketMessageRow => ({
  id: String(row?.id || ''),
  ticketId: String(row?.ticketId || ''),
  senderUserId: String(row?.senderUserId || ''),
  senderRole: String(row?.senderRole || ''),
  body: String(row?.body || ''),
  createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
});

const resolveProductOwnerMeta = async (productType: ProductType, productId: string) => {
  if (productType === ProductType.FABRIC) {
    const row = await prisma.fabric.findUnique({
      where: { id: productId },
      include: {
        seller: { select: { userId: true, businessName: true } },
        materialType: { select: { name: true } },
      },
    });
    if (!row?.seller?.userId) return null;
    return {
      productName: String(row.name || ''),
      productCategory: String(row.materialType?.name || 'Material'),
      ownerUserId: String(row.seller.userId || ''),
      ownerRole: ROLE_SELLER,
      ownerName: String(row.seller.businessName || 'Seller'),
    };
  }
  if (productType === ProductType.DESIGN) {
    const row = await prisma.design.findUnique({
      where: { id: productId },
      include: {
        designer: { select: { userId: true, businessName: true } },
        category: { select: { name: true } },
      },
    });
    if (!row?.designer?.userId) return null;
    return {
      productName: String(row.name || ''),
      productCategory: String(row.category?.name || 'Category'),
      ownerUserId: String(row.designer.userId || ''),
      ownerRole: ROLE_DESIGNER,
      ownerName: String(row.designer.businessName || 'Designer'),
    };
  }
  const row = await prisma.readyToWear.findUnique({
    where: { id: productId },
    include: {
      designer: { select: { userId: true, businessName: true } },
      category: { select: { name: true } },
    },
  });
  if (!row?.designer?.userId) return null;
  return {
    productName: String(row.name || ''),
    productCategory: String(row.category?.name || 'Category'),
    ownerUserId: String(row.designer.userId || ''),
    ownerRole: ROLE_DESIGNER,
    ownerName: String(row.designer.businessName || 'Designer'),
  };
};

export const getFailedProductApprovalTicketByProduct = async (input: {
  productType: ProductType;
  productId: string;
}) => {
  await ensureFailedProductApprovalTicketSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicket"
     WHERE "productType" = $1 AND "productId" = $2
     LIMIT 1`,
    input.productType,
    input.productId
  );
  return rows.length > 0 ? mapTicketRow(rows[0]) : null;
};

export const getFailedProductApprovalTicketById = async (ticketId: string) => {
  await ensureFailedProductApprovalTicketSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicket"
     WHERE "id" = $1
     LIMIT 1`,
    ticketId
  );
  return rows.length > 0 ? mapTicketRow(rows[0]) : null;
};

export const syncFailedProductApprovalTicketFromOutcome = async (input: {
  productType: ProductType;
  productId: string;
  technicalFailure: boolean;
  needsCorrection: boolean;
  reason: string;
  createdById?: string | null;
}) => {
  await ensureFailedProductApprovalTicketSchema();
  const current = await getFailedProductApprovalTicketByProduct({
    productType: input.productType,
    productId: input.productId,
  });
  const shouldOpen = input.technicalFailure && input.needsCorrection;
  if (!shouldOpen) {
    if (current && current.status !== 'RESOLVED') {
      await prisma.$executeRawUnsafe(
        `UPDATE "FailedProductApprovalTicket"
         SET "status" = 'RESOLVED', "updatedAt" = NOW()
         WHERE "id" = $1`,
        current.id
      );
    }
    return null;
  }
  const ownerMeta = await resolveProductOwnerMeta(input.productType, input.productId);
  if (!ownerMeta) return null;
  const reason = String(input.reason || '').trim() || 'Automation failed because of a technical issue.';
  const ticketId = current?.id || randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FailedProductApprovalTicket"
      ("id","productType","productId","productName","productCategory","ownerUserId","ownerRole","ownerName","latestFailureReason","status","createdById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10,NOW(),NOW())
     ON CONFLICT ("productType","productId")
     DO UPDATE SET
       "productName" = EXCLUDED."productName",
       "productCategory" = EXCLUDED."productCategory",
       "ownerUserId" = EXCLUDED."ownerUserId",
       "ownerRole" = EXCLUDED."ownerRole",
       "ownerName" = EXCLUDED."ownerName",
       "latestFailureReason" = EXCLUDED."latestFailureReason",
       "status" = 'OPEN',
       "updatedAt" = NOW()`,
    ticketId,
    input.productType,
    input.productId,
    ownerMeta.productName,
    ownerMeta.productCategory,
    ownerMeta.ownerUserId,
    ownerMeta.ownerRole,
    ownerMeta.ownerName,
    reason,
    input.createdById || null
  );
  const reasonChanged = !current || String(current.latestFailureReason || '').trim() !== reason;
  if (reasonChanged) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FailedProductApprovalTicketMessage"
        ("id","ticketId","senderUserId","senderRole","body","createdAt")
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      randomUUID(),
      ticketId,
      String(input.createdById || 'system'),
      'SYSTEM',
      `Automation failed due to a technical issue after automatic retry.\nReason: ${reason}`
    );
  }
  return getFailedProductApprovalTicketByProduct({
    productType: input.productType,
    productId: input.productId,
  });
};

const filterTickets = (
  rows: FailedProductApprovalTicketRow[],
  input: { search?: string; productType?: ProductType; category?: string }
) => {
  const search = String(input.search || '').trim().toLowerCase();
  const category = String(input.category || '').trim().toLowerCase();
  return rows.filter((row) => {
    if (input.productType && row.productType !== input.productType) return false;
    if (category && String(row.productCategory || '').trim().toLowerCase() !== category) return false;
    if (!search) return true;
    const haystack = `${row.productName} ${row.ownerName} ${row.productCategory} ${row.latestFailureReason}`.toLowerCase();
    return haystack.includes(search);
  });
};

export const listFailedProductApprovalTicketsForAdmin = async (input: {
  search?: string;
  productType?: ProductType;
  category?: string;
  page?: number;
  limit?: number;
}) => {
  await ensureFailedProductApprovalTicketSchema();
  const page = Math.max(1, Number(input.page || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(input.limit || 20) || 20));
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicket"
     WHERE "status" = 'OPEN'
     ORDER BY "updatedAt" DESC`
  );
  const mapped = (Array.isArray(rows) ? rows : []).map(mapTicketRow);
  const filtered = filterTickets(mapped, input);
  const categories = Array.from(new Set(filtered.map((row) => String(row.productCategory || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);
  return {
    rows: paged,
    categories,
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
};

export const listFailedProductApprovalTicketsForOwner = async (input: {
  ownerUserId: string;
  ownerRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}) => {
  await ensureFailedProductApprovalTicketSchema();
  const page = Math.max(1, Number(input.page || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(input.limit || 20) || 20));
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicket"
     WHERE "status" = 'OPEN'
       AND "ownerUserId" = $1
       AND "ownerRole" = $2
     ORDER BY "updatedAt" DESC`,
    input.ownerUserId,
    input.ownerRole
  );
  const mapped = (Array.isArray(rows) ? rows : []).map(mapTicketRow);
  const filtered = filterTickets(mapped, input);
  const categories = Array.from(new Set(filtered.map((row) => String(row.productCategory || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);
  return {
    rows: paged,
    categories,
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
};

export const canAccessFailedProductTicket = (
  ticket: FailedProductApprovalTicketRow,
  actor: { userId: string; role: string }
) => {
  const role = String(actor.role || '').toUpperCase();
  if (role === ROLE_ADMIN) return true;
  return String(ticket.ownerUserId || '') === String(actor.userId || '');
};

export const listFailedProductApprovalTicketMessages = async (ticketId: string) => {
  await ensureFailedProductApprovalTicketSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicketMessage"
     WHERE "ticketId" = $1
     ORDER BY "createdAt" ASC`,
    ticketId
  );
  return (Array.isArray(rows) ? rows : []).map(mapTicketMessageRow);
};

export const createFailedProductApprovalTicketMessage = async (input: {
  ticketId: string;
  senderUserId: string;
  senderRole: string;
  body: string;
}) => {
  await ensureFailedProductApprovalTicketSchema();
  const text = String(input.body || '').trim();
  if (!text) return null;
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FailedProductApprovalTicketMessage"
      ("id","ticketId","senderUserId","senderRole","body","createdAt")
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    id,
    input.ticketId,
    input.senderUserId,
    String(input.senderRole || 'USER'),
    text
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "FailedProductApprovalTicket"
     SET "updatedAt" = NOW()
     WHERE "id" = $1`,
    input.ticketId
  );
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "FailedProductApprovalTicketMessage"
     WHERE "id" = $1
     LIMIT 1`,
    id
  );
  return rows.length > 0 ? mapTicketMessageRow(rows[0]) : null;
};

