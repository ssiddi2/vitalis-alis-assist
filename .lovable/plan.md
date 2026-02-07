
# Virtualis 2.0: Hospital-Based Clinical Intelligence Platform

## Vision Understanding

You're building an **interoperable clinical intelligence layer** that sits on top of EMRs (Epic, Meditech, Cerner), enabling clinicians to:
1. Select which hospital's patients to view
2. Collaborate with consultants directly in the ALIS chat
3. See real-time order staging and note generation alongside the conversation
4. Track billing and revenue cycle metrics

---

## Architecture Overview

```text
+------------------+     +------------------+     +------------------+
|   HOSPITAL A     |     |   HOSPITAL B     |     |   HOSPITAL C     |
|   (Epic)         |     |   (Meditech)     |     |   (Cerner)       |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                     +------------v------------+
                     |      VIRTUALIS LAYER    |
                     |  (Interoperability Hub) |
                     +------------+------------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
    +---------v------+  +---------v------+  +---------v------+
    | Patient List   |  | ALIS AI Chat   |  | Clinical Ops   |
    | (by Hospital)  |  | + Consultants  |  | (Orders/Notes) |
    +----------------+  +----------------+  +----------------+
```

---

## Phase 1: Database Schema Expansion

### New Tables

**hospitals** - Multi-hospital support
- `id`, `name`, `code`, `emr_system` (epic/meditech/cerner)
- `address`, `logo_url`, `connection_status`

**hospital_users** - User-hospital access mapping
- `user_id`, `hospital_id`, `access_level`
- Controls which hospitals each user can view

**patients** - Enhanced with hospital relationship
- Add `hospital_id` foreign key
- Add `unit`, `attending_physician`, `care_team`

**consultants** - Specialist directory
- `id`, `hospital_id`, `specialty`, `name`, `pager`, `on_call_status`

**chat_participants** - Multi-user chat support
- `conversation_id`, `user_id`, `role` (clinician/consultant/alis)
- `joined_at`, `is_active`

**staged_orders** - Orders pending approval
- `id`, `conversation_id`, `patient_id`
- `order_type`, `order_data`, `status`, `created_by`

**clinical_notes** - Generated documentation
- `id`, `conversation_id`, `patient_id`
- `note_type` (progress/consult/discharge), `content`, `status`

**billing_events** - Revenue cycle tracking
- `id`, `patient_id`, `note_id`, `cpt_codes`, `icd10_codes`
- `estimated_revenue`, `status`

---

## Phase 2: Hospital Selection Flow

### After Login Experience

```text
+------------------------------------------+
|  Welcome, Dr. Smith                      |
|                                          |
|  Select a facility:                      |
|                                          |
|  +----------------------------------+    |
|  | [Epic icon] Memorial Hospital    |    |
|  | 24 patients | 3 alerts           |    |
|  +----------------------------------+    |
|                                          |
|  +----------------------------------+    |
|  | [Cerner icon] City Medical       |    |
|  | 18 patients | 1 alert            |    |
|  +----------------------------------+    |
+------------------------------------------+
```

### Components
- **HospitalSelector page** - Grid of available hospitals with patient counts
- **HospitalContext provider** - Manages selected hospital across the app
- Patients filtered by `hospital_id` automatically

---

## Phase 3: Enhanced ALIS Panel - Two-Column Layout

### Redesigned Layout

```text
+--------------------------------------------------+
|  ALIS Panel                                      |
+----------------------+---------------------------+
|                      |                           |
|  CLINICAL ACTIONS    |  CONVERSATION             |
|                      |                           |
|  +----------------+  |  [ALIS typing...]         |
|  | STAGED ORDERS  |  |                           |
|  | -------------  |  |  Based on trajectory,     |
|  | CTA Chest STAT |  |  I recommend a PE workup  |
|  | Labs panel     |  |                           |
|  | [Approve All]  |  |  [Consult Cardiology]     |
|  +----------------+  |                           |
|                      |  +---------------------+  |
|  +----------------+  |  | Dr. Patel (Cards)   |  |
|  | PROGRESS NOTE  |  |  | joined the chat     |  |
|  | -------------  |  |  +---------------------+  |
|  | S: Increased.. |  |                           |
|  | O: O2 4L NC... |  |  [Message input]          |
|  | [Edit] [Sign]  |  |                           |
|  +----------------+  |                           |
|                      |                           |
|  +----------------+  |                           |
|  | BILLING        |  |                           |
|  | Est. revenue   |  |                           |
|  | $1,250         |  |                           |
|  +----------------+  |                           |
+----------------------+---------------------------+
```

### Key Features
- **Left column**: Live-updating staged orders, notes, billing
- **Right column**: Chat with ALIS and consultants
- Real-time sync - orders appear as ALIS suggests them

---

## Phase 4: Consultant Collaboration

### Workflow
1. User says: "Consult cardiology"
2. ALIS identifies on-call cardiologist
3. Sends notification (in-app + simulated page)
4. Consultant joins chat as participant
5. Three-way conversation: User + ALIS + Consultant

### Implementation
- Extend `alis-chat` edge function to detect consult requests
- Create `notify-consultant` edge function
- Add consultant avatar and messages to chat
- For demo: Synthetic consultant responses with realistic delays

---

## Phase 5: EMR Integration Details

### Connection Types (for demo/presentation)

**Epic** - FHIR R4 API
- Patient demographics, encounters, observations
- Problem list, medications, allergies
- Real-time ADT notifications

**Meditech** - HL7v2 / FHIR facade
- Traditional HL7 messaging
- Proprietary APIs via integration engine

**Cerner** - FHIR R4 API
- Similar to Epic FHIR capabilities
- Millennium platform integration

### Synthetic Data Structure
```text
Memorial Hospital (Epic)
  - 12 patients across 3 units
  - ICU, Med-Surg, Cardiac

City Medical (Cerner)
  - 8 patients across 2 units
  - General Medicine, Oncology

Regional Health (Meditech)
  - 15 patients across 4 units
  - ED, Surgical, Rehab, Long-term
```

---

## Phase 6: UI Enhancements

### Larger Virtualis Logo
- TopBar: 48px height (up from 40px)
- Auth page: 96px height (up from 80px)
- Add subtle animation on hover

### Patient List View
- Card-based design with hospital branding
- Risk indicators, days since admission
- Quick actions: View, Message, Orders

### Futuristic Elements
- Gradient mesh backgrounds
- Animated connection lines between data sources
- Pulse indicators for real-time data

---

## Data Model Summary

```text
hospitals (new)
  - id, name, code, emr_system, logo_url, connection_status

hospital_users (new)
  - user_id -> auth.users
  - hospital_id -> hospitals
  - access_level

patients (enhanced)
  - hospital_id -> hospitals (NEW)
  - unit, attending_physician, care_team (NEW)

consultants (new)
  - hospital_id -> hospitals
  - specialty, name, pager, on_call_status

conversations (enhanced)
  - hospital_id -> hospitals (NEW)

chat_participants (new)
  - conversation_id -> conversations
  - user_id (nullable for consultants)
  - consultant_id -> consultants (nullable)
  - role, joined_at

staged_orders (new)
  - conversation_id -> conversations
  - patient_id -> patients
  - order_type, order_data, status, rationale

clinical_notes (new)
  - conversation_id -> conversations
  - patient_id -> patients
  - note_type, content (JSONB for SOAP), status

billing_events (new)
  - patient_id -> patients
  - note_id -> clinical_notes
  - cpt_codes, icd10_codes, estimated_revenue
```

---

## Implementation Order

1. ✅ **Database migration** - Create all new tables with RLS
2. ✅ **Synthetic data seeding** - 3 hospitals, 35 patients, specialties
3. ✅ **Hospital selection page** - Post-login routing
4. ✅ **Patient list by hospital** - Filtered views (context ready)
5. ✅ **Enhanced ALIS panel** - Two-column layout
6. ✅ **Staged orders component** - Real-time order staging panel
7. ✅ **Clinical notes panel** - SOAP note display/editing
8. ⏳ **Consultant integration** - Chat participants, notifications (next)
9. ✅ **Billing tracker** - CPT/revenue display
10. ✅ **Logo and UI polish** - Sizing, animations, backgrounds

---

## Technical Notes

- All hospital filtering uses RLS policies based on `hospital_users`
- Consultant notifications use Supabase Realtime
- Orders/notes sync via Realtime subscriptions
- ALIS edge function enhanced with tool-calling for order/consult actions
- Demo mode provides scripted consultant interactions
