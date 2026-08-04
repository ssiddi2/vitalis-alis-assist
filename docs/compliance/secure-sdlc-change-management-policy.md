> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Secure SDLC & Change Management Policy

**Owner:** Engineering Lead · **Review:** annually · SOC 2 CC8.1; HIPAA §164.308(a)(1), §164.312(c)

## 1. Principles

- Every production change is a reviewed commit. No manual edits to production systems outside this process.
- Security controls are **centralized, not per-feature** — `guard()`, `_shared/tenancy.ts`, `_shared/validate.ts`, `_shared/cors.ts` exist so a control cannot drift between functions.
- The default posture of every control is **deny/fail-closed**.

## 2. Change flow

1. Branch from `main`.
2. Implement; add or update tests for security-relevant behaviour.
3. Open a pull request describing the change and its security impact.
4. **CI quality gate** runs automatically (`.github/workflows/ci.yml`, on `pull_request` to `main`): checkout → Node 24 with npm cache → `npm ci` → `npm run typecheck` (`tsc --noEmit`) → `npm test` → `npm run build` → `npm audit --omit=dev --audit-level=high` (non-blocking, reviewed manually). The workflow contains **no deploy job** — deployment is a separate, deliberate action.
5. Peer review against the security checklist (§3). Author self-merge without review is not permitted for changes touching auth, tenancy, RLS, AI providers or EHR integration.
6. Merge to `main`, then deploy.

Emergency fixes may bypass the wait for review to contain an active incident, but require retrospective review within one business day and a recorded justification.

## 3. Mandatory reviewer checklist

- [ ] Does any Edge Function accept a caller-supplied `patient_id`, `note_id`, `order_id`, `prescription_id` or `thread_id` and use it with the **service-role client**? If so, is it scoped with `patientInHospital()` / `ownedByHospital()` from `_shared/tenancy.ts`? Is the hospital scope repeated on UPDATE/DELETE statements (TOCTOU)?
- [ ] Does the function start with `guard()` (CORS → auth → rate limit)? Is the rate-limit bucket and limit appropriate for its cost?
- [ ] Is every external input validated through `_shared/validate.ts` with an explicit cap?
- [ ] Does any code path send PHI to a provider other than **AWS Bedrock**? Any reintroduction of Cohere, Gemini, Anthropic-direct or the Lovable AI Gateway in a PHI path is an automatic rejection.
- [ ] Do error responses and logs avoid PHI? Are upstream EHR response bodies withheld from clients?
- [ ] Does new SQL create a `public` table? If so, it must include `GRANT`s, `ENABLE ROW LEVEL SECURITY`, and policies in the **same** migration.
- [ ] Are new origins added to the CORS allowlist deliberately, and is the preview wildcard still gated behind `ALLOW_LOVABLE_PREVIEW`?
- [ ] Are new AI-driven interventions registered in the DSI model-card registry (`src/data/dsiRegistry.ts`) with the accurate vendor and model?
- [ ] Does any new AI-initiated mutation write an `audit_logs` entry with the AI provenance flag?

## 4. Migrations as code

Schema changes are SQL migrations stored in `supabase/migrations/`, reviewed before execution, and applied forward-only. Rules:

- Every `CREATE TABLE` in `public` is followed in the **same migration** by `GRANT` statements, `ENABLE ROW LEVEL SECURITY`, and policies. A table without grants is unreachable; a table without policies is unprotected.
- Grants are the minimum the policies allow — no `anon` grant where every policy scopes to `auth.uid()`.
- Destructive migrations (drop/rename/backfill) require an explicit rollback or restore plan referencing the [BC/DR runbook](./business-continuity-dr-plan.md) and are executed outside peak clinical hours.
- The migration history in Git is the audit trail of every schema change.

## 5. Dependency and supply-chain management

`npm audit --omit=dev --audit-level=high` runs on every PR. High/critical advisories with a reachable path are remediated within 30 days (critical: 7 days) or documented as accepted risks with a compensating control. Dependencies are pinned by the lockfile; `npm ci` is used in CI so builds are reproducible.

## 6. Environments and secrets

Secrets live only in the platform secret store and are read server-side with `Deno.env.get()`. Secrets are never committed, never logged, and never exposed to the browser. Only values intended to be public may use `VITE_`-prefixed variables. Production must run **without** `ALLOW_LOVABLE_PREVIEW`.

## 7. Testing

Automated: typecheck, unit tests, build, dependency audit — all gating on PR. Manual: the smoke test in the DR runbook is executed after any change to auth, tenancy or integrations.

**Gap:** test coverage is currently thin (a small unit suite); there is no automated integration test asserting cross-tenant denial. Adding a regression test that a cross-hospital record ID is refused is the highest-value coverage improvement and is tracked.

## 8. Gaps

- No branch protection attestation documented in this repo (CI runs, but enforcement of "required checks" must be confirmed in repository settings).
- No SAST/secret-scanning tool in CI beyond dependency audit.
- No external penetration test.
