# 30-Minute "Universal EMR Interoperability" Demo

Goal: prove ALIS can push clinical data into any external EMR. We host a mock universal FHIR R4 endpoint, mirror every signed action there, and give the client two proof surfaces: an in-app "Sent to EMR" panel and a standalone sandbox viewer they can refresh live.

## What the client will see

1. In ALIS: sign a note / add a problem / send an Rx / save vitals.
2. A toast + side panel in ALIS shows the outbound FHIR resource (JSON) + sandbox response + resource ID + a "View in EMR Sandbox" link.
3. Opening that link (separate tab on `/emr-sandbox`) shows a generic-looking external EMR UI with the just-created DocumentReference / Condition / MedicationRequest / Observation visible at the top of the patient's chart.
4. Talking point: "swap the endpoint URL + auth header and this same pipeline lands in Epic, Cerner, Athena, Meditech."

## Build

### 1. FHIR ingest endpoint (edge function `fhir-ingest`)
- POST accepts a FHIR R4 resource or Bundle, validates `resourceType`, stamps `id` + `meta.lastUpdated`, stores in new `fhir_resources` table.
- GET lists resources by `patient_id` + optional `resourceType`, newest first.
- No JWT (demo); validates a shared `X-Demo-Token` header set in code so it looks like real auth in the payload panel.

### 2. New table `fhir_resources`
Columns: `patient_id`, `resource_type`, `resource_id` (FHIR id), `payload` (jsonb), `source` (text, default `'alis'`), `hospital_id`. RLS: authenticated read scoped to hospital; insert via service role from edge function.

### 3. Client helper `src/lib/fhirSync.ts`
Single function `syncToEMR(resource, patientId)` → POSTs to `fhir-ingest`, returns `{ id, payload, response, viewerUrl }`. Pushes the result into a Zustand store `useEmrSyncFeed` (last 20 events).

### 4. Wire 4 write points (minimal edits)
- `SuperbillModal` / note sign in `PatientHeader` → build `DocumentReference` (note text → `content.attachment.data` base64).
- Problem add (existing problem list component) → `Condition`.
- Prescription create → `MedicationRequest`.
- Vitals save → `Observation` (one per vital sign).

Each call is fire-and-forget; failures show a toast but don't block the clinical write.

### 5. In-app proof: `EmrSyncDrawer`
- Floating "EMR Sync" pill bottom-right of `/dashboard`, badge = unseen count.
- Drawer lists the last 20 sync events: resource type, patient, timestamp, expandable JSON payload, response status, "Open in Sandbox" button.

### 6. Sandbox viewer route `/emr-sandbox`
- Standalone page styled to look like a generic third-party EMR (neutral gray chrome, "MERIDIAN HEALTH SYSTEM — FHIR R4 Sandbox" header, no ALIS branding).
- Left: patient picker (queries `fhir_resources` distinct patient_id, joins `patients`).
- Right: tabbed view — Documents / Problems / Medications / Observations — each pulls from `fhir_resources` filtered by `resource_type`. Auto-refresh every 3s.
- Renders FHIR fields directly (DocumentReference description + decoded content, Condition.code.text + onset, MedicationRequest.medicationCodeableConcept + dosage, Observation.code + valueQuantity).

## Files

New:
- `supabase/functions/fhir-ingest/index.ts`
- `supabase/migrations/<ts>_fhir_resources.sql`
- `src/lib/fhirSync.ts`
- `src/lib/fhirBuilders.ts` (resource constructors)
- `src/stores/emrSyncFeed.ts`
- `src/components/virtualis/EmrSyncDrawer.tsx`
- `src/pages/EmrSandbox.tsx`

Edited:
- `src/App.tsx` — add `/emr-sandbox` route, mount `EmrSyncDrawer` on dashboard.
- `src/components/virtualis/PatientHeader.tsx` — call `syncToEMR` on note sign + superbill save.
- Problem add, prescription create, vitals save components — one-line `syncToEMR(...)` call after successful insert.

## Demo script add-on (last 90 seconds)

> "Everything you just saw — note, diagnosis, Rx, vitals — also fired as FHIR R4 to an external endpoint. Here's the payload we sent [open drawer]. Here's the receiving EMR [open `/emr-sandbox` tab, refresh]. To point this at Epic or Cerner, we change one URL and one auth token."

## Out of scope (call out, don't build)

- Real Epic/Cerner OAuth (needs days of sandbox provisioning).
- Inbound FHIR (reading external charts into ALIS).
- HL7 v2 / CDA — mention as available, don't demo.

## Risks

- 30-min window is tight; if anything slips, drop vitals → Observation first, then problems → Condition. DocumentReference + MedicationRequest are the most impressive.
- `/emr-sandbox` should be opened in a 2nd browser window before the call so refresh shows changes live.
