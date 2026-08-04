> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# HIPAA Security Rule Risk Analysis

**Owner:** Security Officer + Privacy Officer · **Review:** annually and after significant change · 45 CFR §164.308–312

**Scope of ePHI:** patient demographics, problems, medications, allergies, vitals, laboratory results, imaging metadata and reports, clinical notes, orders and prescriptions, consult threads, and billing/insurance data — stored in Supabase Postgres, processed by Supabase Edge Functions, and transmitted to AWS Bedrock for inference and to customer EHRs over SMART-on-FHIR.

Status key: **Implemented** · **Partial** · **Gap**

## Administrative safeguards — §164.308

| Standard | Requirement | Status | Implementation / evidence |
|---|---|---|---|
| §164.308(a)(1)(i) | Security management process | Partial | This risk analysis + [risk-management-policy.md](./risk-management-policy.md); program is new and not yet independently audited |
| §164.308(a)(1)(ii)(A) | Risk analysis | Implemented | This document; re-performed annually and on material change |
| §164.308(a)(1)(ii)(B) | Risk management | Implemented | Risk register with scored treatments and owners |
| §164.308(a)(1)(ii)(C) | Sanction policy | Implemented | [workforce-security-acceptable-use-policy.md](./workforce-security-acceptable-use-policy.md) §6 |
| §164.308(a)(1)(ii)(D) | Information system activity review | Partial | `audit_logs` captures mutations incl. AI provenance; review is manual and no alerting is live until a Sentry DSN is configured |
| §164.308(a)(2) | Assigned security responsibility | Implemented | Security Officer named in the operational register; owners listed in [README](./README.md) |
| §164.308(a)(3) | Workforce security (authorize/supervise, clearance, termination) | Implemented | Invitation-only account creation (`admin-create-user`); same-day revocation; quarterly access review |
| §164.308(a)(4) | Information access management | Implemented | RLS on 45/45 public tables + `hospital_users` membership + `userHasHospitalAccess()`; see [access-control-policy.md](./access-control-policy.md) |
| §164.308(a)(5) | Security awareness and training | Partial | Policy acknowledgement at onboarding; recurring formal training program not yet established |
| §164.308(a)(5)(ii)(C) | Log-in monitoring | Partial | Supabase Auth records sign-in events; no automated failed-login alerting |
| §164.308(a)(5)(ii)(D) | Password management | Implemented | Supabase Auth password policy + self-service reset; optional TOTP MFA |
| §164.308(a)(6) | Security incident procedures | Implemented | [incident-response-plan.md](./incident-response-plan.md) |
| §164.308(a)(7) | Contingency plan | Partial | [business-continuity-dr-plan.md](./business-continuity-dr-plan.md) with RTO/RPO and restore runbook; **restore not yet exercised end-to-end** |
| §164.308(a)(8) | Evaluation | Partial | Internal code audits performed and remediated; **no external penetration test or SOC 2 audit yet** |
| §164.308(b)(1) | Business associate contracts | Partial | AWS and Supabase BAAs signed; **ElevenLabs BAA in progress**; Sentry receives no PHI by design |

## Physical safeguards — §164.310

| Standard | Status | Implementation / evidence |
|---|---|---|
| §164.310(a) Facility access controls | Implemented (inherited) | All ePHI resides in AWS/Supabase managed data centres; physical security is the subprocessor's control, evidenced by their SOC 2 reports. VirtualisONE operates no server room. |
| §164.310(b)–(c) Workstation use and security | Partial | Acceptable-use policy requires full-disk encryption, screen lock and current OS patches; **no MDM enforcement** |
| §164.310(d) Device and media controls | Implemented | No ePHI is stored on removable media; workstations hold no local ePHI database; disposal is handled by the cloud subprocessor |

## Technical safeguards — §164.312

| Standard | Requirement | Status | Implementation / evidence |
|---|---|---|---|
| §164.312(a)(1) | Access control | Implemented | RLS on all 45 public tables; hospital scoping via `hospital_users`; caller-supplied IDs re-scoped by `_shared/tenancy.ts` |
| §164.312(a)(2)(i) | Unique user identification | Implemented | Supabase Auth `auth.uid()`; no shared accounts |
| §164.312(a)(2)(ii) | Emergency access | Partial | Break-glass is performed by an administrator via the service-role path; a formal documented break-glass procedure with automatic audit review is a gap |
| §164.312(a)(2)(iii) | Automatic logoff | Implemented | Application inactivity guard terminates idle sessions |
| §164.312(a)(2)(iv) | Encryption/decryption at rest | Implemented | AES-256 at rest (Supabase-managed Postgres and storage) |
| §164.312(b) | Audit controls | Implemented | `audit_logs` records clinical and security mutations; AI-initiated actions flagged; `audit-log` function is authenticated with origin-allowlisted CORS |
| §164.312(c) | Integrity | Implemented | Server-side validation with explicit caps (`_shared/validate.ts`); orders/notes follow staged → signed → pushed lifecycle with signature attribution; migrations-as-code |
| §164.312(d) | Person or entity authentication | Implemented | JWT verification in `guard()`; optional TOTP MFA (AAL2) |
| §164.312(e)(1) | Transmission security | Implemented | TLS 1.2+ everywhere; SigV4-signed Bedrock calls; https-only SMART issuers with a deny-by-default allowlist; origin-allowlisted CORS |
| §164.312(e)(2)(ii) | Encryption in transit | Implemented | TLS enforced by Supabase, AWS and the app; non-https SMART endpoints rejected before any navigation or token storage |

## Organizational and documentation requirements

| Standard | Status | Notes |
|---|---|---|
| §164.314(a) BA contracts | Partial | See vendor register; ElevenLabs outstanding |
| §164.316(a) Policies and procedures | Implemented | This `docs/compliance/` set |
| §164.316(b)(2)(i) Six-year retention | Implemented | Policies and audit records retained ≥6 years — see [data-retention.md](./data-retention.md) |

## Honest gap list (consolidated)

1. **ElevenLabs BAA in progress** — the ALIS voice session is a direct browser↔ElevenLabs WebRTC stream; do not use it with PHI until the BAA is executed. (R-03)
2. **Monitoring/alerting not live** — Sentry is wired and PHI-scrubbed but a complete no-op until `VITE_SENTRY_DSN` is set. (R-05)
3. **No external penetration test** and no SOC 2 Type II audit. (R-06)
4. **Clinical accuracy of ALIS is not formally validated**; output is advisory and requires clinician sign-off. (R-07)
5. **DR restore has not been exercised end-to-end**; RTO/RPO are targets, not measured results. (R-10)
6. **MFA is optional**, not enforced for privileged roles. (R-13)
7. **No recurring formal security-awareness training program** yet.
8. **No automated anomalous-access detection** over `audit_logs`; review is manual.
9. **No MDM** enforcing workstation controls.
10. **No formal break-glass emergency-access procedure**.
