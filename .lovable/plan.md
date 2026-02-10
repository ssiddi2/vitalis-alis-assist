
# Patient List by Hospital with Clinical Notes

## Problem

The dashboard currently shows a single hardcoded demo patient ("Margaret Chen") regardless of which hospital/EMR you select. There's no patient list, no way to switch between patients, and no hospital-specific data shown. The database already has 8 patients for Memorial General (Epic), 6 for City Medical (Cerner), and 6+ for Regional Health (Meditech) -- but they're never fetched or displayed.

## Solution

Build a patient census sidebar that fetches real patients from the database filtered by the selected hospital, and allow clicking a patient to view their details and clinical notes.

---

### 1. Create a Patient List Sidebar Component

**New file: `src/components/virtualis/PatientListSidebar.tsx`**

A scrollable sidebar showing all patients for the selected hospital, grouped by unit (ICU, Med-Surg, Cardiac, etc.), with:
- Status indicators (critical = red, warning = amber, stable = green)
- Patient name, age, sex, bed number
- Admission diagnosis summary
- Click to select a patient and view their dashboard

### 2. Create a `usePatients` Hook

**New file: `src/hooks/usePatients.ts`**

Fetches patients from Supabase filtered by `hospital_id`:
```text
SELECT * FROM patients WHERE hospital_id = :selectedHospitalId ORDER BY status, name
```
Returns patients grouped by unit for display.

### 3. Seed Clinical Notes per Hospital

**Database migration** to insert sample clinical notes for patients across all three hospitals. Each EMR system will have notes that reflect its style:

| Hospital (EMR) | Notes Style |
|---|---|
| Memorial General (Epic) | Structured SOAP notes with Epic-style formatting |
| City Medical (Cerner) | PowerChart-style documentation |
| Regional Health (Meditech) | Meditech-formatted clinical entries |

Sample notes per patient will include:
- Admission H&P
- Daily progress notes
- Nursing assessments

### 4. Update Dashboard Layout

**Modified file: `src/pages/Dashboard.tsx`**

Change from single-patient view to a three-panel layout:

```text
Desktop:
+------------------+---------------------------+-----------------+
| Patient List     | Patient Dashboard         | ALIS Panel      |
| (sidebar, 280px) | (center, flexible)        | (right, 420px+) |
+------------------+---------------------------+-----------------+

Mobile:
- Patient list accessible via a top tab or dropdown
- Patient dashboard full width
- ALIS via existing FAB
```

Key changes:
- Add patient list as left sidebar (collapsible on smaller screens)
- Track `selectedPatient` state instead of using hardcoded `demoPatient`
- Fetch clinical notes for the selected patient
- Pass real patient data to `PatientDashboard` and `ALISPanel`

### 5. Update PatientDashboard for Real Data

**Modified file: `src/components/virtualis/PatientDashboard.tsx`**

- Accept clinical notes as a prop and display them in a "Recent Notes" section
- Show attending physician and care team info
- Display unit-specific context

### 6. Create Clinical Notes Display Component

**New file: `src/components/virtualis/ClinicalNotesDisplay.tsx`**

Renders clinical notes (SOAP format) with:
- Note type badge (Progress, H&P, Consult)
- Timestamp and author
- Expandable sections for S/O/A/P
- Status indicator (Draft, Signed)

---

## Database Changes

### Migration: Seed clinical notes for existing patients

Insert 2-3 clinical notes per patient across all hospitals. Example for Memorial General (Epic):

**Robert Chen (ICU, Sepsis):**
- Admission H&P: Detailed sepsis workup, source investigation
- Progress Note Day 2: Vasopressor requirements, culture results
- Progress Note Day 3: Improving, weaning pressors

**Maria Santos (ICU, STEMI):**
- Admission H&P: Cardiac catheterization findings, stent placement
- Progress Note Day 2: Post-PCI monitoring, echo results

Similar notes for all patients at City Medical and Regional Health, with EMR-appropriate formatting differences.

---

## Files Summary

| File | Action | Description |
|---|---|---|
| `src/components/virtualis/PatientListSidebar.tsx` | Create | Scrollable patient census by unit |
| `src/components/virtualis/ClinicalNotesDisplay.tsx` | Create | Renders SOAP notes with expand/collapse |
| `src/hooks/usePatients.ts` | Create | Fetches patients by hospital_id |
| `src/pages/Dashboard.tsx` | Edit | Add patient list sidebar, track selected patient |
| `src/components/virtualis/PatientDashboard.tsx` | Edit | Show clinical notes section |
| Migration SQL | Create | Seed clinical notes for all hospital patients |

---

## Data Architecture

```text
Hospital Selected
    |
    v
usePatients(hospitalId)
    |
    v
Patient List Sidebar ──click──> selectedPatient
    |                                |
    v                                v
Grouped by Unit              PatientDashboard
(ICU, Med-Surg, etc.)        + Clinical Notes
                             + ALIS Context
```

## Patient Counts by Hospital

- **Memorial General (Epic)**: 8 patients across ICU (3), Med-Surg (3), Cardiac (2)
- **City Medical (Cerner)**: 6 patients across Gen Med (3), Oncology (3)
- **Regional Health (Meditech)**: 6+ patients across ED, Surgical, Rehab, Telemetry
