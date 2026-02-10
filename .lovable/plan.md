

# Dynamic Patient Census and AI-Powered Clinical Dashboard

## Problem

The entire dashboard is hardcoded around a single fictitious patient ("Margaret Chen" with ID "pt-001"). When you select different hospitals (Epic, Cerner, Meditech), the same patient appears. The database has 23 real patients spread across 3 hospitals but they are never fetched or displayed. Clinical notes table is empty. ALIS receives the hardcoded patient as context, so it can only talk about Margaret Chen.

## Solution

Replace all hardcoded demo data with a dynamic, database-driven experience. Patients load per hospital, clicking a patient sets the context for both the dashboard and ALIS, and clinical notes are seeded per patient so the AI has real data to discuss.

---

## Changes Overview

### 1. Database Migration -- Seed Clinical Notes + Patient Vitals

Insert 2-3 clinical notes per patient (SOAP format) with EMR-specific styling. Also add clinical insight/trend data as JSONB on each patient so the dashboard has real data to show.

**New table: `patient_vitals`**
Stores current vitals and trends per patient so the dashboard can show dynamic "What Matters Now" insights and trends instead of hardcoded scenario data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| patient_id | uuid | FK to patients |
| insights | jsonb | Array of clinical insights |
| trends | jsonb | Array of clinical trend values |
| updated_at | timestamptz | Last update time |

**Seed clinical_notes** for all 23 patients with hospital-appropriate formatting:
- Epic patients: Structured SOAP with Epic-style headers
- Cerner patients: PowerChart-style documentation
- Meditech patients: Meditech-formatted entries

### 2. Create `usePatients` Hook

**New file: `src/hooks/usePatients.ts`**

Fetches patients from the database filtered by the selected hospital ID. Returns them grouped by unit (ICU, Med-Surg, Cardiac, etc.) for sidebar display.

```
usePatients(hospitalId) => {
  patients: Patient[],
  patientsByUnit: Map<string, Patient[]>,
  loading: boolean,
  error: string | null
}
```

### 3. Create `usePatientDetails` Hook

**New file: `src/hooks/usePatientDetails.ts`**

Fetches clinical notes, vitals/insights/trends, staged orders, and billing events for a selected patient.

```
usePatientDetails(patientId) => {
  clinicalNotes: ClinicalNote[],
  insights: ClinicalInsight[],
  trends: ClinicalTrend[],
  stagedOrders: StagedOrder[],
  billingEvents: BillingEvent[],
  loading: boolean
}
```

### 4. Create Patient List Sidebar

**New file: `src/components/virtualis/PatientListSidebar.tsx`**

A collapsible sidebar showing all patients for the selected hospital:
- Grouped by unit (ICU, Med-Surg, Cardiac, ED, etc.)
- Color-coded status dots (red = critical, amber = warning, green = stable)
- Shows patient name, bed, age/sex, admission diagnosis
- Click to select a patient -- updates the entire dashboard + ALIS context
- Collapsible on smaller screens
- Patient count badge per unit

### 5. Create Clinical Notes Display

**New file: `src/components/virtualis/ClinicalNotesDisplay.tsx`**

Renders SOAP notes fetched from the database:
- Note type badge (Progress, H&P, Consult)
- Author and timestamp
- Expandable S/O/A/P sections
- Draft vs Signed status indicator

### 6. Update Patient Type

**Edit: `src/types/clinical.ts`**

Update the `Patient` interface to match database columns (uuid id, unit, status, attending_physician, care_team, hospital_id).

### 7. Rewrite Dashboard Layout

**Edit: `src/pages/Dashboard.tsx`**

Major rewrite to remove ALL hardcoded demo data:

```
+------------------+---------------------------+-----------------+
| Patient List     | Patient Dashboard         | ALIS Panel      |
| (240px, collaps) | (center, flexible)        | (right, 420px+) |
+------------------+---------------------------+-----------------+
```

- Remove all imports from `demoData.ts` (demoPatient, scenarioData, etc.)
- Remove scenario selector from TopBar (no more Day 1/Day 2/Prevention toggle)
- Add `usePatients(selectedHospital.id)` to fetch patient census
- Track `selectedPatient` state -- default to first critical patient
- Add `usePatientDetails(selectedPatient.id)` to fetch clinical data
- Pass real patient + real notes/insights/trends to PatientDashboard
- Pass real patient context to ALIS so AI can answer questions about any patient
- Keep staged orders, billing, consult modals -- but drive them from database data

### 8. Update TopBar

**Edit: `src/components/virtualis/TopBar.tsx`**

- Remove scenario selector props and UI (no more Day 1/2/Prevention dropdown)
- Keep hospital selector, user menu, time display, AI status indicator

### 9. Update PatientDashboard

**Edit: `src/components/virtualis/PatientDashboard.tsx`**

- Add a "Recent Clinical Notes" section using the new ClinicalNotesDisplay component
- Show attending physician and care team info from database
- Remove dependency on hardcoded scenario-driven insights

### 10. Update ALIS Context

**Edit: `src/pages/Dashboard.tsx` (ALIS section)**

Pass the selected patient's real data as context to the AI:

```typescript
patientContext: {
  patient: selectedPatient,        // Real DB patient
  hospital: selectedHospital,      // Real hospital
  clinicalNotes: patientNotes,     // Real SOAP notes
  insights: patientInsights,       // Real clinical insights
  trends: patientTrends,           // Real vitals/trends
}
```

This means when you ask ALIS "what's going on with this patient?", it will answer based on actual clinical data for whichever patient you've selected -- not a hardcoded script.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | Seed clinical_notes, create patient_vitals table, seed vitals/insights |
| `src/hooks/usePatients.ts` | Create | Fetch patients by hospital_id |
| `src/hooks/usePatientDetails.ts` | Create | Fetch notes, vitals, orders for a patient |
| `src/components/virtualis/PatientListSidebar.tsx` | Create | Patient census sidebar |
| `src/components/virtualis/ClinicalNotesDisplay.tsx` | Create | SOAP notes renderer |
| `src/types/clinical.ts` | Edit | Update Patient interface for DB schema |
| `src/pages/Dashboard.tsx` | Edit | Replace hardcoded data with dynamic fetching |
| `src/components/virtualis/TopBar.tsx` | Edit | Remove scenario selector |
| `src/components/virtualis/PatientDashboard.tsx` | Edit | Add clinical notes section |

---

## User Experience After Implementation

1. Select a hospital (e.g., Memorial General / Epic)
2. See a sidebar with 8 patients grouped by ICU (3), Med-Surg (3), Cardiac (2)
3. Critical patients highlighted in red, warnings in amber
4. Click any patient -- dashboard updates with their real clinical data
5. ALIS panel resets and greets you with context about the selected patient
6. Ask ALIS anything: "What are the latest vitals?", "Summarize the notes", "Stage a lab order" -- it responds using real patient data
7. Switch hospitals -- entirely different patient list appears
