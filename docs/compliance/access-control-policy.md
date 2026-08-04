> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Access Control Policy

**Owner:** Security Officer · **Review:** annually · HIPAA §164.308(a)(4), §164.312(a)(1), §164.312(d)

## 1. Identity and authentication

- Authentication is provided by Supabase Auth (JWT bearer sessions). There is **no anonymous sign-up**: accounts are created by an administrator through the `admin-create-user` Edge Function (invitation-only onboarding).
- **MFA (TOTP)** is available to all users: enrollment via `src/hooks/useMfa.ts` and `src/components/virtualis/TwoFactorSetup.tsx`; users who hold a factor are challenged at login and elevated from AAL1 to AAL2 (`src/pages/Auth.tsx`). Rollout is currently **optional** — enrolled users are challenged, unenrolled users are not blocked. Mandatory MFA for privileged roles is a tracked gap.
- Self-service password reset is available via the Supabase email flow.
- Idle sessions are terminated by the application inactivity guard.

## 2. Tenancy model — hospital scoping

VirtualisONE is multi-tenant by hospital. The authoritative membership record is **`public.hospital_users`** (`user_id`, `hospital_id`).

Three independent layers enforce it:

1. **Row Level Security.** RLS is enabled on **all 45 tables in the `public` schema** (verified: `select count(*) filter (where rowsecurity) from pg_tables where schemaname='public'` returns 45 of 45). Policies resolve the caller's accessible hospitals through `hospital_users`, so a direct PostgREST query from the browser cannot read another hospital's rows.
2. **Explicit server-side membership check.** Edge Functions that use the service-role client (which **bypasses RLS**) must call `userHasHospitalAccess(db, userId, hospitalId)` from `supabase/functions/_shared/auth.ts` before reading or writing.
3. **Record-level tenancy re-scoping.** See §3.

## 3. The cross-tenant scoping rule (mandatory)

> **Every caller-supplied record identifier — `patient_id`, `note_id`, `order_id`, `prescription_id`, `thread_id`, `hospital_id` — must be verified to belong to the caller's hospital before the service-role client touches it. Membership in a hospital is not authorization for an arbitrary record ID.**

Implementation: `supabase/functions/_shared/tenancy.ts` provides the two canonical helpers:

- `patientInHospital(db, patientId, hospitalId)` — confirms the patient row exists in that hospital.
- `ownedByHospital(db, table, id, hospitalId)` — confirms an arbitrary record joins to the hospital.

Enforcement points:

| Function | Caller-supplied ID | Scoping |
|---|---|---|
| `consultation-ai` (`create_thread`) | `patientId` | `patientInHospital()` before any clinical context is loaded; other actions derive the patient from the thread row and re-check hospital access |
| `alis-chat` | `patientContext.patient.id`, tool arg `patient_id` | verified before **any** tool executes; `create_team_channel` re-verifies the model-supplied patient ID |
| `billing-coder` | `patient_id` / encounter | `patientInHospital()` |
| `order-transmit` | `prescription_id`, `staged_order_id` | `ownedByHospital()` **and** the hospital scope is repeated on the UPDATE statement itself, closing the check/mutate (TOCTOU) window |
| `fhir-sync` / `fhir-writeback` | FHIR base URL | `guard()` plus deny-by-default issuer allowlist |

Reviewers must reject any pull request that passes a caller-supplied ID to the service-role client without a tenancy check.

## 4. Role model

| Role | Granted | Capability |
|---|---|---|
| Clinician | Admin invitation | Read/write clinical data for their hospitals; sign orders and notes; use ALIS |
| Administrator | Existing administrator | The above plus user invitation, role assignment, facility configuration |
| `service_role` | Platform-only | Full DB access; never exposed to a browser; used exclusively inside Edge Functions |
| `anon` / `authenticated` | Platform | PostgREST roles; constrained by explicit GRANTs plus RLS |

Roles are stored in a dedicated roles table and evaluated by a `SECURITY DEFINER` function — never on the profile/user row — to prevent privilege escalation through a self-updatable column.

## 5. Least privilege and minimum necessary

- Grants are issued per table to the narrowest role set that the policies actually permit; `anon` grants are withheld wherever every policy scopes to `auth.uid()`.
- **`public.rate_limits` is service-role only** — user-facing grants were revoked so a user cannot reset their own limiter. The limiter also **fails closed** on any database error (`_shared/rateLimit.ts`).
- Application queries select the columns needed for the task; ALIS receives only the clinical context for the patient in scope. See [minimum-necessary-privacy-policy.md](./minimum-necessary-privacy-policy.md).

## 6. Origin control

Edge Function CORS uses an explicit origin allowlist (`_shared/cors.ts`): the published origin, the custom domains, and any origin named in `ALLOWED_ORIGINS`. The shared `*.lovable.app` / `*.lovableproject.com` preview wildcard is **opt-in only** via `ALLOW_LOVABLE_PREVIEW=true` and must remain unset in production.

## 7. Access reviews and revocation

- Membership in `hospital_users` and administrator role assignments are reviewed at least **quarterly** by the Security Officer.
- Access is revoked **same-day** on separation or role change; the Supabase account is deactivated, which terminates login while clinical records are retained per the [retention schedule](./data-retention.md).
- Every grant, change and revocation is recorded in `audit_logs`.

## 8. Gaps

- MFA is optional rather than enforced for privileged roles.
- Access reviews are manual; there is no automated attestation workflow.
