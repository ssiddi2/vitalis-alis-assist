> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Audit Logging & Monitoring Policy

**Owner:** Security Officer · **Review:** annually · HIPAA §164.308(a)(1)(ii)(D), §164.312(b)

## 1. Purpose

Maintain records sufficient to reconstruct who did what, to which patient's record, when, and — critically for an AI-assisted EMR — **whether a human or the AI initiated the action**.

## 2. What is logged

| Event class | Recorded | Mechanism |
|---|---|---|
| Clinical data mutations | Actor, action, target record, timestamp, hospital | `audit_logs` table via the application audit hook and `log_audit_event` |
| Order lifecycle | staged → signed → pushed-to-EMR → rejected, with the signing clinician | `src/lib/orderLifecycle.ts`, `staged_orders` status transitions |
| Note signature and EMR push | Signing clinician, destination, outcome | Note editor + `fhir-writeback` |
| **AI-initiated mutations** | Same as above **plus an explicit AI provenance flag** (`ai_initiated` on the audit entry, `ai_generated` on the record) | `supabase/functions/alis-chat/index.ts` tool execution; surfaced in the UI (e.g. `StagedOrdersPanel`) |
| Prescription transmission | Queued/sent state, controlled-substance blocks | `order-transmit` |
| Authentication events | Sign-in, sign-out, MFA enrollment and challenge, password reset | Supabase Auth |
| Administrative changes | User invitation, role assignment, hospital membership changes | `admin-create-user` + `audit_logs` |
| Rate-limit denials | 429 responses per user/bucket | `_shared/rateLimit.ts` / `guard()` |
| Application errors | Stack trace and non-PHI context | Sentry (`src/lib/monitoring.ts`) — **inert without `VITE_SENTRY_DSN`** |
| Platform logs | Edge Function invocations, database logs | Supabase platform logging |

The audit endpoint (`supabase/functions/audit-log`) is authenticated and uses per-request origin-allowlisted CORS — the previous wildcard was removed.

## 3. AI provenance requirement

Every mutation performed by ALIS on a clinician's behalf must be attributable as AI-initiated. This is both a safety control (a reviewer must know whether a human or a model drafted an order) and a regulatory expectation for decision-support transparency. Published model cards (`src/data/dsiRegistry.ts`, rendered on the AI Governance page) disclose the intervention, its inputs, the vendor and the exact model (`us.anthropic.claude-3-5-sonnet-20241022-v2:0` on AWS Bedrock).

## 4. What must never be logged

PHI in console output, error messages, telemetry or CI logs. Enforced by:

- `alis-chat` logs only non-identifying telemetry (success boolean, byte counts) — no prompts, no patient content.
- `fhir-writeback` does **not** return upstream EHR response bodies to the client (a FHIR `OperationOutcome` may contain PHI); only a status and a truncated server-side length is recorded.
- Sentry `beforeSend`/`beforeSendTransaction` drop request bodies, headers, cookies and query strings and redact PHI-bearing keys (patient, name, mrn, dob, transcript, note, content, text, message, address, phone, insurance, diagnosis, reason). `sendDefaultPii` is false.
- Validation errors are generic and never echo the submitted value (`_shared/validate.ts`).

## 5. Integrity and access

`audit_logs` is written through server-side paths; users cannot edit or delete audit entries, and RLS scopes visibility to the caller's hospital. Audit records are Confidential data and access to them is itself restricted.

## 6. Review

| Activity | Cadence | Owner |
|---|---|---|
| Review of administrative changes and role grants | Monthly | Security Officer |
| Review of AI-initiated mutations for anomalous volume/pattern | Monthly | Security Officer + clinical lead |
| Review of rate-limit denials and 401/403 spikes | Monthly | Engineering Lead |
| Targeted review of a patient's access history | On request or on suspicion | Privacy Officer |
| Full access review of `hospital_users` | Quarterly | Security Officer |

## 7. Retention

Audit records are retained **six years** (§164.316(b)(2)(i)) — see [data-retention.md](./data-retention.md).

## 8. Gaps

- **No live alerting.** Sentry is integrated and PHI-safe but a complete no-op until `VITE_SENTRY_DSN` is set; until then detection depends on user reports and manual review (risk R-05).
- **No automated anomaly detection** over `audit_logs` (e.g. a clinician touching an unusual number of charts) (risk R-12).
- Logs are not shipped to an independent, append-only store outside the production account, so a full account compromise could affect log integrity.
