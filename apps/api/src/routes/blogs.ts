import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

const BLOG_AUDIENCE_TYPES = ['SELLER', 'DESIGNER', 'COUNTRY', 'OTHER'] as const;
type BlogAudienceType = (typeof BLOG_AUDIENCE_TYPES)[number];

const blogCreateSchema = z.object({
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

const blogUpdateSchema = blogCreateSchema.partial();

const ensureBlogTables = async () => {
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

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

const normalizeAudienceType = (value: unknown): BlogAudienceType =>
  BLOG_AUDIENCE_TYPES.includes(String(value || '').toUpperCase() as BlogAudienceType)
    ? (String(value || '').toUpperCase() as BlogAudienceType)
    : 'OTHER';

const getString = (value: unknown) => {
  const text = String(value || '').trim();
  return text.length > 0 ? text : undefined;
};

const toBlogLink = (slug: string) => `/stories/${slug}`;

const generateUniqueSlug = async (title: string, explicit?: string, excludeId?: string) => {
  const base = slugify(explicit || title) || `story-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "BlogPost" WHERE "slug" = $1 LIMIT 1`,
      candidate
    );
    const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!existing || (excludeId && String(existing.id) === excludeId)) {
      return candidate;
    }
    candidate = `${base}-${suffix++}`;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureBlogTables();
  } catch (error) {
    console.error('Failed to ensure blog tables:', error);
  }
  next();
});

// Admin endpoints
router.get('/admin', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const audienceType = String(req.query.audienceType || '').trim().toUpperCase();
    const status = String(req.query.status || '').trim().toUpperCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdBy","updatedBy","createdAt","updatedAt"
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
        audienceType: normalizeAudienceType(row.audienceType),
        link: toBlogLink(String(row.slug || '')),
      })),
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs.' });
  }
});

router.get('/admin/options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
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
        audienceType: normalizeAudienceType(row.audienceType),
        link: toBlogLink(String(row.slug || '')),
      })),
    });
  } catch (error) {
    console.error('Error fetching blog options:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog options.' });
  }
});

router.post('/admin', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const parsed = blogCreateSchema.parse(req.body);
    const slug = await generateUniqueSlug(parsed.title, parsed.slug);
    const now = new Date();
    const createdBy = String((req as any)?.user?.id || '').trim() || null;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "BlogPost" ("id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdBy","updatedBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      randomUUID(),
      parsed.title.trim(),
      slug,
      getString(parsed.excerpt) || null,
      parsed.content.trim(),
      normalizeAudienceType(parsed.audienceType),
      getString(parsed.targetName) || null,
      getString(parsed.targetEntityId) || null,
      getString(parsed.coverImage) || null,
      Boolean(parsed.isPublished),
      parsed.isPublished ? now : null,
      createdBy,
      createdBy
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdBy","updatedBy","createdAt","updatedAt"
       FROM "BlogPost"
       WHERE "slug" = $1
       LIMIT 1`,
      slug
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.status(201).json({
      success: true,
      data: row ? { ...row, audienceType: normalizeAudienceType(row.audienceType), link: toBlogLink(row.slug) } : null,
      message: 'Blog created.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error creating blog:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog.' });
  }
});

router.put('/admin/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const parsed = blogUpdateSchema.parse(req.body);
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
    const nextSlug = parsed.slug
      ? await generateUniqueSlug(nextTitle, parsed.slug, id)
      : String(existing.slug || '');
    const nextPublished = typeof parsed.isPublished === 'boolean' ? parsed.isPublished : Boolean(existing.isPublished);
    const updatedBy = String((req as any)?.user?.id || '').trim() || null;
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
      parsed.excerpt !== undefined ? getString(parsed.excerpt) || null : null,
      parsed.content !== undefined ? parsed.content.trim() : null,
      parsed.audienceType !== undefined ? normalizeAudienceType(parsed.audienceType) : null,
      parsed.targetName !== undefined ? getString(parsed.targetName) || null : null,
      parsed.targetEntityId !== undefined ? getString(parsed.targetEntityId) || null : null,
      parsed.coverImage !== undefined ? getString(parsed.coverImage) || null : null,
      nextPublished,
      publishedAt === undefined ? null : publishedAt,
      updatedBy,
      id
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","isPublished","publishedAt","createdBy","updatedBy","createdAt","updatedAt"
       FROM "BlogPost" WHERE "id" = $1 LIMIT 1`,
      id
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.json({
      success: true,
      data: row ? { ...row, audienceType: normalizeAudienceType(row.audienceType), link: toBlogLink(row.slug) } : null,
      message: 'Blog updated.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating blog:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog.' });
  }
});

router.delete('/admin/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "BlogPost" WHERE "id" = $1`, String(req.params.id || ''));
    res.json({ success: true, message: 'Blog deleted.' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog.' });
  }
});

// Public endpoints
router.get('/', async (req, res) => {
  try {
    const audienceType = String(req.query.audienceType || '').trim().toUpperCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","publishedAt","createdAt","updatedAt"
       FROM "BlogPost"
       WHERE "isPublished" = true
       ORDER BY COALESCE("publishedAt","updatedAt") DESC`
    );
    const filtered = (rows || []).filter((row) =>
      audienceType ? String(row.audienceType || '').toUpperCase() === audienceType : true
    );
    res.json({
      success: true,
      data: filtered.map((row) => ({
        ...row,
        audienceType: normalizeAudienceType(row.audienceType),
        link: toBlogLink(String(row.slug || '')),
      })),
    });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs.' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","slug","excerpt","content","audienceType","targetName","targetEntityId","coverImage","publishedAt","createdAt","updatedAt"
       FROM "BlogPost"
       WHERE "slug" = $1 AND "isPublished" = true
       LIMIT 1`,
      slug
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return res.status(404).json({ success: false, message: 'Story not found.' });
    }
    res.json({
      success: true,
      data: {
        ...row,
        audienceType: normalizeAudienceType(row.audienceType),
        link: toBlogLink(String(row.slug || '')),
      },
    });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch story.' });
  }
});

export default router;
