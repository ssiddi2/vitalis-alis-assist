> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Business Continuity & Disaster Recovery Plan

**Owner:** Engineering Lead · **Review:** annually; restore exercised at least annually · HIPAA §164.308(a)(7)

## 1. Architecture and dependencies

VirtualisONE has no self-managed infrastructure. Continuity therefore depends on:

| Component | Provider | Failure impact |
|---|---|---|
| Postgres (all ePHI) | Supabase (AWS-hosted) | Total — no clinical data access |
| Edge Functions (auth, AI, integrations) | Supabase | AI, consults, ordering and EHR integration unavailable; static app still loads |
| SPA hosting | Lovable | Application unreachable |
| Inference | AWS Bedrock | ALIS unavailable; **fails closed with 503** by design — the app remains usable without AI |
| Transactional email | AWS SES | Invitations and password resets delayed |
| Voice | ElevenLabs | Voice session unavailable; typed ALIS unaffected |

Clinical care continuity: the customer's source EHR remains the system of record. If VirtualisONE is unavailable, clinicians continue in the legacy EHR — this is the primary business-continuity mitigation and should be stated in customer runbooks.

## 2. Objectives

| Scenario | RTO | RPO |
|---|---|---|
| Application/Edge Function failure (bad deploy) | **1 hour** | 0 (no data loss) |
| Database corruption or accidental destructive migration | **4 hours** | **≤ 5 minutes** via point-in-time recovery |
| Full Supabase project loss | **24 hours** | ≤ 24 hours (last daily backup) |
| Bedrock/regional AI outage | N/A — degraded mode | 0 (AI is advisory; app functions without it) |
| ElevenLabs outage | N/A — degraded mode | 0 |

These are **targets**, not measured results — see §6.

## 3. Backups

- Supabase performs automated daily database backups with point-in-time recovery, retained per the project's plan tier.
- Schema is reproducible from `supabase/migrations/` in version control (migrations-as-code).
- Application and Edge Function source is in Git; every deployable state is a commit.
- Secrets are **not** in backups — they are held in the platform secret store and must be re-supplied on rebuild (see §4, step 5).

## 4. Restore runbook

**Trigger:** data loss, corruption, or destructive migration. **Declared by:** Engineering Lead (notify the Security Officer — treat as a potential incident until ruled out).

1. **Stop the bleeding.** Halt further writes: disable the offending deploy by rolling back to the last known-good commit, or unset the credentials of the function causing damage (the AI path fails closed).
2. **Fix the recovery point.** From the incident timeline, identify the last timestamp before corruption. Record it in the incident log before touching anything.
3. **Preserve the current state.** Take a fresh manual backup/snapshot of the damaged database *before* restoring, so forensic analysis remains possible.
4. **Restore.**
   - *Corruption/partial loss:* perform a Supabase point-in-time recovery to the timestamp from step 2.
   - *Full project loss:* create a new Supabase project, then apply `supabase/migrations/` in order to rebuild the schema, then restore data from the most recent backup dump.
5. **Re-supply secrets** (required for a rebuilt project): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `SMART_CLIENT_ID`, `SMART_CLIENT_SECRET`, `ALLOWED_FHIR_ISS`, `ALLOWED_ORIGINS`, ElevenLabs credentials. Leave `ALLOW_LOVABLE_PREVIEW` unset in production.
6. **Verify tenancy and access before reopening.** This is mandatory — a restore can silently drop policies:
   - `select count(*) filter (where rowsecurity) as rls, count(*) as total from pg_tables where schemaname='public';` → must return **45 of 45**.
   - Confirm policies exist on the clinical tables and that `public.rate_limits` has **no** grants to `anon`/`authenticated`.
   - Confirm `hospital_users` rows are present and correct.
7. **Redeploy** Edge Functions and the SPA from the known-good commit.
8. **Smoke test:** sign in → select a facility → open a patient chart (correct hospital only) → attempt a cross-hospital record ID and confirm it is denied → run one ALIS request (expect a normal response, or a clean 503 if Bedrock is intentionally unconfigured) → confirm a row lands in `audit_logs`.
9. **Reopen** to users; announce restoration and state the recovery point so clinicians know what data may need re-entry.
10. **Post-mortem** within 10 business days; feed corrective actions into the risk register.

## 5. Communications

The Incident Commander notifies affected customers at declaration, at a defined interval during recovery, and at restoration — including the recovery point and any data that must be re-entered. If restored data omits records that existed, assess for an integrity/availability incident under the [incident response plan](./incident-response-plan.md).

## 6. Testing and known limitation

The restore runbook must be exercised at least annually in a scratch project, with the elapsed time recorded and compared to the RTO. **This exercise has not yet been performed**, so RTO/RPO are unvalidated targets (risk R-10).
