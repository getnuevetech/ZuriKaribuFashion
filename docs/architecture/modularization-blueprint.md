# Modularization Blueprint (Draft)

**Product:** African Fashion Platform  
**Draft status:** v0.2 (execution-ready planning draft)  
**Purpose:** Move from feature-rich monolith to modular platform with safe extraction path and provider swap capability.

---

## 0) Version history

- **v0.1:** Strategy-level recommendation (modular monolith first).
- **v0.2:** Adds:
  1. **Module-by-module API contracts** (internal ports + current endpoint map),
  2. **Initial DB/table ownership map**,
  3. **Sprint plan with acceptance criteria**.

---

## 1) Executive recommendation

Proceed with **Modular Monolith -> Selective Service Extraction**.

Do **not** split everything immediately. Split by objective triggers and risk profile.

### Extraction order
1. **Communications execution plane** (PBX/VoIP + WhatsApp/event connectors)
2. **Async workers** (AI retries, email ingestion, translation jobs, notifications)
3. **Ticketing service** (only when throughput/team isolation requires)

---

## 2) Architectural guardrails (must be enforced)

1. Each module owns its own schema/tables.
2. No direct cross-module table writes.
3. All cross-module writes happen via:
   - domain APIs, or
   - outbox events.
4. Every replaceable module has a provider port + adapter.
5. Module activation/deactivation is runtime-configurable (and auditable).
6. RBAC remains centralized but enforced at every module boundary.

---

## 3) Module catalog and ownership charters

| Module Key | Scope | Initial Owner | Notes |
|---|---|---|---|
| `platform_core` | auth, RBAC, users, MFA policies, activity audit | Platform | system-of-record for identity and permissions |
| `commerce` | catalog, pricing/currency, orders, payments, shipping | Commerce | high write volume, strong consistency needs |
| `ticketing` | support tickets, routing, SLA/escalation, ticket messages | Support | includes support ticket and order-ticket overlay contracts |
| `chat` | live chat sessions/participants/messages and chat actions | Support | stays near ticketing until extraction trigger met |
| `communications` | PBX/VoIP, call logs, WhatsApp session events/routing | Comms | first extraction candidate |
| `help_center` | customer/vendor FAQ/articles/contacts CMS | Content Ops | low-risk module, good candidate for provider swap |
| `automation_ai` | product automation, retry/failure queues, bot orchestration | Automation | async-heavy and bursty |
| `ops` | backup/restore, health diagnostics, runtime checks | Platform Ops | should remain independently operable |

---

## 4) Module switchboard (activation/deactivation and provider swap)

### 4.1 Registry schema (proposed)

```ts
type ModuleRegistryRow = {
  moduleKey:
    | 'platform_core'
    | 'commerce'
    | 'ticketing'
    | 'chat'
    | 'communications'
    | 'help_center'
    | 'automation_ai'
    | 'ops';
  enabled: boolean;
  mode: 'active' | 'degraded' | 'maintenance';
  provider: 'internal' | string; // e.g. twilio, zendesk
  rolloutScope: { type: 'GLOBAL' | 'ROLE' | 'TENANT' | 'PERCENT'; value: string };
  configJson: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string; // ISO
};
```

### 4.2 Evaluation contract

```ts
type ModuleAccessDecision = {
  moduleKey: string;
  allowed: boolean;
  effectiveMode: 'active' | 'degraded' | 'maintenance';
  provider: string;
  reason?: 'DISABLED' | 'MAINTENANCE' | 'ROLLOUT_SCOPE' | 'PROVIDER_UNHEALTHY';
};
```

### 4.3 Runtime behavior
- Sidebar/menu visibility checks `ModuleAccessDecision`.
- API handlers short-circuit with module-aware error if disallowed.
- Worker schedulers start/stop consumers based on module state.
- Health dashboard lists module status + provider health.

---

## 5) API contracts (v0.2)

This section defines stable contracts for modularization.  
Each contract includes:
1) **Internal Port Contract** (future-proof API between modules/services),  
2) **Current HTTP facade map** (existing endpoints in this repository).

## 5.1 Platform Core Contract

### Internal Port Contract

```ts
interface IdentityPort {
  login(input: { email: string; password: string }): Promise<{ token: string; requiresMfa: boolean; challengeId?: string }>;
  startMfaChallenge(input: { challengeId: string; method: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR' }): Promise<{ challengeId: string; expiresAt: string }>;
  verifyMfa(input: { challengeId: string; code: string }): Promise<{ token: string }>;
  getProfile(userId: string): Promise<{ id: string; role: string; permissions: string[] }>;
}

interface AuthenticatorPolicyPort {
  getPolicy(): Promise<{
    enabled: boolean;
    allowEmailOtp: boolean;
    allowTotpAuthenticator: boolean;
    otpLength: number;
    otpExpiryMinutes: number;
    requiredUserRoles: string[];
    requiredAdminRoleIds: string[];
  }>;
  updatePolicy(patch: Record<string, unknown>): Promise<unknown>;
}
```

### Current HTTP facade map
- `POST /api/auth/login`
- `POST /api/auth/mfa/challenge/select`
- `POST /api/auth/mfa/verify`
- `GET /api/auth/mfa/preferences`
- `PATCH /api/auth/mfa/preferences`
- `GET /api/admin/authenticator/settings`
- `PATCH /api/admin/authenticator/settings`

---

## 5.2 Ticketing Contract (support ticketing)

### Internal Port Contract

```ts
interface TicketingPort {
  listTickets(filter: {
    source?: 'ORDER' | 'EMAIL' | 'PHONE' | 'WEB' | 'WHATSAPP' | 'OTHER';
    status?: string;
    search?: string;
  }): Promise<Array<{
    ticketId: string;
    ticketNumber?: string;
    source: string;
    status: string;
    assignedAdminUserId?: string | null;
    assignedGroupId?: string | null;
  }>>;

  createTicket(input: {
    source: string;
    title: string;
    subject?: string;
    requesterUserId?: string | null;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    relatedOrderId?: string;
    body: string;
    sourceLanguage?: string;
  }): Promise<{ ticketId: string; ticketNumber: string }>;

  addMessage(input: {
    ticketRef: string;
    senderUserId: string;
    senderRole: string;
    body: string;
    attachments?: string[];
    sourceLanguage?: string;
    visibleToCustomer?: boolean;
    isInternal?: boolean;
  }): Promise<{ messageId: string }>;

  assign(input: {
    ticketRef: string;
    assignedAdminUserId?: string | null;
    assignedAdminRoleId?: string | null;
    assignedGroupId?: string | null;
  }): Promise<{ ok: true }>;
}
```

### Current HTTP facade map
- `GET /api/customer-service/admin/tickets`
- `POST /api/customer-service/admin/tickets`
- `GET /api/customer-service/admin/tickets/:ticketRef/messages`
- `POST /api/customer-service/admin/tickets/:ticketRef/messages`
- `PATCH /api/customer-service/admin/tickets/:ticketRef/assign`
- `GET /api/customer-service/admin/ticket-routing/groups`
- `POST /api/customer-service/admin/ticket-routing/groups`
- `PATCH /api/customer-service/admin/ticket-routing/groups/:id`
- `GET /api/customer-service/admin/ticket-routing/rules`
- `POST /api/customer-service/admin/ticket-routing/rules`
- `PATCH /api/customer-service/admin/ticket-routing/rules/:id`

---

## 5.3 Order Ticketing Contract (commerce-ticketing bridge)

### Internal Port Contract

```ts
interface OrderTicketingPort {
  getOrderThread(input: { orderId: string; viewerId: string }): Promise<{
    ticket: unknown;
    messages: unknown[];
    permissions: { canPost: boolean; canManageTicket: boolean };
  }>;
  postOrderMessage(input: {
    orderId: string;
    senderUserId: string;
    body: string;
    recipientRoles?: string[];
    sourceLanguage?: string;
    attachments?: string[];
  }): Promise<{ ok: true }>;
  assignOrderTicket(input: {
    ticketId: string;
    assignedToRole?: string;
    assignedToUserId?: string;
    dueAt?: string;
  }): Promise<{ ok: true }>;
  updateOrderTicketStatus(input: {
    orderId: string;
    status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
    actorUserId: string;
  }): Promise<{ ok: true }>;
}
```

### Current HTTP facade map
- `GET /api/orders/:id/ticketing`
- `POST /api/orders/:id/ticketing/messages`
- `PATCH /api/orders/:id/ticketing/status`
- `GET /api/orders/admin/tickets`
- `PATCH /api/orders/admin/tickets/:ticketId/assign`
- `GET /api/orders/admin/ticketing/settings`
- `PUT /api/orders/admin/ticketing/settings`
- `PATCH /api/orders/admin/ticketing/settings`
- `GET /api/orders/admin/ticketing/translation-settings`
- `PATCH /api/orders/admin/ticketing/translation-settings`
- `GET /api/orders/ticketing/language-preference`
- `PUT /api/orders/ticketing/language-preference`

---

## 5.4 Chat Contract

### Internal Port Contract

```ts
interface ChatPort {
  startSession(input: {
    customerUserId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    departmentId?: string;
    issueType?: string;
    preferredLanguage?: string;
  }): Promise<{ sessionId: string }>;

  getSession(input: { sessionId: string; viewerUserId?: string }): Promise<unknown>;

  postMessage(input: {
    sessionId: string;
    senderParticipantId?: string;
    senderRole: string;
    body: string;
    sourceLanguage?: string;
    attachments?: string[];
    isInternal?: boolean;
  }): Promise<{ messageId: string }>;

  applyAdminAction(input: {
    sessionId: string;
    action: 'TRANSFER' | 'ESCALATE' | 'ADD_AGENT' | 'TOGGLE_VISIBILITY';
    targetUserId?: string;
    participantId?: string;
    visibleToCustomer?: boolean;
  }): Promise<{ ok: true }>;
}
```

### Current HTTP facade map
- `POST /api/customer-service/chat/start`
- `GET /api/customer-service/chat/:sessionId`
- `POST /api/customer-service/chat/:sessionId/messages`
- `GET /api/customer-service/admin/chats`
- `PATCH /api/customer-service/admin/chats/:sessionId/actions`

---

## 5.5 Communications Contract (PBX + WhatsApp)

### Internal Port Contract

```ts
interface CommunicationsPort {
  // VoIP
  startCall(input: {
    contextType: 'DIRECT' | 'TICKET' | 'CHAT';
    contextId?: string;
    fromUserId: string;
    toUserId?: string;
    routeId?: string;
  }): Promise<{ callId: string; callLink: string; toUserId: string }>;
  endCall(input: { callId: string; actorUserId: string }): Promise<{ ok: true }>;
  listCalls(filter: { status?: string; contextType?: string; search?: string }): Promise<unknown[]>;

  // WhatsApp
  startWhatsApp(input: {
    mode: 'CHAT' | 'CALL';
    contextType: 'DIRECT' | 'TICKET' | 'CHAT';
    contextId?: string;
    fromUserId: string;
    toUserId?: string;
    routeId?: string;
    message?: string;
  }): Promise<{ eventId: string; eventLink: string; toUserId: string; linkedTicketId?: string }>;
  endWhatsApp(input: { eventId: string; actorUserId: string }): Promise<{ ok: true }>;
  listWhatsAppEvents(filter: { mode?: string; status?: string; search?: string }): Promise<unknown[]>;
}
```

### Current HTTP facade map
- `GET /api/customer-service/admin/voip/settings`
- `PATCH /api/customer-service/admin/voip/settings`
- `GET /api/customer-service/admin/voip/calls`
- `POST /api/customer-service/voip/calls/start`
- `POST /api/customer-service/voip/calls/:id/end`
- `GET /api/customer-service/admin/whatsapp/settings`
- `PATCH /api/customer-service/admin/whatsapp/settings`
- `GET /api/customer-service/admin/whatsapp/events`
- `POST /api/customer-service/whatsapp/start`
- `POST /api/customer-service/whatsapp/events/:id/end`

---

## 5.6 Help Center Contract

### Internal Port Contract

```ts
interface HelpCenterPort {
  getPublicContent(audience: 'CUSTOMER' | 'VENDOR'): Promise<{
    heroTitle: string;
    heroSubtitle: string;
    supportHint: string;
    faqs: unknown[];
    articles: unknown[];
    contacts: unknown[];
  }>;
  getAdminContent(): Promise<{ customer: unknown; vendor: unknown }>;
  patchAdminContent(patch: Record<string, unknown>): Promise<{ customer: unknown; vendor: unknown }>;
}
```

### Current HTTP facade map
- `GET /api/help-center/public/:audience`
- `GET /api/help-center/admin/content`
- `PATCH /api/help-center/admin/content`

---

## 5.7 Ops Contract (backup/restore)

### Internal Port Contract

```ts
interface BackupRestorePort {
  runBackup(input: { scope: string; actorUserId: string }): Promise<{ artifactId: string }>;
  runRestore(input: { artifactId: string; actorUserId: string }): Promise<{ restoreJobId: string }>;
  listArtifacts(filter: Record<string, unknown>): Promise<unknown[]>;
  listRestoreJobs(filter: Record<string, unknown>): Promise<unknown[]>;
}
```

### Current HTTP facade map
- Mounted under `/api/backups` and `/api/admin/backups` (admin backup/restore routes)

---

## 6) Initial DB/table ownership map (v0.2 baseline)

This map is the initial ownership contract.  
It is intentionally not exhaustive for every future table, but it is authoritative for current high-impact domains.

## 6.1 Platform Core owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `User` | platform_core | read by many modules, writes only via Identity/User APIs |
| `AdminProfile` | platform_core | commerce/support can read by ID only |
| `ActivityLog` | platform_core | append-only by all modules through audit API |
| `Notification` | platform_core | write through notification port only |
| `AdminRole` | platform_core | read by support/enterprise |
| `SecuritySetting` | platform_core | only auth/authenticator module writes |
| `UserAuthChallenge` | platform_core | only auth/authenticator module writes |
| `GoogleAuthLink` | platform_core | only auth module writes |
| `PasswordResetToken` | platform_core | only auth module writes |

## 6.2 Commerce owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `ProductCategory`, `MaterialType` | commerce | read-only from other modules |
| `Fabric`, `FabricImage` | commerce | support can read metadata only |
| `Design`, `DesignFabric`, `DesignImage`, `DesignMeasurementVariable` | commerce | support/help-center read-only |
| `ReadyToWear`, `ReadyToWearSize`, `ReadyToWearImage` | commerce | read-only outside commerce |
| `Order`, `DesignOrderItem`, `FabricOrderItem`, `ReadyToWearOrderItem`, `OrderTimeline` | commerce | ticketing uses IDs only |
| `PricingRule`, `Review` | commerce | automation reads pricing/review signals |

## 6.3 Ticketing + Chat owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `SupportDepartment` | ticketing | communications reads route targets only |
| `SupportTicketGroup` | ticketing | read-only from other modules |
| `SupportTicketRoutingRule` | ticketing | communications may read for fallback routing |
| `SupportTicket` | ticketing | communications can link by ticket ID only |
| `SupportTicketMessage` | ticketing | chat may reference but not write directly |
| `SupportCenterSetting` | ticketing | split into module-specific configs in future migration |
| `SupportChatSession` | chat | ticketing can reference by `sessionId` |
| `SupportChatParticipant` | chat | write only via chat actions |
| `SupportChatMessage` | chat | write only via chat API |
| `OrderTicket` | ticketing (commerce bridge) | commerce reads summarized status only |
| `OrderTicketMessage` | ticketing (commerce bridge) | write only via order-ticketing API |
| `OrderTicketMessageTranslation` | ticketing (translation subdomain) | read-only outside ticketing |
| `UserTicketLanguagePreference` | ticketing | auth/profile can read preference only |
| `SupportNumberSequence` | ticketing | can later move to shared numbering module |

## 6.4 Communications owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `SupportVoipCall` | communications | ticketing receives events only |
| `SupportWhatsAppEvent` | communications | ticketing link by foreign key ID only |

## 6.5 Help/Content owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `HelpCenterSetting` | help_center | read by web pages; writes via help_center admin API only |
| `HomepageSectionSetting`, `FooterContent`, `BlogPost`, etc. | content/homepage | independent from support/comms modules |

## 6.6 Ops owned tables

| Table | Ownership | External access rule |
|---|---|---|
| `AdminBackupSetting` | ops | platform_core can read state |
| `BackupArtifact` | ops | append/read via ops APIs |
| `BackupRestoreJob` | ops | append/read via ops APIs |

---

## 7) Integration/event contracts (required for extraction)

Use transactional outbox and idempotent consumers.

### Canonical events (initial set)
- `ticket.created`
- `ticket.message.created`
- `ticket.escalated`
- `chat.session.started`
- `chat.message.created`
- `voip.call.started`
- `voip.call.ended`
- `whatsapp.event.started`
- `whatsapp.event.ended`
- `auth.mfa.challenge.created`
- `auth.mfa.challenge.verified`
- `automation.approval.failed`

### Event envelope

```ts
type DomainEvent<T = Record<string, unknown>> = {
  id: string; // uuid
  eventType: string;
  moduleKey: string;
  aggregateType: string; // ticket, call, chat, user
  aggregateId: string;
  occurredAt: string; // ISO
  actorUserId?: string;
  correlationId?: string;
  payload: T;
  version: 1;
};
```

---

## 8) 90-day sprint plan with acceptance criteria

Assume 2-week sprints (6 sprints total).

## Sprint 1 - Module switchboard foundation

### Scope
- Add module registry schema + admin APIs.
- Add runtime module evaluation middleware.
- Add UI wiring for hide/show based on module state.

### Acceptance criteria
- [ ] `ticketing`, `chat`, `communications`, `help_center` can each be toggled independently.
- [ ] Disabled module returns deterministic API error payload with reason code.
- [ ] Sidebar/footer links hide when module disabled (no dead links).
- [ ] All module config changes are audit-logged.

## Sprint 2 - Provider ports and adapter scaffolding

### Scope
- Create `TicketingPort`, `ChatPort`, `CommunicationsPort`, `HelpCenterPort`.
- Implement internal adapters and routing through port layer.

### Acceptance criteria
- [ ] 100% of PBX/WhatsApp entrypoints call `CommunicationsPort`.
- [ ] 100% of support ticket endpoints call `TicketingPort`.
- [ ] Existing API behavior unchanged (contract parity test green).
- [ ] New provider adapter can be registered without route edits.

## Sprint 3 - Data ownership enforcement

### Scope
- Document table ownership in code.
- Add lint/CI checks to prevent forbidden cross-module writes.
- Add repository package boundaries (`apps/api/src/modules/<module>` layout target).

### Acceptance criteria
- [ ] CI fails on disallowed imports/write access across module boundaries.
- [ ] No direct `prisma.$executeRawUnsafe` cross-domain writes outside owning module.
- [ ] Table ownership matrix committed and referenced in contributing docs.

## Sprint 4 - Async reliability and outbox

### Scope
- Add outbox table + publisher + consumer framework.
- Move email ingestion, translation side effects, AI retries to workers.

### Acceptance criteria
- [ ] Outbox publishes and consumers are idempotent (`event_id` dedupe).
- [ ] Dead-letter queue exists with replay tooling.
- [ ] API p95 latency reduced on chat/ticket endpoints under load test.
- [ ] Worker restart causes no duplicate terminal side effects.

## Sprint 5 - Communications extraction readiness

### Scope
- Stand up communications service skeleton (or separate deployable process).
- Add signed service token auth.
- Enable shadow mode for call/WhatsApp operations.

### Acceptance criteria
- [ ] Shadow mode receives mirrored traffic with >= 99.5% payload parity.
- [ ] Service token auth validated with TTL and key rotation.
- [ ] Rollback switch restores internal adapter within 5 minutes.
- [ ] No regression in call start/end success metrics.

## Sprint 6 - Controlled communications cutover

### Scope
- Shift `communications` provider from `internal` to extracted service for pilot scope.
- Expand rollout by role/tenant after stability gates.

### Acceptance criteria
- [ ] Pilot scope error rate not above baseline +0.5%.
- [ ] P95 call-start latency does not regress >15%.
- [ ] Incident runbook tested (failover to internal provider).
- [ ] Post-cutover audit confirms no unauthorized data access paths.

---

## 9) Operational SLOs and extraction gates

Service/module extraction is approved only when:
- Contract tests are green for 14 consecutive days.
- Module-level dashboard exists (latency, success rate, queue lag).
- Rollback tested in staging and production simulation.
- On-call runbook + ownership rotation defined.

Initial SLO targets:
- Ticket/Chat API availability: **99.9%**
- Communications start-call endpoint success: **>= 99.5%**
- Event delivery from outbox to consumer: **>= 99.9% within 60s**

---

## 10) Security/RBAC requirements in modular world

1. Keep RBAC source-of-truth centralized (`platform_core`).
2. Every module validates claims server-side (never UI-only checks).
3. Service-to-service calls require signed tokens (short TTL, audience-scoped).
4. Super-admin-only fields (`callerId`) remain redacted by default in all APIs.
5. Module settings edits require privileged permissions + audit log.

---

## 11) Risks and mitigation updates (v0.2)

- **Risk:** Split-brain behavior during provider swap.  
  **Mitigation:** shadow mode + parity checker + staged rollout scopes.

- **Risk:** Legacy raw SQL schema drift complicates extraction.  
  **Mitigation:** normalize to module migration ownership and registry.

- **Risk:** Hidden coupling between order-ticketing and support-ticketing.  
  **Mitigation:** explicit bridge contracts and event links only.

- **Risk:** Config toggles misused in production.  
  **Mitigation:** change approvals, audit logs, and "maintenance mode" safe defaults.

---

## 12) Immediate next actions

1. Approve this v0.2 baseline.
2. Create implementation epics aligned to Sprints 1-6.
3. Start Sprint 1 with module registry + runtime gate middleware.
4. Start contract-test harness in parallel (before extraction work).

---

## 13) Decision summary (v0.2)

1. Keep one user-facing platform, modularize internally now.
2. Add module switchboard and provider ports immediately.
3. Make communications the first extraction candidate.
4. Enforce table ownership and outbox patterns before service split.
5. Gate extraction by measurable SLO and rollback readiness.

