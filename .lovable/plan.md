

# Wire Up Encounter-Aware Patient Dashboard

## What This Solves
When a clinician clicks "Start Visit" from the Clinic page, the Patient Dashboard currently shows inpatient-specific fields (Admission Day, Expected LOS, Bed) instead of the encounter context (Visit Reason, Encounter Type, Duration Timer). This plan bridges that gap.

## Changes

### 1. Add Encounter Context to HospitalContext
Add `activeEncounterId` state alongside the existing `selectedPatientId` so the encounter context travels from Clinic to Dashboard without URL hacks.

- New state: `activeEncounterId: string | null`
- New setter: `setActiveEncounterId`
- Exposed via context provider

### 2. Update Clinic Page to Pass Encounter ID
When creating an encounter on check-in, store the encounter ID. When "Start Visit" is clicked, set both the patient ID and the encounter ID in the context before navigating.

- `handleCheckIn`: save the created encounter ID (already returned from `createEncounter`)
- `handleStartVisit`: look up or fetch the active encounter for that appointment, call `setActiveEncounterId(encounterId)` before `navigate('/dashboard')`

### 3. Create useActiveEncounter Hook
A small hook that fetches the encounter record from the database when `activeEncounterId` is set, providing:
- `encounter` object (type, visit_reason, chief_complaint, check_in_at, status, room_number)
- `elapsedMinutes` (live timer computed from check_in_at)
- Loading state

### 4. Adapt PatientDashboard to Accept Encounter
- Add optional `encounterId` prop to `PatientDashboard`
- Dashboard.tsx reads `activeEncounterId` from context and passes it down
- When an encounter is active, PatientHeader renders encounter-specific fields instead of inpatient fields

### 5. Make PatientHeader Encounter-Aware
The header will detect whether encounter context is provided and switch its bottom info grid:

**Inpatient mode (no encounter):**
- Location/Bed | Admission Day | Expected LOS | Admission Diagnosis

**Outpatient/Encounter mode:**
- Visit Type badge | Visit Reason | Room | Duration Timer (live, updating every minute)

The top section (name, age, sex, MRN, Active badge) stays the same in both modes.

### 6. Clear Encounter on Patient Switch
When a different patient is selected from the sidebar (inpatient flow), clear `activeEncounterId` so the dashboard reverts to inpatient mode. This ensures backward compatibility.

## Technical Details

### Files Modified
- `src/contexts/HospitalContext.tsx` -- add activeEncounterId state
- `src/pages/Clinic.tsx` -- pass encounter ID on navigation
- `src/pages/Dashboard.tsx` -- read encounter from context, pass to PatientDashboard
- `src/components/virtualis/PatientDashboard.tsx` -- accept optional encounterId, pass to header
- `src/components/virtualis/PatientHeader.tsx` -- dual-mode rendering (inpatient vs encounter)
- `src/types/clinical.ts` -- extend Patient type with optional encounter fields

### New Files
- `src/hooks/useActiveEncounter.ts` -- fetches encounter by ID, computes elapsed time

### Duration Timer Implementation
Uses a `setInterval` (every 60 seconds) to update elapsed time from `check_in_at`. Displays as "12m", "1h 23m", etc. Cleans up on unmount.

### Data Flow

```text
Clinic Page
  |-- handleCheckIn() --> createEncounter() --> saves encounterId
  |-- handleStartVisit() --> setActiveEncounterId(id) + setSelectedPatientId(id) + navigate('/dashboard')

Dashboard Page
  |-- reads activeEncounterId from HospitalContext
  |-- useActiveEncounter(activeEncounterId) --> { encounter, elapsedMinutes }
  |-- passes encounter to PatientDashboard

PatientDashboard
  |-- passes encounter to PatientHeader

PatientHeader
  |-- if encounter: shows Visit Type, Reason, Room, Timer
  |-- else: shows Location, Bed, Admission Day, LOS
```

### Backward Compatibility
- All existing inpatient workflows are untouched
- Selecting a patient from the sidebar clears the encounter context
- The PatientHeader gracefully falls back to inpatient mode when no encounter is present
