
# Audit Logging for PHI Access - HIPAA Compliance

## Overview

This plan implements comprehensive audit logging to track all Protected Health Information (PHI) access, modifications, and clinical actions. This is a critical requirement for **HIPAA compliance** (45 CFR 164.312(b) - Audit Controls).

---

## What Gets Logged

### High-Priority PHI Tables (Automatic Logging)
| Table | Actions Logged | PHI Sensitivity |
|-------|---------------|-----------------|
| `patients` | SELECT, INSERT, UPDATE, DELETE | High |
| `clinical_notes` | SELECT, INSERT, UPDATE, DELETE | High |
| `staged_orders` | SELECT, INSERT, UPDATE, DELETE | High |
| `billing_events` | SELECT, INSERT, UPDATE, DELETE | High |
| `conversations` | INSERT, UPDATE, DELETE | Medium |
| `messages` | INSERT | Medium |

### Captured Data Points
- **Who**: User ID, IP address, user agent
- **What**: Action type, table name, record ID
- **When**: Timestamp with timezone
- **Where**: Hospital context, session ID
- **Why**: Action metadata (e.g., "viewed patient chart", "signed note")

---

## Database Schema

### New Table: `audit_logs`

```text
audit_logs
├── id (UUID, primary key)
├── user_id (UUID, references auth.users)
├── hospital_id (UUID, nullable)
├── action_type (enum: view, create, update, delete, export, sign, approve)
├── resource_type (text: patient, clinical_note, staged_order, etc.)
├── resource_id (UUID)
├── patient_id (UUID, nullable - for quick patient-level queries)
├── metadata (JSONB - additional context)
├── ip_address (INET)
├── user_agent (TEXT)
├── session_id (TEXT)
├── created_at (TIMESTAMPTZ)
```

### Action Type Enum
```text
audit_action_type:
  - view          (accessed/read data)
  - create        (inserted new record)
  - update        (modified existing record)
  - delete        (removed record)
  - export        (downloaded/exported data)
  - sign          (signed clinical note)
  - approve       (approved order)
  - login         (user authentication)
  - logout        (user sign out)
```

---

## Implementation Components

### 1. Database Triggers (Automatic Logging)

Create triggers on PHI tables to automatically log INSERT, UPDATE, DELETE operations:

```text
For each PHI table:
  AFTER INSERT  → log 'create' action
  AFTER UPDATE  → log 'update' action with old/new values
  AFTER DELETE  → log 'delete' action with deleted data
```

Key benefit: Catches all data changes regardless of how they're made (API, edge function, direct SQL).

### 2. Client-Side View Logging

Add explicit logging calls when users view PHI:
- Patient dashboard access
- Clinical notes opened
- Orders reviewed
- Billing data viewed

### 3. Edge Function for Audit Logging

Create `audit-log` edge function that:
- Receives audit events from the client
- Validates user authentication
- Enriches with IP/user-agent
- Writes to `audit_logs` table

### 4. RLS Policies for Audit Table

- **SELECT**: Only admins and compliance officers can query logs
- **INSERT**: Authenticated users can write (via security definer function)
- **UPDATE/DELETE**: No one (logs are immutable)

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ View Patient│    │ Sign Note   │    │ Approve Order│        │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│   ┌─────────────────────────────────────────────────────┐      │
│   │              useAuditLog Hook (Client)              │      │
│   │  - Captures action context                          │      │
│   │  - Includes session/browser info                    │      │
│   └───────────────────────┬─────────────────────────────┘      │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            ▼
              ┌─────────────────────────┐
              │  audit-log Edge Function │
              │  - Validates auth token  │
              │  - Extracts IP/UA        │
              │  - Writes to database    │
              └────────────┬────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    audit_logs Table                      │  │
│   │  - Immutable (no UPDATE/DELETE allowed)                  │  │
│   │  - Indexed for fast queries                              │  │
│   │  - Admin-only read access                                │  │
│   └─────────────────────────────────────────────────────────┘  │
│                           ▲                                     │
│                           │                                     │
│   ┌───────────────────────┴───────────────────────────────┐    │
│   │              Database Triggers                         │    │
│   │  - patients_audit_trigger                              │    │
│   │  - clinical_notes_audit_trigger                        │    │
│   │  - staged_orders_audit_trigger                         │    │
│   │  - billing_events_audit_trigger                        │    │
│   └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Files to Create

### Database Migration
- `supabase/migrations/[timestamp]_audit_logging.sql`
  - Create `audit_action_type` enum
  - Create `audit_logs` table with proper indexes
  - Create `log_audit_event` security definer function
  - Create triggers for automatic logging on PHI tables
  - RLS policies (admin read, authenticated insert via function)

### Edge Function
- `supabase/functions/audit-log/index.ts`
  - POST endpoint for client-side audit events
  - Extracts IP from x-forwarded-for header
  - Validates auth token
  - Writes to `audit_logs` via service role

### React Hook
- `src/hooks/useAuditLog.ts`
  - `logView(resourceType, resourceId, patientId?)` - for viewing
  - `logAction(actionType, resourceType, resourceId, metadata?)` - for actions
  - Automatically includes hospital context

### Updated Components
- `PatientDashboard.tsx` - log patient view
- `ClinicalNotesPanel.tsx` - log note access and signing
- `StagedOrdersPanel.tsx` - log order views and approvals
- `BillingPanel.tsx` - log billing data access
- `Auth.tsx` - log login events
- `useAuth.ts` - log logout events

---

## Technical Specifications

### Indexes for Query Performance

```text
idx_audit_logs_user_id        - Query by who
idx_audit_logs_patient_id     - Query by patient
idx_audit_logs_resource       - Query by resource_type + resource_id
idx_audit_logs_created_at     - Query by time range
idx_audit_logs_hospital       - Query by facility
```

### Security Definer Function

```text
log_audit_event(
  p_action_type audit_action_type,
  p_resource_type text,
  p_resource_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_hospital_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
```

This function runs with elevated privileges to insert into the audit log regardless of RLS policies.

### Metadata Examples

```text
View Patient:
  { "view_type": "dashboard", "duration_ms": 45000 }

Sign Note:
  { "note_type": "progress", "signature_method": "password" }

Approve Order:
  { "order_type": "imaging", "priority": "stat" }
```

---

## HIPAA Compliance Mapping

| HIPAA Requirement | Implementation |
|-------------------|----------------|
| 164.312(b) - Audit Controls | `audit_logs` table with triggers |
| 164.308(a)(1)(ii)(D) - Information Activity Review | Admin dashboard queries |
| 164.312(d) - Person/Entity Authentication | `user_id` linked to auth.users |
| 164.530(j) - Retention | 6-year retention policy (configurable) |

---

## Implementation Order

1. **Database Migration** - Create audit_logs table and triggers
2. **Security Definer Function** - Enable secure insertions
3. **Edge Function** - Handle client-side audit events
4. **React Hook** - useAuditLog for consistent logging
5. **Component Updates** - Add logging to PHI access points
6. **Auth Integration** - Log login/logout events

---

## Estimated Changes

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/[timestamp]_audit_logging.sql` | New | Schema, triggers, RLS |
| `supabase/functions/audit-log/index.ts` | New | Edge function |
| `src/hooks/useAuditLog.ts` | New | Client-side hook |
| `src/pages/Dashboard.tsx` | Edit | Add view logging |
| `src/components/virtualis/ClinicalNotesPanel.tsx` | Edit | Log note actions |
| `src/components/virtualis/StagedOrdersPanel.tsx` | Edit | Log order actions |
| `src/components/virtualis/BillingPanel.tsx` | Edit | Log billing views |
| `src/pages/Auth.tsx` | Edit | Log login events |
| `src/hooks/useAuth.ts` | Edit | Log logout events |
