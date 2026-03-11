

# Consultation System — Integration Gaps

The backend architecture (4 tables, edge function, types, hook) is fully implemented. However, the `ConsultationThreadView` component is **not wired into any UI** — it's an orphan component. There are two issues to fix:

## Issues

1. **No entry point**: `ConsultationThreadView` is never imported or rendered anywhere. Users have no way to create or view consultation threads.

2. **ConsultRequestModal doesn't create threads**: The existing `ConsultRequestModal` creates `consult_requests` rows but never spawns a `consultation_thread` or opens the thread view.

## Plan

### 1. Add "Consultations" tab to PatientChartTabs
- Add a new tab trigger with a `Stethoscope` icon labeled "Consults"
- Render `ConsultationThreadView` inside, passing `patientId` and `hospitalId`

### 2. Add thread creation UI inside ConsultationThreadView
- When no `threadId` is provided, show a "New Consultation" form (specialty select + reason input)
- On submit, call `createThread()` from the hook, which invokes the edge function
- After creation, automatically display the thread conversation

### 3. Wire ConsultRequestModal to create threads
- After a consult request is created, optionally launch a consultation thread linking the `consultRequestId`
- Add a "Start AI Thread" button on existing consult requests to open the thread view

### Files to change

| Action | File |
|--------|------|
| Edit | `src/components/virtualis/PatientChartTabs.tsx` — add Consults tab |
| Edit | `src/components/virtualis/ConsultationThreadView.tsx` — add create-thread form when no threadId |
| Edit | `src/components/virtualis/ConsultRequestModal.tsx` — option to launch thread after request |

