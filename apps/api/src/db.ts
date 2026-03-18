import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const resolvePrismaEngineOverride = () => {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  // Railway containers can fail OpenSSL autodetection and pick the legacy musl engine.
  // Prefer explicit OpenSSL 3 engine binaries when they exist.
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'node_modules', '.prisma', 'client', 'libquery_engine-linux-musl-openssl-3.0.x.so.node'),
    path.join(cwd, 'node_modules', '.prisma', 'client', 'libquery_engine-debian-openssl-3.0.x.so.node'),
  ];
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
    console.log(`[prisma] using query engine override: ${match}`);
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
