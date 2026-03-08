import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma, UserRole, UserStatus } from './db';

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@africanfashion.com').trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin123!';
const FORCE_ADMIN_PASSWORD_RESET = process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true';

const isSchemaDriftError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2022');

const asNonEmpty = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveInitials = (name?: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'NA';

async function ensureAdminBootstrap() {
  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: DEFAULT_ADMIN_EMAIL, mode: 'insensitive' } },
      include: { adminProfile: true },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL,
          password: hashedPassword,
          firstName: 'System',
          lastName: 'Administrator',
          role: UserRole.ADMINISTRATOR,
          status: UserStatus.ACTIVE,
          adminProfile: { create: {} },
        },
      });
      console.log(`✅ Admin bootstrap user created (${DEFAULT_ADMIN_EMAIL})`);
      return;
    }

    const userUpdateData: Prisma.UserUpdateInput = {};
    if (existing.role !== UserRole.ADMINISTRATOR) userUpdateData.role = UserRole.ADMINISTRATOR;
    if (existing.status !== UserStatus.ACTIVE) userUpdateData.status = UserStatus.ACTIVE;
    if (FORCE_ADMIN_PASSWORD_RESET) {
      userUpdateData.password = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: existing.id },
        data: userUpdateData,
      });
      console.log(`✅ Admin bootstrap user normalized (${DEFAULT_ADMIN_EMAIL})`);
    }

    if (!existing.adminProfile) {
      await prisma.adminProfile.create({
        data: { userId: existing.id },
      });
      console.log(`✅ Admin profile created for ${DEFAULT_ADMIN_EMAIL}`);
    }
  } catch (error) {
    if (isSchemaDriftError(error)) {
      console.warn('⚠️ Skipped admin bootstrap due to schema drift:', (error as Prisma.PrismaClientKnownRequestError).code);
      return;
    }
    throw error;
  }
}

async function backfillHomepageSectionData() {
  try {
    const steps = await prisma.howItWorksStep.findMany();
    for (const step of steps) {
      const subtitle = asNonEmpty(step.subtitle) || step.title;
      const icon = asNonEmpty(step.icon) || 'Sparkles';
      if (subtitle !== step.subtitle || icon !== step.icon) {
        await prisma.howItWorksStep.update({
          where: { id: step.id },
          data: { subtitle, icon },
        });
      }
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  try {
    const categories = await prisma.shopCategory.findMany({ orderBy: { displayOrder: 'asc' } });
    const seen = new Set<string>();
    for (const category of categories) {
      const title = asNonEmpty(category.title) || 'Category';
      const description = asNonEmpty(category.description) || title;
      const ctaText = asNonEmpty(category.ctaText) || 'Shop Now';
      const ctaLink = asNonEmpty(category.ctaLink) || '/designs';
      let key = asNonEmpty(category.key) || slugify(title) || `category-${category.id.slice(0, 8)}`;
      let suffix = 1;
      while (seen.has(key)) {
        key = `${slugify(title) || 'category'}-${suffix++}`;
      }
      seen.add(key);

      if (
        description !== category.description ||
        ctaText !== category.ctaText ||
        ctaLink !== category.ctaLink ||
        key !== category.key
      ) {
        await prisma.shopCategory.update({
          where: { id: category.id },
          data: { description, ctaText, ctaLink, key },
        });
      }
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  try {
    const spotlights = await prisma.designerSpotlight.findMany();
    for (const spotlight of spotlights) {
      const quote = asNonEmpty(spotlight.quote) || asNonEmpty(spotlight.bio) || 'Featured African designer.';
      const bio = asNonEmpty(spotlight.bio) || quote;
      if (quote !== spotlight.quote || bio !== spotlight.bio) {
        await prisma.designerSpotlight.update({
          where: { id: spotlight.id },
          data: { quote, bio },
        });
      }
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  try {
    const sections = await prisma.heritageSection.findMany();
    for (const section of sections) {
      const subtitle = asNonEmpty(section.subtitle) || 'Every pattern carries meaning.';
      const ctaText = asNonEmpty(section.ctaText) || 'Read Our Story';
      const ctaLink = asNonEmpty(section.ctaLink) || '/about';
      if (subtitle !== section.subtitle || ctaText !== section.ctaText || ctaLink !== section.ctaLink) {
        await prisma.heritageSection.update({
          where: { id: section.id },
          data: { subtitle, ctaText, ctaLink },
        });
      }
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  try {
    const testimonials = await prisma.testimonial.findMany();
    for (const testimonial of testimonials) {
      const initials = asNonEmpty(testimonial.initials) || deriveInitials(testimonial.name);
      const quote = asNonEmpty(testimonial.quote) || `I love the quality and fit from ${testimonial.name}.`;
      if (initials !== testimonial.initials || quote !== testimonial.quote) {
        await prisma.testimonial.update({
          where: { id: testimonial.id },
          data: { initials, quote },
        });
      }
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  try {
    const footer = await prisma.footerContent.findFirst();
    if (!footer) {
      await prisma.footerContent.create({
        data: {
          companyName: 'ZuriKaribu',
          tagline: 'Wear the story of Africa.',
          email: 'hello@zurikaribu.com',
          phone: '+1 (555) 123-4567',
          address: 'Lagos, Nigeria',
          copyright: `© ${new Date().getFullYear()} ZuriKaribu. All rights reserved.`,
        },
      });
    }
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
  }

  console.log('✅ Homepage section backfill completed');
}

export async function runStartupRepairs() {
  await ensureAdminBootstrap();
  await backfillHomepageSectionData();
}

export const bootstrapAdminConfig = {
  email: DEFAULT_ADMIN_EMAIL,
  password: DEFAULT_ADMIN_PASSWORD,
};
