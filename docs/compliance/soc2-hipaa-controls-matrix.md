> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# SOC 2 / HIPAA Controls Matrix

**Owner:** Security Officer · **Review:** quarterly

Auditor-facing mapping of SOC 2 Trust Services Criteria (Security, Availability, Confidentiality) and HIPAA Security Rule safeguards to the controls **actually implemented in this codebase**. Every row names a file or mechanism so the claim can be verified in source.

Status: **Implemented** · **Partial** · **Planned**

## Common Criteria — Control Environment & Governance

| Ref | Criterion | HIPAA | Status | Implementing control / evidence |
|---|---|---|---|---|
| CC1.1–1.5 | Integrity, board oversight, structure, competence, accountability | §164.308(a)(2) | Partial | Named Security/Privacy/Engineering owners in [README](./README.md); [workforce policy](./workforce-security-acceptable-use-policy.md) with sanctions. No board-level oversight structure yet |
| CC2.1–2.3 | Information and communication | §164.316(a) | Implemented | This `docs/compliance/` policy set; published DSI model cards (`src/data/dsiRegistry.ts`) disclose AI vendor and model to users |
| CC3.1–3.4 | Risk assessment | §164.308(a)(1)(ii)(A–B) | Implemented | [risk-management-policy.md](./risk-management-policy.md) scored register; [hipaa-security-risk-analysis.md](./hipaa-security-risk-analysis.md) |
| CC4.1–4.2 | Monitoring of controls | §164.308(a)(8) | **Partial** | Internal code audits performed and remediated; CI gate on every PR. **No external penetration test; no SOC 2 audit yet** |
| CC5.1–5.3 | Control activities | — | Implemented | Centralized `guard()`, `_shared/tenancy.ts`, `_shared/validate.ts` — controls implemented once, reused everywhere |

## Common Criteria — Logical Access (CC6)

| Ref | Criterion | HIPAA | Status | Implementing control / evidence |
|---|---|---|---|---|
| CC6.1 | Logical access security | §164.312(a)(1) | Implemented | RLS enabled on **45 of 45** `public` tables; hospital-scoped policies via `hospital_users`; `userHasHospitalAccess()` in `_shared/auth.ts` |
| CC6.1 | Record-level tenancy | §164.308(a)(4) | Implemented | `_shared/tenancy.ts` (`patientInHospital`, `ownedByHospital`) applied in `consultation-ai`, `alis-chat`, `billing-coder`, `order-transmit`; hospital scope repeated on UPDATEs to close TOCTOU |
| CC6.1 | Authentication | §164.312(d) | Implemented | JWT verification in `_shared/guard.ts`; Supabase Auth |
| CC6.1 | MFA | §164.312(d) | **Partial** | TOTP enroll + AAL2 challenge (`src/hooks/useMfa.ts`, `src/pages/Auth.tsx`); **optional, not enforced for privileged roles** |
| CC6.2 | Registration and authorization of users | §164.308(a)(3) | Implemented | Invitation-only via `admin-create-user`; no anonymous sign-up |
| CC6.3 | Role-based least privilege | §164.308(a)(4) | Implemented | Roles in a dedicated table evaluated by a `SECURITY DEFINER` function (never on the profile row); per-table grants narrowed to policy scope; `public.rate_limits` service-role only |
| CC6.6 | Boundary protection | §164.312(e)(1) | Implemented | Origin-allowlisted CORS (`_shared/cors.ts`); preview wildcard gated behind `ALLOW_LOVABLE_PREVIEW`; deny-by-default FHIR issuer allowlist (`_shared/fhirAllowlist.ts`) |
| CC6.6 | Abuse / cost protection | — | Implemented | Per-user fixed-window limiter, **fails closed** on DB error (`_shared/rateLimit.ts`), applied through `guard()` on all AI endpoints |
| CC6.7 | Transmission and data-movement restriction | §164.312(e)(2)(ii) | Implemented | TLS 1.2+; SigV4-signed Bedrock calls; https-only SMART endpoints; no upstream EHR response body echoed to clients (`fhir-writeback`) |
| CC6.8 | Prevention of unauthorized software / injection | §164.312(c)(1) | Implemented | Server-side validation with explicit caps (`_shared/validate.ts`); URL scheme checks before `window.open` / navigation (`RadiologyReportModal.tsx`, `SmartLaunch.tsx`); no `dangerouslySetInnerHTML` on untrusted content |
| CC6.5 | Termination of access | §164.308(a)(3)(ii)(C) | Implemented | Same-day deactivation and membership removal; see [data-retention.md](./data-retention.md) §3 |

## Common Criteria — Operations, Change, Risk Mitigation (CC7–CC9)

| Ref | Criterion | HIPAA | Status | Implementing control / evidence |
|---|---|---|---|---|
| CC7.1 | Detection of configuration and vulnerability issues | §164.308(a)(1)(ii)(D) | Partial | `npm audit --omit=dev --audit-level=high` on every PR (`.github/workflows/ci.yml`); no SAST or secret scanning |
| CC7.2 | Monitoring for anomalies | §164.312(b) | **Partial** | `audit_logs` captures mutations incl. AI provenance; Sentry PHI-scrubbed (`src/lib/monitoring.ts`) but **inert until `VITE_SENTRY_DSN` is set** — alerting pending activation |
| CC7.3–7.4 | Incident evaluation and response | §164.308(a)(6) | Implemented | [incident-response-plan.md](./incident-response-plan.md) with severity ladder, roles, containment actions |
| CC7.5 | Recovery from incidents | §164.308(a)(7) | Partial | [BC/DR plan](./business-continuity-dr-plan.md) restore runbook; **not yet exercised end-to-end** |
| CC8.1 | Change management | §164.312(c)(1) | Implemented | PR review + CI gate (typecheck/test/build/audit, no deploy job); migrations-as-code in `supabase/migrations/` with mandatory GRANT + RLS + policy in the same migration |
| CC9.1 | Risk mitigation | §164.308(a)(1)(ii)(B) | Implemented | Scored risk register with owners and treatment deadlines |
| CC9.2 | Vendor and business-partner management | §164.308(b), §164.314(a) | **Partial** | [Vendor register](./vendor-subprocessor-management-policy.md): AWS **BAA signed**, Supabase **BAA signed**, Sentry no PHI; **ElevenLabs BAA in progress**. Cohere, Google Gemini and the Lovable AI Gateway **removed from the PHI path** |

## Availability (A1)

| Ref | Criterion | HIPAA | Status | Implementing control / evidence |
|---|---|---|---|---|
| A1.1 | Capacity management | — | Partial | Managed autoscaling by Supabase/AWS; per-user rate limits bound AI cost. No formal capacity planning |
| A1.2 | Backup and recovery infrastructure | §164.308(a)(7)(ii)(A) | Implemented | Supabase automated daily backups + PITR; schema reproducible from migrations in Git |
| A1.2 | Graceful degradation | §164.308(a)(7)(ii)(C) | Implemented | AI path **fails closed with 503** when Bedrock is unavailable — the application remains usable without ALIS; source EHR remains the clinical fallback |
| A1.3 | Recovery testing | §164.308(a)(7)(ii)(D) | **Planned** | Restore runbook documented with RTO/RPO targets; **annual exercise not yet performed** |

## Confidentiality (C1)

| Ref | Criterion | HIPAA | Status | Implementing control / evidence |
|---|---|---|---|---|
| C1.1 | Identification and protection of confidential information | §164.312(a)(2)(iv) | Implemented | [Data classification policy](./data-classification-handling-policy.md); AES-256 at rest; TLS in transit; secrets server-side only via `Deno.env.get()` |
| C1.1 | PHI confined to BAA-covered processors | §164.308(b) | Implemented | **Bedrock-only** inference (`_shared/llm.ts`, `_shared/bedrock.ts`, `us.anthropic.claude-3-5-sonnet-20241022-v2:0`) under the AWS BAA; fail-closed 503; no Cohere / Gemini / Anthropic-direct / Lovable-gateway path remains |
| C1.1 | PHI excluded from logs and telemetry | §164.312(b) | Implemented | Non-identifying telemetry in `alis-chat`; Sentry `beforeSend` drops bodies/headers/cookies/query strings and redacts PHI keys; validation errors never echo input |
| C1.1 | Voice channel | §164.308(b) | **Partial — gap** | ALIS voice is a direct browser↔ElevenLabs WebRTC stream; token minted by the authenticated `elevenlabs-conversation-token` function. **ElevenLabs BAA in progress — must not carry real PHI until executed** |
| C1.2 | Disposal of confidential information | §164.310(d)(2) | Partial | [Retention schedule](./data-retention.md); enforcement is manual, no automated purge job |

## Processing Integrity / clinical safety (supplemental)

| Area | Status | Implementing control / evidence |
|---|---|---|
| Human sign-off on AI output | Implemented | Orders follow staged → signed → pushed-to-EMR; notes require clinician signature; AI drafts are never transmitted unsigned |
| AI provenance | Implemented | `ai_initiated` / `ai_generated` flags on audit entries and records (`alis-chat`, `src/lib/orderLifecycle.ts`) |
| Decision-support transparency | Implemented | DSI model-card registry (`src/data/dsiRegistry.ts`) rendered on the AI Governance page, aligned to ONC §170.315(b)(11) source-attribute expectations |
| Controlled-substance prescribing | Implemented (as a block) | Schedules II–V hard-blocked (`_shared/controlledSubstances.ts`); **EPCS not certified** |
| Honest transmission status | Implemented | Orders show "queued" when no vendor is connected — never a fabricated "sent" |
| **Clinical accuracy validation** | **Planned — gap** | ALIS output is advisory only; **no formal prospective clinical validation study has been performed** |

## Consolidated open items

| Item | Ref | Owner | Status |
|---|---|---|---|
| Execute ElevenLabs BAA (restrict voice to non-PHI until then) | C1.1, CC9.2 | Security Officer | In progress |
| Activate Sentry (`VITE_SENTRY_DSN`) and define alert routing | CC7.2 | Engineering Lead | Pending |
| Commission external penetration test | CC4.1 | Security Officer | Planned |
| Exercise the DR restore runbook and record actual RTO | A1.3 | Engineering Lead | Planned |
| Enforce MFA for privileged roles | CC6.1 | Security Officer | Planned |
| Formal clinical validation of ALIS acuity and note output | Clinical safety | Clinical Lead | Planned |
| Automated anomaly detection over `audit_logs` | CC7.2 | Engineering Lead | Planned |
| Recurring security-awareness training with completion tracking | §164.308(a)(5) | Security Officer | Planned |
| Automated retention/purge job | C1.2 | Privacy Officer | Planned |
| Regression tests for cross-tenant denial and issuer rejection | CC8.1 | Engineering Lead | Planned |
