> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Vendor & Subprocessor Management Policy

**Owner:** Security Officer · **Review:** quarterly and before onboarding any new subprocessor · HIPAA §164.308(b), §164.314(a)

## 1. Rule

**No subprocessor may receive, process, store or transmit PHI before a Business Associate Agreement is executed.** A vendor that cannot or will not sign a BAA may only be used on paths that are architecturally incapable of carrying PHI, and that limitation must be enforced in code, not by convention.

## 2. Onboarding process

1. Define the data the vendor will touch and classify it ([data-classification-handling-policy.md](./data-classification-handling-policy.md)).
2. Security review: obtain SOC 2 Type II or equivalent, review encryption, retention, subprocessor list and breach-notification terms.
3. Execute a BAA if PHI is involved; confirm the vendor's zero-retention/no-training terms for AI services.
4. Record the vendor in the register below with owner, data types and BAA status.
5. Implement the integration server-side with the credential held in the platform secret store.
6. Re-review annually, and immediately on breach notice or material change of terms.

## 3. Subprocessor register

| Subprocessor | Service in VirtualisONE | Data received | BAA status | Notes / evidence |
|---|---|---|---|---|
| **Amazon Web Services** | **Bedrock** — all clinical AI inference, model `us.anthropic.claude-3-5-sonnet-20241022-v2:0`; **SES** — transactional email | PHI (clinical context sent for inference); email addresses | **Signed** | AWS BAA covers Bedrock and SES. SigV4-signed calls from `_shared/bedrock.ts`; Bedrock does not retain prompts for model training. Sole AI provider — `_shared/llm.ts` fails closed with 503 if unconfigured |
| **Supabase** | Postgres database, Auth, Edge Functions, Storage, Realtime | PHI (system of record for all clinical data) | **Signed** | AES-256 at rest, TLS in transit, managed backups + PITR; RLS enabled on 45/45 public tables |
| **ElevenLabs** | ALIS voice session — direct **browser↔ElevenLabs WebRTC** audio stream | Potentially PHI (spoken clinical content) | **In progress** | ⚠️ Until executed, the voice feature must not be used with real PHI. The session token is minted server-side by the authenticated `elevenlabs-conversation-token` function, but the audio stream itself does not traverse our servers |
| **Sentry** | Frontend error monitoring | Metadata only — **no PHI** | Not required (no PHI) | PHI-scrubbing `beforeSend` in `src/lib/monitoring.ts` drops request bodies, headers, cookies and query strings and redacts PHI-bearing keys (patient, name, mrn, dob, transcript, note, content, text, message, address, phone, insurance, diagnosis, reason). Complete no-op unless `VITE_SENTRY_DSN` is set — **currently inert** |
| **Lovable** | Application hosting and build platform | No PHI in the PHI path (static SPA hosting); platform operators may have infrastructure access | Review with counsel | The Lovable **AI Gateway** is **not** used for any inference — see §4 |
| **GitHub** | Source control and CI (`.github/workflows/ci.yml`) | Source code only; **no PHI** | Not required | No production data in CI; no deploy job in the workflow |
| **Customer EHRs** (Epic, Cerner, MEDITECH) | SMART-on-FHIR read and writeback | PHI, exchanged with the covered entity that owns it | N/A — counterparty, not subprocessor | Governed by the customer BAA/integration agreement; deny-by-default issuer allowlist |

## 4. Removed from the PHI path — explicit statement for auditors

The following AI providers were previously reachable and have been **removed entirely** from every PHI-handling code path:

- **Cohere** (`command-r-plus`) — removed.
- **Google Gemini** — removed.
- **Anthropic direct API** — removed.
- **Lovable AI Gateway** — removed.

`supabase/functions/_shared/llm.ts` now exposes AWS Bedrock as the **only** provider and throws rather than falling back, so a Bedrock outage produces a 503 instead of silently routing PHI to a vendor without a BAA. Reintroducing any of these providers on a PHI path is an automatic pull-request rejection (see the [SDLC checklist](./secure-sdlc-change-management-policy.md) §3). The published DSI model cards (`src/data/dsiRegistry.ts`, rendered at the AI Governance page) were updated to state the actual vendor and model.

## 5. Ongoing monitoring

Quarterly: confirm BAAs remain in force, review each vendor's published subprocessor changes and any breach notices, and confirm no new vendor has been introduced without review. A subprocessor breach notice is treated as our **date of discovery** under the [breach notification policy](./breach-notification-policy.md).

## 6. Offboarding

On termination: revoke credentials, remove secrets from the platform store, confirm deletion or return of data as required by the BAA, and update this register with the removal date.

## 7. Gaps

- ElevenLabs BAA outstanding (risk R-03).
- Vendor SOC 2 reports are collected but not yet tracked in a formal review calendar with expiry dates.
