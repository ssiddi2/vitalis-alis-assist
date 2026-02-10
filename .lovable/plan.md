
# Dynamic Order Creation & Signing Workflow

## Problem

Right now, the order workflow has several gaps:

1. **Tool calls aren't executed server-side** -- The edge function streams the AI response but never calls `executeTool()` (the function exists but is never invoked). Orders mentioned in chat don't actually appear in the Staged Orders panel.

2. **No real-time feedback** -- When ALIS stages an order, the sidebar doesn't update until a page refresh. There's no visual indication that an order is being created.

3. **No signing step** -- Orders go from "staged" to "approved" with a single click. There's no confirmation or signature workflow.

---

## Plan

### 1. Execute tool calls server-side in the edge function

**File: `supabase/functions/alis-chat/index.ts`**

The `executeTool` function already exists but is never called. Update the streaming handler to:

- Collect tool calls from the streamed response (detect `finish_reason: "tool_calls"`)
- After the initial stream ends, execute each tool call via `executeTool()`
- Send tool results back to the AI as a second request for a follow-up response
- Stream that follow-up response back to the client
- Include a custom SSE event (e.g., `event: tool_result`) with the tool call result so the frontend can react immediately

### 2. Handle tool result events on the frontend

**File: `src/hooks/useALISChat.ts`**

Update the SSE parser to:

- Detect `event: tool_result` lines in the stream
- When a `stage_order` tool result arrives, call `onToolCall` with the result data
- This triggers the parent (Dashboard) to add the new order to the staged orders list in real-time

### 3. Wire up `onToolCall` in Dashboard to update staged orders live

**File: `src/pages/Dashboard.tsx`**

- Pass an `onToolCall` callback to `useALISChat`
- When `stage_order` is called, append the new order to `stagedOrders` state immediately
- Show a toast notification: "Order staged -- awaiting your signature"

### 4. Add an order signing confirmation modal

**File: `src/components/virtualis/OrderSignatureModal.tsx` (new)**

Create a lightweight confirmation dialog that appears when the clinician clicks "Approve" on a staged order:

- Shows order details (type, name, priority, rationale)
- Displays a "Sign & Send" button with the clinician's name
- Shows a brief animation/checkmark on successful signing
- Logs the signature action to the audit trail

### 5. Update StagedOrdersPanel to use the signing modal

**File: `src/components/virtualis/StagedOrdersPanel.tsx`**

- When "Approve" is clicked, open the `OrderSignatureModal` instead of immediately approving
- Add a subtle pulse/highlight animation when a new order appears in the list (so the clinician notices it was just staged)
- Show an "Order created by ALIS" badge on AI-generated orders

### 6. Enable realtime subscription for staged_orders

**File: `src/hooks/usePatientDetails.ts`**

- Add a Supabase realtime subscription on `staged_orders` filtered by `patient_id`
- On `INSERT`, add the new order to state
- On `UPDATE`, update the order status (staged -> approved -> sent)
- This ensures orders created server-side by the edge function appear instantly

---

## Workflow After Changes

```text
User types: "Order a CBC and BMP stat"
          |
          v
ALIS streams response + triggers stage_order tool call
          |
          v
Edge function executes tool --> inserts into staged_orders table
          |
          v
Realtime subscription fires --> new order appears in sidebar with pulse animation
          |
          v
ALIS confirms in chat: "Order Staged: CBC (STAT)"
          |
          v
Clinician clicks Approve --> Signature modal opens
          |
          v
Clinician clicks "Sign & Send" --> order status = approved, audit logged
          |
          v
Success animation + toast: "Order signed and sent to EMR"
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/alis-chat/index.ts` | Edit | Execute tool calls server-side, send tool_result SSE events |
| `src/hooks/useALISChat.ts` | Edit | Parse tool_result events, forward to onToolCall callback |
| `src/pages/Dashboard.tsx` | Edit | Wire onToolCall to update stagedOrders state |
| `src/components/virtualis/OrderSignatureModal.tsx` | New | Signing confirmation dialog with clinician name and audit logging |
| `src/components/virtualis/StagedOrdersPanel.tsx` | Edit | Integrate signing modal, add new-order animation, ALIS badge |
| `src/hooks/usePatientDetails.ts` | Edit | Add realtime subscription for staged_orders |

---

## Database Changes

**Migration: Enable realtime for staged_orders**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.staged_orders;
```

No schema changes needed -- the existing `staged_orders` table already has the correct structure and RLS policies.
