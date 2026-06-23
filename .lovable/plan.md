# Demo Playbook — Winning the Universal EMR Contract

Total time: ~25 min talk + 5 min Q&A. Goal: prove ALIS is not vaporware on interop. Three "show, don't tell" moments: (1) sign a note → it lands externally, (2) push a whole chart → wave of FHIR resources lands, (3) "now imagine that endpoint is Epic" — change one URL.

## Setup (do this 10 min before the call)

1. **Two browser windows, side-by-side.** Left: ALIS at `/dashboard` with a demo patient open. Right: `/emr-sandbox` (the Meridian Health System view), pre-selected to the same patient.
2. **Open the EMR Sync drawer once and close it** so the unseen badge resets to 0.
3. **Clear the sandbox** if it has leftover demo data (optional: a "Reset demo" SQL call).
4. **Have one staged order ready** in the patient's chart so you don't fumble building one live.
5. Confirm the demo clinic is the one with seeded patients (Chen, Santos, Thompson, Williams, Anderson).

## The Pitch Frame (60 seconds, before opening the app)

> "Every EMR vendor says they're interoperable. What they usually mean is: 'we have an API.' What you actually need is: when a clinician finishes a note in our system, that note appears in your Epic chart 200 milliseconds later, with no nightly batch, no CSV, no IT ticket. I'm going to show you that happening, live, in two directions, in the next twenty minutes."

State the three things you'll prove:
1. **Real-time outbound** — clinical actions in ALIS become FHIR R4 resources in an external EMR instantly.
2. **Universal pipe** — same code path serves Epic, Cerner, Athena, Meditech, or a custom on-prem FHIR server. Configurable per hospital.
3. **Auditable** — every payload is logged and replayable, not a black box.

## Beat-by-Beat Script (~20 min)

### Beat 1 — The chart (2 min)
Open patient. Walk through problems, meds, vitals briefly. Don't dwell.
> "Standard EMR chart. Nothing special here yet — the interop story starts the moment a clinician *does something*."

### Beat 2 — Sign a note → watch it land (4 min)
1. Open the progress note modal. Either dictate two sentences or use the pre-populated template.
2. Click **Sign**.
3. Toast fires: *"Sent to EMR Sandbox · DocumentReference/abc12345"*.
4. **Open the EMR Sync drawer** (bottom-right pill). Expand the new entry.
   > "Here's the exact FHIR R4 DocumentReference we sent. Status 201, resource ID assigned by the receiving system. This is the audit trail your compliance team will ask for."
5. **Flip to the sandbox window.** Refresh tab is already auto-polling.
   > "And here's the receiving EMR. Different system, different UI, no ALIS branding — that's the point. The note is here, with the full SOAP body, timestamped, attributed."

### Beat 3 — Sign an order (3 min)
1. Open staged order, sign it.
2. Same flow: toast → drawer shows MedicationRequest → flip to sandbox, Medications tab.
   > "Medication order. Now picture this as an Epic MAR or a Cerner PowerChart — the resource is identical, only the endpoint changes."

### Beat 4 — The money shot: full chart push (3 min)
1. In the patient header click **"Push to EMR"**.
2. Toast: *"N FHIR resources delivered."*
3. Flip to sandbox. Watch tabs populate: Conditions, Medications, Observations all light up at once.
   > "That's an entire chart synchronized in under a second. Same mechanism for backfilling a referral, a transfer, or an HIE pull request."

### Beat 5 — The "any EMR" reveal (3 min)
Open the edge function file `supabase/functions/fhir-ingest/index.ts` or just talk over a slide.
> "What you're seeing land in 'Meridian' is a FHIR R4 endpoint we host for this demo. To repoint at Epic on FHIR, Cerner Millennium, or Athena, we change two things: the base URL and the OAuth client. The clinical workflow code never changes. That's the universal EMR layer."

Optionally show `EMRConnectionModal` or the hospital config to make this concrete — "per-hospital endpoint, per-hospital auth."

### Beat 6 — Inbound + standards (2 min, talk only)
> "We've shown outbound. Inbound is the same in reverse: SMART-on-FHIR launch hands us a patient context and access token, we pull DocumentReferences, Conditions, MedicationStatements. We also speak HL7 v2 for legacy systems and CDA for referral documents — happy to demo those on a follow-up if it's relevant to your stack."

### Beat 7 — Audit, security, compliance (2 min)
> "Every push is logged in `fhir_resources` with timestamps and user attribution. Every PHI access is logged in `audit_logs`. RLS isolates data per hospital. HIPAA BAA in place via our infrastructure provider. We can deliver SOC 2 Type II artifacts on request."

### Beat 8 — Close (1 min)
> "Three takeaways: real-time, universal, auditable. What we showed today is the same code path that goes to production. The only thing standing between this demo and a pilot in your environment is pointing the endpoint at your sandbox. We can have that wired in 48 hours."

## Likely Questions & Answers

| Question | Answer |
|---|---|
| "Does this work with Epic specifically?" | "Yes — SMART-on-FHIR app, App Orchard registration in progress. The DocumentReference, MedicationRequest, Condition, and Observation resources you just saw are Epic-compatible. Read uses Epic's USCDI endpoints; write uses what Epic permits per resource type." |
| "What about Cerner / Oracle Health?" | "Same FHIR R4 surface. Cerner's sandbox supports DocumentReference and Observation writes today — we've tested it." |
| "What if the receiving EMR is down?" | "We queue and retry with exponential backoff, and the local chart is always the source of truth. Failed pushes show in the sync drawer with the error." |
| "HL7 v2?" | "Supported via an MLLP adapter — typically lab orders, ADT, and result delivery. We can show that on a follow-up." |
| "How long to integrate with our EMR?" | "If you have a FHIR R4 endpoint, 1–2 weeks for the read/write contract plus your security review. SMART app registration timelines depend on the vendor (Epic ~6 weeks, Cerner faster)." |
| "What about PHI in transit / at rest?" | "TLS 1.3 in transit, AES-256 at rest, BAA-covered hosting, RLS per hospital, full audit log." |
| "Can you write to a custom on-prem system?" | "Yes — anything that accepts FHIR R4 over HTTPS works today. For non-FHIR systems we drop in an adapter; HL7 v2 over MLLP is the most common." |

## What NOT to do

- **Don't open Supabase, the database, or any infrastructure UI.** They'll fixate on "you're using Supabase?" instead of the story.
- **Don't show the `EmrSyncDrawer` JSON to a non-technical buyer.** Use it only if the room has a CIO/CMIO/integration architect. For clinical buyers, the sandbox tab alone is the proof.
- **Don't promise specific Epic write resources** beyond DocumentReference, Observation, Flag, Communication — Epic's write surface is narrow and they'll know.
- **Don't demo voice (ElevenLabs) in the same session** unless they ask. It's not reconnected and a failure during this demo would tank the interop story.

## Backup Plan If Something Breaks

- **Sandbox tab not updating?** Refresh it manually. Auto-poll is 3 s.
- **Sign action fails?** Skip to Beat 4 (Push to EMR) — that one call covers all four resource types.
- **No internet to demo endpoint?** Show the EMR Sync drawer JSON only and narrate over it. The payload itself is the proof.

## Leave-Behind (offer at end)

- 1-page PDF: "ALIS Interoperability Architecture" — FHIR R4 resource matrix, Epic/Cerner/Athena status, security posture.
- Link to `/integration-spec` route (technical FHIR docs already in the app, print-optimized).
- Offer a 48-hour proof: "Give us a sandbox endpoint, we'll show your data flowing into your EMR by end of week."
