

# Standalone Outpatient EMR Expansion Plan

## Overview

Transform Virtualis from an inpatient EMR overlay into a full standalone EMR capable of handling outpatient clinics, primary care offices, and specialty practices. This builds on the existing clinical intelligence layer (ALIS, CPOE, Billing) while adding the core ambulatory workflows that are missing.

## Phase 1: Data Foundation (Database Schema)

### New Tables

**encounters** -- The core outpatient visit record (replaces the inpatient admission model)
- id, patient_id, provider_id (user), hospital_id
- encounter_type: enum (office_visit, telehealth, follow_up, annual_physical, urgent, procedure)
- visit_reason, chief_complaint
- scheduled_at, check_in_at, check_out_at
- status: enum (scheduled, checked_in, in_progress, completed, cancelled, no_show)
- duration_minutes, room_number
- billing_event_id (links to existing billing_events)

**appointments** -- Scheduling layer
- id, patient_id, provider_id, hospital_id
- encounter_type, visit_reason
- start_time, end_time, duration_minutes
- status: enum (scheduled, confirmed, checked_in, completed, cancelled, no_show)
- recurring_rule (JSONB for repeat visits)
- notes

**prescriptions** -- eRx capability
- id, patient_id, encounter_id, prescriber_id
- medication_name, dose, frequency, route, quantity, refills
- pharmacy_name, pharmacy_npi
- status: enum (draft, signed, sent, filled, cancelled)
- sig (patient instructions)
- dea_schedule (for controlled substances)

**immunizations** -- Vaccine records
- id, patient_id, vaccine_name, cvx_code
- administered_date, lot_number, site, route
- administered_by, manufacturer
- next_due_date

**referrals** -- Outbound referral tracking (extends existing consult_requests)
- id, patient_id, encounter_id, referring_provider_id
- referred_to_provider, referred_to_specialty
- reason, urgency, status
- scheduled_date, completed_date, report_received

**note_templates** -- Visit-type-specific documentation templates
- id, name, encounter_type, specialty
- template_content (JSONB with section structure)
- created_by, hospital_id

### Schema Modifications

**patients table** -- Add outpatient fields
- Add: insurance_provider, insurance_id, pcp_provider_id
- Add: preferred_pharmacy, preferred_language
- Add: emergency_contact (JSONB)
- Add: patient_type enum (inpatient, outpatient, both)
- Existing inpatient fields (bed, unit, admission_day, expected_los) become nullable/optional

## Phase 2: Core Outpatient Workflows

### 2a. Scheduling and Calendar
- New `/schedule` page with a weekly/daily calendar view
- Appointment creation modal with patient search, visit type picker, provider/room assignment
- Check-in / check-out flow that transitions appointment to encounter
- Color-coded status indicators on calendar slots
- Drag-and-drop rescheduling

### 2b. Encounter Workflow
- New encounter-based flow: Patient arrives -> Check-in -> Rooming -> Provider sees patient -> Document -> Check-out -> Bill
- The existing PatientDashboard adapts to show encounter context instead of admission context
- PatientHeader shows visit reason, provider, and encounter duration instead of admission day/LOS
- Chart tabs remain the same (labs, vitals, meds, etc.) but scoped to encounter when relevant

### 2c. Prescription Writing (eRx)
- New "Prescriptions" tab in PatientChartTabs
- Prescription entry form: medication search, dose builder, SIG generator
- ALIS integration: "Prescribe metformin 500mg" -> staged prescription for signature
- Prescription history view with refill tracking

### 2d. Note Templates
- Template library accessible from the Notes tab
- Pre-built templates: Annual Physical, Follow-Up, Sick Visit, Procedure Note
- ALIS can auto-select appropriate template based on encounter type
- Templates populate the existing NoteEditorModal with pre-filled sections

## Phase 3: Enhanced Features

### 3a. Patient Registration / Intake
- Demographics editing form (currently read-only display)
- Insurance capture fields
- Consent form tracking
- Emergency contact management

### 3b. Referral Management
- Extend ConsultRequestModal into a full referral workflow
- Track referral status: sent, scheduled, completed, report received
- Referral queue view for office staff

### 3c. Immunization Tracking
- New "Immunizations" tab in PatientChartTabs
- Vaccine administration recording
- Due-date tracking with overdue alerts
- ALIS can flag missing vaccinations based on age/conditions

### 3d. Preventive Care Dashboard
- Screening reminders (mammogram, colonoscopy, A1c, etc.)
- Age/sex/condition-based protocol engine
- Wellness visit checklist generation

## Phase 4: Navigation and UX Changes

### Updated App Routes

```text
/                    -- Facility selector (existing)
/schedule            -- NEW: Provider schedule/calendar
/census              -- Inpatient census (existing, still available)
/clinic              -- NEW: Outpatient patient list (today's appointments)
/dashboard           -- Patient chart (existing, enhanced for encounters)
/billing             -- Billing dashboard (existing)
/quality             -- Quality dashboard (existing)
/admin               -- Admin panel (existing)
```

### Navigation Flow Change

```text
Current (Inpatient):
  Facility -> Census -> Patient Dashboard

New (Outpatient):
  Facility -> Schedule/Clinic View -> Check-in -> Encounter Dashboard

Both paths converge at the same Patient Dashboard,
which adapts based on whether context is inpatient or outpatient.
```

### TopBar Updates
- Add encounter timer (time since check-in)
- Show encounter type badge instead of EMR sync badge when in standalone mode
- Toggle between "Inpatient" and "Outpatient" views at facility level

## Technical Considerations

### Database
- All new tables get RLS policies following existing patterns (hospital_users join for access control)
- Encounters link to existing clinical_notes, staged_orders, and billing_events via encounter_id foreign keys
- Audit triggers on all new tables for HIPAA compliance
- Realtime enabled on appointments table for live schedule updates

### ALIS AI Enhancement
- Encounter-aware context: ALIS knows if this is a follow-up vs. new visit
- Template suggestion: "This looks like a diabetes follow-up. Want me to use the DM Follow-Up template?"
- Preventive care prompts: "This patient is due for a colonoscopy screening"
- Prescription drafting from conversation

### Backward Compatibility
- All existing inpatient workflows remain intact
- Patient records work across both contexts
- The `patient_type` field on patients controls which views are available
- Hospitals can be configured as inpatient-only, outpatient-only, or both

## Build Progress

- [x] 1. Database schema (encounters, appointments, prescriptions, immunizations, referrals, note_templates)
- [x] 2. `/schedule` page with weekly/daily calendar view + appointment creation modal
- [x] 3. `/clinic` page with today's appointments, check-in/check-out workflow
- [x] 4. Prescription writing (eRx) tab in PatientChartTabs
- [x] 5. Navigation updates (TopBar links to Schedule/Clinic, App.tsx routes)
- [ ] 6. Note templates
- [ ] 7. Immunizations and preventive care
- [ ] 8. Patient registration/intake forms
- [ ] 9. Referral management
- [ ] 10. Encounter-aware PatientDashboard (show visit context vs admission context)
