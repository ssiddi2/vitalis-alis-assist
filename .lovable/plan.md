
# Make Virtualis A++++ -- Seed Data and Complete Missing Features

## Overview
The architecture and schema are solid, but every outpatient table is empty and a few UI features are missing. This plan seeds realistic demo data and fills the remaining gaps to make the full outpatient workflow demonstrable end-to-end.

## Step 1: Seed Demo Data (Database Migration)

Populate the outpatient tables with realistic clinical data so Schedule, Clinic, and eRx pages are immediately functional.

### Appointments (12-15 records)
- Spread across today and this week
- Mix of statuses: scheduled, confirmed, checked_in, completed
- Various encounter types: office_visit, follow_up, telehealth, annual_physical, urgent
- Linked to existing patients (23 patients across 3 hospitals)
- Assigned to the first available user as provider_id (or use a placeholder approach with a function)

### Encounters (3-4 records)
- Match the checked_in/completed appointments
- Include visit reasons, chief complaints, room numbers
- One active "in_progress" encounter for immediate demo

### Prescriptions (5-8 records)
- Common medications: Metformin 500mg, Lisinopril 10mg, Atorvastatin 20mg, Amoxicillin 500mg, Omeprazole 20mg
- Mix of statuses: draft, signed, sent
- Proper SIG text (e.g., "Take 1 tablet by mouth twice daily with meals")

### Note Templates (5 records)
- Annual Physical (with ROS, exam, screening sections)
- Follow-Up Visit (focused SOAP)
- Sick Visit (acute care template)
- Procedure Note (pre/intra/post sections)
- Telehealth Visit (virtual visit adapted template)

Each template has structured JSONB content with section headers and placeholder text.

### Immunizations (8-10 records)
- Common vaccines: Influenza, COVID-19, Tdap, Pneumococcal, Hepatitis B
- Spread across multiple patients
- Some with upcoming next_due_dates to demo overdue alerts

## Step 2: Add Immunizations Tab to Patient Chart

Add an "Immunizations" tab to `PatientChartTabs.tsx` with a new `ImmunizationsPanel.tsx` component.

### ImmunizationsPanel features:
- Table view of administered vaccines (name, date, lot, site, administered_by)
- "Overdue" badge for vaccines past their next_due_date
- "Add Vaccine" button with a form modal (vaccine name, date, lot number, site, route, manufacturer)
- Uses a new `useImmunizations.ts` hook for CRUD operations

### Files:
- Create `src/hooks/useImmunizations.ts`
- Create `src/components/virtualis/ImmunizationsPanel.tsx`
- Edit `src/components/virtualis/PatientChartTabs.tsx` (add tab)

## Step 3: Add Note Template Picker to Notes Tab

Enhance the existing Notes UI to allow selecting a pre-built template when creating a new note.

### Changes:
- Add a "New Note from Template" button to `ClinicalNotesDisplay.tsx`
- Create a `TemplatePickerModal.tsx` that lists available templates from the database
- When selected, opens the existing `NoteEditorModal` pre-populated with the template's section structure
- Uses a `useNoteTemplates.ts` hook

### Files:
- Create `src/hooks/useNoteTemplates.ts`
- Create `src/components/virtualis/TemplatePickerModal.tsx`
- Edit `src/components/virtualis/ClinicalNotesDisplay.tsx` (add template button)

## Technical Details

### Database Migration
A single migration seeds all demo data. It will:
1. Look up existing patient IDs and hospital IDs dynamically
2. Use a CTE or DO block to assign provider_id from existing users
3. Insert appointments for today and surrounding days
4. Insert matching encounters for checked-in appointments
5. Insert sample prescriptions
6. Insert note templates (not patient-specific, so no patient_id needed)
7. Insert immunization records for select patients

### New Hooks
- `useImmunizations(patientId)`: fetch, create immunization records with RLS-aware queries
- `useNoteTemplates(hospitalId?)`: fetch templates, optionally filtered by encounter_type

### Component Architecture
- `ImmunizationsPanel` follows the same pattern as `AllergiesPanel` / `MedicationsPanel` (table + add modal)
- `TemplatePickerModal` is a simple dialog with a list of template cards, each showing name, encounter_type, and specialty

### No Breaking Changes
- All existing tabs and workflows remain untouched
- New tabs are additive
- Demo data uses existing patient/hospital IDs

## Build Order
1. Database migration (seed all demo data)
2. `useImmunizations` hook + `ImmunizationsPanel` component + add tab
3. `useNoteTemplates` hook + `TemplatePickerModal` + wire into Notes tab
