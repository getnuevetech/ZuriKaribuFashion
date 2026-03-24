import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const detectLinuxLibcFamily = (): 'glibc' | 'musl' | 'unknown' => {
  if (process.platform !== 'linux') return 'unknown';
  try {
    const report = process.report?.getReport?.();
    const header = (report as any)?.header || {};
    if (String(header?.glibcVersionRuntime || '').trim()) {
      return 'glibc';
    }
    const sharedObjects = Array.isArray((report as any)?.sharedObjects) ? (report as any).sharedObjects : [];
    if (sharedObjects.some((entry: unknown) => String(entry || '').toLowerCase().includes('musl'))) {
      return 'musl';
    }
  } catch {
    // Ignore runtime report failures and fall back to unknown.
  }
  return 'unknown';
};

const resolvePrismaEngineOverride = () => {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  // Runtime can fail OpenSSL autodetection and pick an incompatible engine.
  // Select the engine family that matches current libc (glibc vs musl).
  const cwd = process.cwd();
  const libcFamily = detectLinuxLibcFamily();
  const preferDebian = libcFamily === 'glibc' || libcFamily === 'unknown';
  const orderedTargets = preferDebian
    ? ['libquery_engine-debian-openssl-3.0.x.so.node', 'libquery_engine-linux-musl-openssl-3.0.x.so.node']
    : ['libquery_engine-linux-musl-openssl-3.0.x.so.node', 'libquery_engine-debian-openssl-3.0.x.so.node'];
  const candidates = orderedTargets.map((fileName) =>
    path.join(cwd, 'node_modules', '.prisma', 'client', fileName)
  );
  const match = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (!match) return;
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = match;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[prisma] using query engine override (${libcFamily}): ${match}`);
  }
};

resolvePrismaEngineOverride();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Export types from Prisma
export type {
  User,
  Order,
  Fabric,
  Design,
  Address,
  Review,
  Notification,
  ActivityLog,
  PricingRule,
  ProductCategory,
  MaterialType,
  ReadyToWear,
  OrderTimeline,
} from '@prisma/client';

// Export enums
export { UserRole, UserStatus, ProductStatus, ProductType, OrderType, OrderStatus, PaymentStatus } from '@prisma/client';
