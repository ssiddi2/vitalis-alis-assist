

# Integrating VirtualisOne Features into Virtualis

## Gap Analysis: What We Have vs. What's Listed

### Already Implemented (no work needed)
- Auth with role-based access (Physician/Admin/Clinician/Viewer)
- Multi-hospital support with hospital selection/switching
- RLS-secured database + role-based route guards
- Patient census with search
- SOAP Notes (AI-enhanced via ALIS `create_note` tool)
- Progress Notes (NoteEditorModal, ProgressNoteModal)
- ALIS AI chat with patient context (ALISPanel + alis-chat edge function)
- AI order recommendations (ALIS `stage_order` tool)
- Medical coding assistant (ALIS `suggest_billing_codes` tool)
- Billing panel with CPT/ICD-10 codes
- Charge review panel with status tracking
- Lab ordering via staged orders
- Imaging ordering via staged orders
- Radiology/imaging panel + report viewer
- Team messaging (TeamChatPanel)
- Consult requests (ConsultRequestModal)
- Direct messages (DirectMessageSidebar)
- Hospital selector/switcher
- Voice dictation button (VoiceDictationButton)
- Order entry modal (OrderEntryModal)
- Notification center (NotificationCenter)
- Audit log viewer (useAuditLog)
- Skeleton loaders
- Error boundaries
- Mobile optimization (MobileALISSheet, MobileALISFab)
- HIPAA-compliant session timeout (InactivityGuard)
- Admin panel with user management

### Missing Features to Build (prioritized by clinical value)

---

## Phase 1: Enhanced Patient Workspace (Epic-Style Chart)

The current PatientDashboard shows insights, trends, imaging, and notes. What's missing is a **tabbed chart view** with dedicated sections like a real EMR workspace.

**What to add:**
- Tabbed navigation within PatientDashboard: Summary | Labs | Vitals | Meds | Allergies | Problems | Notes | Imaging | Orders | Billing
- **Labs tab**: Vertical lab result display with trending sparklines, abnormal flagging, and historical comparison
- **Vitals tab**: Time-series vitals chart (HR, BP, SpO2, Temp, RR) using the existing `patient_vitals` table
- **Medications tab**: Active medication list with drug name, dose, route, frequency, start date
- **Allergies tab**: Allergy list with severity and reaction type
- **Problem List tab**: Active/resolved problem list with ICD-10 codes

**Database changes:**
- New table: `patient_medications` (patient_id, name, dose, route, frequency, start_date, end_date, status, prescriber)
- New table: `patient_allergies` (patient_id, allergen, reaction, severity, onset_date)
- New table: `patient_problems` (patient_id, description, icd10_code, status, onset_date, resolved_date)

**New components:**
- `PatientChartTabs.tsx` -- tab container replacing current linear layout
- `LabResultsPanel.tsx` -- vertical lab display with trending
- `VitalsPanel.tsx` -- time-series vitals chart
- `MedicationsPanel.tsx` -- active med list
- `AllergiesPanel.tsx` -- allergy display
- `ProblemListPanel.tsx` -- problem list management

---

## Phase 2: CPOE Enhancement (Order Sets + Safety Checks)

The current OrderEntryModal handles individual orders. What's missing is **order sets** and **drug interaction checking**.

**What to add:**
- **Order Sets Library**: Pre-built order bundles (e.g., "Chest Pain Workup", "Sepsis Bundle", "DVT Prophylaxis") that stage multiple orders at once
- **Drug Interaction Alerts**: When staging a medication order, check against the patient's active medications for interactions
- **Order Review Modal**: Before signing, show a consolidated order review with safety flags

**Database changes:**
- New table: `order_sets` (id, name, description, category, orders_template jsonb, hospital_id, created_by)

**New components:**
- `OrderSetSelector.tsx` -- searchable order set picker
- `DrugInteractionAlert.tsx` -- inline warning component

**Edge function changes:**
- Add `check_interactions` tool to ALIS so it can warn about drug interactions proactively

---

## Phase 3: Revenue Cycle Management Dashboard

The current ChargeReviewPanel is inline in the ALIS sidebar. What's missing is a **dedicated RCM page** with analytics.

**What to add:**
- New `/billing` route with a full billing dashboard page
- Revenue overview cards: total billed, collected, pending, denied
- Denial management queue with AI-powered appeal letter generation
- Collections aging buckets (0-30, 31-60, 61-90, 90+ days)
- Provider-level revenue breakdown
- Note-to-billing workflow: auto-trigger code suggestion when a note is signed

**Database changes:**
- Add columns to `billing_events`: `denial_reason`, `appeal_status`, `appeal_text`, `payer`, `date_of_service`, `provider_id`

**New components/pages:**
- `src/pages/BillingDashboard.tsx` -- full RCM page
- `DenialWorkqueue.tsx` -- denial management list
- `RevenueChart.tsx` -- revenue analytics using recharts

---

## Phase 4: EMR Interoperability Layer

The current project references EMR systems (Epic, Cerner, Meditech) as metadata on hospitals. What's missing is an **integration architecture**.

**What to add:**
- EMR Connection modal showing connection status per hospital with sync indicators
- FHIR resource display (read-only, showing what data would come from the EMR)
- Sync status panel in the TopBar or PatientHeader showing last EMR sync time
- Circuit breaker pattern in API calls with retry logic (partially done via `authenticatedFetch`)

**New components:**
- `EMRSyncBadge.tsx` -- small sync status indicator on PatientHeader
- `EMRConnectionModal.tsx` -- connection config and status display

**No database changes** -- this is a UI/architecture layer that would connect to real FHIR endpoints in production.

---

## Phase 5: Ambient Intelligence Enhancement

VoiceDictationButton exists but uses basic Web Speech API. What's missing is **ambient listening mode**.

**What to add:**
- "Hey ALIS" wake word detection (or a toggle for ambient mode)
- Ambient status indicator showing listening state
- Voice command library: "ALIS, order a CBC", "ALIS, draft a progress note"
- Floating AI panel that persists across page navigation

**Modified components:**
- Enhance `VoiceDictationButton.tsx` with ambient mode toggle
- Add `AmbientStatusIndicator.tsx` to TopBar
- Make ALISPanel available as a floating overlay (not just in the dashboard grid)

---

## Phase 6: Quality and Compliance

**What to add:**
- CMS quality measures dashboard showing compliance rates
- Clinical quality indicators per patient (e.g., DVT prophylaxis given, fall risk assessed)
- Compliance checklist per encounter

**New page:**
- `src/pages/QualityDashboard.tsx`

---

## Implementation Sequence

| Phase | Feature | New Tables | New Components | Effort |
|-------|---------|-----------|----------------|--------|
| 1 | Patient Chart Tabs | 3 | 6 | High |
| 2 | CPOE + Order Sets | 1 | 2 | Medium |
| 3 | RCM Dashboard | 0 (columns) | 3 | Medium |
| 4 | EMR Interop Layer | 0 | 2 | Low |
| 5 | Ambient Intelligence | 0 | 2 | Medium |
| 6 | Quality Dashboard | 0 | 1 | Low |

---

## What We Should NOT Build

Staying true to the "intelligence layer, not another EMR" philosophy, we should skip or simplify:

- **Patient Admission Form** -- the source EMR handles admissions; we read ADT data
- **Emergency Department Dashboard** -- this is an EMR module; we overlay intelligence on existing ER workflows
- **Nursing Documentation/Flowsheets** -- EMR-native; ALIS can summarize nursing notes pulled from the EMR
- **Settings Panel / Command Palette / Deployment Checklist** -- admin tooling that adds bloat without clinical value
- **Welcome Tour / Beta Onboarding** -- can be added later as polish
- **ROI Calculator / CFO Dashboard** -- executive reporting that can be built once real billing data flows

This keeps Virtualis focused: clinical intelligence, care coordination, and revenue optimization -- powered by ALIS, not replacing the EMR.

---

## Recommended Starting Point

**Phase 1 (Patient Chart Tabs)** is the highest impact because it transforms the patient view from a summary dashboard into a full clinical workspace -- the core experience physicians will use all day. This is where the "VirtualisOne" feature set adds the most missing value.

