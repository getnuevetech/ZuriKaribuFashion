import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

const HELP_CENTER_SETTINGS_KEY = 'HELP_CENTER_CONTENT_V1';

type HelpFaq = {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
};

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
};

type HelpContact = {
  id: string;
  label: string;
  value: string;
  type: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'LINK' | 'OTHER';
  isActive: boolean;
  sortOrder: number;
};

type HelpAudienceContent = {
  heroTitle: string;
  heroSubtitle: string;
  supportHint: string;
  faqs: HelpFaq[];
  articles: HelpArticle[];
  contacts: HelpContact[];
};

type HelpCenterContent = {
  customer: HelpAudienceContent;
  vendor: HelpAudienceContent;
};

const helpFaqSchema = z.object({
  id: z.string().trim().max(80).optional(),
  question: z.string().trim().min(2).max(400),
  answer: z.string().trim().min(2).max(6000),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const helpArticleSchema = z.object({
  id: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(240),
  summary: z.string().trim().min(2).max(1000),
  body: z.string().trim().min(2).max(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const helpContactSchema = z.object({
  id: z.string().trim().max(80).optional(),
  label: z.string().trim().min(2).max(140),
  value: z.string().trim().min(2).max(500),
  type: z.enum(['EMAIL', 'PHONE', 'WHATSAPP', 'LINK', 'OTHER']).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const audiencePatchSchema = z.object({
  heroTitle: z.string().trim().max(240).optional(),
  heroSubtitle: z.string().trim().max(600).optional(),
  supportHint: z.string().trim().max(600).optional(),
  faqs: z.array(helpFaqSchema).max(300).optional(),
  articles: z.array(helpArticleSchema).max(300).optional(),
  contacts: z.array(helpContactSchema).max(300).optional(),
});

const adminPatchSchema = z
  .object({
    customer: audiencePatchSchema.optional(),
    vendor: audiencePatchSchema.optional(),
  })
  .strict();

const DEFAULT_HELP_CENTER_CONTENT: HelpCenterContent = {
  customer: {
    heroTitle: 'Customer Help Center',
    heroSubtitle: 'Learn how to shop, place orders, track deliveries, and resolve issues quickly on ZuriKaribu.',
    supportHint: 'Need direct help? Reach support through chat, ticketing, phone, or WhatsApp if enabled.',
    faqs: [
      {
        id: 'cust-faq-1',
        question: 'How do I place an order?',
        answer:
          'Browse products by category, add your preferred items to cart, then proceed to checkout. Confirm your delivery address and payment method to complete your order.',
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'cust-faq-2',
        question: 'How can I track my order status?',
        answer:
          'Go to your dashboard orders page to view order progress. You can also open a ticket if you need a detailed delivery update.',
        isActive: true,
        sortOrder: 2,
      },
      {
        id: 'cust-faq-3',
        question: 'Can I request changes after placing a custom design order?',
        answer:
          'Yes. If production has not reached the locked stage, use ticket/chat support to request updates. Final approval rules and timelines are controlled by platform workflow settings.',
        isActive: true,
        sortOrder: 3,
      },
    ],
    articles: [
      {
        id: 'cust-art-1',
        title: 'How ordering works from start to delivery',
        summary: 'A complete guide for first-time buyers.',
        body:
          '1) Discover products using category pages and search.\n2) Review sizing, material, and shipping information.\n3) Add items to cart and complete checkout.\n4) Track order milestones from processing to delivery.\n5) Use tickets/chat support for escalations and post-order support.',
        tags: ['orders', 'checkout', 'delivery'],
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'cust-art-2',
        title: 'Payments, refunds, and support channels',
        summary: 'Understand payment options, refund workflows, and where to get help.',
        body:
          'Payments are processed through enabled payment providers configured by admin. For refund or payment disputes, create a support ticket with your order reference so the assigned team can assist quickly.',
        tags: ['payments', 'refunds', 'support'],
        isActive: true,
        sortOrder: 2,
      },
      {
        id: 'cust-art-3',
        title: 'Using chat, tickets, and translation support',
        summary: 'Communicate with support in your preferred language.',
        body:
          'Customer service chat and ticketing can translate content based on configured language preferences. Select your preferred language before starting a conversation for better support experience.',
        tags: ['chat', 'ticketing', 'translation'],
        isActive: true,
        sortOrder: 3,
      },
    ],
    contacts: [
      { id: 'cust-contact-1', label: 'Customer Support Email', value: 'support@zurikaribu.com', type: 'EMAIL', isActive: true, sortOrder: 1 },
      { id: 'cust-contact-2', label: 'Customer Support Phone', value: '+234 000 000 0000', type: 'PHONE', isActive: true, sortOrder: 2 },
    ],
  },
  vendor: {
    heroTitle: 'Seller & Designer Success Center',
    heroSubtitle: 'Operational guidance, policy knowledge, and support channels for sellers and designers.',
    supportHint: 'Need account help? Contact admin operations through ticketing, chat, or WhatsApp routes configured by admin.',
    faqs: [
      {
        id: 'vendor-faq-1',
        question: 'How do I submit products for approval?',
        answer:
          'Use your seller/designer dashboard product section, complete all required fields, and submit. AI + admin workflow will review based on quality and policy checks.',
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'vendor-faq-2',
        question: 'Where can I view failed product approvals?',
        answer:
          'Open your Failed Product Approval section in dashboard. You can review failure reasons and communicate with admin for resolution steps.',
        isActive: true,
        sortOrder: 2,
      },
      {
        id: 'vendor-faq-3',
        question: 'How are support escalations routed?',
        answer:
          'Routing uses admin-managed rules by source/channel and target groups. SLA escalation can reassign your case automatically if response windows expire.',
        isActive: true,
        sortOrder: 3,
      },
    ],
    articles: [
      {
        id: 'vendor-art-1',
        title: 'Vendor onboarding and profile readiness checklist',
        summary: 'Checklist for faster approvals and better catalog visibility.',
        body:
          'Complete business profile, compliance fields, quality images, and country/currency requirements. Keep profile and contact data current for smoother operational routing.',
        tags: ['onboarding', 'profile', 'compliance'],
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'vendor-art-2',
        title: 'Product quality, automation checks, and approvals',
        summary: 'Understand how automation and manual review decisions are made.',
        body:
          'Automation checks evaluate product data completeness, image quality, pricing integrity, and policy controls. Admin users can rerun and review outcomes when needed.',
        tags: ['products', 'automation', 'approval'],
        isActive: true,
        sortOrder: 2,
      },
      {
        id: 'vendor-art-3',
        title: 'Vendor support channels: ticket, chat, and WhatsApp',
        summary: 'How to contact operations and resolve issues faster.',
        body:
          'Use ticketing for traceable cases, chat for live collaboration, and WhatsApp when enabled by admin policy. Routing targets and response ownership are managed by role/group rules.',
        tags: ['support', 'chat', 'whatsapp'],
        isActive: true,
        sortOrder: 3,
      },
    ],
    contacts: [
      { id: 'vendor-contact-1', label: 'Vendor Operations Email', value: 'vendors@zurikaribu.com', type: 'EMAIL', isActive: true, sortOrder: 1 },
      { id: 'vendor-contact-2', label: 'Vendor Operations WhatsApp', value: '+2340000000000', type: 'WHATSAPP', isActive: true, sortOrder: 2 },
    ],
  },
};

function parseObject(value: unknown): Record<string, unknown> {
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
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeFaqs(value: unknown, fallback: HelpFaq[]): HelpFaq[] {
  const rows = parseArray(value)
    .map((entry) => parseObject(entry))
    .map((row, index) => ({
      id: String(row.id || randomUUID()).trim().slice(0, 80),
      question: String(row.question || '').trim().slice(0, 400),
      answer: String(row.answer || '').trim().slice(0, 6000),
      isActive: row.isActive !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Math.max(0, Math.floor(Number(row.sortOrder))) : index + 1,
    }))
    .filter((row) => row.question && row.answer);
  return rows.length > 0 ? rows : fallback;
}

function normalizeArticles(value: unknown, fallback: HelpArticle[]): HelpArticle[] {
  const rows = parseArray(value)
    .map((entry) => parseObject(entry))
    .map((row, index) => ({
      id: String(row.id || randomUUID()).trim().slice(0, 80),
      title: String(row.title || '').trim().slice(0, 240),
      summary: String(row.summary || '').trim().slice(0, 1000),
      body: String(row.body || '').trim().slice(0, 20000),
      tags: Array.from(
        new Set(
          parseArray(row.tags)
            .map((tag) => String(tag || '').trim().slice(0, 40))
            .filter(Boolean)
        )
      ).slice(0, 20),
      isActive: row.isActive !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Math.max(0, Math.floor(Number(row.sortOrder))) : index + 1,
    }))
    .filter((row) => row.title && row.summary && row.body);
  return rows.length > 0 ? rows : fallback;
}

function normalizeContacts(value: unknown, fallback: HelpContact[]): HelpContact[] {
  const allowedTypes = new Set(['EMAIL', 'PHONE', 'WHATSAPP', 'LINK', 'OTHER']);
  const rows = parseArray(value)
    .map((entry) => parseObject(entry))
    .map((row, index) => {
      const typeToken = String(row.type || 'OTHER').trim().toUpperCase();
      return {
        id: String(row.id || randomUUID()).trim().slice(0, 80),
        label: String(row.label || '').trim().slice(0, 140),
        value: String(row.value || '').trim().slice(0, 500),
        type: (allowedTypes.has(typeToken) ? typeToken : 'OTHER') as HelpContact['type'],
        isActive: row.isActive !== false,
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Math.max(0, Math.floor(Number(row.sortOrder))) : index + 1,
      };
    })
    .filter((row) => row.label && row.value);
  return rows.length > 0 ? rows : fallback;
}

function normalizeAudienceContent(value: unknown, fallback: HelpAudienceContent): HelpAudienceContent {
  const row = parseObject(value);
  return {
    heroTitle: String(row.heroTitle || fallback.heroTitle).trim().slice(0, 240) || fallback.heroTitle,
    heroSubtitle: String(row.heroSubtitle || fallback.heroSubtitle).trim().slice(0, 600) || fallback.heroSubtitle,
    supportHint: String(row.supportHint || fallback.supportHint).trim().slice(0, 600) || fallback.supportHint,
    faqs: normalizeFaqs(row.faqs, fallback.faqs),
    articles: normalizeArticles(row.articles, fallback.articles),
    contacts: normalizeContacts(row.contacts, fallback.contacts),
  };
}

function normalizeHelpCenterContent(value: unknown): HelpCenterContent {
  const row = parseObject(value);
  return {
    customer: normalizeAudienceContent(row.customer, DEFAULT_HELP_CENTER_CONTENT.customer),
    vendor: normalizeAudienceContent(row.vendor, DEFAULT_HELP_CENTER_CONTENT.vendor),
  };
}

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "HelpCenterSetting" (
          "key" TEXT PRIMARY KEY,
          "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HelpCenterSetting" ("key","value","createdAt","updatedAt")
         VALUES ($1,$2::jsonb,NOW(),NOW())
         ON CONFLICT ("key") DO NOTHING`,
        HELP_CENTER_SETTINGS_KEY,
        JSON.stringify(DEFAULT_HELP_CENTER_CONTENT)
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

async function readContent(): Promise<HelpCenterContent> {
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "HelpCenterSetting" WHERE "key" = $1 LIMIT 1`,
    HELP_CENTER_SETTINGS_KEY
  );
  if (!rows[0]) return normalizeHelpCenterContent(DEFAULT_HELP_CENTER_CONTENT);
  return normalizeHelpCenterContent(rows[0].value);
}

async function writeContent(content: HelpCenterContent): Promise<HelpCenterContent> {
  const normalized = normalizeHelpCenterContent(content);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HelpCenterSetting" ("key","value","createdAt","updatedAt")
     VALUES ($1,$2::jsonb,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    HELP_CENTER_SETTINGS_KEY,
    JSON.stringify(normalized)
  );
  return normalized;
}

function asPublicContent(input: HelpAudienceContent) {
  const sortByOrder = <T extends { sortOrder: number }>(rows: T[]) =>
    [...rows].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  return {
    heroTitle: input.heroTitle,
    heroSubtitle: input.heroSubtitle,
    supportHint: input.supportHint,
    faqs: sortByOrder(input.faqs.filter((row) => row.isActive)),
    articles: sortByOrder(input.articles.filter((row) => row.isActive)),
    contacts: sortByOrder(input.contacts.filter((row) => row.isActive)),
  };
}

router.get('/public/:audience', async (req, res) => {
  try {
    const audience = String(req.params.audience || '').trim().toLowerCase();
    const content = await readContent();
    const selected = audience === 'vendor' || audience === 'seller-designer' || audience === 'seller' || audience === 'designer'
      ? content.vendor
      : content.customer;
    return res.json({
      success: true,
      data: {
        audience: selected === content.vendor ? 'VENDOR' : 'CUSTOMER',
        ...asPublicContent(selected),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load help center content.' });
  }
});

router.get(
  '/admin/content',
  authenticate,
  authorizePermissions(Permissions.HELP_CENTER_MANAGE, Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const content = await readContent();
      return res.json({ success: true, data: content });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load help center content.' });
    }
  }
);

router.patch(
  '/admin/content',
  authenticate,
  authorizePermissions(Permissions.HELP_CENTER_MANAGE, Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const parsed = adminPatchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      }
      const current = await readContent();
      const patch = parsed.data;
      const next = normalizeHelpCenterContent({
        ...current,
        ...(patch.customer ? { customer: { ...current.customer, ...patch.customer } } : {}),
        ...(patch.vendor ? { vendor: { ...current.vendor, ...patch.vendor } } : {}),
      });
      const saved = await writeContent(next);
      return res.json({
        success: true,
        message: 'Help center content updated.',
        data: saved,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update help center content.' });
    }
  }
);

export default router;

