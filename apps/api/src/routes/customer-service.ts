import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole } from '../db';
import { authenticate, authorizePermissions, optionalAuth } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  detectTicketingLanguage,
  getTicketingSupportedLanguages,
  normalizeTicketingLanguage,
  translateTicketingText,
} from '../utils/ticketing-translation';

const router = Router();

const TICKET_SOURCES = ['ORDER', 'EMAIL', 'PHONE', 'WEB', 'OTHER', 'CHAT', 'BOT'] as const;
const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
const ROUTE_TARGET_TYPES = ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE'] as const;
const CHAT_ROLES = ['CUSTOMER', 'AGENT', 'SUPERVISOR', 'ADMIN', 'BOT'] as const;

type TicketSource = (typeof TICKET_SOURCES)[number];
type RouteTargetType = (typeof ROUTE_TARGET_TYPES)[number];

const SUPPORT_SETTINGS_KEY = 'customer_service_runtime_settings_v1';

type SupportSettings = {
  translationEnabled: boolean;
  defaultLanguage: string;
  chatPopupDelayMinutes: number;
  shoppingBotDelayMinutes: number;
  botEnabled: boolean;
  shoppingBotEnabled: boolean;
  serviceBotEnabled: boolean;
  shoppingBotAvatarFemale: string;
  shoppingBotAvatarMale: string;
  voipEnabled: boolean;
  voipProvider: string;
  voipCallBaseUrl: string;
  voipRoutes: Array<{
    id: string;
    name: string;
    enabled: boolean;
    contextType: 'TICKET' | 'CHAT' | 'DIRECT' | 'ANY';
    fromRoles: string[];
    targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE' | 'CUSTOMER_SERVICE';
    targetId: string;
  }>;
  voipTransferTargets: Array<{
    id: string;
    name: string;
    enabled: boolean;
    targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE';
    targetId: string;
  }>;
  emailIngestEnabled: boolean;
  emailIngestToken: string;
  ticketIdPrefix: string;
  ticketIdSuffix: string;
  ticketIdPadding: number;
  ticketIdNextNumber: number;
};

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  translationEnabled: true,
  defaultLanguage: 'en',
  chatPopupDelayMinutes: 2,
  shoppingBotDelayMinutes: 3,
  botEnabled: true,
  shoppingBotEnabled: true,
  serviceBotEnabled: true,
  shoppingBotAvatarFemale: '',
  shoppingBotAvatarMale: '',
  voipEnabled: false,
  voipProvider: 'INTERNAL',
  voipCallBaseUrl: '',
  voipRoutes: [],
  voipTransferTargets: [],
  emailIngestEnabled: false,
  emailIngestToken: '',
  ticketIdPrefix: 'TKT-',
  ticketIdSuffix: '',
  ticketIdPadding: 6,
  ticketIdNextNumber: 1,
};

const supportSettingsPatchSchema = z
  .object({
    translationEnabled: z.boolean().optional(),
    defaultLanguage: z.string().trim().min(2).max(24).optional(),
    chatPopupDelayMinutes: z.number().int().min(0).max(60).optional(),
    shoppingBotDelayMinutes: z.number().int().min(0).max(60).optional(),
    botEnabled: z.boolean().optional(),
    shoppingBotEnabled: z.boolean().optional(),
    serviceBotEnabled: z.boolean().optional(),
    shoppingBotAvatarFemale: z.string().trim().max(2000).optional(),
    shoppingBotAvatarMale: z.string().trim().max(2000).optional(),
    voipEnabled: z.boolean().optional(),
    voipProvider: z.string().trim().max(120).optional(),
    voipCallBaseUrl: z.string().trim().max(2000).optional(),
    voipRoutes: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(140),
          enabled: z.boolean().optional(),
          contextType: z.enum(['TICKET', 'CHAT', 'DIRECT', 'ANY']).optional(),
          fromRoles: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
          targetType: z.enum(['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE']).optional(),
          targetId: z.string().trim().max(120).optional(),
        })
      )
      .max(100)
      .optional(),
    voipTransferTargets: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(140),
          enabled: z.boolean().optional(),
          targetType: z.enum(['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE']).optional(),
          targetId: z.string().trim().max(120).optional(),
        })
      )
      .max(100)
      .optional(),
    emailIngestEnabled: z.boolean().optional(),
    emailIngestToken: z.string().trim().max(240).optional(),
    ticketIdPrefix: z.string().trim().max(40).optional(),
    ticketIdSuffix: z.string().trim().max(40).optional(),
    ticketIdPadding: z.number().int().min(1).max(12).optional(),
    ticketIdNextNumber: z.number().int().min(1).max(999999999).optional(),
  })
  .strict();

const ticketCreateSchema = z
  .object({
    source: z.enum(TICKET_SOURCES).optional(),
    title: z.string().trim().min(1).max(240),
    subject: z.string().trim().max(240).optional(),
    body: z.string().trim().min(1).max(5000),
    requesterName: z.string().trim().max(180).optional(),
    requesterEmail: z.string().trim().email().optional(),
    requesterPhone: z.string().trim().max(80).optional(),
    requesterUserId: z.string().trim().max(64).optional(),
    relatedOrderId: z.string().trim().max(64).optional(),
    sourceLanguage: z.string().trim().min(2).max(24).optional(),
    attachments: z.array(z.string().trim().max(4096)).max(12).optional(),
    targetType: z.enum(ROUTE_TARGET_TYPES).optional(),
    targetId: z.string().trim().max(96).optional(),
  })
  .strict();

const ticketReplySchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    sourceLanguage: z.string().trim().min(2).max(24).optional(),
    attachments: z.array(z.string().trim().max(4096)).max(12).optional(),
    visibleToCustomer: z.boolean().optional(),
    isInternal: z.boolean().optional(),
  })
  .strict();

const ticketAssignSchema = z
  .object({
    targetType: z.enum(ROUTE_TARGET_TYPES).optional(),
    targetId: z.string().trim().max(96).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    slaHours: z.number().int().min(1).max(720).optional(),
    source: z.enum(TICKET_SOURCES).optional(),
  })
  .strict();

const groupSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).optional(),
    groupType: z.enum(['ROLE_BASED', 'USER_BASED', 'MIXED']).optional(),
    roleTokens: z.array(z.string().trim().max(96)).max(50).optional(),
    userIds: z.array(z.string().trim().max(64)).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const routingRuleSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    source: z.enum([...TICKET_SOURCES, 'ALL'] as any).optional(),
    sequence: z.number().int().min(1).max(999).optional(),
    targetType: z.enum(ROUTE_TARGET_TYPES),
    targetId: z.string().trim().min(1).max(96),
    slaHours: z.number().int().min(1).max(720).optional(),
    escalationTargetType: z.enum(ROUTE_TARGET_TYPES).optional(),
    escalationTargetId: z.string().trim().max(96).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const departmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().min(2).max(40),
    description: z.string().trim().max(240).optional(),
    targetType: z.enum(['AUTO', ...ROUTE_TARGET_TYPES]).optional(),
    targetId: z.string().trim().max(96).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const chatStartSchema = z
  .object({
    departmentId: z.string().trim().max(64).optional(),
    issueType: z.string().trim().max(120).optional(),
    preferredLanguage: z.string().trim().min(2).max(24).optional(),
    name: z.string().trim().max(180).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(80).optional(),
    source: z.enum(['WIDGET', 'CONTACT']).optional(),
  })
  .strict();

const chatMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    sourceLanguage: z.string().trim().min(2).max(24).optional(),
    preferredLanguage: z.string().trim().min(2).max(24).optional(),
    attachments: z.array(z.string().trim().max(4096)).max(12).optional(),
    token: z.string().trim().max(120).optional(),
    isInternal: z.boolean().optional(),
  })
  .strict();

const chatAdminActionSchema = z
  .object({
    action: z.enum(['TRANSFER', 'ESCALATE', 'ADD_AGENT', 'TOGGLE_VISIBILITY']),
    targetUserId: z.string().trim().max(64).optional(),
    participantId: z.string().trim().max(64).optional(),
    visibleToCustomer: z.boolean().optional(),
  })
  .strict();

const botRequestSchema = z
  .object({
    mode: z.enum(['SERVICE', 'SHOPPING']).optional(),
    message: z.string().trim().min(1).max(2000),
    preferredLanguage: z.string().trim().min(2).max(24).optional(),
    genderHint: z.string().trim().max(24).optional(),
    contextPaths: z.array(z.string().trim().max(300)).max(20).optional(),
  })
  .strict();

const voipStartSchema = z
  .object({
    contextType: z.enum(['TICKET', 'CHAT', 'DIRECT']),
    contextId: z.string().trim().max(64).optional(),
    toUserId: z.string().trim().max(64).optional(),
    routeId: z.string().trim().max(80).optional(),
  })
  .strict();

const voipRouteItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  enabled: z.boolean().optional(),
  contextType: z.enum(['TICKET', 'CHAT', 'DIRECT', 'ANY']).optional(),
  fromRoles: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  targetType: z.enum(['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE']).optional(),
  targetId: z.string().trim().max(120).optional(),
});

const voipTransferTargetItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  enabled: z.boolean().optional(),
  targetType: z.enum(['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE']).optional(),
  targetId: z.string().trim().max(120).optional(),
});

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

function dedupeStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeAttachments(value: unknown): string[] {
  return dedupeStrings(Array.isArray(value) ? value : []).slice(0, 12).map((url) => url.slice(0, 4096));
}

function asTicketSource(value: unknown, fallback: TicketSource = 'OTHER'): TicketSource {
  const source = String(value || '').trim().toUpperCase();
  return (TICKET_SOURCES.includes(source as TicketSource) ? source : fallback) as TicketSource;
}

function normalizeSettings(value: unknown): SupportSettings {
  const source = parseObject(value);
  const normalizedVoipRoutes = (Array.isArray(source.voipRoutes) ? source.voipRoutes : [])
    .map((entry) => parseObject(entry))
    .map((entry) => ({
      id: String(entry.id || randomUUID()).trim().slice(0, 80),
      name: String(entry.name || 'Route').trim().slice(0, 140) || 'Route',
      enabled: entry.enabled !== false,
      contextType: (['TICKET', 'CHAT', 'DIRECT', 'ANY'].includes(String(entry.contextType || '').toUpperCase())
        ? String(entry.contextType || '').toUpperCase()
        : 'ANY') as 'TICKET' | 'CHAT' | 'DIRECT' | 'ANY',
      fromRoles: dedupeStrings(parseArray(entry.fromRoles)).slice(0, 20),
      targetType: (['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE'].includes(
        String(entry.targetType || '').toUpperCase()
      )
        ? String(entry.targetType || '').toUpperCase()
        : 'CUSTOMER_SERVICE') as 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE' | 'CUSTOMER_SERVICE',
      targetId: String(entry.targetId || '').trim().slice(0, 120),
    }))
    .filter((entry) => entry.id && entry.name);
  const normalizedTransferTargets = (Array.isArray(source.voipTransferTargets) ? source.voipTransferTargets : [])
    .map((entry) => parseObject(entry))
    .map((entry) => ({
      id: String(entry.id || randomUUID()).trim().slice(0, 80),
      name: String(entry.name || 'Transfer Target').trim().slice(0, 140) || 'Transfer Target',
      enabled: entry.enabled !== false,
      targetType: (['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE'].includes(String(entry.targetType || '').toUpperCase())
        ? String(entry.targetType || '').toUpperCase()
        : 'ADMIN_GROUP') as 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE',
      targetId: String(entry.targetId || '').trim().slice(0, 120),
    }))
    .filter((entry) => entry.id && entry.name);
  const ticketIdPadding = Math.max(1, Math.min(12, Number(source.ticketIdPadding || DEFAULT_SUPPORT_SETTINGS.ticketIdPadding)));
  const ticketIdNextNumber = Math.max(1, Math.floor(Number(source.ticketIdNextNumber || DEFAULT_SUPPORT_SETTINGS.ticketIdNextNumber)));
  return {
    translationEnabled: source.translationEnabled !== false,
    defaultLanguage: normalizeTicketingLanguage(source.defaultLanguage, DEFAULT_SUPPORT_SETTINGS.defaultLanguage),
    chatPopupDelayMinutes: Math.max(0, Math.min(60, Number(source.chatPopupDelayMinutes || DEFAULT_SUPPORT_SETTINGS.chatPopupDelayMinutes))),
    shoppingBotDelayMinutes: Math.max(0, Math.min(60, Number(source.shoppingBotDelayMinutes || DEFAULT_SUPPORT_SETTINGS.shoppingBotDelayMinutes))),
    botEnabled: source.botEnabled !== false,
    shoppingBotEnabled: source.shoppingBotEnabled !== false,
    serviceBotEnabled: source.serviceBotEnabled !== false,
    shoppingBotAvatarFemale: String(source.shoppingBotAvatarFemale || ''),
    shoppingBotAvatarMale: String(source.shoppingBotAvatarMale || ''),
    voipEnabled: source.voipEnabled === true,
    voipProvider: String(source.voipProvider || DEFAULT_SUPPORT_SETTINGS.voipProvider).trim() || 'INTERNAL',
    voipCallBaseUrl: String(source.voipCallBaseUrl || '').trim(),
    voipRoutes: normalizedVoipRoutes,
    voipTransferTargets: normalizedTransferTargets,
    emailIngestEnabled: source.emailIngestEnabled === true,
    emailIngestToken: String(source.emailIngestToken || '').trim(),
    ticketIdPrefix: String(source.ticketIdPrefix || DEFAULT_SUPPORT_SETTINGS.ticketIdPrefix).trim().slice(0, 40),
    ticketIdSuffix: String(source.ticketIdSuffix || DEFAULT_SUPPORT_SETTINGS.ticketIdSuffix).trim().slice(0, 40),
    ticketIdPadding,
    ticketIdNextNumber,
  };
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportCenterSetting" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportDepartment" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "targetType" TEXT NOT NULL DEFAULT 'AUTO', "targetId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SupportDepartment_code_key" ON "SupportDepartment"("code")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportTicketGroup" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "groupType" TEXT NOT NULL DEFAULT 'MIXED', "roleTokens" JSONB NOT NULL DEFAULT '[]'::jsonb, "userIds" JSONB NOT NULL DEFAULT '[]'::jsonb, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicketGroup_name_key" ON "SupportTicketGroup"("name")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportTicketRoutingRule" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'ALL', "sequence" INTEGER NOT NULL DEFAULT 1, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "slaHours" INTEGER NOT NULL DEFAULT 24, "escalationTargetType" TEXT, "escalationTargetId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportTicketRoutingRule_source_idx" ON "SupportTicketRoutingRule"("source","sequence","isActive")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportTicket" ("id" TEXT PRIMARY KEY, "source" TEXT NOT NULL DEFAULT 'OTHER', "title" TEXT NOT NULL, "subject" TEXT, "status" TEXT NOT NULL DEFAULT 'OPEN', "priority" TEXT NOT NULL DEFAULT 'NORMAL', "relatedOrderId" TEXT, "requesterUserId" TEXT, "requesterName" TEXT, "requesterEmail" TEXT, "requesterPhone" TEXT, "assignedAdminUserId" TEXT, "assignedAdminRoleId" TEXT, "assignedGroupId" TEXT, "slaDueAt" TIMESTAMP(3), "escalatedAt" TIMESTAMP(3), "escalationLevel" INTEGER NOT NULL DEFAULT 0, "routeSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb, "createdByUserId" TEXT, "lastMessageAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "ticketNumber" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber") WHERE "ticketNumber" IS NOT NULL`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportTicket_lookup_idx" ON "SupportTicket"("source","status","updatedAt")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportTicketMessage" ("id" TEXT PRIMARY KEY, "ticketId" TEXT NOT NULL, "senderUserId" TEXT, "senderRole" TEXT NOT NULL, "senderDisplayName" TEXT, "body" TEXT NOT NULL, "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb, "sourceLanguage" TEXT NOT NULL DEFAULT 'en', "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true, "isInternal" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportTicketMessage" ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticket_idx" ON "SupportTicketMessage"("ticketId","createdAt")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportChatSession" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'OPEN', "departmentId" TEXT, "issueType" TEXT, "source" TEXT NOT NULL DEFAULT 'WIDGET', "customerUserId" TEXT, "guestName" TEXT, "guestEmail" TEXT, "guestPhone" TEXT, "guestToken" TEXT, "preferredLanguage" TEXT NOT NULL DEFAULT 'en', "assignedAdminUserId" TEXT, "assignedAdminRoleId" TEXT, "assignedGroupId" TEXT, "primaryAgentUserId" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb, "lastMessageAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportChatSession_status_idx" ON "SupportChatSession"("status","updatedAt")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportChatParticipant" ("id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "userId" TEXT, "displayName" TEXT, "role" TEXT NOT NULL, "preferredLanguage" TEXT NOT NULL DEFAULT 'en', "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT true, "isPrimary" BOOLEAN NOT NULL DEFAULT false, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leftAt" TIMESTAMP(3))`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportChatParticipant_session_idx" ON "SupportChatParticipant"("sessionId","joinedAt")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportChatMessage" ("id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "senderParticipantId" TEXT, "senderRole" TEXT NOT NULL, "senderDisplayName" TEXT, "body" TEXT NOT NULL, "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb, "isInternal" BOOLEAN NOT NULL DEFAULT false, "sourceLanguage" TEXT NOT NULL DEFAULT 'en', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportChatMessage" ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportChatMessage_session_idx" ON "SupportChatMessage"("sessionId","createdAt")`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportVoipCall" ("id" TEXT PRIMARY KEY, "contextType" TEXT NOT NULL, "contextId" TEXT, "fromUserId" TEXT, "toUserId" TEXT, "status" TEXT NOT NULL DEFAULT 'INITIATED', "provider" TEXT, "callLink" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportVoipCall" ADD COLUMN IF NOT EXISTS "routeId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportVoipCall" ADD COLUMN IF NOT EXISTS "fromCallerId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "SupportVoipCall" ADD COLUMN IF NOT EXISTS "toCallerId" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportVoipCall_context_idx" ON "SupportVoipCall"("contextType","contextId","createdAt")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportVoipCall_startedAt_idx" ON "SupportVoipCall"("startedAt")`);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "SupportNumberSequence" (
          "key" TEXT PRIMARY KEY,
          "currentNumber" BIGINT NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "callerId" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_callerId_key" ON "User"("callerId") WHERE "callerId" IS NOT NULL`);
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "OrderTicketMessage" ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT`);
      } catch {
        // ignore if order ticketing table is not available yet in this deployment stage
      }

      const defaults = [
        ['Customer Service', 'CUSTOMER_SERVICE', 'General customer service requests.'],
        ['Track Order', 'TRACK_ORDER', 'Order tracking and delivery support.'],
        ['Account / Refund', 'ACCOUNT_REFUND', 'Account, refund, and payments support.'],
      ];
      for (const row of defaults) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "SupportDepartment" ("id","name","code","description","targetType","isActive","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,'AUTO',true,NOW(),NOW())
           ON CONFLICT ("code") DO NOTHING`,
          randomUUID(),
          row[0],
          row[1],
          row[2]
        );
      }
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AdminRole" ("id","name","description","permissions","isSystem","isActive","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4::jsonb,true,true,NOW(),NOW())
           ON CONFLICT ("name") DO NOTHING`,
          randomUUID(),
          'Customer Service Agent',
          'Default role for customer service operations.',
          JSON.stringify([
            Permissions.ADMIN_ACCESS,
            Permissions.ADMIN_DASHBOARD_READ,
            Permissions.CUSTOMER_SERVICE_CHAT_MANAGE,
            Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE,
            Permissions.SUPPORT_TICKETS_MANAGE,
            Permissions.SUPPORT_ROUTING_MANAGE,
            Permissions.BOTS_MANAGE,
            Permissions.VOIP_MANAGE,
            Permissions.ORDERS_TICKETING_TRANSLATION_MANAGE,
          ])
        );
      } catch {
        // ignore if admin RBAC schema is not ready yet
      }
      schemaReady = true;
    })();
  }
  await schemaPromise;
  schemaPromise = null;
}

const SUPPORT_TICKET_SEQUENCE_KEY = 'SUPPORT_TICKET';

async function readSupportTicketNextNumber(): Promise<number> {
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ currentNumber: number }>>(
    `SELECT "currentNumber"::bigint AS "currentNumber"
     FROM "SupportNumberSequence"
     WHERE "key" = $1
     LIMIT 1`,
    SUPPORT_TICKET_SEQUENCE_KEY
  );
  const currentNumber = Number(rows[0]?.currentNumber || 0);
  const safeCurrent = Number.isFinite(currentNumber) ? Math.max(0, Math.floor(currentNumber)) : 0;
  return safeCurrent + 1;
}

async function setSupportTicketNextNumber(nextNumber: number) {
  await ensureSchema();
  const safeNext = Math.max(1, Math.floor(Number(nextNumber || 1)));
  const currentNumber = safeNext - 1;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SupportNumberSequence" ("key","currentNumber","createdAt","updatedAt")
     VALUES ($1,$2,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "currentNumber" = EXCLUDED."currentNumber", "updatedAt" = NOW()`,
    SUPPORT_TICKET_SEQUENCE_KEY,
    currentNumber
  );
}

async function allocateSupportTicketNumber(settings: SupportSettings): Promise<string> {
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ currentNumber: number }>>(
    `INSERT INTO "SupportNumberSequence" ("key","currentNumber","createdAt","updatedAt")
     VALUES ($1,1,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "currentNumber" = "SupportNumberSequence"."currentNumber" + 1, "updatedAt" = NOW()
     RETURNING "currentNumber"::bigint AS "currentNumber"`,
    SUPPORT_TICKET_SEQUENCE_KEY
  );
  const sequenceNumber = Math.max(1, Math.floor(Number(rows[0]?.currentNumber || 1)));
  const prefix = String(settings.ticketIdPrefix || '').trim();
  const suffix = String(settings.ticketIdSuffix || '').trim();
  const padded = String(sequenceNumber).padStart(Math.max(1, Number(settings.ticketIdPadding || 6)), '0');
  return `${prefix}${padded}${suffix}`.slice(0, 120);
}

async function resolveIncomingSourceLanguage(params: {
  providedLanguage?: string;
  text: string;
  fallbackLanguage: string;
  preferredLanguage?: string;
}) {
  const fallback = normalizeTicketingLanguage(params.preferredLanguage, params.fallbackLanguage);
  const requested = normalizeTicketingLanguage(params.providedLanguage || 'auto', 'auto');
  if (requested !== 'auto') return normalizeTicketingLanguage(requested, fallback);
  const detected = await detectTicketingLanguage({
    text: String(params.text || ''),
    fallbackLanguage: fallback,
  });
  return normalizeTicketingLanguage(detected, fallback);
}

async function readSettings(): Promise<SupportSettings> {
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(`SELECT "value" FROM "SupportCenterSetting" WHERE "key" = $1 LIMIT 1`, SUPPORT_SETTINGS_KEY);
  const normalized = rows[0] ? normalizeSettings(rows[0].value) : { ...DEFAULT_SUPPORT_SETTINGS };
  const envToken = String(process.env.SUPPORT_EMAIL_INGEST_TOKEN || '').trim();
  if (!normalized.emailIngestToken && envToken) normalized.emailIngestToken = envToken;
  normalized.ticketIdNextNumber = await readSupportTicketNextNumber();
  return normalized;
}

async function writeSettings(patch: Partial<SupportSettings>) {
  const current = await readSettings();
  const next = normalizeSettings({ ...current, ...(patch || {}) });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SupportCenterSetting" ("key","value","createdAt","updatedAt")
     VALUES ($1,$2::jsonb,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    SUPPORT_SETTINGS_KEY,
    JSON.stringify(next)
  );
  if (patch.ticketIdNextNumber !== undefined) {
    await setSupportTicketNextNumber(Number(patch.ticketIdNextNumber || 1));
    next.ticketIdNextNumber = await readSupportTicketNextNumber();
  }
  return next;
}

async function resolveAssignment(targetType: RouteTargetType, targetId: string) {
  if (targetType === 'ADMIN_USER') {
    return { assignedAdminUserId: String(targetId || '').trim() || null, assignedAdminRoleId: null as string | null, assignedGroupId: null as string | null };
  }
  if (targetType === 'ADMIN_GROUP') {
    const groupRows = await prisma.$queryRawUnsafe<Array<{ userIds: unknown; roleTokens: unknown }>>(
      `SELECT "userIds","roleTokens" FROM "SupportTicketGroup" WHERE "id" = $1 AND "isActive" = true LIMIT 1`,
      targetId
    );
    const group = groupRows[0];
    const userIds = group ? dedupeStrings(parseArray(group.userIds)) : [];
    const roleTokens = group ? dedupeStrings(parseArray(group.roleTokens)) : [];
    let selectedUserId = userIds[0] || null;
    if (!selectedUserId && roleTokens.length > 0) {
      const adminRoleIds = roleTokens
        .map((token) => String(token || '').trim())
        .map((token) => (/^ADMIN_ROLE:/i.test(token) ? token.slice('ADMIN_ROLE:'.length) : token))
        .filter(Boolean);
      if (adminRoleIds.length > 0) {
        const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT u."id"
           FROM "User" u
           LEFT JOIN "AdminProfile" ap ON ap."userId" = u."id"
           WHERE u."role" = $1
             AND u."status" = 'ACTIVE'
             AND ap."adminRoleId" = ANY($2::text[])
           ORDER BY u."updatedAt" DESC
           LIMIT 1`,
          UserRole.ADMINISTRATOR,
          adminRoleIds
        );
        selectedUserId = rows[0]?.id ? String(rows[0].id) : null;
      }
    }
    return { assignedAdminUserId: selectedUserId, assignedAdminRoleId: null as string | null, assignedGroupId: String(targetId || '').trim() || null };
  }
  const roleId = /^ADMIN_ROLE:/i.test(String(targetId || '').trim()) ? String(targetId).trim().slice('ADMIN_ROLE:'.length) : String(targetId || '').trim();
  const users = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT u."id"
     FROM "User" u
     LEFT JOIN "AdminProfile" ap ON ap."userId" = u."id"
     WHERE u."role" = $1
       AND u."status" = 'ACTIVE'
       AND ap."adminRoleId" = $2
     ORDER BY u."updatedAt" DESC
     LIMIT 1`,
    UserRole.ADMINISTRATOR,
    roleId
  );
  return { assignedAdminUserId: users[0]?.id ? String(users[0].id) : null, assignedAdminRoleId: roleId || null, assignedGroupId: null as string | null };
}

async function resolveInitialRouting(source: TicketSource) {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","source","sequence","targetType","targetId","slaHours","escalationTargetType","escalationTargetId"
     FROM "SupportTicketRoutingRule"
     WHERE "isActive" = true
       AND ("source" = $1 OR "source" = 'ALL')
     ORDER BY CASE WHEN "source" = $1 THEN 0 ELSE 1 END ASC, "sequence" ASC
     LIMIT 1`,
    source
  );
  const rule = rows[0];
  if (!rule) return null;
  const targetType = String(rule.targetType || '').trim().toUpperCase() as RouteTargetType;
  if (!ROUTE_TARGET_TYPES.includes(targetType)) return null;
  const assignment = await resolveAssignment(targetType, String(rule.targetId || ''));
  const snapshot = {
    ruleId: String(rule.id || ''),
    source: asTicketSource(rule.source, source),
    sequence: Number(rule.sequence || 1),
    targetType,
    targetId: String(rule.targetId || ''),
    slaHours: Math.max(1, Number(rule.slaHours || 24)),
    escalationTargetType: rule.escalationTargetType ? String(rule.escalationTargetType) : null,
    escalationTargetId: rule.escalationTargetId ? String(rule.escalationTargetId) : null,
  };
  return { assignment, snapshot };
}

function normalizeRoleToken(role: unknown) {
  return String(role || '').trim().toUpperCase();
}

function isSellerOrDesignerRole(role: unknown) {
  const token = normalizeRoleToken(role);
  return token === 'FABRIC_SELLER' || token === 'FASHION_DESIGNER' || token === 'RESELLER_INFLUENCER';
}

function isCustomerRole(role: unknown) {
  return normalizeRoleToken(role) === 'CUSTOMER';
}

function routeMatches(
  route: SupportSettings['voipRoutes'][number],
  contextType: 'TICKET' | 'CHAT' | 'DIRECT',
  fromRole: string
) {
  if (!route.enabled) return false;
  if (route.contextType !== 'ANY' && route.contextType !== contextType) return false;
  if (!Array.isArray(route.fromRoles) || route.fromRoles.length === 0) return true;
  const allowedRoles = route.fromRoles.map((token) => normalizeRoleToken(token)).filter(Boolean);
  return allowedRoles.includes(fromRole);
}

function pickVoipRoute(
  settings: SupportSettings,
  params: { requestedRouteId?: string; contextType: 'TICKET' | 'CHAT' | 'DIRECT'; fromRole: string }
) {
  const routes = Array.isArray(settings.voipRoutes) ? settings.voipRoutes : [];
  const requestedRouteId = String(params.requestedRouteId || '').trim();
  if (requestedRouteId) {
    const selected = routes.find((route) => String(route.id || '').trim() === requestedRouteId);
    if (selected && routeMatches(selected, params.contextType, params.fromRole)) return selected;
  }
  return routes.find((route) => routeMatches(route, params.contextType, params.fromRole)) || null;
}

async function resolveVoipTargetFromRoute(
  route: SupportSettings['voipRoutes'][number] | null
): Promise<string | null> {
  if (!route || !route.enabled) return null;
  if (route.targetType === 'CUSTOMER_SERVICE') {
    const routing = await resolveInitialRouting('PHONE');
    return routing?.assignment?.assignedAdminUserId || null;
  }
  const targetType = String(route.targetType || '').trim().toUpperCase() as RouteTargetType;
  if (!ROUTE_TARGET_TYPES.includes(targetType)) return null;
  const assignment = await resolveAssignment(targetType, String(route.targetId || ''));
  return assignment.assignedAdminUserId || null;
}

async function resolveVoipTicketTargetUserId(contextId: string, callerUserId: string): Promise<string | null> {
  const rawRef = String(contextId || '').trim();
  if (!rawRef) return null;
  const supportTicketId = /^SUPPORT:/i.test(rawRef) ? rawRef.slice('SUPPORT:'.length) : rawRef;
  const supportRows = await prisma.$queryRawUnsafe<Array<{ requesterUserId: string | null; createdByUserId: string | null }>>(
    `SELECT "requesterUserId","createdByUserId"
     FROM "SupportTicket"
     WHERE "id" = $1 OR "ticketNumber" = $2
     LIMIT 1`,
    supportTicketId,
    rawRef
  );
  const support = supportRows[0];
  if (support) {
    const targetUserId = [support.requesterUserId, support.createdByUserId]
      .map((value) => (value ? String(value) : ''))
      .find((value) => value && value !== callerUserId);
    if (targetUserId) return targetUserId;
  }

  const orderTicketId = /^ORDER:/i.test(rawRef) ? rawRef.slice('ORDER:'.length) : rawRef;
  const orderTicketRows = await prisma.$queryRawUnsafe<Array<{ customerId: string | null }>>(
    `SELECT o."customerId"
     FROM "OrderTicket" ot
     LEFT JOIN "Order" o ON o."id" = ot."orderId"
     WHERE ot."id" = $1
     LIMIT 1`,
    orderTicketId
  );
  if (orderTicketRows[0]?.customerId && String(orderTicketRows[0].customerId) !== callerUserId) {
    return String(orderTicketRows[0].customerId);
  }

  const orderRows = await prisma.$queryRawUnsafe<Array<{ customerId: string | null }>>(
    `SELECT "customerId" FROM "Order" WHERE "id" = $1 LIMIT 1`,
    rawRef
  );
  if (orderRows[0]?.customerId && String(orderRows[0].customerId) !== callerUserId) {
    return String(orderRows[0].customerId);
  }

  return null;
}

async function resolveVoipChatTargetUserId(contextId: string, callerUserId: string): Promise<string | null> {
  const sessionId = String(contextId || '').trim();
  if (!sessionId) return null;
  const sessionRows = await prisma.$queryRawUnsafe<Array<{ customerUserId: string | null; assignedAdminUserId: string | null }>>(
    `SELECT "customerUserId","assignedAdminUserId"
     FROM "SupportChatSession"
     WHERE "id" = $1
     LIMIT 1`,
    sessionId
  );
  const session = sessionRows[0];
  if (!session) return null;
  if (session.customerUserId && String(session.customerUserId) !== callerUserId) return String(session.customerUserId);
  if (session.assignedAdminUserId && String(session.assignedAdminUserId) !== callerUserId) return String(session.assignedAdminUserId);
  const participants = await prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
    `SELECT "userId"
     FROM "SupportChatParticipant"
     WHERE "sessionId" = $1
       AND "userId" IS NOT NULL
     ORDER BY "joinedAt" ASC
     LIMIT 20`,
    sessionId
  );
  const participantTarget = participants
    .map((row) => (row.userId ? String(row.userId) : ''))
    .find((userId) => userId && userId !== callerUserId);
  return participantTarget || null;
}

async function readUserCallerId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const rows = await prisma.$queryRawUnsafe<Array<{ callerId: string | null }>>(
    `SELECT "callerId" FROM "User" WHERE "id" = $1 LIMIT 1`,
    userId
  );
  const callerId = rows[0]?.callerId ? String(rows[0].callerId).trim() : '';
  return callerId || null;
}

async function runEscalationSweep() {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","source","routeSnapshot","escalationLevel"
     FROM "SupportTicket"
     WHERE "status" IN ('OPEN','PENDING')
       AND "slaDueAt" IS NOT NULL
       AND "slaDueAt" < NOW()
     ORDER BY "slaDueAt" ASC
     LIMIT 100`
  );
  for (const row of rows) {
    const snapshot = parseObject(row.routeSnapshot);
    const escalationTargetType = String(snapshot.escalationTargetType || '').trim().toUpperCase() as RouteTargetType;
    const escalationTargetId = String(snapshot.escalationTargetId || '').trim();
    let nextAssignment: Awaited<ReturnType<typeof resolveAssignment>> | null = null;
    let nextSnapshot: Record<string, unknown> = snapshot;
    let nextSlaHours = Math.max(1, Number(snapshot.slaHours || 24));
    if (ROUTE_TARGET_TYPES.includes(escalationTargetType) && escalationTargetId) {
      nextAssignment = await resolveAssignment(escalationTargetType, escalationTargetId);
      nextSnapshot = { ...snapshot, targetType: escalationTargetType, targetId: escalationTargetId };
    } else {
      const nextRows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","source","sequence","targetType","targetId","slaHours"
         FROM "SupportTicketRoutingRule"
         WHERE "isActive" = true
           AND ("source" = $1 OR "source" = 'ALL')
           AND "sequence" > $2
         ORDER BY CASE WHEN "source" = $1 THEN 0 ELSE 1 END ASC, "sequence" ASC
         LIMIT 1`,
        asTicketSource(row.source, 'OTHER'),
        Math.max(1, Number(snapshot.sequence || 1))
      );
      const next = nextRows[0];
      if (next) {
        const targetType = String(next.targetType || '').trim().toUpperCase() as RouteTargetType;
        if (ROUTE_TARGET_TYPES.includes(targetType)) {
          nextAssignment = await resolveAssignment(targetType, String(next.targetId || ''));
          nextSlaHours = Math.max(1, Number(next.slaHours || 24));
          nextSnapshot = {
            ruleId: String(next.id || ''),
            source: asTicketSource(next.source, asTicketSource(row.source, 'OTHER')),
            sequence: Number(next.sequence || 1),
            targetType,
            targetId: String(next.targetId || ''),
            slaHours: nextSlaHours,
          };
        }
      }
    }
    if (!nextAssignment) {
      await prisma.$executeRawUnsafe(`UPDATE "SupportTicket" SET "escalatedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`, String(row.id));
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "SupportTicket"
       SET "assignedAdminUserId" = $2,
           "assignedAdminRoleId" = $3,
           "assignedGroupId" = $4,
           "routeSnapshot" = $5::jsonb,
           "slaDueAt" = (NOW() + ($6 || ' hours')::interval),
           "escalatedAt" = NOW(),
           "escalationLevel" = COALESCE("escalationLevel",0) + 1,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(row.id),
      nextAssignment.assignedAdminUserId,
      nextAssignment.assignedAdminRoleId,
      nextAssignment.assignedGroupId,
      JSON.stringify(nextSnapshot),
      String(Math.max(1, nextSlaHours))
    );
  }
}

function guestTokenFromRequest(req: any) {
  return String(req.headers['x-chat-token'] || req.query?.token || req.body?.token || '').trim();
}

async function canAccessChat(sessionId: string, req: any) {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT "id","customerUserId","guestToken" FROM "SupportChatSession" WHERE "id" = $1 LIMIT 1`, sessionId);
  const session = rows[0];
  if (!session) return false;
  const user = req.user || null;
  if (user?.role === UserRole.ADMINISTRATOR || user?.role === UserRole.QA_TEAM) return true;
  if (user?.id && session.customerUserId && String(session.customerUserId) === String(user.id)) return true;
  const token = guestTokenFromRequest(req);
  if (token && session.guestToken && String(session.guestToken) === token) return true;
  return false;
}

function isPrivilegedChatViewer(user: any) {
  return user?.role === UserRole.ADMINISTRATOR || user?.role === UserRole.QA_TEAM;
}

async function buildChatThread(params: {
  sessionId: string;
  viewerLanguage?: string;
  includeInternal: boolean;
  includeInvisibleAgentMessages: boolean;
}) {
  const settings = await readSettings();
  const messages = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT m."id",
            m."senderParticipantId",
            m."senderRole",
            m."senderDisplayName",
            m."body",
            m."attachments",
            m."isInternal",
            m."sourceLanguage",
            m."createdAt",
            COALESCE(p."isVisibleToCustomer", true) AS "senderVisibleToCustomer"
     FROM "SupportChatMessage" m
     LEFT JOIN "SupportChatParticipant" p ON p."id" = m."senderParticipantId"
     WHERE m."sessionId" = $1
     ORDER BY m."createdAt" ASC`,
    params.sessionId
  );
  const normalizedViewerLanguage = normalizeTicketingLanguage(params.viewerLanguage, settings.defaultLanguage);
  const mapped = [];
  for (const row of messages) {
    const senderRole = String(row.senderRole || '').trim().toUpperCase();
    const senderVisibleToCustomer = row.senderVisibleToCustomer !== false;
    if (!params.includeInternal && row.isInternal === true) continue;
    if (
      !params.includeInvisibleAgentMessages &&
      senderRole !== 'CUSTOMER' &&
      senderRole !== 'BOT' &&
      senderVisibleToCustomer === false
    ) {
      continue;
    }
    const sourceLanguage = normalizeTicketingLanguage(row.sourceLanguage, settings.defaultLanguage);
    let body = String(row.body || '');
    let translated = false;
    if (settings.translationEnabled && sourceLanguage !== normalizedViewerLanguage) {
      try {
        const translatedResult = await translateTicketingText({
          text: body,
          sourceLanguage,
          targetLanguage: normalizedViewerLanguage,
        });
        const translatedBody = String(translatedResult.translatedText || '').trim();
        if (translatedBody) {
          body = translatedBody;
          translated = translatedBody !== String(row.body || '');
        }
      } catch {
        translated = false;
      }
    }
    mapped.push({
      id: String(row.id || ''),
      body,
      originalBody: String(row.body || ''),
      sourceLanguage,
      translated,
      translatedToLanguage: normalizedViewerLanguage,
      senderRole: senderRole || String(row.senderRole || ''),
      senderDisplayName: String(row.senderDisplayName || ''),
      isInternal: row.isInternal === true,
      senderVisibleToCustomer,
      attachments: normalizeAttachments(parseArray(row.attachments)),
      createdAt: new Date(row.createdAt || Date.now()).toISOString(),
    });
  }
  return mapped;
}

async function createSupportTicket(input: {
  source: TicketSource;
  title: string;
  subject?: string;
  body: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterUserId?: string | null;
  relatedOrderId?: string;
  createdByUserId?: string | null;
  sourceLanguage?: string;
  attachments?: string[];
  targetType?: RouteTargetType;
  targetId?: string;
}) {
  const settings = await readSettings();
  const sourceLanguage = await resolveIncomingSourceLanguage({
    providedLanguage: input.sourceLanguage,
    text: input.body,
    fallbackLanguage: settings.defaultLanguage,
  });
  const ticketNumber = await allocateSupportTicketNumber(settings);
  let assignment = { assignedAdminUserId: null as string | null, assignedAdminRoleId: null as string | null, assignedGroupId: null as string | null };
  let snapshot: Record<string, unknown> = {};
  let slaHours = 24;
  if (input.targetType && input.targetId) {
    assignment = await resolveAssignment(input.targetType, input.targetId);
    snapshot = { source: input.source, sequence: 0, targetType: input.targetType, targetId: input.targetId, slaHours };
  } else {
    const routing = await resolveInitialRouting(input.source);
    if (routing) {
      assignment = routing.assignment;
      snapshot = routing.snapshot;
      slaHours = Number(routing.snapshot.slaHours || 24);
    }
  }
  const ticketId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SupportTicket"
      ("id","ticketNumber","source","title","subject","status","relatedOrderId","requesterUserId","requesterName","requesterEmail","requesterPhone","assignedAdminUserId","assignedAdminRoleId","assignedGroupId","slaDueAt","routeSnapshot","createdByUserId","lastMessageAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'OPEN',$6,$7,$8,$9,$10,$11,$12,$13,(NOW() + ($14 || ' hours')::interval),$15::jsonb,$16,NOW(),NOW(),NOW())`,
    ticketId,
    ticketNumber,
    input.source,
    String(input.title || '').slice(0, 240),
    String(input.subject || input.title || '').slice(0, 240),
    input.relatedOrderId || null,
    input.requesterUserId || null,
    input.requesterName || null,
    input.requesterEmail || null,
    input.requesterPhone || null,
    assignment.assignedAdminUserId,
    assignment.assignedAdminRoleId,
    assignment.assignedGroupId,
    String(Math.max(1, slaHours)),
    JSON.stringify(snapshot),
    input.createdByUserId || null
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SupportTicketMessage"
      ("id","ticketId","senderUserId","senderRole","senderDisplayName","body","attachments","sourceLanguage","visibleToCustomer","isInternal","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,true,false,NOW())`,
    randomUUID(),
    ticketId,
    input.requesterUserId || null,
    input.requesterUserId ? 'CUSTOMER' : 'GUEST',
    input.requesterName || 'Customer',
    String(input.body || '').slice(0, 5000),
    JSON.stringify(normalizeAttachments(input.attachments || [])),
    sourceLanguage
  );
  return { ticketId, ticketNumber };
}

async function sendBotSupportResponse(message: string) {
  const lower = String(message || '').toLowerCase();
  if (!lower.trim()) return { reply: 'Please share a little more detail so I can help.', escalate: false };
  if (lower.includes('track') || lower.includes('where is my order') || lower.includes('delivery')) {
    return { reply: 'I can help with order tracking. Please share your order number and we can check status immediately.', escalate: false };
  }
  if (lower.includes('refund') || lower.includes('cancel')) {
    return { reply: 'I can help with refund requests. Please share your order number and reason so I can escalate to billing if needed.', escalate: true };
  }
  if (lower.includes('account') || lower.includes('password') || lower.includes('login')) {
    return { reply: 'For account support, I can connect you to a live agent right away.', escalate: true };
  }
  return { reply: 'I can answer quick questions, but for this request I will connect you to a live agent now.', escalate: true };
}

async function searchShoppingSuggestions(message: string) {
  const terms = dedupeStrings(
    String(message || '')
      .toLowerCase()
      .split(/[\s,.;:/\\|!?(){}\[\]-]+/)
      .filter((token) => token.length >= 3)
  ).slice(0, 8);
  const queryToken = terms[0] || String(message || '').trim().slice(0, 40);
  if (!queryToken) return [];
  const [fabrics, designs, ready] = await Promise.all([
    prisma.fabric.findMany({
      where: { name: { contains: queryToken, mode: 'insensitive' } },
      select: { id: true, name: true, finalPrice: true, images: { select: { url: true }, take: 1 } },
      take: 4,
    }),
    prisma.design.findMany({
      where: { name: { contains: queryToken, mode: 'insensitive' } },
      select: { id: true, name: true, finalPrice: true, images: { select: { url: true }, take: 1 } },
      take: 4,
    }),
    prisma.readyToWear.findMany({
      where: { name: { contains: queryToken, mode: 'insensitive' } },
      select: { id: true, name: true, basePrice: true, images: { select: { url: true }, take: 1 } },
      take: 4,
    }),
  ]);
  const results: Array<{ id: string; type: string; name: string; price: number; image?: string; href: string }> = [];
  for (const row of fabrics) {
    results.push({
      id: String(row.id),
      type: 'FABRIC',
      name: String(row.name || ''),
      price: Number(row.finalPrice || 0),
      image: Array.isArray(row.images) ? String(row.images[0]?.url || '') : '',
      href: `/fabrics/${row.id}`,
    });
  }
  for (const row of designs) {
    results.push({
      id: String(row.id),
      type: 'DESIGN',
      name: String(row.name || ''),
      price: Number(row.finalPrice || 0),
      image: Array.isArray(row.images) ? String(row.images[0]?.url || '') : '',
      href: `/designs/${row.id}`,
    });
  }
  for (const row of ready) {
    results.push({
      id: String(row.id),
      type: 'READY_TO_WEAR',
      name: String(row.name || ''),
      price: Number(row.basePrice || 0),
      image: Array.isArray(row.images) ? String(row.images[0]?.url || '') : '',
      href: `/ready-to-wear/${row.id}`,
    });
  }
  return results.slice(0, 8);
}

router.get('/public/config', async (_req, res) => {
  try {
    const settings = await readSettings();
    const departments = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","name","code","description" FROM "SupportDepartment" WHERE "isActive" = true ORDER BY "name" ASC`
    );
    return res.json({
      success: true,
      data: {
        settings: {
          translationEnabled: settings.translationEnabled,
          defaultLanguage: settings.defaultLanguage,
          chatPopupDelayMinutes: settings.chatPopupDelayMinutes,
          shoppingBotDelayMinutes: settings.shoppingBotDelayMinutes,
          botEnabled: settings.botEnabled,
          shoppingBotEnabled: settings.shoppingBotEnabled,
          serviceBotEnabled: settings.serviceBotEnabled,
          shoppingBotAvatarFemale: settings.shoppingBotAvatarFemale,
          shoppingBotAvatarMale: settings.shoppingBotAvatarMale,
        },
        supportedLanguages: getTicketingSupportedLanguages(),
        departments: departments.map((row) => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          code: String(row.code || ''),
          description: String(row.description || ''),
        })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load support config.' });
  }
});

router.get(
  '/admin/settings',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE, Permissions.ORDERS_MANAGE),
  async (_req, res) => {
    try {
      const settings = await readSettings();
      return res.json({
        success: true,
        data: {
          ...settings,
          supportedLanguages: getTicketingSupportedLanguages(),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to read settings.' });
    }
  }
);

router.patch(
  '/admin/settings',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = supportSettingsPatchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      }
      const updated = await writeSettings(parsed.data as Partial<SupportSettings>);
      return res.json({ success: true, data: updated, message: 'Customer service settings updated.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update settings.' });
    }
  }
);

router.get(
  '/admin/departments',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE, Permissions.ORDERS_MANAGE),
  async (_req, res) => {
    try {
      await ensureSchema();
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","name","code","description","targetType","targetId","isActive","createdAt","updatedAt"
         FROM "SupportDepartment"
         ORDER BY "name" ASC`
      );
      return res.json({ success: true, data: rows });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to list departments.' });
    }
  }
);

router.post(
  '/admin/departments',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = departmentSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      }
      const data = parsed.data;
      await ensureSchema();
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupportDepartment" ("id","name","code","description","targetType","targetId","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
        id,
        data.name.trim(),
        data.code.trim().toUpperCase(),
        data.description?.trim() || null,
        (data.targetType || 'AUTO').toUpperCase(),
        data.targetId?.trim() || null,
        data.isActive !== false
      );
      return res.status(201).json({ success: true, data: { id }, message: 'Department created.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to create department.' });
    }
  }
);

router.patch(
  '/admin/departments/:id',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_SETTINGS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = departmentSchema.partial().safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      }
      const patch = parsed.data;
      await ensureSchema();
      const currentRows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportDepartment" WHERE "id" = $1 LIMIT 1`, String(req.params.id || ''));
      const current = currentRows[0];
      if (!current) return res.status(404).json({ success: false, message: 'Department not found.' });
      await prisma.$executeRawUnsafe(
        `UPDATE "SupportDepartment"
         SET "name" = $2,
             "code" = $3,
             "description" = $4,
             "targetType" = $5,
             "targetId" = $6,
             "isActive" = $7,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(req.params.id),
        String(patch.name ?? current.name),
        String((patch.code ?? current.code) || '').toUpperCase(),
        patch.description !== undefined ? patch.description || null : current.description,
        String((patch.targetType ?? current.targetType) || 'AUTO').toUpperCase(),
        patch.targetId !== undefined ? patch.targetId || null : current.targetId,
        patch.isActive !== undefined ? patch.isActive : current.isActive
      );
      return res.json({ success: true, message: 'Department updated.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update department.' });
    }
  }
);

router.get(
  '/admin/ticket-routing/groups',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (_req, res) => {
    try {
      await ensureSchema();
      const rows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportTicketGroup" ORDER BY "name" ASC`);
      return res.json({ success: true, data: rows });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to list groups.' });
    }
  }
);

router.post(
  '/admin/ticket-routing/groups',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = groupSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      await ensureSchema();
      const id = randomUUID();
      const data = parsed.data;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupportTicketGroup" ("id","name","description","groupType","roleTokens","userIds","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,NOW(),NOW())`,
        id,
        data.name.trim(),
        data.description?.trim() || null,
        data.groupType || 'MIXED',
        JSON.stringify(dedupeStrings(data.roleTokens || [])),
        JSON.stringify(dedupeStrings(data.userIds || [])),
        data.isActive !== false
      );
      return res.status(201).json({ success: true, data: { id }, message: 'Group created.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to create group.' });
    }
  }
);

router.patch(
  '/admin/ticket-routing/groups/:id',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = groupSchema.partial().safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const rows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportTicketGroup" WHERE "id" = $1 LIMIT 1`, String(req.params.id || ''));
      const current = rows[0];
      if (!current) return res.status(404).json({ success: false, message: 'Group not found.' });
      const patch = parsed.data;
      await prisma.$executeRawUnsafe(
        `UPDATE "SupportTicketGroup"
         SET "name" = $2,
             "description" = $3,
             "groupType" = $4,
             "roleTokens" = $5::jsonb,
             "userIds" = $6::jsonb,
             "isActive" = $7,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(req.params.id),
        String(patch.name ?? current.name),
        patch.description !== undefined ? patch.description || null : current.description,
        String(patch.groupType ?? current.groupType ?? 'MIXED'),
        JSON.stringify(dedupeStrings(patch.roleTokens ?? parseArray(current.roleTokens))),
        JSON.stringify(dedupeStrings(patch.userIds ?? parseArray(current.userIds))),
        patch.isActive !== undefined ? patch.isActive : current.isActive
      );
      return res.json({ success: true, message: 'Group updated.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update group.' });
    }
  }
);

router.get(
  '/admin/ticket-routing/rules',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (_req, res) => {
    try {
      await ensureSchema();
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM "SupportTicketRoutingRule" ORDER BY "source" ASC, "sequence" ASC`
      );
      return res.json({ success: true, data: rows });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to list rules.' });
    }
  }
);

router.post(
  '/admin/ticket-routing/rules',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = routingRuleSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const data = parsed.data;
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupportTicketRoutingRule"
         ("id","name","source","sequence","targetType","targetId","slaHours","escalationTargetType","escalationTargetId","isActive","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
        id,
        data.name.trim(),
        (data.source || 'ALL').toUpperCase(),
        Number(data.sequence || 1),
        data.targetType,
        data.targetId,
        Number(data.slaHours || 24),
        data.escalationTargetType || null,
        data.escalationTargetId || null,
        data.isActive !== false
      );
      return res.status(201).json({ success: true, data: { id }, message: 'Routing rule created.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to create routing rule.' });
    }
  }
);

router.patch(
  '/admin/ticket-routing/rules/:id',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_ROUTING_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = routingRuleSchema.partial().safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const currentRows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportTicketRoutingRule" WHERE "id" = $1 LIMIT 1`, String(req.params.id || ''));
      const current = currentRows[0];
      if (!current) return res.status(404).json({ success: false, message: 'Rule not found.' });
      const patch = parsed.data;
      await prisma.$executeRawUnsafe(
        `UPDATE "SupportTicketRoutingRule"
         SET "name" = $2,
             "source" = $3,
             "sequence" = $4,
             "targetType" = $5,
             "targetId" = $6,
             "slaHours" = $7,
             "escalationTargetType" = $8,
             "escalationTargetId" = $9,
             "isActive" = $10,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(req.params.id),
        String(patch.name ?? current.name),
        String((patch.source ?? current.source) || 'ALL').toUpperCase(),
        Number(patch.sequence ?? current.sequence ?? 1),
        String(patch.targetType ?? current.targetType),
        String(patch.targetId ?? current.targetId),
        Number(patch.slaHours ?? current.slaHours ?? 24),
        patch.escalationTargetType !== undefined ? patch.escalationTargetType || null : current.escalationTargetType,
        patch.escalationTargetId !== undefined ? patch.escalationTargetId || null : current.escalationTargetId,
        patch.isActive !== undefined ? patch.isActive : current.isActive
      );
      return res.json({ success: true, message: 'Routing rule updated.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update routing rule.' });
    }
  }
);

router.get(
  '/admin/tickets',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_TICKETS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      await ensureSchema();
      await runEscalationSweep().catch(() => undefined);
      const sourceFilter = String(req.query?.source || '').trim().toUpperCase();
      const statusFilter = String(req.query?.status || '').trim().toUpperCase();
      const search = String(req.query?.search || '').trim().toLowerCase();
      const supportTickets = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT t.*,
                (SELECT COUNT(*)::int FROM "SupportTicketMessage" m WHERE m."ticketId" = t."id") AS "messageCount"
         FROM "SupportTicket" t
         ORDER BY t."updatedAt" DESC
         LIMIT 500`
      );
      const orderTickets = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT ot."id", ot."orderId", ot."subject", ot."status", ot."assignedToUserId", ot."assignedToRole", ot."dueAt", ot."escalatedAt", ot."createdAt", ot."updatedAt",
                o."orderNumber", o."customerId",
                (SELECT COUNT(*)::int FROM "OrderTicketMessage" om WHERE om."ticketId" = ot."id") AS "messageCount"
         FROM "OrderTicket" ot
         LEFT JOIN "Order" o ON o."id" = ot."orderId"
         ORDER BY ot."updatedAt" DESC
         LIMIT 500`
      );
      const mappedSupport = supportTickets.map((row) => ({
        id: `SUPPORT:${row.id}`,
        ticketId: String(row.id || ''),
        ticketNumber: String(row.ticketNumber || '').trim(),
        source: asTicketSource(row.source, 'OTHER'),
        title: String(row.title || row.subject || 'Support Ticket'),
        subject: String(row.subject || row.title || ''),
        status: String(row.status || 'OPEN'),
        requesterUserId: row.requesterUserId ? String(row.requesterUserId) : null,
        requesterName: String(row.requesterName || ''),
        requesterEmail: String(row.requesterEmail || ''),
        requesterPhone: String(row.requesterPhone || ''),
        assignedAdminUserId: row.assignedAdminUserId ? String(row.assignedAdminUserId) : null,
        assignedAdminRoleId: row.assignedAdminRoleId ? String(row.assignedAdminRoleId) : null,
        assignedGroupId: row.assignedGroupId ? String(row.assignedGroupId) : null,
        dueAt: row.slaDueAt ? new Date(row.slaDueAt).toISOString() : null,
        escalatedAt: row.escalatedAt ? new Date(row.escalatedAt).toISOString() : null,
        relatedOrderId: row.relatedOrderId ? String(row.relatedOrderId) : null,
        messageCount: Number(row.messageCount || 0),
        createdAt: new Date(row.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
      }));
      const mappedOrder = orderTickets.map((row) => ({
        id: `ORDER:${row.id}`,
        ticketId: String(row.id || ''),
        ticketNumber: '',
        source: 'ORDER',
        title: String(row.orderNumber || row.subject || `Order ${row.orderId || ''}`),
        subject: String(row.subject || row.orderNumber || ''),
        status: String(row.status || 'OPEN'),
        requesterUserId: row.customerId ? String(row.customerId) : null,
        requesterName: '',
        requesterEmail: '',
        requesterPhone: '',
        assignedAdminUserId: row.assignedToUserId ? String(row.assignedToUserId) : null,
        assignedAdminRoleId: row.assignedToRole ? String(row.assignedToRole) : null,
        assignedGroupId: null,
        dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
        escalatedAt: row.escalatedAt ? new Date(row.escalatedAt).toISOString() : null,
        relatedOrderId: row.orderId ? String(row.orderId) : null,
        messageCount: Number(row.messageCount || 0),
        createdAt: new Date(row.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
      }));
      const merged = [...mappedSupport, ...mappedOrder]
        .filter((row) => (sourceFilter ? String(row.source).toUpperCase() === sourceFilter : true))
        .filter((row) => (statusFilter ? String(row.status).toUpperCase() === statusFilter : true))
        .filter((row) => {
          if (!search) return true;
          return (
            row.title.toLowerCase().includes(search) ||
            row.subject.toLowerCase().includes(search) ||
            String(row.requesterName || '').toLowerCase().includes(search) ||
            String(row.requesterEmail || '').toLowerCase().includes(search)
          );
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return res.json({ success: true, data: merged });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load tickets.' });
    }
  }
);

router.post(
  '/admin/tickets',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_TICKETS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req: any, res) => {
    try {
      const parsed = ticketCreateSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const data = parsed.data;
      const created = await createSupportTicket({
        source: data.source || 'OTHER',
        title: data.title,
        subject: data.subject,
        body: data.body,
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        requesterPhone: data.requesterPhone,
        requesterUserId: data.requesterUserId || null,
        relatedOrderId: data.relatedOrderId,
        createdByUserId: req.user?.id || null,
        sourceLanguage: data.sourceLanguage,
        attachments: data.attachments || [],
        targetType: data.targetType,
        targetId: data.targetId,
      });
      return res
        .status(201)
        .json({ success: true, data: { id: `SUPPORT:${created.ticketId}`, ticketNumber: created.ticketNumber }, message: 'Ticket created.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to create ticket.' });
    }
  }
);

router.get(
  '/admin/tickets/:ticketRef/messages',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_TICKETS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      await ensureSchema();
      const ticketRef = String(req.params.ticketRef || '').trim();
      if (ticketRef.startsWith('ORDER:')) {
        const ticketId = ticketRef.slice('ORDER:'.length);
        const messages = await prisma.$queryRawUnsafe<Array<any>>(
          `SELECT "id","ticketId","senderUserId","senderRole","senderDisplayName","body","recipientRoles","attachments","visibleToCustomer","isInternal","sourceLanguage","createdAt"
           FROM "OrderTicketMessage"
           WHERE "ticketId" = $1
           ORDER BY "createdAt" ASC`,
          ticketId
        );
        return res.json({ success: true, data: messages });
      }
      const ticketId = ticketRef.startsWith('SUPPORT:') ? ticketRef.slice('SUPPORT:'.length) : ticketRef;
      const messages = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","ticketId","senderUserId","senderRole","senderDisplayName","body","attachments","visibleToCustomer","isInternal","sourceLanguage","createdAt"
         FROM "SupportTicketMessage"
         WHERE "ticketId" = $1
         ORDER BY "createdAt" ASC`,
        ticketId
      );
      return res.json({ success: true, data: messages });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load ticket messages.' });
    }
  }
);

router.post(
  '/admin/tickets/:ticketRef/messages',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_TICKETS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req: any, res) => {
    try {
      const parsed = ticketReplySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const ticketRef = String(req.params.ticketRef || '').trim();
      const data = parsed.data;
      const settings = await readSettings();
      const sourceLanguage = await resolveIncomingSourceLanguage({
        providedLanguage: data.sourceLanguage,
        text: data.body,
        fallbackLanguage: settings.defaultLanguage,
      });
      if (ticketRef.startsWith('ORDER:')) {
        const ticketId = ticketRef.slice('ORDER:'.length);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "OrderTicketMessage"
            ("id","ticketId","orderId","senderUserId","senderRole","senderDisplayName","body","recipientRoles","attachments","visibleToCustomer","isInternal","sourceLanguage","createdAt")
           SELECT $1, ot."id", ot."orderId", $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NOW()
           FROM "OrderTicket" ot
           WHERE ot."id" = $11`,
          randomUUID(),
          req.user?.id || null,
          req.user?.role || UserRole.ADMINISTRATOR,
          `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.email || 'Support Agent',
          data.body,
          JSON.stringify(['CUSTOMER', 'ADMINISTRATOR']),
          JSON.stringify(normalizeAttachments(data.attachments || [])),
          data.visibleToCustomer !== false,
          data.isInternal === true,
          sourceLanguage,
          ticketId
        );
        await prisma.$executeRawUnsafe(`UPDATE "OrderTicket" SET "updatedAt" = NOW(), "lastMessageAt" = NOW() WHERE "id" = $1`, ticketId);
      } else {
        const ticketId = ticketRef.startsWith('SUPPORT:') ? ticketRef.slice('SUPPORT:'.length) : ticketRef;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "SupportTicketMessage"
            ("id","ticketId","senderUserId","senderRole","senderDisplayName","body","attachments","sourceLanguage","visibleToCustomer","isInternal","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,NOW())`,
          randomUUID(),
          ticketId,
          req.user?.id || null,
          req.user?.role || UserRole.ADMINISTRATOR,
          `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.email || 'Support Agent',
          data.body,
          JSON.stringify(normalizeAttachments(data.attachments || [])),
          sourceLanguage,
          data.visibleToCustomer !== false,
          data.isInternal === true
        );
        await prisma.$executeRawUnsafe(`UPDATE "SupportTicket" SET "updatedAt" = NOW(), "lastMessageAt" = NOW() WHERE "id" = $1`, ticketId);
      }
      return res.json({ success: true, message: 'Reply sent.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to send reply.' });
    }
  }
);

router.patch(
  '/admin/tickets/:ticketRef/assign',
  authenticate,
  authorizePermissions(Permissions.SUPPORT_TICKETS_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const parsed = ticketAssignSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const ticketRef = String(req.params.ticketRef || '').trim();
      const data = parsed.data;
      const slaHours = Math.max(1, Number(data.slaHours || 24));
      if (ticketRef.startsWith('ORDER:')) {
        const ticketId = ticketRef.slice('ORDER:'.length);
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderTicket"
           SET "assignedToUserId" = $2,
               "assignedToRole" = $3,
               "status" = COALESCE($4, "status"),
               "dueAt" = (NOW() + ($5 || ' hours')::interval),
               "updatedAt" = NOW()
           WHERE "id" = $1`,
          ticketId,
          data.targetType === 'ADMIN_USER' ? data.targetId || null : null,
          data.targetType === 'ADMIN_ROLE' ? data.targetId || null : null,
          data.status || null,
          String(slaHours)
        );
      } else {
        const ticketId = ticketRef.startsWith('SUPPORT:') ? ticketRef.slice('SUPPORT:'.length) : ticketRef;
        const assignment =
          data.targetType && data.targetId
            ? await resolveAssignment(data.targetType, data.targetId)
            : { assignedAdminUserId: null, assignedAdminRoleId: null, assignedGroupId: null };
        await prisma.$executeRawUnsafe(
          `UPDATE "SupportTicket"
           SET "assignedAdminUserId" = COALESCE($2, "assignedAdminUserId"),
               "assignedAdminRoleId" = COALESCE($3, "assignedAdminRoleId"),
               "assignedGroupId" = COALESCE($4, "assignedGroupId"),
               "status" = COALESCE($5, "status"),
               "source" = COALESCE($6, "source"),
               "slaDueAt" = (NOW() + ($7 || ' hours')::interval),
               "updatedAt" = NOW()
           WHERE "id" = $1`,
          ticketId,
          assignment.assignedAdminUserId,
          assignment.assignedAdminRoleId,
          assignment.assignedGroupId,
          data.status || null,
          data.source || null,
          String(slaHours)
        );
      }
      return res.json({ success: true, message: 'Ticket assignment updated.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update assignment.' });
    }
  }
);

router.post('/email/ingest', async (req, res) => {
  try {
    const settings = await readSettings();
    if (!settings.emailIngestEnabled) return res.status(403).json({ success: false, message: 'Email ingestion is disabled.' });
    const token = String(req.headers['x-support-email-token'] || req.query?.token || '').trim();
    if (!token || token !== settings.emailIngestToken) return res.status(401).json({ success: false, message: 'Invalid token.' });
    const payload = z
      .object({
        fromEmail: z.string().trim().email(),
        fromName: z.string().trim().max(180).optional(),
        phone: z.string().trim().max(80).optional(),
        subject: z.string().trim().min(1).max(240),
        body: z.string().trim().min(1).max(5000),
        sourceLanguage: z.string().trim().min(2).max(24).optional(),
      })
      .safeParse(req.body || {});
    if (!payload.success) return res.status(400).json({ success: false, message: payload.error.errors[0]?.message || 'Invalid payload.' });
    const data = payload.data;
    const created = await createSupportTicket({
      source: 'EMAIL',
      title: data.subject,
      subject: data.subject,
      body: data.body,
      requesterName: data.fromName || data.fromEmail,
      requesterEmail: data.fromEmail,
      requesterPhone: data.phone,
      sourceLanguage: data.sourceLanguage,
    });
    return res
      .status(201)
      .json({ success: true, data: { id: `SUPPORT:${created.ticketId}`, ticketNumber: created.ticketNumber }, message: 'Email converted to ticket.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to ingest email.' });
  }
});

router.post('/chat/start', optionalAuth, async (req: any, res) => {
  try {
    await ensureSchema();
    const parsed = chatStartSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
    const data = parsed.data;
    const settings = await readSettings();
    const user = req.user || null;
    const preferredLanguage = normalizeTicketingLanguage(data.preferredLanguage, settings.defaultLanguage);
    const guestToken = user?.id ? null : randomUUID().replace(/-/g, '');
    const sessionId = randomUUID();

    let assignment = { assignedAdminUserId: null as string | null, assignedAdminRoleId: null as string | null, assignedGroupId: null as string | null };
    if (data.departmentId) {
      const deptRows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "targetType","targetId" FROM "SupportDepartment" WHERE "id" = $1 AND "isActive" = true LIMIT 1`,
        String(data.departmentId || '')
      );
      const dept = deptRows[0];
      if (dept && dept.targetType && String(dept.targetType).toUpperCase() !== 'AUTO' && dept.targetId) {
        const tt = String(dept.targetType).toUpperCase() as RouteTargetType;
        if (ROUTE_TARGET_TYPES.includes(tt)) assignment = await resolveAssignment(tt, String(dept.targetId || ''));
      }
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportChatSession"
        ("id","status","departmentId","issueType","source","customerUserId","guestName","guestEmail","guestPhone","guestToken","preferredLanguage","assignedAdminUserId","assignedAdminRoleId","assignedGroupId","metadata","lastMessageAt","createdAt","updatedAt")
       VALUES ($1,'OPEN',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'{}'::jsonb,NOW(),NOW(),NOW())`,
      sessionId,
      data.departmentId || null,
      data.issueType || null,
      data.source || 'WIDGET',
      user?.id || null,
      (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : data.name || null) || null,
      (user ? user.email : data.email) || null,
      (user ? user.phone : data.phone) || null,
      guestToken,
      preferredLanguage,
      assignment.assignedAdminUserId,
      assignment.assignedAdminRoleId,
      assignment.assignedGroupId
    );
    const participantId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportChatParticipant"
        ("id","sessionId","userId","displayName","role","preferredLanguage","isVisibleToCustomer","isPrimary","joinedAt")
       VALUES ($1,$2,$3,$4,'CUSTOMER',$5,true,true,NOW())`,
      participantId,
      sessionId,
      user?.id || null,
      (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : data.name || null) || 'Customer',
      preferredLanguage
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportChatMessage"
        ("id","sessionId","senderParticipantId","senderRole","senderDisplayName","body","attachments","isInternal","sourceLanguage","createdAt")
       VALUES ($1,$2,NULL,'BOT','ZuriKaribu Assistant',$3,'[]'::jsonb,false,$4,NOW())`,
      randomUUID(),
      sessionId,
      'Welcome to ZuriKaribu support. Tell us what you need, and we will connect you to the right team.',
      settings.defaultLanguage
    );
    return res.status(201).json({
      success: true,
      data: { sessionId, token: guestToken, preferredLanguage, assignedAdminUserId: assignment.assignedAdminUserId },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to start chat.' });
  }
});

router.get('/chat/:sessionId', optionalAuth, async (req: any, res) => {
  try {
    await ensureSchema();
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session id is required.' });
    const allowed = await canAccessChat(sessionId, req);
    if (!allowed) return res.status(403).json({ success: false, message: 'Not allowed to access this chat.' });
    const rows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportChatSession" WHERE "id" = $1 LIMIT 1`, sessionId);
    const session = rows[0];
    if (!session) return res.status(404).json({ success: false, message: 'Chat session not found.' });
    const settings = await readSettings();
    const viewerLanguage = normalizeTicketingLanguage(
      req.query?.language || req.query?.preferredLanguage,
      session.preferredLanguage || settings.defaultLanguage
    );
    const privilegedViewer = isPrivilegedChatViewer(req.user);
    const messages = await buildChatThread({
      sessionId,
      viewerLanguage,
      includeInternal: privilegedViewer,
      includeInvisibleAgentMessages: privilegedViewer,
    });
    const participantRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","userId","displayName","role","preferredLanguage","isVisibleToCustomer","isPrimary","joinedAt","leftAt"
       FROM "SupportChatParticipant"
       WHERE "sessionId" = $1
       ORDER BY "joinedAt" ASC`,
      sessionId
    );
    const participants = participantRows
      .filter((row) => {
        if (privilegedViewer) return true;
        const role = String(row.role || '').trim().toUpperCase();
        if (role === 'CUSTOMER') return true;
        return row.isVisibleToCustomer === true;
      })
      .map((row) => ({
        id: String(row.id || ''),
        userId: privilegedViewer ? (row.userId ? String(row.userId) : null) : null,
        displayName: String(row.displayName || ''),
        role: String(row.role || ''),
        preferredLanguage: normalizeTicketingLanguage(row.preferredLanguage, settings.defaultLanguage),
        isVisibleToCustomer: row.isVisibleToCustomer !== false,
        isPrimary: row.isPrimary === true,
        joinedAt: row.joinedAt ? new Date(row.joinedAt).toISOString() : null,
        leftAt: row.leftAt ? new Date(row.leftAt).toISOString() : null,
      }));
    return res.json({
      success: true,
      data: {
        session: {
          id: String(session.id || ''),
          status: String(session.status || 'OPEN'),
          departmentId: session.departmentId ? String(session.departmentId) : null,
          issueType: session.issueType ? String(session.issueType) : null,
          source: String(session.source || 'WIDGET'),
          preferredLanguage: String(session.preferredLanguage || 'en'),
          assignedAdminUserId: session.assignedAdminUserId ? String(session.assignedAdminUserId) : null,
          assignedAdminRoleId: session.assignedAdminRoleId ? String(session.assignedAdminRoleId) : null,
          assignedGroupId: session.assignedGroupId ? String(session.assignedGroupId) : null,
          createdAt: new Date(session.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(session.updatedAt || Date.now()).toISOString(),
        },
        language: {
          viewerPreferredLanguage: viewerLanguage,
          translationEnabled: settings.translationEnabled,
          defaultLanguage: settings.defaultLanguage,
          supportedLanguages: getTicketingSupportedLanguages(),
        },
        participants,
        messages,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load chat.' });
  }
});

router.post('/chat/:sessionId/messages', optionalAuth, async (req: any, res) => {
  try {
    await ensureSchema();
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session id is required.' });
    const allowed = await canAccessChat(sessionId, req);
    if (!allowed) return res.status(403).json({ success: false, message: 'Not allowed to post to this chat.' });
    const parsed = chatMessageSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
    const data = parsed.data;
    const settings = await readSettings();
    const sessionRows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportChatSession" WHERE "id" = $1 LIMIT 1`, sessionId);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ success: false, message: 'Chat session not found.' });
    const senderUser = req.user || null;
    let senderRole = 'CUSTOMER';
    if (senderUser?.role === UserRole.ADMINISTRATOR) senderRole = 'ADMIN';
    if (senderUser?.role === UserRole.QA_TEAM) senderRole = 'SUPERVISOR';
    const participantRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "SupportChatParticipant" WHERE "sessionId" = $1 AND COALESCE("leftAt", NULL) IS NULL AND (("userId" = $2) OR ($2 IS NULL AND "role" = 'CUSTOMER')) ORDER BY "joinedAt" ASC LIMIT 1`,
      sessionId,
      senderUser?.id || null
    );
    let participantId = participantRows[0]?.id ? String(participantRows[0].id) : '';
    if (!participantId) {
      participantId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupportChatParticipant"
          ("id","sessionId","userId","displayName","role","preferredLanguage","isVisibleToCustomer","isPrimary","joinedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,false,NOW())`,
        participantId,
        sessionId,
        senderUser?.id || null,
        senderUser ? `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim() || senderUser.email || 'Support Agent' : session.guestName || 'Customer',
        CHAT_ROLES.includes(senderRole as any) ? senderRole : 'CUSTOMER',
        normalizeTicketingLanguage(data.preferredLanguage, settings.defaultLanguage),
        senderRole === 'CUSTOMER'
      );
    }
    const sourceLanguage = await resolveIncomingSourceLanguage({
      providedLanguage: data.sourceLanguage,
      text: data.body,
      fallbackLanguage: settings.defaultLanguage,
      preferredLanguage: normalizeTicketingLanguage(data.preferredLanguage, session.preferredLanguage || settings.defaultLanguage),
    });
    const internalMessageRequested = data.isInternal === true;
    const effectiveIsInternal = senderRole === 'CUSTOMER' ? false : internalMessageRequested;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportChatMessage"
        ("id","sessionId","senderParticipantId","senderRole","senderDisplayName","body","attachments","isInternal","sourceLanguage","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,NOW())`,
      randomUUID(),
      sessionId,
      participantId,
      senderRole,
      senderUser ? `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim() || senderUser.email || 'Support Agent' : session.guestName || 'Customer',
      data.body,
      JSON.stringify(normalizeAttachments(data.attachments || [])),
      effectiveIsInternal,
      sourceLanguage
    );
    await prisma.$executeRawUnsafe(`UPDATE "SupportChatSession" SET "lastMessageAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`, sessionId);

    if (senderRole === 'CUSTOMER' && settings.botEnabled && settings.serviceBotEnabled) {
      const bot = await sendBotSupportResponse(data.body);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupportChatMessage"
          ("id","sessionId","senderParticipantId","senderRole","senderDisplayName","body","attachments","isInternal","sourceLanguage","createdAt")
         VALUES ($1,$2,NULL,'BOT','ZuriKaribu Assistant',$3,'[]'::jsonb,false,$4,NOW())`,
        randomUUID(),
        sessionId,
        bot.reply,
        settings.defaultLanguage
      );
      if (bot.escalate && !session.assignedAdminUserId && !session.assignedAdminRoleId && !session.assignedGroupId) {
        const created = await createSupportTicket({
          source: 'CHAT',
          title: `Chat escalation ${new Date().toISOString().slice(0, 16)}`,
          subject: 'Escalated from customer service chat',
          body: `Customer message: ${data.body}`,
          requesterName: String(session.guestName || ''),
          requesterEmail: String(session.guestEmail || ''),
          requesterPhone: String(session.guestPhone || ''),
          requesterUserId: session.customerUserId ? String(session.customerUserId) : null,
          sourceLanguage,
        });
        await prisma.$executeRawUnsafe(
          `INSERT INTO "SupportChatMessage"
            ("id","sessionId","senderParticipantId","senderRole","senderDisplayName","body","attachments","isInternal","sourceLanguage","createdAt")
           VALUES ($1,$2,NULL,'BOT','ZuriKaribu Assistant',$3,'[]'::jsonb,false,$4,NOW())`,
          randomUUID(),
          sessionId,
          `A support ticket has been created for escalation: SUPPORT:${created.ticketId} (${created.ticketNumber}). Our team will follow up shortly.`,
          settings.defaultLanguage
        );
      }
    }
    const viewerLanguage = normalizeTicketingLanguage(data.preferredLanguage, session.preferredLanguage || settings.defaultLanguage);
    const privilegedViewer = senderRole !== 'CUSTOMER';
    const messages = await buildChatThread({
      sessionId,
      viewerLanguage,
      includeInternal: privilegedViewer,
      includeInvisibleAgentMessages: privilegedViewer,
    });
    return res.json({ success: true, data: { messages } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to post chat message.' });
  }
});

router.get(
  '/admin/chats',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_CHAT_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      await ensureSchema();
      const status = String(req.query?.status || '').trim().toUpperCase();
      const search = String(req.query?.search || '').trim().toLowerCase();
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT s.*,
                d."name" AS "departmentName",
                (SELECT COUNT(*)::int FROM "SupportChatMessage" m WHERE m."sessionId" = s."id") AS "messageCount"
         FROM "SupportChatSession" s
         LEFT JOIN "SupportDepartment" d ON d."id" = s."departmentId"
         ORDER BY s."updatedAt" DESC
         LIMIT 500`
      );
      const mapped = rows
        .map((row) => ({
          id: String(row.id || ''),
          status: String(row.status || 'OPEN'),
          departmentId: row.departmentId ? String(row.departmentId) : null,
          departmentName: String(row.departmentName || ''),
          issueType: String(row.issueType || ''),
          source: String(row.source || 'WIDGET'),
          guestName: String(row.guestName || ''),
          guestEmail: String(row.guestEmail || ''),
          customerUserId: row.customerUserId ? String(row.customerUserId) : null,
          assignedAdminUserId: row.assignedAdminUserId ? String(row.assignedAdminUserId) : null,
          assignedAdminRoleId: row.assignedAdminRoleId ? String(row.assignedAdminRoleId) : null,
          assignedGroupId: row.assignedGroupId ? String(row.assignedGroupId) : null,
          messageCount: Number(row.messageCount || 0),
          preferredLanguage: String(row.preferredLanguage || 'en'),
          updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
          createdAt: new Date(row.createdAt || Date.now()).toISOString(),
        }))
        .filter((row) => (status ? row.status.toUpperCase() === status : true))
        .filter((row) => {
          if (!search) return true;
          return (
            row.departmentName.toLowerCase().includes(search) ||
            row.issueType.toLowerCase().includes(search) ||
            row.guestName.toLowerCase().includes(search) ||
            row.guestEmail.toLowerCase().includes(search)
          );
        });
      return res.json({ success: true, data: mapped });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to list chats.' });
    }
  }
);

router.patch(
  '/admin/chats/:sessionId/actions',
  authenticate,
  authorizePermissions(Permissions.CUSTOMER_SERVICE_CHAT_MANAGE, Permissions.ORDERS_MANAGE),
  async (req: any, res) => {
    try {
      await ensureSchema();
      const parsed = chatAdminActionSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
      const data = parsed.data;
      const sessionId = String(req.params.sessionId || '').trim();
      const sessionRows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT * FROM "SupportChatSession" WHERE "id" = $1 LIMIT 1`, sessionId);
      const session = sessionRows[0];
      if (!session) return res.status(404).json({ success: false, message: 'Chat session not found.' });
      if (data.action === 'TRANSFER') {
        if (!data.targetUserId) return res.status(400).json({ success: false, message: 'targetUserId is required for transfer.' });
        await prisma.$executeRawUnsafe(
          `UPDATE "SupportChatSession" SET "assignedAdminUserId" = $2, "primaryAgentUserId" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
          sessionId,
          data.targetUserId
        );
      } else if (data.action === 'ESCALATE') {
        await prisma.$executeRawUnsafe(`UPDATE "SupportChatSession" SET "status" = 'PENDING', "updatedAt" = NOW() WHERE "id" = $1`, sessionId);
      } else if (data.action === 'ADD_AGENT') {
        if (!data.targetUserId) return res.status(400).json({ success: false, message: 'targetUserId is required for add agent.' });
        const exists = await prisma.$queryRawUnsafe<Array<any>>(
          `SELECT "id" FROM "SupportChatParticipant" WHERE "sessionId" = $1 AND "userId" = $2 AND "leftAt" IS NULL LIMIT 1`,
          sessionId,
          data.targetUserId
        );
        if (!exists[0]) {
          const users = await prisma.user.findMany({ where: { id: data.targetUserId }, select: { id: true, firstName: true, lastName: true, email: true }, take: 1 });
          const user = users[0];
          await prisma.$executeRawUnsafe(
            `INSERT INTO "SupportChatParticipant"
              ("id","sessionId","userId","displayName","role","preferredLanguage","isVisibleToCustomer","isPrimary","joinedAt")
             VALUES ($1,$2,$3,$4,'AGENT','en',false,false,NOW())`,
            randomUUID(),
            sessionId,
            data.targetUserId,
            user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Support Agent' : 'Support Agent'
          );
        }
      } else if (data.action === 'TOGGLE_VISIBILITY') {
        if (!data.participantId) return res.status(400).json({ success: false, message: 'participantId is required for visibility toggle.' });
        await prisma.$executeRawUnsafe(
          `UPDATE "SupportChatParticipant"
           SET "isVisibleToCustomer" = $3
           WHERE "id" = $1 AND "sessionId" = $2`,
          data.participantId,
          sessionId,
          data.visibleToCustomer === true
        );
      }
      return res.json({ success: true, message: 'Chat action applied.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to apply chat action.' });
    }
  }
);

router.post('/bot/respond', optionalAuth, async (req, res) => {
  try {
    const parsed = botRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
    const data = parsed.data;
    const settings = await readSettings();
    if (!settings.botEnabled) return res.status(403).json({ success: false, message: 'Bot is disabled by admin settings.' });
    const mode = (data.mode || 'SERVICE').toUpperCase();
    const preferredLanguage = normalizeTicketingLanguage(data.preferredLanguage, settings.defaultLanguage);
    if (mode === 'SHOPPING') {
      const suggestions = await searchShoppingSuggestions(data.message);
      return res.json({
        success: true,
        data: {
          mode: 'SHOPPING',
          reply:
            suggestions.length > 0
              ? `I found ${suggestions.length} matching product suggestions.`
              : 'I could not find exact matches yet. Share style, fabric type, color, and budget and I will refine the search.',
          suggestions,
          preferredLanguage,
          genderHint: data.genderHint || '',
        },
      });
    }
    const service = await sendBotSupportResponse(data.message);
    return res.json({
      success: true,
      data: {
        mode: 'SERVICE',
        reply: service.reply,
        escalate: service.escalate,
        preferredLanguage,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to process bot request.' });
  }
});

router.get(
  '/admin/voip/settings',
  authenticate,
  authorizePermissions(Permissions.VOIP_MANAGE, Permissions.ORDERS_MANAGE),
  async (_req, res) => {
    try {
      const settings = await readSettings();
      return res.json({
        success: true,
        data: {
          enabled: settings.voipEnabled,
          provider: settings.voipProvider,
          callBaseUrl: settings.voipCallBaseUrl,
          routes: settings.voipRoutes,
          transferTargets: settings.voipTransferTargets,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load VoIP settings.' });
    }
  }
);

router.patch(
  '/admin/voip/settings',
  authenticate,
  authorizePermissions(Permissions.VOIP_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      const payload = z
        .object({
          enabled: z.boolean().optional(),
          provider: z.string().trim().max(120).optional(),
          callBaseUrl: z.string().trim().max(2000).optional(),
          routes: z.array(voipRouteItemSchema).max(200).optional(),
          transferTargets: z.array(voipTransferTargetItemSchema).max(200).optional(),
        })
        .safeParse(req.body || {});
      if (!payload.success) return res.status(400).json({ success: false, message: payload.error.errors[0]?.message || 'Invalid payload.' });
      const updated = await writeSettings({
        voipEnabled: payload.data.enabled,
        voipProvider: payload.data.provider,
        voipCallBaseUrl: payload.data.callBaseUrl,
        voipRoutes: payload.data.routes
          ? payload.data.routes.map((route) => ({
              id: String(route.id || '').trim(),
              name: String(route.name || '').trim(),
              enabled: route.enabled !== false,
              contextType: route.contextType || 'ANY',
              fromRoles: dedupeStrings(Array.isArray(route.fromRoles) ? route.fromRoles : []).map((token) => String(token || '').trim().toUpperCase()),
              targetType: route.targetType || 'CUSTOMER_SERVICE',
              targetId: String(route.targetId || '').trim(),
            }))
          : undefined,
        voipTransferTargets: payload.data.transferTargets
          ? payload.data.transferTargets.map((target) => ({
              id: String(target.id || '').trim(),
              name: String(target.name || '').trim(),
              enabled: target.enabled !== false,
              targetType: target.targetType || 'ADMIN_USER',
              targetId: String(target.targetId || '').trim(),
            }))
          : undefined,
      });
      return res.json({
        success: true,
        data: {
          enabled: updated.voipEnabled,
          provider: updated.voipProvider,
          callBaseUrl: updated.voipCallBaseUrl,
          routes: updated.voipRoutes,
          transferTargets: updated.voipTransferTargets,
        },
        message: 'VoIP settings updated.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to update VoIP settings.' });
    }
  }
);

router.get(
  '/admin/voip/calls',
  authenticate,
  authorizePermissions(Permissions.VOIP_MANAGE, Permissions.ORDERS_MANAGE),
  async (req, res) => {
    try {
      await ensureSchema();
      const statusFilter = String(req.query?.status || '').trim().toUpperCase();
      const contextTypeFilter = String(req.query?.contextType || '').trim().toUpperCase();
      const search = String(req.query?.search || '').trim().toLowerCase();
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT c.*,
                fu."email" AS "fromEmail",
                tu."email" AS "toEmail"
         FROM "SupportVoipCall" c
         LEFT JOIN "User" fu ON fu."id" = c."fromUserId"
         LEFT JOIN "User" tu ON tu."id" = c."toUserId"
         ORDER BY c."startedAt" DESC NULLS LAST, c."createdAt" DESC
         LIMIT 1000`
      );
      const mapped = rows
        .map((row) => ({
          id: String(row.id || ''),
          routeId: row.routeId ? String(row.routeId) : null,
          contextType: String(row.contextType || 'DIRECT'),
          contextId: row.contextId ? String(row.contextId) : null,
          fromUserId: row.fromUserId ? String(row.fromUserId) : null,
          toUserId: row.toUserId ? String(row.toUserId) : null,
          fromCallerId: row.fromCallerId ? String(row.fromCallerId) : null,
          toCallerId: row.toCallerId ? String(row.toCallerId) : null,
          fromEmail: String(row.fromEmail || ''),
          toEmail: String(row.toEmail || ''),
          provider: String(row.provider || ''),
          status: String(row.status || 'INITIATED'),
          callLink: String(row.callLink || ''),
          startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
          endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        }))
        .filter((row) => (statusFilter ? row.status.toUpperCase() === statusFilter : true))
        .filter((row) => (contextTypeFilter ? row.contextType.toUpperCase() === contextTypeFilter : true))
        .filter((row) => {
          if (!search) return true;
          return (
            String(row.fromEmail || '').toLowerCase().includes(search) ||
            String(row.toEmail || '').toLowerCase().includes(search) ||
            String(row.fromCallerId || '').toLowerCase().includes(search) ||
            String(row.toCallerId || '').toLowerCase().includes(search) ||
            String(row.contextId || '').toLowerCase().includes(search)
          );
        });
      return res.json({ success: true, data: mapped });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to list call logs.' });
    }
  }
);

router.post('/voip/calls/start', authenticate, async (req: any, res) => {
  try {
    await ensureSchema();
    const parsed = voipStartSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' });
    const settings = await readSettings();
    if (!settings.voipEnabled) return res.status(403).json({ success: false, message: 'VoIP is disabled by admin settings.' });
    const data = parsed.data;
    const callerUserId = req.user?.id ? String(req.user.id) : '';
    const callerRole = normalizeRoleToken(req.user?.role);
    if (!callerUserId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (isSellerOrDesignerRole(callerRole)) {
      return res.status(403).json({ success: false, message: 'Outbound calls are disabled for seller/designer accounts.' });
    }

    const selectedRoute = pickVoipRoute(settings, {
      requestedRouteId: data.routeId,
      contextType: data.contextType,
      fromRole: callerRole,
    });

    let toUserId = String(data.toUserId || '').trim() || null;
    const customerOnlyRoute = isCustomerRole(callerRole);
    if (customerOnlyRoute) {
      toUserId = null;
    }
    if (!customerOnlyRoute && !toUserId && data.contextType === 'TICKET') {
      toUserId = await resolveVoipTicketTargetUserId(String(data.contextId || ''), callerUserId);
    }
    if (!customerOnlyRoute && !toUserId && data.contextType === 'CHAT') {
      toUserId = await resolveVoipChatTargetUserId(String(data.contextId || ''), callerUserId);
    }
    if (!toUserId) {
      toUserId = await resolveVoipTargetFromRoute(selectedRoute);
    }
    if (isCustomerRole(callerRole) && !toUserId) {
      const fallbackRouting = await resolveInitialRouting('PHONE');
      toUserId = fallbackRouting?.assignment?.assignedAdminUserId || null;
    }
    if (toUserId && String(toUserId) === callerUserId) {
      toUserId = null;
    }
    if (!toUserId) {
      return res.status(400).json({
        success: false,
        message: isCustomerRole(callerRole)
          ? 'No customer service agent is currently routable for calls.'
          : 'Unable to resolve the call recipient for this context.',
      });
    }

    const callId = randomUUID();
    const fromCallerId = await readUserCallerId(callerUserId);
    const toCallerId = await readUserCallerId(toUserId);
    const routeId = selectedRoute?.id ? String(selectedRoute.id) : null;
    const callLink = settings.voipCallBaseUrl
      ? `${settings.voipCallBaseUrl.replace(/\/+$/, '')}/${callId}`
      : `voip://${callId}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportVoipCall"
        ("id","routeId","contextType","contextId","fromUserId","toUserId","fromCallerId","toCallerId","status","provider","callLink","metadata","startedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'INITIATED',$9,$10,$11::jsonb,NOW(),NOW(),NOW())`,
      callId,
      routeId,
      data.contextType,
      data.contextId || null,
      callerUserId,
      toUserId,
      fromCallerId,
      toCallerId,
      settings.voipProvider,
      callLink,
      JSON.stringify({
        routeName: selectedRoute?.name || null,
        callerRole,
      })
    );
    return res.status(201).json({
      success: true,
      data: { id: callId, routeId, callLink, provider: settings.voipProvider, toUserId, fromCallerId, toCallerId },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to start call.' });
  }
});

router.post('/voip/calls/:id/end', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    await prisma.$executeRawUnsafe(
      `UPDATE "SupportVoipCall"
       SET "status" = 'ENDED', "endedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(req.params.id || '')
    );
    return res.json({ success: true, message: 'Call ended.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to end call.' });
  }
});

export default router;
