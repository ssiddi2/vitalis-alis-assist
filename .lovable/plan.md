

# How Virtualis/ALIS Works + Secure Team Chat

## Current Architecture Overview

Here's how everything coordinates today:

```text
┌─────────────────────────────────────────────────────────────────┐
│                         VIRTUALIS                               │
│              (Clinical Intelligence Layer)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Auth +     │    │   Hospital   │    │    ALIS      │      │
│  │   Roles      │    │   Context    │    │   AI Engine  │      │
│  │  (RBAC)      │    │   (Multi-    │    │  (Gemini)    │      │
│  │              │    │    tenant)   │    │              │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Clinical Dashboard                      │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │ Patient View       │  ALIS Chat + Clinical Actions ││   │
│  │  │ - Trajectory       │  - AI Analysis                ││   │
│  │  │ - Trends           │  - Staged Orders              ││   │
│  │  │ - Insights         │  - Clinical Notes             ││   │
│  │  │                    │  - Billing                    ││   │
│  │  └────────────────────┴────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               HIPAA Audit Logging                        │   │
│  │  Every PHI access, order, note, signature tracked        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Backend        │
                    │   (Supabase/     │
                    │    Cloud)        │
                    │  - PostgreSQL    │
                    │  - RLS Policies  │
                    │  - Edge Funcs    │
                    │  - Realtime      │
                    └──────────────────┘
```

### How Data Flows Today

1. **Authentication**: User logs in, gets assigned a role (admin, clinician, viewer)
2. **Hospital Selection**: User picks a facility - all subsequent data is filtered by hospital
3. **Patient Context**: Dashboard loads patient data, clinical trends, insights
4. **ALIS AI**: Real-time AI chat analyzes patient trajectory, can suggest orders/notes
5. **Clinical Actions**: Orders are staged, notes are drafted - all require physician approval
6. **Audit Trail**: Every action on PHI is logged immutably

---

## What's Missing: Secure Team Communication

Right now ALIS is a 1:1 conversation between a clinician and AI. In real clinical workflows, teams need to:

- **Collaborate in real-time** on patient care
- **Consult specialists** securely within the workflow
- **Hand off** critical information between shifts
- **Discuss cases** with nursing, pharmacy, case management

This requires a **HIPAA-compliant secure chat** separate from the ALIS AI assistant.

---

## Proposed: Team Communication Feature

### New Capabilities

| Feature | Description | HIPAA Requirement |
|---------|-------------|-------------------|
| **Patient Channels** | Chat rooms linked to a patient case | All messages logged, PHI contained |
| **Direct Messages** | 1:1 secure messaging between providers | Encrypted, audited |
| **Consult Requests** | Formal specialty consultation threads | Tracked with response times |
| **Shift Handoff** | Structured handoff notes | Timestamped, acknowledged |
| **Care Team Presence** | See who's online/on-call | Role-based visibility |

### Security & Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Encryption at Rest** | Supabase encrypts all data |
| **Encryption in Transit** | TLS 1.3 for all connections |
| **Access Control** | RLS policies by hospital + role |
| **Audit Logging** | Every message action logged |
| **Retention Policies** | Configurable by organization |
| **No PHI in Notifications** | Push notifications redact content |

---

## Database Schema Changes

### New Tables

**1. team_channels** - Patient-linked or topic-based channels
```text
- id (UUID)
- hospital_id (FK)
- patient_id (FK, optional)
- name (e.g., "Margaret Chen - Care Team")
- channel_type: 'patient_care' | 'department' | 'consult'
- created_by (user)
- created_at, updated_at
```

**2. team_messages** - Secure messages
```text
- id (UUID)
- channel_id (FK)
- sender_id (FK to users)
- content (encrypted text)
- message_type: 'text' | 'handoff' | 'urgent' | 'order_link'
- reply_to_id (FK for threading)
- created_at
- read_by (JSONB array)
```

**3. direct_conversations** - 1:1 private chats
```text
- id (UUID)
- participant_1 (FK to users)
- participant_2 (FK to users)
- hospital_id (FK)
- patient_id (FK, optional context)
- created_at
```

**4. direct_messages** - Private messages
```text
- id (UUID)
- conversation_id (FK)
- sender_id (FK)
- content
- created_at
- is_read
```

**5. consult_requests** - Formal consultation tracking
```text
- id (UUID)
- patient_id (FK)
- requesting_user_id (FK)
- specialty (text)
- consultant_id (FK, optional)
- urgency: 'routine' | 'urgent' | 'stat'
- reason (text)
- status: 'pending' | 'accepted' | 'completed'
- channel_id (FK - linked thread)
- response_time_minutes
- created_at, updated_at
```

---

## RLS Security Policies

```text
Team Channels:
- Users can only see channels at their hospital
- Patient channels require clinician or higher role
- Admins can see all channels at their hospitals

Messages:
- Can only read messages in channels you have access to
- Can only send messages if you're a channel member
- All message inserts trigger audit log

Direct Messages:
- Only visible to the two participants
- Cannot be deleted (HIPAA retention)
- Audit logged on read/send
```

---

## UI Components to Add

### 1. Team Chat Tab (Dashboard)
Add a third tab/panel alongside Patient View and ALIS:
- Channel list (patient cases, department groups)
- Message thread view
- Quick actions (mark urgent, link order, request consult)

### 2. Direct Message Sidebar
- Care team member list with online status
- Unread message badges
- Quick DM compose

### 3. Consult Request Flow
- "Request Consult" button in ALIS or patient view
- Specialty picker + urgency selector
- Auto-creates channel for discussion
- Tracks response time for quality metrics

### 4. Shift Handoff Template
- Structured handoff form
- Auto-populates from ALIS trajectory analysis
- Requires acknowledgment from receiving provider

---

## File Changes Required

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration for team_channels, team_messages, direct_conversations, direct_messages, consult_requests tables |
| `src/types/team.ts` | New TypeScript types for team chat |
| `src/hooks/useTeamChat.ts` | Hook for realtime channel messages |
| `src/hooks/useDirectMessages.ts` | Hook for 1:1 messaging |
| `src/hooks/useConsultRequests.ts` | Hook for consult tracking |
| `src/components/virtualis/TeamChatPanel.tsx` | Main team chat UI |
| `src/components/virtualis/DirectMessageSidebar.tsx` | DM list and compose |
| `src/components/virtualis/ConsultRequestModal.tsx` | Consult request form |
| `src/components/virtualis/ShiftHandoffForm.tsx` | Handoff template |
| `src/pages/Dashboard.tsx` | Add Team Chat tab/panel |

---

## Realtime Implementation

```text
Subscribe to team_messages table for live updates:
- New messages appear instantly
- Typing indicators
- Read receipts (optional)
- Presence tracking for online status
```

---

## Summary

| Current State | After Implementation |
|---------------|----------------------|
| ALIS is 1:1 AI assistant | ALIS + Team Chat + DMs |
| No team communication | Secure HIPAA-compliant messaging |
| No consult tracking | Formal consult requests with SLAs |
| No handoff workflow | Structured shift handoffs |
| Single-user context | Multi-provider collaboration |

This makes Virtualis a **complete clinical communication platform** - not just an AI assistant, but a secure workspace where care teams coordinate in real-time with full audit trails.

