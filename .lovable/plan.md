

# Virtualis: Gap Analysis and Feature Roadmap

This plan identifies what's missing to make Virtualis a production-ready universal clinical intelligence layer -- not another EMR, but an AI-powered overlay that enhances existing EMR workflows.

---

## Philosophy: Intelligence Layer, Not Another EMR

You're right -- this should never become "another EMR on top of an EMR." The core value proposition is:
- ALIS as the intelligent orchestrator that reads from and writes back to the source EMR
- Physicians interact with ALIS naturally (voice, chat, manual entry) and ALIS handles the EMR translation
- Everything flows through ALIS-assisted workflows, not redundant data entry screens

---

## What's Missing (5 Major Gaps)

### 1. Voice Dictation for Notes (H&Ps, Progress Notes, Procedures)

**Current state**: Notes are only created by ALIS via AI tool calls or manually typed in a SOAP editor modal. There's no way for a physician to dictate a note hands-free.

**What to build**:
- A microphone button in the ALIS chat input and inside the Note Editor modal
- Real-time speech-to-text using ElevenLabs Scribe (already available as a platform integration)
- Two modes:
  - **Dictate into chat**: Physician speaks, transcription goes into the ALIS chat, and ALIS structures it into a SOAP note automatically
  - **Dictate into note fields**: Physician speaks directly into S/O/A/P fields in the Note Editor with real-time transcription
- Support for H&P, Progress Notes, Consult Notes, Discharge Summaries, and Procedure Notes (note types already exist in the schema)

**Technical approach**:
- New edge function `elevenlabs-scribe-token` to generate single-use tokens
- Add ElevenLabs Scribe React SDK (`@elevenlabs/react` + `useScribe` hook)
- New `VoiceDictationButton` component reusable across chat input and note editor
- The ALIS chat already handles `create_note` tool calls -- dictation just feeds into this existing flow

### 2. Manual Order Entry (Physician-Typed Orders)

**Current state**: Orders can only be staged by ALIS via AI tool calls. Physicians cannot type their own orders manually.

**What to build**:
- A "New Order" button in the Clinical Actions sidebar (next to Staged Orders panel)
- An `OrderEntryModal` with fields for:
  - Order type (lab, imaging, medication, consult, procedure) -- already defined in schema
  - Order name (free text with autocomplete suggestions)
  - Priority (STAT / Urgent / Today / Routine) -- already in schema
  - Clinical indication / rationale
  - Optional: dosing details for medications, laterality for imaging
- Orders entered manually go into the same `staged_orders` table with `created_by` set to the physician's user ID (vs null for AI-generated)
- Same approval/signature workflow applies -- the existing `StagedOrdersPanel` and `OrderSignatureModal` already handle this

**Technical approach**:
- New `OrderEntryModal.tsx` component
- Add a "New Order" button to `StagedOrdersPanel` header
- Insert directly to `staged_orders` table via Supabase client
- Realtime subscription already picks up new orders automatically

### 3. PACS / Radiology Viewer Integration

**Current state**: No imaging viewer or PACS integration exists. Imaging orders can be staged but results can't be viewed.

**What to build**:
- A **Radiology Results** section in the Patient Dashboard showing imaging study metadata (study type, date, status, reading radiologist, impression)
- A lightweight DICOM/image viewer panel using an open viewer approach
- Integration architecture:
  - New `imaging_studies` database table (patient_id, study_type, study_date, accession_number, status, impression, report_text, viewer_url)
  - An `ImagingPanel` component in the Patient Dashboard showing study list with status badges
  - Clicking a study opens a viewer panel/modal -- initially showing the radiology report text and impression
  - For actual DICOM viewing: embed an iframe pointing to a PACS viewer URL (OHIF Viewer or similar) per study
  - ALIS gets imaging context injected so it can reason about radiology findings

**Technical approach**:
- New database migration: `imaging_studies` table with RLS policies
- New `ImagingPanel.tsx` component for the dashboard
- New `RadiologyReportModal.tsx` for viewing full reports
- Add imaging data to the `usePatientDetails` hook
- Inject imaging context into ALIS system prompt via `patientContext`

### 4. Revenue Cycle Management Enhancement

**Current state**: Billing panel shows basic CPT codes and estimated revenue from a single billing event. There's no charge capture workflow, no denial management, and no RCM analytics.

**What to build**:
- **Auto-Charge Capture**: When a note is signed, ALIS automatically suggests CPT and ICD-10 codes based on the note content and creates a billing event
- **Charge Review Dashboard**: A dedicated section (or expandable panel) showing:
  - Pending charges awaiting submission
  - Submitted claims with status tracking
  - Denial alerts with suggested appeal actions
  - Revenue summary by time period, provider, and service line
- **ALIS RCM Tool**: New AI tool `suggest_billing_codes` that analyzes a signed note and returns recommended CPT/ICD-10 codes with confidence levels
- **Billing Workflow**: 
  - Note signed -> ALIS auto-generates billing codes -> Coder reviews -> Submit claim
  - Track claim lifecycle: pending -> submitted -> accepted/rejected
  - Flag under-coded or over-coded encounters

**Technical approach**:
- New ALIS tool `suggest_billing_codes` in the edge function
- Auto-trigger billing code suggestion when a note status changes to "signed" (database trigger or client-side)
- Enhance `BillingPanel.tsx` with charge review capabilities
- New `RCMDashboard` component or page for aggregate analytics
- Add billing code suggestion UI with accept/modify/reject actions

### 5. Virtualis Chat Integration (Unified Communication Hub)

**Current state**: Team Chat exists but is separate from ALIS. Direct messages exist. Consult requests exist. But there's no unified communication layer where clinical conversations, ALIS intelligence, and care coordination come together.

**What to build**:
- **Smart Chat Routing**: When a physician asks ALIS a question that requires specialist input, ALIS can automatically draft a consult request or loop in a specialist via team chat
- **Context-Aware Messaging**: Messages between providers automatically include relevant patient context (current vitals, active orders, recent notes) as a collapsible header
- **ALIS in Team Chat**: Allow providers to @mention ALIS in team chat threads to get AI analysis visible to the whole care team
- **Notification Center**: A unified notification system that aggregates:
  - New consult responses
  - Order status changes
  - Critical lab results
  - ALIS alerts
  - Direct messages

**Technical approach**:
- Enhance `TeamChatPanel` to support @ALIS mentions that trigger AI responses visible to all participants
- New `NotificationCenter` component in the TopBar
- Add notification preferences per user in profiles table
- Wire realtime subscriptions for cross-cutting notifications

---

## Implementation Priority (Recommended Order)

| Phase | Feature | Impact | Effort |
|-------|---------|--------|--------|
| 1 | Manual Order Entry | High -- unblocks physician autonomy | Low |
| 2 | Voice Dictation | High -- core differentiator, hands-free workflow | Medium |
| 3 | RCM Enhancement | High -- direct revenue impact | Medium |
| 4 | Radiology/PACS Integration | High -- completes clinical picture | Medium-High |
| 5 | Unified Communication Hub | Medium -- quality of life improvement | Medium |

---

## Technical Details

### Database Changes Required
- New table: `imaging_studies` (for PACS integration)
- New columns on `billing_events`: `coding_confidence`, `coder_reviewed`, `denial_reason`, `appeal_status`
- Optional: `notifications` table for the notification center

### New Edge Functions
- `elevenlabs-scribe-token` -- generates speech-to-text tokens for voice dictation

### New Components
- `src/components/virtualis/VoiceDictationButton.tsx` -- reusable mic button with real-time transcription
- `src/components/virtualis/OrderEntryModal.tsx` -- manual order entry form
- `src/components/virtualis/ImagingPanel.tsx` -- radiology studies list
- `src/components/virtualis/RadiologyReportModal.tsx` -- full report viewer
- `src/components/virtualis/NotificationCenter.tsx` -- unified notifications dropdown
- `src/components/virtualis/ChargeReviewPanel.tsx` -- billing code review UI

### Modified Files
- `supabase/functions/alis-chat/index.ts` -- add `suggest_billing_codes` tool
- `src/hooks/usePatientDetails.ts` -- add imaging studies fetch
- `src/components/virtualis/ALISPanel.tsx` -- add voice dictation button to chat input
- `src/components/virtualis/NoteEditorModal.tsx` -- add voice dictation to SOAP fields
- `src/components/virtualis/StagedOrdersPanel.tsx` -- add "New Order" button
- `src/components/virtualis/BillingPanel.tsx` -- enhanced charge review
- `src/components/virtualis/PatientDashboard.tsx` -- add imaging section
- `src/components/virtualis/TopBar.tsx` -- add notification center

