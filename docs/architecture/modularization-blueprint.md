# Modularization Blueprint (Draft)

**Product:** African Fashion Platform  
**Draft status:** v0.1 (planning only; no runtime refactor yet)  
**Goal:** Reduce single-source-of-failure risk while preserving unified product experience

---

## 1) Executive recommendation

Use a **modular monolith now**, then extract selected domains into services when objective triggers are met.

Why this path:
- Keeps delivery speed high while feature set is still expanding rapidly.
- Reduces coupling and outage blast radius through explicit module boundaries.
- Enables controlled replacement of internal modules with third-party providers.
- Avoids premature microservice complexity (service mesh, distributed tracing burden, cross-service transactions too early).

---

## 2) Architectural north star

### Target shape
- **One product surface** (single app UX for users/admins).
- **Multiple internal modules** with strict contracts.
- **Configurable module providers** (internal vs external).
- **Progressive extraction path** for high-load/high-risk domains (PBX, realtime comms, async automation).

### Core principles
1. **Module owns its data and behavior**.
2. **No direct cross-module DB writes**.
3. **Cross-module communication via API contracts + events**.
4. **Every replaceable capability has a provider interface**.
5. **Feature/module toggles are runtime-configurable**.

---

## 3) Proposed module map

## A. Platform Core (foundational)
- Identity/Auth (JWT, MFA policies, session/security challenges)
- User/Org/Role/RBAC
- Configuration registry (global + module settings)
- Audit log + activity events

## B. Commerce Domain
- Catalog (RTW/FTB/CTW products, inventory, media)
- Pricing/Currency (rules, conversions, country enforcement)
- Orders/Fulfillment
- Payments/settlements

## C. Support Domain
- Ticketing (sources: Order/Email/Phone/Web/WhatsApp/Others)
- Live Chat (agent routing, transfer/escalation, attachments, translation overlay)
- Help Center CMS (customer/vendor knowledge pages)

## D. Communications Domain
- PBX/VoIP (extensions, trunks, queues, routing, logs)
- WhatsApp channel integration
- Email ingestion gateway
- SMS/notification adapters (future)

## E. Automation & AI Domain
- Product approval automation
- Price anomaly detection (e.g., Product Price Compare)
- Retry/failure queues (Failed AI Approval)
- Bot orchestration (shopping + service bot)

## F. Platform Ops Domain
- Backup/restore orchestration
- Scheduled jobs and workers
- Health/status + diagnostics

---

## 4) Module extraction priority

Order by operational risk and scaling profile:

1. **Communications (PBX/VoIP + channel connectors)**  
   - Real-time, latency-sensitive, and failure-prone integrations.
2. **Async workers (AI, email ingestion, notifications)**  
   - Move non-request workflows out of API hot path.
3. **Ticketing (if volume/team ownership requires)**  
   - Extract once traffic or organizational boundaries justify.
4. **Help Center CMS**  
   - Keep in monolith longer unless independently operated.

---

## 5) Activation/deactivation model (module switchboard)

Introduce a **module registry** (config-driven):
- `module_key` (e.g., `ticketing`, `pbx`, `whatsapp`, `help_center`)
- `enabled` (true/false)
- `provider` (e.g., `internal`, `twilio`, `zendesk`, `freshdesk`)
- `mode` (`active`, `degraded`, `maintenance`)
- `config_json` (provider-specific settings)
- `rollout_scope` (all tenants, selected tenant/group, percentage)

Behavior:
- UI navigation/menu visibility checks module state.
- API routes enforce module enabled/provider availability.
- Background jobs are started/stopped by module state.
- Health pages show module readiness and degraded status.

---

## 6) Provider interface contracts (anti-lock-in)

Define stable interfaces in code (domain ports), then implement adapters:

### PBX Port (example)
- `startCall(request): CallSession`
- `transferCall(sessionId, target): TransferResult`
- `endCall(sessionId): EndResult`
- `getCallLogs(filter): CallLog[]`
- `provisionExtension(userId): ExtensionInfo`

Adapters:
- `InternalPbxAdapter`
- `ExternalPbxAdapter` (future: Twilio/Asterisk bridge/etc.)

### Ticketing Port (example)
- `createTicket(input): Ticket`
- `reply(ticketId, message): TicketMessage`
- `escalate(ticketId, rule): EscalationResult`
- `listTickets(filter): TicketPage`

Adapters:
- `InternalTicketingAdapter`
- `ExternalTicketingAdapter` (future)

---

## 7) Data ownership and integration rules

### Data boundaries
- Each module owns its tables and migrations.
- Shared identifiers only (e.g., `userId`, `orderId`, `ticketId`) across modules.
- Avoid shared mutable records across domains.

### Integration patterns
- **Synchronous API call** for immediate user-response needs.
- **Asynchronous domain events** for side effects:
  - `TicketCreated`, `CallStarted`, `CallEnded`, `TicketEscalated`, `AiApprovalFailed`, etc.

### Reliability pattern
- Use **transactional outbox** for publishing events.
- Consumers must be idempotent (`event_id` dedupe).

---

## 8) Deployment topology roadmap

## Stage 0 (Now): Hardened Modular Monolith
- Keep current deployment topology.
- Enforce folder/package boundaries by module.
- Introduce module registry + provider interfaces.
- Isolate worker processes from API request process.

## Stage 1: Split workers/processes
- Separate deployments for:
  - API web process
  - Background workers
  - Realtime communications worker(s)
- Independent autoscaling and restart policies.

## Stage 2: Extract Communications Service
- Move PBX/VoIP + channel connectors behind an internal API.
- Keep auth/rbac claims exchange via signed service tokens.
- Keep UI and orchestration in main app, execution in comms service.

## Stage 3: Optional Ticketing extraction
- Extract only if ticket throughput, org ownership, or reliability needs justify.

---

## 9) Security and RBAC model in modular setup

- Keep **RBAC source of truth centralized** (Platform Core).
- Propagate user claims + permissions through signed service tokens.
- Enforce per-module permissions locally (defense in depth).
- Add service-to-service auth (mTLS or signed JWT + short TTL).
- Keep Super Admin-only fields (e.g., callerId visibility) enforced server-side in every module.

---

## 10) Observability and failure isolation

Minimum standards per module:
- Health endpoint + readiness endpoint.
- Structured logs (request_id, module_key, user_id if present).
- Metrics:
  - success rate
  - latency p95/p99
  - queue lag
  - retry/dead-letter counts
- Tracing spans across module boundaries.
- Circuit breakers/timeouts for external providers.

---

## 11) Trigger criteria to extract a module

Extract module when at least 2–3 are true:
- Independent scaling required.
- Deployment cadence differs materially from core app.
- Frequent incidents in module impact unrelated flows.
- Dedicated team ownership emerges.
- Compliance/security isolation required.

---

## 12) 90-day implementation plan (no hard breaks)

### Phase 1 (Weeks 1–3): Foundation
- Add module registry schema and admin controls.
- Introduce provider interface layer for PBX + Ticketing.
- Add module health dashboard and degraded-mode handling.

### Phase 2 (Weeks 4–7): Boundary hardening
- Refactor routes/services into domain modules.
- Add event outbox and idempotent consumers.
- Move heavy async tasks to workers.

### Phase 3 (Weeks 8–12): First extraction
- Extract Communications execution layer (PBX + connectors) behind API.
- Run shadow traffic + parity checks.
- Cut over by module toggle with rollback switch.

---

## 13) Risks and mitigations

- **Risk:** Partial modularization without hard boundaries.  
  **Mitigation:** Enforce dependency rules and ownership in CI checks.

- **Risk:** Toggle complexity causes misconfiguration.  
  **Mitigation:** Safe defaults + config validation + audit trail for config edits.

- **Risk:** Cross-module data inconsistency.  
  **Mitigation:** Outbox + idempotency + replay-safe consumers.

- **Risk:** Observability gaps during extraction.  
  **Mitigation:** Tracing/logging baseline before any service split.

---

## 14) Decision summary

1. Keep one user-facing application experience.  
2. Implement strict internal modular boundaries immediately.  
3. Add provider abstraction and module toggles now.  
4. Extract PBX/communications first when readiness criteria are met.  
5. Defer full microservice breakup until measurable triggers justify it.

---

## 15) Open decisions for next draft

- Multi-tenant strategy for module toggles (global vs tenant-scoped overrides).
- Event bus selection (DB outbox only vs Kafka/SQS/SNS).
- Service auth strategy (JWT service tokens vs mTLS + JWT).
- Data retention/SLA policies per module (ticketing, call logs, chat transcripts).

