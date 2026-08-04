> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Encryption & Key Management Policy

**Owner:** Engineering Lead · **Review:** annually · HIPAA §164.312(a)(2)(iv), §164.312(e)

## 1. Encryption in transit

| Path | Protection |
|---|---|
| Browser → application | HTTPS (TLS 1.2+), HSTS provided by the hosting platform |
| Browser/Edge Function → Supabase | TLS 1.2+ enforced by Supabase; plaintext connections rejected |
| Edge Function → AWS Bedrock | HTTPS with AWS SigV4 request signing (`_shared/bedrock.ts`, `aws4fetch`) |
| Edge Function → customer EHR (FHIR) | HTTPS only — non-`https:` issuers and endpoints are rejected before any request, navigation or token storage (`_shared/fhirAllowlist.ts`, `src/lib/smart.ts`, `src/pages/SmartLaunch.tsx`) |
| Browser → ElevenLabs | DTLS/SRTP-encrypted WebRTC (direct; does not traverse our servers) |
| Cross-origin API access | Restricted by an explicit origin allowlist (`_shared/cors.ts`) |

Plaintext HTTP is permitted only for `http://localhost` during local development.

## 2. Encryption at rest

| Store | Protection |
|---|---|
| Postgres (all ePHI) | AES-256, managed by Supabase on AWS |
| Object storage (documents/images) | AES-256, managed by Supabase |
| Backups and PITR archives | Encrypted by the platform with the same standard |
| Workstations | Full-disk encryption required by acceptable-use policy (not MDM-enforced — gap) |

Application-layer field encryption is **not** implemented; confidentiality relies on platform at-rest encryption plus RLS-enforced access control. This is a deliberate, documented design decision.

## 3. Key and secret custody

Cryptographic keys for at-rest and in-transit encryption are managed by AWS/Supabase; VirtualisONE does not hold or rotate them directly. Application secrets are held in the platform secret store and read server-side with `Deno.env.get()`:

| Secret | Purpose | Exposure |
|---|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Bedrock inference (and SES) | Server-only |
| Supabase service-role key | Edge Function privileged DB access | Server-only; **never** in browser code; not retrievable through the Cloud UI |
| `SMART_CLIENT_ID` / `SMART_CLIENT_SECRET` | SMART-on-FHIR token exchange | Server-only; the client secret is never sent to a client-supplied endpoint — the `token_endpoint` is re-derived server-side from the allowlisted issuer |
| `ALLOWED_FHIR_ISS` | Issuer allowlist (deny-all when unset) | Server-only |
| `ALLOWED_ORIGINS` / `ALLOW_LOVABLE_PREVIEW` | CORS allowlist | Server-only |
| ElevenLabs API key | Minting voice session tokens | Server-only, via authenticated function |
| Supabase anon/publishable key | Client SDK | Public by design; safe only because RLS is enabled on all 45 public tables |
| `VITE_SENTRY_DSN` | Error monitoring | Public by design; monitoring is a no-op when unset |

Rules: secrets are never committed to Git, never logged, never returned in an API response, and never `VITE_`-prefixed unless intentionally public. Bearer tokens and EHR access tokens are never written to `localStorage`.

## 4. EHR access tokens

Tokens obtained through the SMART-on-FHIR flow are session-scoped, held in `sessionStorage` for the life of the browser session, and expire per the issuing EHR. They are treated as **Restricted** data because they grant access to PHI. The launch flow rejects non-https endpoints specifically to prevent a `javascript:` or plaintext sink from stealing them. See [ehr-integration-security.md](./ehr-integration-security.md).

## 5. Rotation

| Secret | Cadence | Trigger for immediate rotation |
|---|---|---|
| AWS access keys | Every 12 months | Suspected compromise, workforce separation with access |
| Supabase service-role key | Every 12 months | Suspected compromise |
| `SMART_CLIENT_SECRET` | Per EHR partner policy, at least annually | Suspected compromise, partner request |
| ElevenLabs API key | Every 12 months | Suspected compromise |
| User passwords | No forced expiry (NIST 800-63B) | Suspected compromise |

Rotation procedure: create the new credential → set it in the platform secret store → redeploy the affected Edge Functions → verify with a smoke test → revoke the old credential → record the rotation.

## 6. Gaps

- No application-layer field-level encryption for the most sensitive columns.
- Workstation encryption is policy-required but not centrally enforced.
- No automated secret-scanning in CI.
