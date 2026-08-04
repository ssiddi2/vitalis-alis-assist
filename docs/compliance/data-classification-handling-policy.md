> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Data Classification & Handling Policy

**Owner:** Privacy Officer · **Review:** annually

## 1. Classification tiers

| Tier | Definition | Examples in VirtualisONE |
|---|---|---|
| **Restricted — PHI** | Individually identifiable health information | Patient demographics, problems, medications, allergies, vitals, lab results, imaging metadata and reports, clinical notes, orders, prescriptions, consult threads, insurance/billing data, ALIS prompts and outputs containing clinical context, EHR access tokens (grant access to PHI) |
| **Confidential** | Non-PHI whose disclosure harms the business or security posture | Service-role key, AWS credentials, `SMART_CLIENT_SECRET`, `audit_logs` content, source code, this compliance set (internal-use), customer contracts |
| **Internal** | Routine internal operational data | Facility configuration, fee schedules, DSI model cards (pre-publication), CI output |
| **Public** | Intended for public disclosure | Marketing pages (`/product`, `/roi-calculator`), the published AI Governance / DSI page, the anon/publishable Supabase key |

## 2. Handling rules by tier

### Restricted — PHI
- **Storage:** only in Supabase Postgres (AES-256 at rest). Never in source code, Git, CI logs, spreadsheets, screenshots, chat tools, or a local database.
- **Access:** hospital-scoped only — RLS on all 45 public tables plus `hospital_users` membership plus `userHasHospitalAccess()`; every caller-supplied record ID re-scoped via `_shared/tenancy.ts`.
- **Transit:** TLS 1.2+ only. Bedrock calls are SigV4-signed over TLS; SMART issuers must be https and explicitly allowlisted.
- **Processing by AI:** AWS Bedrock only, under the AWS BAA. Fail closed if unavailable.
- **Logging:** PHI must never be written to console logs, error messages or telemetry. `alis-chat` logs only non-identifying telemetry (success flag, byte counts). `fhir-writeback` does **not** echo upstream EHR response bodies to clients, because a FHIR `OperationOutcome` can contain PHI.
- **Error telemetry:** Sentry `beforeSend` drops bodies/headers/cookies/query strings and redacts PHI-bearing keys.
- **Client storage:** minimize. Session-scoped only; EHR tokens live in `sessionStorage` for the duration of the SMART session and are not persisted to `localStorage`.
- **Export/print:** only through application features designed for it and attributable in `audit_logs`.
- **Sharing:** only with the covered entity that owns the data, and only the minimum necessary.

### Confidential
- Secrets live exclusively in the platform secret store, read server-side with `Deno.env.get()`. Never `VITE_`-prefixed, never logged, never echoed in an API response. The Supabase service-role key and database password are not retrievable and must never be placed in client code.
- `public.rate_limits` is service-role only; user grants revoked.
- Source code and compliance documents are shared under NDA where external.

### Internal
Standard access controls; no special handling. Do not mix with PHI.

### Public
Reviewed for accuracy before publication — in particular the DSI model cards, which are a regulatory disclosure and must state the real vendor and model (AWS Bedrock — Anthropic Claude 3.5 Sonnet, `us.anthropic.claude-3-5-sonnet-20241022-v2:0`).

## 3. De-identification

Any data used for demos, testing or analytics must be synthetic or de-identified to the §164.514(b) Safe Harbor standard. Production PHI must never be copied into a demo, staging or sandbox environment. The `fhir-sync` connectivity probe deliberately returns only a resource ID and `lastUpdated` — no name, gender or birth date — so a connectivity check cannot surface identifiers.

## 4. Disposal

Electronic PHI is deleted per the [retention schedule](./data-retention.md) and destroyed by the cloud subprocessor's media-sanitization process. No PHI is written to removable media, so no physical destruction procedure is required.

## 5. Labelling

Database tables carrying PHI are identified in the data map maintained by the Privacy Officer. Documents in this directory are Confidential unless marked otherwise.
