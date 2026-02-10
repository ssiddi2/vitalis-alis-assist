
# Dynamic Note Creation, Editing, and Order/Note Signing Workflow

## Problem

1. **No note creation tool** -- ALIS can't create clinical notes through chat. The edge function only has `stage_order`; there's no `create_note` tool.
2. **Edit does nothing** -- Clicking "Edit" on a note just logs to console (`console.log('Edit note:', noteId)`).
3. **Sign doesn't persist** -- Signing a note only updates local state; nothing is saved to the database.
4. **Note type not visible** -- The panel always says "Progress Note" regardless of `note_type` (progress, consult, discharge, procedure).
5. **No editable note modal** -- The existing `ProgressNoteModal` is read-only and never wired into the main workflow.

---

## Plan

### 1. Add `create_note` tool to the edge function

**File: `supabase/functions/alis-chat/index.ts`**

Add a new tool definition alongside `stage_order`:

- Parameters: `note_type` (progress, consult, discharge, procedure), `subjective`, `objective`, `assessment`, `plan`
- The tool inserts a row into `clinical_notes` with status `draft`
- Returns the created note so the frontend can display it immediately
- Emits a `tool_result` SSE event just like orders do

### 2. Enable realtime for `clinical_notes`

**Database migration:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_notes;
```

### 3. Add realtime subscription for clinical_notes in `usePatientDetails`

**File: `src/hooks/usePatientDetails.ts`**

Subscribe to INSERT and UPDATE events on `clinical_notes` filtered by `patient_id`, so notes created by ALIS appear instantly in the sidebar.

### 4. Create an editable note modal

**File: `src/components/virtualis/NoteEditorModal.tsx` (new)**

A dialog that lets the clinician:
- See the note type (Progress, Consult, Discharge, Procedure) as a header badge
- Edit each SOAP field (S, O, A, P) in textarea inputs
- Save changes back to the database (UPDATE `clinical_notes`)
- Sign the note with an electronic signature block (similar to OrderSignatureModal)
- Signing updates `status` to `signed` and sets `signed_at` in the database

### 5. Update `ClinicalNotesPanel` to show all notes with type labels

**File: `src/components/virtualis/ClinicalNotesPanel.tsx`**

- Show the `note_type` label (e.g., "Progress Note", "Consult Note") instead of always "Progress Note"
- List all draft/pending notes (not just the latest one) so clinicians can review multiple
- Add pulse animation for newly created notes (like orders have)
- Wire "Edit" to open the `NoteEditorModal`
- Wire "Sign" to open the `NoteEditorModal` in sign mode

### 6. Wire `onToolCall` in Dashboard for note creation

**File: `src/pages/Dashboard.tsx`**

- Handle `create_note` tool results alongside `stage_order`
- Show toast: "Note drafted -- ready for review"
- The realtime subscription will handle adding it to the list

### 7. Handle `create_note` tool results in `useALISChat`

**File: `src/hooks/useALISChat.ts`**

Already handles generic `tool_result` events and forwards to `onToolCall`. The `create_note` results will flow through the same path -- no changes needed here.

---

## Workflow After Changes

### Note Creation
```
Clinician: "Draft a progress note for this patient"
    |
    v
ALIS generates SOAP content + calls create_note tool
    |
    v
Edge function inserts into clinical_notes (status: draft)
    |
    v
Realtime fires --> note appears in Clinical Actions with pulse
    |
    v
ALIS confirms: "Progress note drafted. Review in the sidebar."
    |
    v
Clinician clicks Edit --> NoteEditorModal opens with editable SOAP fields
    |
    v
Clinician edits content, clicks Save --> database updated
    |
    v
Clinician clicks Sign --> electronic signature applied, status = signed
```

### Order Creation (existing, unchanged)
```
Clinician: "Order a CBC stat"
    |
    v
ALIS calls stage_order --> order appears with pulse
    |
    v
Clinician clicks Approve --> OrderSignatureModal --> signed
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/alis-chat/index.ts` | Edit | Add `create_note` tool definition and executor |
| `src/hooks/usePatientDetails.ts` | Edit | Add realtime subscription for `clinical_notes` |
| `src/components/virtualis/NoteEditorModal.tsx` | New | Editable SOAP note modal with save and sign |
| `src/components/virtualis/ClinicalNotesPanel.tsx` | Edit | Show note types, list all drafts, wire edit/sign to modal |
| `src/pages/Dashboard.tsx` | Edit | Handle `create_note` tool results, wire modal callbacks |

## Database Changes

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_notes;
```

No schema changes -- the existing `clinical_notes` table already has `note_type`, `content` (JSONB for SOAP), `status`, and `signed_at`.
