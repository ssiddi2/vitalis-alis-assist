> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Information Security Policy

**Owner:** Security Officer · **Review:** annually or on material change

## 1. Purpose and scope

This policy establishes how VirtualisONE protects the confidentiality, integrity and availability of electronic protected health information (ePHI) and other sensitive data. It applies to all workforce members (employees, contractors, founders) and to all components of the VirtualisONE system: the React/Vite single-page application, Supabase Postgres, Supabase Edge Functions, and the subprocessors listed in the [vendor register](./vendor-subprocessor-management-policy.md).

## 2. Governance

- The **Security Officer** (HIPAA §164.308(a)(2)) owns this policy, the risk analysis, incident response, and the vendor program.
- The **Privacy Officer** owns minimum-necessary, retention, and patient-rights matters.
- The **Engineering Lead** owns secure SDLC, CI enforcement, and BC/DR execution.
- Material security decisions, accepted risks and policy exceptions are recorded in writing with an owner and a review date.

## 3. Control objectives and how they are met

### 3.1 Least-privilege access
Access is scoped to the hospital a user actually belongs to. Row Level Security is enabled on **all 45 tables in the `public` schema**, and policies resolve access through `hospital_users` membership. Server-side code additionally calls `userHasHospitalAccess()` (`supabase/functions/_shared/auth.ts`) before touching data with the service-role client, and re-scopes every caller-supplied record ID through `_shared/tenancy.ts`. See [access-control-policy.md](./access-control-policy.md).

### 3.2 One authoritative security gate
Every AI and cost-bearing Edge Function begins with a single `guard()` call (`_shared/guard.ts`) that performs, in order: origin-allowlisted CORS, JWT authentication, and per-user rate limiting. Centralizing the preamble prevents per-function drift — a class of defect that repeatedly causes real breaches.

### 3.3 Input validation
All externally supplied values are validated server-side by `_shared/validate.ts` (`vtext`, `venum`, `vuuid`, `varray`) with explicit maximum lengths. Failures return generic messages and never echo the submitted value. Client-side `maxLength` attributes mirror the server caps for UX only; the server cap is authoritative.

### 3.4 AI under BAA, fail-closed
All clinical inference runs on **AWS Bedrock** (`us.anthropic.claude-3-5-sonnet-20241022-v2:0`) via SigV4-signed requests (`_shared/bedrock.ts`), covered by the AWS BAA. `_shared/llm.ts` exposes Bedrock as the only provider: if Bedrock is unconfigured or errors, the request **fails closed with 503** rather than falling back. No Cohere, Google Gemini, Anthropic-direct or Lovable AI Gateway path remains in the PHI path.

### 3.5 Encryption
TLS 1.2+ for all data in transit (browser↔app, app↔Supabase, Edge Functions↔AWS/EHR). AES-256 at rest for Postgres and object storage, managed by Supabase. See [encryption-key-management-policy.md](./encryption-key-management-policy.md).

### 3.6 Audit logging
Security-relevant and clinical mutations are recorded in `audit_logs`, including AI-initiated actions which carry an explicit AI provenance flag. See [audit-logging-monitoring-policy.md](./audit-logging-monitoring-policy.md).

### 3.7 Secure change management
Changes reach production only through pull requests that pass the CI gate (`.github/workflows/ci.yml`: typecheck, test, build, dependency audit). Schema changes are migrations-as-code and are reviewed before execution. See [secure-sdlc-change-management-policy.md](./secure-sdlc-change-management-policy.md).

### 3.8 Clinical safety guardrails
Controlled substances (DEA Schedules II–V) are hard-blocked at the transmission layer (`_shared/controlledSubstances.ts`) because EPCS certification has not been obtained. AI output is advisory: orders and notes require clinician review and signature before they are transmitted to an EHR.

## 4. Acceptable use and workforce security
See [workforce-security-acceptable-use-policy.md](./workforce-security-acceptable-use-policy.md). Access is granted on the principle of minimum necessary, reviewed at least quarterly, and revoked on the day of role change or separation.

## 5. Incident management
All suspected security events are reported to the Security Officer immediately and handled under the [incident response plan](./incident-response-plan.md). Confirmed breaches of unsecured PHI follow the [breach notification policy](./breach-notification-policy.md).

## 6. Exceptions
Exceptions require written approval from the Security Officer, a documented compensating control, and an expiry date not exceeding 90 days.

## 7. Enforcement
Violations may result in revocation of access and disciplinary action up to termination, and, for contractors, termination of engagement.

## 8. Known limitations
This program is early-stage. No external penetration test has been conducted, SOC 2 Type II has not been audited, the ElevenLabs BAA is in progress, and Sentry alerting is inert until a DSN is configured. These are tracked in the [risk register](./risk-management-policy.md) and disclosed in the [controls matrix](./soc2-hipaa-controls-matrix.md).
