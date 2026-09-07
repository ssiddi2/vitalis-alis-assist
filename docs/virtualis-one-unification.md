# VirtualisONE Unification — Nue + Note

Status: **prerequisite hardening only.** No unification code has been written, no
source-project contracts have been read, and no integration is complete.

## Project identifiers

| Role | Project ID |
| --- | --- |
| Canonical platform (this project, VirtualisONE) | `2e29a090-42af-4198-bc03-522b3e857b96` |
| Source — Virtualis Nue | `955dc7d9-0861-4066-bfc1-6a07eaf36df6` |
| Source — Virtualis Note | `eb9d503b-3831-420a-8d8b-d7ea0092bbc2` |

**Not yet examined.** Neither source project has been inspected. Their routes,
data models, edge functions, auth model and message/note contracts are unknown
and must not be assumed. Everything below concerns this project only.

## Target end state (intent, not implemented)

- One authenticated identity (`AuthContext`) and one facility/patient/encounter
  context (`HospitalContext`) shared by every embedded surface.
- Communication/consultation (Nue lineage) and documentation (Note lineage)
  embedded as workspace surfaces inside the existing pages and light design —
  no parallel chart, note, patient or messaging system.
- Authorization enforced server-side (RLS + edge-function hospital scoping);
  the note sign / addendum / cosign review path stays intact and immutable.

## Completed in this pass

### 1. `src/hooks/useTeamChat.ts` — cross-context bleed

A single scope key (`userId::hospitalId`) now governs the whole hook:

- state (channels, active channel, messages, members, error, loading) is reset
  synchronously whenever the signed-in user or selected facility changes;
- every async read captures the scope key at issue time and is discarded if the
  scope moved on (late responses from the previous facility can no longer paint);
- fetched channels are re-filtered client-side to the selected facility;
- `selectChannel` clears the prior conversation first and rejects any channel
  whose `hospital_id` differs from the selection (it also accepts `null` to exit);
- `sendMessage` requires the target to be the current active, in-facility channel;
- `createChannel` rejects a mismatched `hospital_id` and stamps the current one;
- `addMember` requires an in-facility active channel;
- the realtime subscription is keyed to (scope, channel, facility), so switching
  any of them tears the old subscription down and late INSERT payloads from the
  old scope are ignored.

These are defence-in-depth checks on top of RLS, not a replacement for it.

### 2. `src/hooks/useNoteIntegrity.ts` — stale note state

Scope key `noteId::enabled`. Versions and addenda are cleared immediately on any
note or enable change, and results are dropped unless the scope key still matches
when they resolve.

### 3. Tests — `src/test/hooks/context-isolation.test.tsx`

Eleven behavioural tests (not source-string assertions) render the real hooks
against a fake backend where each query resolution is held open, then resolve
responses **after** the context has switched:

- channel list resolving after a facility switch is discarded, the next one is kept;
- facility switch clears conversation, members, channels, errors;
- user switch clears everything;
- realtime channel is removed on facility switch;
- selecting / sending to / creating for a foreign facility is refused with no write;
- created channels are stamped with the current facility;
- note switch clears state immediately, a late note-1 response is dropped, and
  disabling clears state.

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

## Remaining blockers to actual unification

- Both source projects still need to be examined; their auth, facility model,
  message/consult schema and note contracts are unknown.
- The `fhir-writeback` authorization work above is planned but unimplemented.
- No database, credential, publishing or external-service change has been made,
  per the scope of this pass.
