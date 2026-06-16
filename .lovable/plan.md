
# 6-Week Lightweight EMR — Go-Live Plan

**Target customer:** Single primary care clinic, 1–5 providers
**Billing:** Superbill PDF only (export to outside biller)
**eRx:** Print/fax only (no Surescripts)
**Compliance:** HIPAA-ready + SOC 2 Type I

## Reality check

You already have ~70% of this: patients, encounters, vitals, problems, meds, allergies, immunizations, clinical notes, staged orders, prescriptions, scheduling, billing events, audit logs, RLS, AuthContext, ALIS AI, ElevenLabs voice, FHIR sync. The 6-week effort is **finish, harden, and remove** — not build new.

Cut from scope for v1 (re-enabled post-launch): inpatient flows, multi-hospital UI, consult marketplace, voice dictation polish, RCM analytics depth, PACS/DICOM viewer, integration-spec/ROI marketing pages on the authed app.

## Weekly milestones

### Week 1 — Scope lock & clinic-mode shell
- Add a `deployment_mode` flag (`ambulatory`) that hides inpatient/multi-hospital/consult-marketplace routes and nav items.
- Default landing = Schedule (today's appointments) instead of PatientCensus.
- Single-clinic onboarding wizard: clinic name, NPI, tax ID, address, providers, fee schedule upload (CSV).
- Strip Demo/Product/IntegrationSpec/ROI from the authed app shell (keep public marketing routes).

### Week 2 — Front desk + intake
- Patient registration form (demographics, insurance card photo upload, consent signature capture).
- Self-check-in link (tokenized URL, no login) → updates appointment status, captures HPI + ROS via template.
- Appointment statuses: scheduled → checked-in → roomed → with-provider → checkout → completed.
- Eligibility: manual entry only (insurance, member ID, group). No 270/271 yet.

### Week 3 — Visit workflow
- One-click "Start Visit" from schedule → opens encounter with SOAP template prefilled (chief complaint, vitals, problem list, meds, allergies).
- Vitals quick-entry (BP, HR, temp, SpO2, weight, height, BMI auto).
- Problem-oriented note: pick ICD-10 from problem list, append plan per problem.
- Order entry: labs (LOINC picklist), in-house procedures, referrals. All staged → signed.
- Rx: pick from formulary, generate printable Rx PDF + eFax via existing eFax stub (use Phaxio or eFax.com — cheapest = Phaxio).

### Week 4 — Charge capture & superbill
- At sign-and-close: clinician picks E/M code (99202–99215) with AI suggestion based on note content + time.
- ICD-10 → CPT linkage UI (drag/drop).
- Generate Superbill PDF (patient, DOS, provider, dx codes, CPT codes, modifiers, charges from fee schedule) → email/download for outside biller.
- Patient receipt PDF for copay collected at desk.
- Daily charge reconciliation report (CSV export).

### Week 5 — Patient portal (read-only v1) + compliance
- Tokenized patient portal: view upcoming appointments, after-visit summary PDF, immunization record, lab results (provider-released only), secure message inbox (1-way clinician→patient first).
- HIPAA: BAA template page, encryption-at-rest verified, audit-log viewer for admins, break-glass logging, session timeout (already have InactivityGuard), MFA for clinicians (TOTP via Supabase).
- Data export: per-patient CCDA-lite JSON download (right of access).
- Backup/DR runbook doc + tested restore.

### Week 6 — Hardening, pilot, go-live
- Load test with 500 patients / 50 appts/day synthetic data.
- Penetration test (self-run with OWASP ZAP + manual RLS audit; full external test post-launch).
- Clinician training mode (sandbox clinic with reset button).
- In-app help (Intercom-style tooltips on first visit).
- SOC 2 Type I evidence collection (policies, access reviews, change management — use Vanta or Drata trial).
- Pilot with 1 provider for 3 days → fix top 10 issues → expand to full clinic.

## Technical details

### Schema additions (minimal — extend existing tables where possible)
- `clinics` (replaces hospitals UX) — already covered by `hospitals` table, just rename in UI.
- `fee_schedule` (clinic_id, cpt_code, charge_amount).
- `patient_insurance` (patient_id, payer_name, member_id, group_number, card_front_url, card_back_url).
- `superbills` (encounter_id, pdf_url, total_charges, status, generated_at).
- `portal_tokens` (patient_id, token, expires_at, scope).
- `mfa_enrollments` (already supported by Supabase Auth — just enable).

All new tables: GRANT to `authenticated` + `service_role`, RLS scoped by `clinic_id` via existing `has_role`/clinic-membership pattern.

### Edge functions to add
- `generate-superbill` — renders PDF via pdf-lib in Deno.
- `send-fax` — Phaxio API wrapper.
- `portal-token` — issue/verify tokenized patient links.
- `patient-portal-api` — read-only endpoints, token-auth (no JWT).

Existing functions kept as-is: `alis-chat`, `audit-log`, `admin-create-user`, `elevenlabs-conversation-token`. Disable `fhir-sync`/`fhir-writeback`/`smart-token` for v1 (clinic isn't connecting to another EHR).

### Secrets to add later (not in this plan, ask when reached)
- `PHAXIO_API_KEY` + `PHAXIO_API_SECRET` (week 3)
- SMTP for portal/clinician notifications if not already wired (week 5)

### What gets deleted/hidden, not refactored
Inpatient census, consult marketplace, RCM analytics dashboard, ROI calculator, integration spec, product page — keep code, hide behind `deployment_mode === 'inpatient'` flag so post-launch we re-enable for hospital customers.

## Hard truths

- **6 weeks is tight but doable** because you're not building from zero. The risk is scope creep, not engineering.
- **Surescripts in 6 weeks = no.** Vendor onboarding (DoseSpot/RXNT) is 4–8 weeks alone and needs EPCS for controlled substances. Print/fax is your only realistic v1.
- **Superbill PDF is not billing.** You will not collect a dollar through this EMR at go-live. The clinic's outside biller takes the PDF and submits 837P themselves. That's fine for a pilot, not for scale — plan clearinghouse work for weeks 7–14.
- **SOC 2 Type I is achievable in 6 weeks** (point-in-time). Type II requires 3–6 months of observation and cannot be compressed.
- **One pilot clinic, one provider first.** Do not sign 5 clinics for week-6 launch. You need real chart-time feedback before you scale.

## What I need from you to start week 1
1. Confirm we hide (not delete) inpatient/multi-hospital features behind a flag.
2. Pilot clinic name + provider count + EHR they're leaving (if any) — affects data migration scope.
3. Choice of fax vendor: Phaxio (cheap, dev-friendly) vs SR Fax (cheaper, clunky API).
4. Approval for ~$300/mo tooling: Vanta trial, Phaxio, monitoring (Sentry).
