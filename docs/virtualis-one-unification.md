# VirtualisONE Unification — Nue + Note

Status: **prerequisite hardening only.** No unification code has been written, no
source-project contracts have been read, and no integration is complete.

## Project identifiers

| Role | Project ID |
| --- | --- |
| Canonical platform (this project, VirtualisONE) | `2e29a090-42af-4198-bc03-522b3e857b96` |
| Source — Virtualis Nue | `955dc7d9-0861-4066-bfc1-6a07eaf36df6` |
| Source — Virtualis Note | `eb9d503b-3831-420a-8d8b-d7ea0092bbc2` |

### Source inspection status — initial, user-supplied

These are **initial inspected contracts reported from the reviewer's own
inspection**, not a completed schema/RLS audit by this agent. No source project
has been modified, and nothing here should be treated as a verified data model.

**Virtualis Nue (`955dc7d9-...`)**
- Tables observed: `threads`, `messages`, `thread_reads`, `provider_credentials`.
- Tenancy column is `facility_id` (this project uses `hospital_id` — a naming
  and possibly semantic mismatch that must be reconciled, not aliased blindly).
- `src/lib/mcp/index.ts` exposes only `getSecurityStatus`; there is **no
  clinical API surface** there, so it cannot be used as an integration seam for
  patient/encounter data.

**Virtualis Note (`eb9d503b-...`)**
- Facilities are provider-owned, and the selector supports an **"all"**
  selection — i.e. a non-single-facility context, which this project's
  `HospitalContext` (exactly one `selectedHospital`) does not model.
- Has its own `clinical_notes` with a **separate review / completeness /
  override signing workflow**, distinct from this project's
  sign → version snapshot → addendum → cosign integrity chain.

Unknown and not to be invented: RLS policies, roles, auth providers, edge
functions, realtime usage, patient/encounter identifiers, and how (or whether)
either project's identities map to this project's `hospital_users`.

## Target end state (intent, not implemented)

- One authenticated identity (`AuthContext`) and one facility/patient/encounter
  context (`HospitalContext`) shared by every embedded surface.
- Communication/consultation (Nue lineage) and documentation (Note lineage)
  embedded as workspace surfaces inside the existing pages and light design —
  no parallel chart, note, patient or messaging system.
- Authorization enforced server-side (RLS + edge-function hospital scoping);
  the note sign / addendum / cosign review path stays intact and immutable.

## Completed in this pass

Correction to the previous revision of this document: comparing *scope strings*
was insufficient (an A -> B -> A switch produces the same string again, so a
response issued during the first A was wrongly accepted), and clearing state in
a `useEffect` is **not synchronous** — the transition render still exposed the
previous context. Both are now fixed.

### 1. `src/hooks/useTeamChat.ts` — cross-context bleed

- **Monotonically increasing generations.** A context generation increments
  during render on every user/facility change; a selection generation
  increments on every `selectChannel`. Generations never repeat, so
  A -> B -> A cannot revive a superseded response.
- **No previous-context exposure during transition.** The returned value is
  computed at render time by generation comparison, so the render that follows
  a switch already reports empty channels/conversation/error. The effect that
  resets the store runs afterwards and cannot paint stale data.
- **Unmount invalidation.** An `aliveRef` invalidates every in-flight callback
  after unmount; state writes are additionally generation-guarded inside the
  updater.
- Reads (`fetchChannels`, conversation messages + members) capture context and
  selection generations at issue time and are discarded otherwise; channels are
  re-filtered client-side to the selected facility.
- Conversation loading is bound to the selection generation, not just the
  facility — a same-facility channel A -> B switch discards A's late response.
- **Mutations are re-validated at invocation**, so a retained callback from a
  superseded context performs no write and returns `null`:
  `createChannel` (generation + user + facility, rejects mismatched
  `hospital_id`, stamps the current one, and its insert result cannot steer a
  switched context), `sendMessage` (must target the current active in-facility
  channel), `addMember` (requires `channelId === activeChannel.id`, the current
  user and the current generations).
- Realtime is keyed to (context generation, selection generation, channel,
  facility): the old subscription is removed on any change, and a retained
  callback from a previous selection is rejected at invocation.

These are defence-in-depth checks on top of RLS, not a replacement for it.

### 2. `src/hooks/useNoteIntegrity.ts` — stale note state

Same generation model: a generation increments during render on any note/enable
change, the returned versions/addenda/loading are generation-filtered at render
time (nothing from the previous note is visible on the transition render), reads
are dropped unless their generation is still current, and unmount invalidates
in-flight work. An A -> B -> A note switch discards the first A's response.

### 3. Tests — `src/test/hooks/context-isolation.test.tsx`

Twenty behavioural tests (not source-string assertions) render the real hooks
against a fake backend where every query and (optionally) every insert is held
open, then resolved **after** the context switched. They assert returned state
and recorded writes:

- channel list resolving after a facility switch is discarded; the next is kept;
- **same-facility channel A -> B**: A's delayed messages never appear, B's do;
- **A -> B -> A facility round trip**: the first A response is rejected even
  though the facility matches again; only the newest generation is accepted;
- **A -> B -> A channel round trip**: the first A conversation response is dropped;
- **retained realtime callback** from the previous channel is ignored while the
  current one still delivers;
- **retained mutation callbacks** (`createChannel`, `sendMessage`, `addMember`)
  from a superseded facility return `null` and record zero writes;
- a `createChannel` whose insert resolves after a facility switch returns `null`
  and does not add the row to the new context's channel list;
- `addMember` refuses a non-active channel and a foreign-facility channel, and
  writes only for the active channel;
- facility switch and user switch clear channels/conversation/members/error;
- realtime channel removed on facility switch;
- foreign-facility select/send/create refused with no write;
- created channels stamped with the current facility;
- note: immediate clear on switch, late response dropped, A -> B -> A dropped,
  **no previous-note data on any render after the switch**, disable clears.

### 4. Verification defect found and fixed

`package.json` declared `typecheck: tsc --noEmit`, but the root `tsconfig.json`
has `"files": []` and only project references — so that command compiled **zero
source files** and always exited 0. Any prior "typecheck clean" claim based on
it (including the previous revision of this document) was meaningless. The
script is now `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p
tsconfig.node.json`, verified to load 254 files under `src/` and to propagate a
real exit code.

## `fhir-writeback` review — findings (endpoint intentionally unchanged)

Files: `supabase/functions/fhir-writeback/index.ts`, `src/lib/ehrWriteback.ts`,
callers `src/components/virtualis/NoteEditorModal.tsx:200`,
`src/hooks/useConsultationThread.ts:142-143`, `src/lib/orderLifecycle.ts:75-76`.
Config: `supabase/config.toml` sets `verify_jwt = false`, so the shared
`guard()` (CORS → `getCaller` → per-user rate limit) is the only auth gate; it
does authenticate and 401 unauthenticated callers.

Findings, in severity order:

1. **No facility ownership check.** The function never receives or validates a
   `hospital_id`, and never calls `userHasHospitalAccess`. Every other PHI edge
   function in this codebase scopes to the caller's facility; this one does not.
2. **No encounter / note ownership check.** `resource` is accepted verbatim.
   Nothing ties the `subject.reference` patient, or the note/order the body was
   built from, to a row the caller may read in this tenant.
3. **Client-supplied destination and credentials.** `iss` and `access_token`
   come from browser storage (`loadSmartSession`). The `isAllowedIss` allowlist
   limits the destination, but the caller still chooses which allowlisted issuer
   receives the payload, and the token is never bound to the caller's session.
4. **Unbounded body.** No size cap or resource-shape validation before the
   upstream POST; only `resourceType` presence is checked.
5. **Fire-and-forget callers.** All four call sites use `void`, so a `skipped`
   result is invisible to the workflow — acceptable today, but it means a future
   authorization denial would be silent.
6. Good as-is: upstream error bodies are never echoed (OperationOutcome PHI),
   the issuer allowlist exists, and rate limiting is applied per user.

### Compatible implementation plan (not yet applied)

Backwards-compatible, response-contract preserving (`written` / `skipped` /
`error` with a `reason`):

1. Extend the request body with required `hospital_id` and optional
   `patient_id`, `encounter_id`, `source_note_id` / `source_order_id`.
   Reject a missing `hospital_id` as `skipped:missing_hospital_context` for one
   release window (log it), then make it hard-required.
2. After `guard()`, call `userHasHospitalAccess(g.admin, g.user.id, hospital_id)`;
   deny with `skipped:not_facility_member`.
3. Resolve the referenced patient/encounter/note through the admin client and
   confirm each row's `hospital_id` matches; deny with
   `skipped:resource_not_in_facility`. Derive `subject.reference` server-side
   from the resolved patient rather than trusting the client value.
4. Cap the JSON body (e.g. 256 KB) and validate `resourceType` against the
   four types the client actually writes.
5. Write an `encounter_events` / audit row per attempt (facility, user,
   resource type, outcome reason) with no clinical content.
6. Update `src/lib/ehrWriteback.ts` to pass the facility and source-record ids;
   update the four call sites, which already have that context in scope.
7. Add tenancy tests mirroring `src/test/tenancy/*` for: missing facility,
   non-member facility, cross-facility patient, oversize body, disallowed
   resource type.

## Deployment observation

The published URL for this project redirects to `https://www.alisai.health/auth`
(browser-confirmed by the reviewer). Any embedded surface must therefore assume
an authenticated entry point on that host.

## Remaining blockers to actual unification

**No integration is complete. Nothing from Nue or Note has been ported.**

- `facility_id` (Nue) vs `hospital_id` (this project): the identifier semantics,
  and whether facility rows correspond one-to-one, are unverified.
- Note's provider-owned facilities with an **"all"** selection have no
  equivalent in `HospitalContext`, which assumes exactly one facility. Either
  the context gains an explicit multi-facility mode with server-side scoping per
  query, or Note's "all" view is not portable as-is. Do not emulate "all" by
  dropping the facility filter.
- Two different note signing models (this project's version/addendum/cosign
  integrity chain vs Note's review/completeness/override workflow) must be
  reconciled; the existing integrity chain must be preserved, not replaced.
- Nue's `src/lib/mcp/index.ts` offers only `getSecurityStatus`, so there is no
  ready clinical API seam; data access will have to go through this project's
  own RLS-scoped tables.
- Neither source project's RLS, roles, auth providers or edge functions have
  been audited; the notes above are an initial inspection only.
- The `fhir-writeback` authorization work above is planned but unimplemented.
- No database, credential, publishing or external-service change has been made,
  per the scope of this pass.

## Facility ⇄ EMR binding: fail-closed (client pass, no DB change)

`HospitalContext` previously treated ANY stored SMART session as proof that the
currently selected facility's EMR was connected, and otherwise fell back to a
synthetic sandbox issuer that rendered as "Connected". Both are unsound in a
multi-tenant deployment: a session launched from facility A would display as a
live connection while working inside facility B.

Checked for a safe existing binding: none exists.

- `public.hospitals` has no issuer/tenant/endpoint column
  (`id, name, code, emr_system, address, logo_url, connection_status, timestamps`).
- `SmartSession` (`src/lib/smart.ts`) records only `iss`, tokens and patient
  context; it carries no facility identifier.
- `VITE_SMART_ISS_ALLOWLIST` and the server's `ALLOWED_FHIR_ISS` are
  deployment-wide allowlists, not per-facility bindings.
- `src/data/emrSandboxes.ts` maps an EMR *flavour* to a synthetic sandbox — that
  is a demo preset, never evidence of a facility connection.

Therefore `facilityIssuerBinding()` returns `null` and the context reports
`status: 'unavailable'` with `reason: 'no_facility_emr_binding'`, or
`'smart_session_not_bound_to_facility'` when a session exists but cannot be
matched. Sandbox is surfaced only when `VITE_EMR_SANDBOX_DEMO=true`, and then
always as `sandbox: true` with a visible sandbox label.

Required to lift the fail-closed state (not implemented here):

1. A per-facility EMR endpoint record — e.g. `hospital_emr_endpoints`
   (`hospital_id`, `iss`, `fhir_base_url`, `environment` production|sandbox,
   `client_id_ref`, `active`, `verified_at`). Its RLS MUST use the full
   workforce-access policy, not `hospital_users` membership alone: read requires
   (a) an explicit, currently-active provisioning row for this user at this
   hospital, (b) a workforce access scope that permits this hospital (onsite
   staff = their single assigned facility; virtual providers = only the
   hospitals they are explicitly provisioned for), and (c) a currently valid,
   unexpired, unrevoked credential/privilege for the acting clinical role at
   that hospital. Missing, ambiguous or expired assignments deny access. Writes
   are administrative and additionally require an admin role at that hospital.
   That policy (provisioning + workforce scope + credential validity) does not
   exist in the database yet.
2. Server-side verification that a SMART token's issuer (and audience/tenant)
   matches the selected facility's active production record before any
   read/write is attributed to that facility.
3. `smart-token` / `fhir-sync` / `fhir-writeback` enforcing the same binding, so
   the client badge reflects a server-verified fact rather than local state.

Unresolved server-side authorization gaps remain: workforce access scope
(virtual multi-facility vs onsite single-facility) is still not modelled in the
database, `hospital_users` membership does not encode current credentialing or
provisioning validity, and `fhir-writeback` still performs no facility or
encounter ownership check. This pass changed client isolation only.


## Facility-list revalidation and revocation latency (honest statement)

`HospitalContext` now attaches a unique request id to every facility-list read
and invalidates outstanding requests on any identity edge, on effect teardown
and on unmount, so a response issued before a sign-out, user switch or
auth-loading window can never restore a revoked facility. A `refresh()` method
is exposed on the context for explicit revalidation; overlapping refreshes are
last-writer-only.

Revocation is NOT live-wired. There is no realtime subscription, no push signal
and no polling on provisioning or credential changes. A revocation currently
takes effect only when one of these occurs:

- the user signs out or the session re-authenticates (auth-loading edge), or
- something calls `refresh()`, or
- the provider remounts (page load / navigation that re-creates the tree).

Until one of those happens, the client may keep showing a facility the server
would now refuse.

Correction to an earlier claim: it is NOT true that "a revoked user's queries
fail". Existing RLS policies key on `hospital_users` membership alone. Removing
a membership row is therefore reflected by RLS on the next query, but
credential-only revocation — an expired, suspended or withdrawn licence,
privilege or telehealth authorization while the membership row remains — is
**not enforced by any current backend policy**. There is no server-side
enforcement of workforce access scope or credential validity today. Closing both
the client-side latency gap and the credential-enforcement gap requires the
workforce-access schema above plus a realtime or short-interval revalidation
channel; neither is implemented.

## Known remaining race (outside this bounded fix)

Within a single facility scope, changing the selected patient does not cancel
in-flight async work started by callers for the previous patient. The context
counters advance only on identity and facility-selection edges, so a caller that
fetched data for patient P1 and resolves after a switch to P2 can still write
P1-derived data into its own component state. Callers must carry their own
patient-scoped guard. Clinical context integrity is therefore NOT complete:
facility/identity isolation is enforced here, same-facility patient-change
races are not.


## Optional external-EHR connector foundation (standalone-first)

virtualisONE is a standalone multi-tenant EMR. External EHR connectivity is
optional and must never gate a native clinical workflow.

### Standalone UI state
`EmrConnection.status` now includes `standalone` (reason
`external_ehr_not_configured`). When no approved facility⇄issuer binding exists
the context resolves to `standalone` synchronously — no artificial "connecting"
spinner, no error tone. `unavailable` is retained only for a facility that HAS a
binding but whose session cannot be proven; `error` and the explicitly labelled
synthetic sandbox (`VITE_EMR_SANDBOX_DEMO=true`) are unchanged.

### Workflow-gate audit (external connectivity only)
Inspected: `src/lib/orderLifecycle.ts`, `src/lib/ehrWriteback.ts`,
`src/components/virtualis/{OrderSignatureModal,StagedOrdersPanel,NoteEditorModal}.tsx`,
`src/hooks/useConsultationThread.ts`, `src/pages/{EMRConnections,SmartLaunch,SmartCallback}.tsx`.
Result: no clinical action (order signing, note signing/addenda, consult,
prescribing) is blocked by the absence of a SMART session — write-back is
best-effort and post-signing. No gate was removed because none existed; auth,
signing, credentialing and readiness prerequisites are untouched. Order status
labels remain local-record vs pushed, which is a factual outcome, not a gate.

### Connector domain module (`src/lib/connectors/`)
- `types.ts` — vendor-neutral typed domain: config (connector id, hospital id,
  profile, environment, enabled, exact approved `baseUrl`/`issuer`, and a server
  secret REFERENCE NAME only), capability declarations that separate
  inbound/outbound, push-subscription vs polling, and per-endpoint
  `unverified`/`verified`, plus `ConnectorHealth`
  (`not_configured|pending|ok|degraded|unknown`) with freshness timestamps.
- `profiles.ts` — extensible templates: Epic, Oracle Health/Cerner, Meditech,
  generic FHIR R4, HL7 v2 interface engine. Templates only: no vendor host,
  path, scope or certified capability is asserted, and every template capability
  is `unverified`. `validateConnectorConfig` rejects non-HTTPS bindings, bad
  secret-reference names and credential-looking values.
- `routing.ts` — pure routing/validation with injected authorization, config,
  mapping, ledger and clock. Client-supplied membership is never accepted. Fail
  closed on: connector not found, tenant mismatch, environment mismatch,
  disabled connector, issuer-binding mismatch, unauthorized tenant, unsupported/
  unverified capability, wrong exchange mode, missing patient/encounter mapping,
  duplicate idempotency key, stale resource version. Idempotency key is scoped
  `hospital::connector::environment::sourceEventId::resourceVersion`;
  checkpoints are per `hospital::connector::environment::resource::externalPatientId`.
  Adapter outcomes are `delivered` / `failed` with `permanent|retryable|unknown`.
- `testing.ts` — in-memory ledger (`durable: false`) and synthetic transport.
  These are test doubles, NOT durable delivery infrastructure.

No route, edge function, migration, credential or network client was added, and
`fhir-writeback` is deliberately unchanged: this pure module does not secure it.
Its missing facility/encounter ownership checks remain open.

### Exchange mode
HL7 FHIR R4 Subscription permits `rest-hook` and describes polling/history as the
alternative (https://hl7.org/fhir/R4/subscription.html). Mode is a per-connector,
per-endpoint declaration driven by the hospital's confirmed capability — never
inferred from a vendor name.

### Honest remaining work
1. Durable inbox/outbox and persisted checkpoints (tables, RLS, grants) — none exist.
2. Authenticated inbound receivers (signature/mTLS verification, replay window, rate limits).
3. Per-hospital connector configuration storage plus an admin surface.
4. Credential/secret provisioning and rotation, server-side only.
5. Capability negotiation from a live CapabilityStatement / site interface spec, with per-endpoint verification evidence.
6. End-to-end runtime: scheduler/worker, retry with backoff, dead-lettering, health/freshness computation.
7. Hardening the `fhir-writeback` server boundary (facility + encounter ownership).

## Connector foundation — correctness corrections (follow-up pass)

### Versioning and ordering
FHIR `versionId` is OPAQUE (https://hl7.org/fhir/R4/http.html — vread/versioning),
so `resourceVersion: number` was wrong. It is now `versionId: string`, compared
only for equality and never ordered numerically or lexicographically. Ordering,
when a source offers it, comes from an explicit optional `SourceSequence`
(`cursor`, optional `previousCursor`, `contiguous`). The ADAPTER owns
contiguity: a non-contiguous event is committed but never advances the cursor,
and a claimed continuation from the wrong cursor fails `cursor_discontinuity`.
The cursor is never set to a "max seen" value, so unseen data cannot be skipped.

### Identity and partitioning
Work identity is a JSON-array tuple of
`hospital, connector, environment, direction, resourceType, resourceId,
operation, versionId`. Stream identity is the same tuple without operation and
version, and is scoped to the resource INSTANCE — two Observations for one
patient are now distinct streams. Immutable source-event dedup
(`hospital, connector, environment, sourceEventId`) is a SEPARATE key. All keys
use `JSON.stringify` of an array, so an id containing `::` cannot collide.

### Read-only routing, transactional commit
`prepareExchangeEvent` is read-only validation and writes nothing. Durable state
moves only through `commitPreparedExchange`, which delegates to a
`TransactionalStore.commit` that must apply the local effect, the inbox dedup
records and the checkpoint atomically. A failed commit leaves the event fully
replayable (proved by test). Outbound dispatch is a separate queue and enqueue
is not delivery. `createSyntheticStore` is in-process memory and explicitly
`durable: false` — it emulates the contract, it is not delivery infrastructure.

### Contract corrections (independently reproduced regressions)
Three further defects were reproduced against the real modules and corrected:
1. Two separately prepared versions of ONE immutable source event could both
   commit, because the store checked only the work key. The transactional commit
   now also rejects an already-seen `sourceEventKey`, and it re-checks the
   expected cursor inside the commit rather than trusting the prepared plan.
2. `deliverThroughAdapter` trusted the plan and would deliver against a CHANGED
   endpoint, disabled/invalid config, a mismatched partition or a capability that
   is no longer verified. Delivery now revalidates the event and plan against the
   CURRENT config (`delivery_binding_mismatch`, `delivery_capability_unverified`)
   before the transport is invoked, and `supports()` is checked against the
   currently verified capability, not the snapshot.
3. `Checkpoint.lastSourceEventId` stored the work tuple. The plan now carries
   `sourceEventId` (and an approved `endpoint` snapshot), and the checkpoint
   records the real source identifier.
The plan is now a defensive copy of the partition, capability and sequence, so a
caller mutating its input cannot retroactively change a validated plan.

TRUST LIMITS UNCHANGED: the cursor's contiguity claim is still ADAPTER-asserted
and unverifiable by this module; opaque versions are never ordered; there is no
durable store, no authenticated receiver, no scheduler, no credential handling
and no real side effects or server authorization here. These are contract fixes
only, not a runtime.

### Config, binding and capability
Config lookup is keyed by hospital + connector + environment, and the RETURNED
config is re-verified against all three (`config_identity_mismatch`). Invalid
config is rejected before any other work. BOTH `baseUrl` and `issuer` must match
the presented endpoint. URL validation now rejects userinfo, query and fragment,
not only non-HTTPS. Profile lookup uses an own-property check. The
secret-reference regex is a developer lint, NOT a browser-safety guarantee — the
guarantee is that credential values never leave the server. Capability matching
includes mode, so one resource may hold both a verified push and a verified
polling capability. Adapters are checked against the config profile and must
report `supports(capability, config)`.

### Delivery outcomes
`delivered` now requires an authoritative `DeliveryReceipt`. A missing receipt, a
throw or an ambiguous timeout is `unknown`: never delivered, and never
auto-resent by this module. A failed or unknown delivery cannot become committed
work.

### New profile templates
`athenahealth` and `eclinicalworks` added as UNVERIFIED templates with public
documentation references only
(https://docs.athenahealth.com/api/fhir-r4/document-reference,
https://www.eclinicalworks.com/products-services/interoperability/). No
connection, endpoint, enabled resource or certification is claimed for either.

### Standalone client write-back (fail closed)
`src/lib/ehrWriteback.ts` previously sent data whenever ANY SMART session existed
in browser storage. It now resolves an authoritative facility/endpoint binding
via `resolveWritebackBinding()`, which returns `null` because no such
authoritative record exists yet; every write returns
`not_configured / no_authoritative_facility_endpoint_binding` with zero function
invocations. This is not a browser-flippable boolean: lifting it requires the
server-verified per-facility endpoint binding described above.
Callers corrected: `NoteEditorModal` no longer audits `pushed_to_ehr` from the
mere presence of a SMART patient id — local signing records `local_record` plus
an explicit `external_delivery: not_configured`; `orderLifecycle` audits
`order.signed_local` and returns `signed`; `useConsultationThread` skips
write-back. The `fhir-writeback` edge function itself is UNCHANGED and still
lacks facility and encounter ownership checks; any future direct caller of that
endpoint still requires that server-side fix. This client change reduces
accidental egress; it does not secure the endpoint.

### Scope of these claims
This is an offline domain foundation with synthetic doubles. No durable store, no
authenticated receiver, no scheduler, no vendor credential and no live traffic
exists. Nothing here should be read as runtime integration readiness.
