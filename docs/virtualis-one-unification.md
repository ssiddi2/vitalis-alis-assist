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
