> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# VirtualisONE Compliance Program

This directory is the written compliance program for **VirtualisONE** (LiveMed), a multi-hospital EMR intelligence platform embedding the ALIS clinical acuity engine. It is written to be **auditor-usable**: every control assertion names the file or mechanism in this repository that implements it, so a reviewer can verify the claim in code rather than take it on trust.

**Scope:** the VirtualisONE web application (React/Vite SPA), its Supabase Postgres database and Edge Functions, and the third-party services in the PHI path (AWS Bedrock, AWS SES, Supabase). Out of scope: customer-side EHR systems (Epic/Cerner/MEDITECH), which are integration counterparties, not subprocessors.

## How the program is organized

| # | Document | Purpose |
|---|---|---|
| 01 | [information-security-policy.md](./information-security-policy.md) | Top-level policy, governance, and control objectives |
| 02 | [access-control-policy.md](./access-control-policy.md) | Identity, tenancy isolation, least privilege, cross-tenant scoping rule |
| 03 | [risk-management-policy.md](./risk-management-policy.md) | Risk identification, scoring, treatment, register |
| 04 | [hipaa-security-risk-analysis.md](./hipaa-security-risk-analysis.md) | §164.308/.310/.312 safeguard mapping with honest gap list |
| 05 | [incident-response-plan.md](./incident-response-plan.md) | Detection, triage, containment, roles, severity ladder |
| 06 | [breach-notification-policy.md](./breach-notification-policy.md) | §164.400–414 four-factor assessment and notification clocks |
| 07 | [business-continuity-dr-plan.md](./business-continuity-dr-plan.md) | RTO/RPO targets and the concrete restore runbook |
| 08 | [secure-sdlc-change-management-policy.md](./secure-sdlc-change-management-policy.md) | PR review, CI gate, migrations-as-code |
| 09 | [vendor-subprocessor-management-policy.md](./vendor-subprocessor-management-policy.md) | Subprocessor register and BAA status |
| 10 | [data-classification-handling-policy.md](./data-classification-handling-policy.md) | Data tiers and handling rules per tier |
| 11 | [encryption-key-management-policy.md](./encryption-key-management-policy.md) | TLS, at-rest encryption, secret custody, rotation |
| 12 | [audit-logging-monitoring-policy.md](./audit-logging-monitoring-policy.md) | What is logged, AI provenance, retention, review |
| 13 | [workforce-security-acceptable-use-policy.md](./workforce-security-acceptable-use-policy.md) | Onboarding/offboarding, device and use rules |
| 14 | [minimum-necessary-privacy-policy.md](./minimum-necessary-privacy-policy.md) | §164.502(b) minimum necessary in system terms |
| 15 | [data-retention.md](./data-retention.md) | Retention schedule and deletion semantics |
| 16 | [ehr-integration-security.md](./ehr-integration-security.md) | SMART-on-FHIR launch, token custody, writeback controls |
| 17 | [soc2-hipaa-controls-matrix.md](./soc2-hipaa-controls-matrix.md) | The auditor-facing TSC + HIPAA control matrix |

## Control environment at a glance

| Domain | Implemented control | Where |
|---|---|---|
| Tenancy isolation | Row Level Security enabled on **all 45 public tables**; policies scope rows to the caller's hospital via `hospital_users` membership | Postgres RLS; `pg_tables.rowsecurity = true` for 45/45 public tables |
| Server-side authorization | `userHasHospitalAccess(db, userId, hospitalId)` before any service-role read/write; caller-supplied record IDs re-scoped to the hospital | `supabase/functions/_shared/auth.ts`, `_shared/tenancy.ts` (`patientInHospital`, `ownedByHospital`) |
| Uniform security preamble | Single `guard()` gate = CORS → JWT auth → per-user rate limit; used by every AI/cost endpoint | `supabase/functions/_shared/guard.ts` |
| Rate limiting | Per-user fixed-window limiter, **fails closed** on DB error; `public.rate_limits` is service-role only (user grants revoked) | `_shared/rateLimit.ts` |
| Input validation | `vtext` / `venum` / `vuuid` / `varray` with explicit caps; generic errors that never echo raw input | `_shared/validate.ts` |
| AI inference | **AWS Bedrock only**, `us.anthropic.claude-3-5-sonnet-20241022-v2:0`, SigV4-signed; fail-closed 503 when unconfigured | `_shared/bedrock.ts`, `_shared/llm.ts` |
| AI vendor removal | No Cohere, Google Gemini, Anthropic-direct or Lovable AI Gateway path remains in any PHI-handling function | `_shared/llm.ts` (single Bedrock provider) |
| EHR integration | Issuer allowlist **deny-by-default**; PKCE; server-side token exchange with `token_endpoint` re-derived from the issuer | `_shared/fhirAllowlist.ts`, `supabase/functions/smart-token/index.ts` |
| CORS | Explicit origin allowlist; shared-preview wildcard is opt-in via `ALLOW_LOVABLE_PREVIEW` | `_shared/cors.ts` |
| Audit logging | Mutations logged to `audit_logs`; AI-initiated changes flagged (`ai_initiated` / `ai_generated`) | `supabase/functions/audit-log`, `alis-chat`, `src/lib/orderLifecycle.ts` |
| Prescribing safety | Schedules II–V hard-blocked pending EPCS certification | `_shared/controlledSubstances.ts`, `order-transmit` |
| Change management | PR-gated CI: typecheck, test, build, dependency audit | `.github/workflows/ci.yml` |
| Error monitoring | Sentry with PHI-scrubbing `beforeSend`; complete no-op without `VITE_SENTRY_DSN` | `src/lib/monitoring.ts`, `src/main.tsx` |
| Encryption | TLS 1.2+ in transit; AES-256 at rest (Supabase-managed Postgres and storage) | Platform control |
| Authentication | Supabase Auth; optional TOTP MFA (enroll + AAL2 challenge); admin-invite-only onboarding | `src/hooks/useMfa.ts`, `src/pages/Auth.tsx`, `admin-create-user` |

## Known gaps (tracked, not hidden)

- ElevenLabs BAA **in progress** — the ALIS voice session is a direct browser↔ElevenLabs WebRTC connection and must not be used with PHI until the BAA executes.
- Sentry is configured but **inert until `VITE_SENTRY_DSN` is set**; production alerting is therefore pending activation.
- **No external penetration test** has been performed.
- Clinical accuracy of ALIS output is **not formally validated**; all AI output is advisory and requires clinician sign-off.
- Formal SOC 2 Type II audit **not yet commenced**.

## Owners and review cadence

| Document set | Owner | Review cadence |
|---|---|---|
| All policies (01–03, 10–14) | Security Officer | Annually, or on material change |
| HIPAA risk analysis (04) | Security Officer + Privacy Officer | Annually and after any significant system change |
| Incident response / breach (05–06) | Security Officer | Annually + after every Sev1/Sev2 incident (post-mortem feeds back) |
| BC/DR (07) | Engineering Lead | Annually; restore runbook exercised at least annually |
| SDLC (08) | Engineering Lead | Annually |
| Vendors (09) | Security Officer | Quarterly, and before onboarding any new subprocessor |
| Retention (15) | Privacy Officer | Annually |
| EHR integration (16) | Engineering Lead | On each integration change |
| Controls matrix (17) | Security Officer | Quarterly |

Named individuals are assigned in the operational register maintained outside this repository. Roles are role-based, not person-based, so the program survives staffing changes.
