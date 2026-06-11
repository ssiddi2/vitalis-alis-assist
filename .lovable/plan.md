## Goal
One continuous, click-through demo that exercises every shipped capability and proves the system can both pull from and write back to a real FHIR EHR (Epic when a client ID is configured, SMART Health IT public sandbox otherwise).

## The demo flow (one script, ~8 minutes)

```text
1. Clinician opens ALIS from inside the EHR
   └─ /smart/launch  (Epic if VITE_SMART_CLIENT_ID set, else SMART Health IT)
       └─ PKCE → token exchange → Patient + Conditions + Meds + Allergies + Vitals pulled
       └─ Banner shows "SMART-on-FHIR · <patient name>"

2. Dashboard lands on the EHR-launched patient
   └─ Patient header + Epic-style tabs populated from FHIR bundle (not demo DB)
   └─ ALIS panel auto-greets with real EHR context

3. AI-mediated cardiology consult
   └─ "Consult → Cardiology" → Dr. Das auto-joins, acuity auto-suggested
   └─ Conversation streams; ALIS posts role-specific insights
   └─ "Generate Note" → structured consultation_note saved

4. CPOE: stage orders from ALIS recommendations
   └─ Drug-interaction alerts fire against the FHIR med list
   └─ Sign orders with PIN

5. Documentation: progress note from template, auto-coded for RCM
   └─ Quality measures + workflow telemetry update live

6. Outpatient leg: switch to /clinic
   └─ Pick today's appointment → encounter → SOAP from template → eRx

7. FHIR write-back (the new bit)
   └─ Signed consult note → POST DocumentReference
   └─ Signed orders → POST MedicationRequest / ServiceRequest
   └─ Consult thread summary → POST Communication
   └─ Each write surfaces FHIR resource ID + EHR link in a "Sent to EHR" toast

8. Wrap: open EMR Connection modal → live counts refresh, "Last write: just now"
```

## What gets built

### A. SMART launch hardening
- Runtime EHR detection: if `VITE_SMART_CLIENT_ID` is set, launch routes prefer Epic; otherwise auto-redirect bare visits to SMART Health IT App Launcher with our redirect pre-filled, so the demo works with zero config.
- Expand SMART scopes to include `user/*.write` and the specific write resources we need.
- Add a `/demo` landing page with one button: **"Launch demo from SMART Health IT"** — kicks off the App Launcher with a pre-selected demo patient. Removes the "find the launcher" friction during a live call.

### B. EHR-aware patient view
- New `useSmartPatient()` hook: when a SMART session exists, the dashboard, header, vitals, problems, meds, allergies panels read from `smart.bundle` instead of Supabase.
- Visual `EHR` chip on each panel header when the data source is FHIR vs. local DB.

### C. FHIR write-back service
- New edge function `fhir-writeback` (one function, three actions):
  - `write_document_reference` — consult notes & progress notes
  - `write_medication_request` — signed med orders
  - `write_communication` — consult thread summaries
- Uses the SMART session's access_token forwarded from the client; gracefully degrades to "would write" preview when sandbox refuses the scope.
- Every write logs to `audit_logs` and returns the EHR resource ID.

### D. Order/note signing hooks
- After PIN sign in `OrderSignatureModal` and `NoteEditorModal`, if a SMART session is active, fire the matching `fhir-writeback` action and show toast: *"Sent to EHR · DocumentReference/12345"*.

### E. Consult flow finish line
- After `generate_note` in `consultation-ai`, automatically queue a `Communication` write-back so the specialist exchange lands in the EHR.

### F. Demo Mode toggle
- New `DemoControlPanel` (admin-only, top-right `Cmd+K → Demo`):
  - Buttons: *Launch SMART*, *Seed inpatient scenario*, *Seed outpatient scenario*, *Reset*.
  - Visible only with `?demo=1` or admin role, so it doesn't pollute the real UI.

### G. Telemetry surface
- New `/demo/dashboard` route that mirrors the existing workflow_metrics in a single big-screen layout — useful to leave open on a second monitor during the pitch.

## Technical notes

- Epic write scopes (`user/DocumentReference.write`, `user/MedicationRequest.write`, `user/Communication.write`) must be added to the app registration; if Epic refuses any, fhir-writeback returns `{ status: "skipped", reason }` and the toast says *"EHR refused write scope — note saved locally"* so the demo never breaks.
- SMART Health IT sandbox accepts writes on most resources without extra registration — that's our fallback path.
- All EHR calls go server-side through edge functions so the access token is never logged in browser network tab.
- Zero schema changes required; `audit_logs`, `consultation_notes`, `staged_orders`, `clinical_notes` already cover persistence.
- No new dependencies. Roughly 1 new edge function + ~4 new small frontend files + edits to 5 existing files.

## Out of scope for this pass
- Per-user OAuth for clinicians signing in *to* the EHR from outside (standalone launch). EHR launch only.
- Bidirectional sync (we push on sign, we pull on launch — no continuous polling).
- Production-grade PHI handling beyond what's already in place.
