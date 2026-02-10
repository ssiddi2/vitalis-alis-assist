

# Two-Step Navigation: Facility → Patient List → Patient Dashboard

## Current Flow
Facility Selector → Dashboard (patient list embedded as sidebar)

## New Flow
Facility Selector → **Patient Census Page** (full-page list) → Patient Dashboard (with ALIS)

---

## Implementation

### 1. Create New Patient Census Page

**New file: `src/pages/PatientCensus.tsx`**

A full-page view showing all patients for the selected hospital, reusing the existing `PatientListSidebar` component logic but in a full-page layout:
- Hospital name and EMR badge at top
- Patients grouped by unit in a card/table layout (larger than the sidebar version)
- Color-coded status indicators
- Click a patient row to navigate to `/dashboard`
- Back button to return to facility selector
- Uses `FuturisticBackground variant="lite"`

### 2. Add Route

**Edit: `src/App.tsx`**

Add `/census` route pointing to `PatientCensus`.

### 3. Update Hospital Selector

**Edit: `src/pages/HospitalSelector.tsx`**

Change `handleSelectHospital` to navigate to `/census` instead of `/dashboard`.

### 4. Update Dashboard

**Edit: `src/pages/Dashboard.tsx`**

- Store the selected patient ID in URL or context so the dashboard knows which patient to load
- Remove the patient list sidebar column on desktop (or keep it for switching between patients once inside)
- If no patient is selected, redirect back to `/census`
- Keep the ALIS panel and patient dashboard as-is

### 5. Add Selected Patient to Hospital Context

**Edit: `src/contexts/HospitalContext.tsx`**

Add `selectedPatientId` / `setSelectedPatientId` to the context so the census page can set it and the dashboard can read it without URL params.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/PatientCensus.tsx` | Create | Full-page patient list per hospital |
| `src/App.tsx` | Edit | Add `/census` route |
| `src/pages/HospitalSelector.tsx` | Edit | Navigate to `/census` instead of `/dashboard` |
| `src/pages/Dashboard.tsx` | Edit | Read selected patient from context, keep sidebar for switching |
| `src/contexts/HospitalContext.tsx` | Edit | Add selectedPatientId state |

---

## User Flow After Implementation

1. Login → Facility Selector (pick hospital)
2. → Patient Census page (see all patients for that hospital, grouped by unit)
3. → Click a patient → Dashboard opens with that patient's clinical data + ALIS
4. Patient list sidebar remains in dashboard for quick switching between patients without going back

